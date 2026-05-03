import html2canvas from "html2canvas";
import { HtmlToPDFError } from "./errors";
import { mergeOptions, resolveOptions } from "./options";
import { prepareSource, waitForRenderableAssets } from "./browser";
import { renderCanvasToPdf, type PdfDocument } from "./render";
import type {
  HtmlToPDFOptions,
  HtmlToPDFSource,
  HtmlToPDFWorker as HtmlToPDFWorkerContract,
  PdfOutput,
  PdfOutputType,
  ResolvedHtmlToPDFOptions
} from "./types";

export class HtmlToPDFWorker implements HtmlToPDFWorkerContract {
  private options: ResolvedHtmlToPDFOptions;
  private source?: HtmlToPDFSource;
  private canvasTask: Promise<HTMLCanvasElement> | undefined;
  private pdfTask: Promise<PdfDocument> | undefined;

  constructor(options: HtmlToPDFOptions = {}) {
    this.options = resolveOptions(options);
  }

  from(source: HtmlToPDFSource): this {
    this.source = source;
    this.invalidate();
    return this;
  }

  set(options: HtmlToPDFOptions): this {
    this.options = mergeOptions(this.options, options);
    this.invalidate();
    return this;
  }

  toCanvas(): Promise<HTMLCanvasElement> {
    this.canvasTask ??= this.createCanvas();
    return this.canvasTask;
  }

  async toPdf(): Promise<ArrayBuffer> {
    return this.output("arraybuffer");
  }

  async toBlob(): Promise<Blob> {
    return this.output("blob");
  }

  async toDataUri(): Promise<string> {
    return this.output("datauristring");
  }

  async output<TType extends PdfOutputType>(type: TType): Promise<PdfOutput<TType>> {
    const pdf = await this.getPdfDocument();

    if (type === "blob") {
      return pdf.output("blob") as PdfOutput<TType>;
    }

    if (type === "datauristring") {
      return pdf.output("datauristring") as PdfOutput<TType>;
    }

    return pdf.output("arraybuffer") as PdfOutput<TType>;
  }

  async save(filename = this.options.filename): Promise<void> {
    const blob = await this.toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  then<TResult1 = ArrayBuffer, TResult2 = never>(
    onfulfilled?: ((value: ArrayBuffer) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.toPdf().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
  ): Promise<ArrayBuffer | TResult> {
    return this.toPdf().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<ArrayBuffer> {
    return this.toPdf().finally(onfinally ?? undefined);
  }

  private async createCanvas(): Promise<HTMLCanvasElement> {
    if (!this.source) {
      throw new HtmlToPDFError("Call from(source) before rendering a PDF.");
    }

    const preparedSource = await prepareSource(this.source, this.options);

    try {
      await waitForRenderableAssets(preparedSource.element);
      return await html2canvas(preparedSource.element, this.options.html2canvas);
    } finally {
      preparedSource.cleanup();
    }
  }

  private getPdfDocument(): Promise<PdfDocument> {
    this.pdfTask ??= this.toCanvas().then((canvas) => renderCanvasToPdf(canvas, this.options));
    return this.pdfTask;
  }

  private invalidate(): void {
    this.canvasTask = undefined;
    this.pdfTask = undefined;
  }
}

export function htmlToPDF(options?: HtmlToPDFOptions): HtmlToPDFWorker {
  return new HtmlToPDFWorker(options);
}
