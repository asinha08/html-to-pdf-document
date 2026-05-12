import html2canvas from "html2canvas";
import { HtmlToPDFError } from "./errors";
import { mergeOptions, resolveOptions } from "./options";
import { prepareSource, waitForRenderableAssets } from "./browser";
import { renderCanvasToPdf, type PdfDocument } from "./render";
import type {
  HtmlToPDFOptions,
  HtmlToPDFSource,
  HtmlToPDFWorker as HtmlToPDFWorkerContract,
  Html2CanvasOptions,
  PdfOutput,
  PdfOutputType,
  ResolvedHtmlToPDFOptions
} from "./types";

const CAPTURE_BOTTOM_BUFFER_PX = 96;
const LIST_MARKER_ATTRIBUTE = "data-html-to-pdf-list-marker";

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
      return await html2canvas(
        preparedSource.element,
        this.createHtml2CanvasOptions(preparedSource.element)
      );
    } finally {
      preparedSource.cleanup();
    }
  }

  private createHtml2CanvasOptions(element: HTMLElement): Partial<Html2CanvasOptions> {
    const html2canvasOptions = this.options.html2canvas;
    const userOnclone = html2canvasOptions.onclone;
    const captureDimensions = getCaptureDimensions(element);

    return {
      ...html2canvasOptions,
      width: html2canvasOptions.width ?? captureDimensions.width,
      height: html2canvasOptions.height ?? captureDimensions.height,
      windowWidth: html2canvasOptions.windowWidth ?? captureDimensions.windowWidth,
      windowHeight: html2canvasOptions.windowHeight ?? captureDimensions.windowHeight,
      onclone: (clonedDocument, clonedElement) => {
        clonedElement.style.fontFamily = this.options.fontFamily;
        addCaptureBottomBuffer(clonedElement);
        userOnclone?.(clonedDocument, clonedElement);
        materializeOrderedListMarkers(clonedDocument, clonedElement);
      }
    };
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

interface CaptureDimensions {
  width: number;
  height: number;
  windowWidth: number;
  windowHeight: number;
}

function getCaptureDimensions(element: HTMLElement): CaptureDimensions {
  const ownerDocument = element.ownerDocument;
  const documentElement = ownerDocument.documentElement;
  const body = ownerDocument.body;
  const rect = element.getBoundingClientRect();
  const includeDocumentDimensions = element === body || element === documentElement;
  const widthCandidates = [element.scrollWidth, element.offsetWidth, element.clientWidth, rect.width, 1];
  const heightCandidates = [element.scrollHeight, element.offsetHeight, element.clientHeight, rect.height, 1];

  if (includeDocumentDimensions) {
    widthCandidates.push(
      documentElement.scrollWidth,
      documentElement.offsetWidth,
      documentElement.clientWidth,
      body?.scrollWidth ?? 0,
      body?.offsetWidth ?? 0,
      body?.clientWidth ?? 0
    );
    heightCandidates.push(
      documentElement.scrollHeight,
      documentElement.offsetHeight,
      documentElement.clientHeight,
      body?.scrollHeight ?? 0,
      body?.offsetHeight ?? 0,
      body?.clientHeight ?? 0
    );
  }

  const width = Math.ceil(Math.max(...widthCandidates));
  const height = Math.ceil(Math.max(...heightCandidates)) + CAPTURE_BOTTOM_BUFFER_PX;

  return {
    width,
    height,
    windowWidth: Math.max(width, ownerDocument.defaultView?.innerWidth ?? 0),
    windowHeight: Math.max(height, ownerDocument.defaultView?.innerHeight ?? 0)
  };
}

function addCaptureBottomBuffer(element: HTMLElement): void {
  const computedPaddingBottom = element.ownerDocument.defaultView
    ?.getComputedStyle(element)
    .getPropertyValue("padding-bottom");
  const currentPaddingBottom = Number.parseFloat(
    computedPaddingBottom || element.style.paddingBottom || "0"
  );
  const paddingBottom = Number.isFinite(currentPaddingBottom) ? currentPaddingBottom : 0;

  element.style.paddingBottom = `${paddingBottom + CAPTURE_BOTTOM_BUFFER_PX}px`;
}

function materializeOrderedListMarkers(ownerDocument: Document, root: HTMLElement): void {
  const orderedLists = getOrderedLists(root);

  for (const list of orderedLists) {
    const listStyleType = getListStyleType(list);

    if (!shouldMaterializeOrderedList(list, listStyleType)) {
      continue;
    }

    const items = getDirectListItems(list);
    let nextValue = getOrderedListStart(list, items.length);

    list.style.listStyleType = "none";

    for (const item of items) {
      const itemValue = parseInteger(item.getAttribute("value")) ?? nextValue;
      nextValue = list.hasAttribute("reversed") ? itemValue - 1 : itemValue + 1;

      if (item.querySelector(`:scope > [${LIST_MARKER_ATTRIBUTE}]`)) {
        continue;
      }

      const marker = ownerDocument.createElement("span");
      marker.setAttribute(LIST_MARKER_ATTRIBUTE, "true");
      marker.textContent = formatOrderedListMarker(
        itemValue,
        getOrderedListStyle(list, item, listStyleType)
      );
      marker.style.fontFamily = "inherit";
      marker.style.fontSize = "inherit";
      marker.style.fontStyle = "inherit";
      marker.style.fontWeight = "inherit";
      marker.style.lineHeight = "inherit";
      marker.style.color = "inherit";
      marker.style.whiteSpace = "pre";
      marker.style.marginRight = "0.35em";

      item.style.listStyleType = "none";
      item.insertBefore(marker, item.firstChild);
    }
  }
}

function getOrderedLists(root: HTMLElement): HTMLOListElement[] {
  const orderedLists = Array.from(root.querySelectorAll("ol")).filter(isOrderedListElement);

  if (isOrderedListElement(root)) {
    orderedLists.unshift(root);
  }

  return orderedLists;
}

function getDirectListItems(list: HTMLOListElement): HTMLLIElement[] {
  return Array.from(list.children).filter(isListItemElement);
}

function isOrderedListElement(element: Element): element is HTMLOListElement {
  return element.tagName.toLowerCase() === "ol";
}

function isListItemElement(element: Element): element is HTMLLIElement {
  return element.tagName.toLowerCase() === "li";
}

function getListStyleType(list: HTMLOListElement): string {
  return (
    list.ownerDocument.defaultView?.getComputedStyle(list).listStyleType ||
    list.style.listStyleType ||
    ""
  ).toLowerCase();
}

function shouldMaterializeOrderedList(list: HTMLOListElement, listStyleType: string): boolean {
  const inlineStyle = list.getAttribute("style") ?? "";

  return (
    listStyleType !== "none" ||
    /list-style\s*:\s*auto/i.test(inlineStyle) ||
    /list-style-type\s*:\s*auto/i.test(inlineStyle)
  );
}

function getOrderedListStart(list: HTMLOListElement, itemCount: number): number {
  const start = parseInteger(list.getAttribute("start"));

  if (start !== undefined) {
    return start;
  }

  return list.hasAttribute("reversed") ? itemCount : 1;
}

function getOrderedListStyle(
  list: HTMLOListElement,
  item: HTMLLIElement,
  listStyleType: string
): string {
  const type = item.getAttribute("type") ?? list.getAttribute("type");

  if (type === "A") {
    return "upper-alpha";
  }

  if (type === "a") {
    return "lower-alpha";
  }

  if (type === "I") {
    return "upper-roman";
  }

  if (type === "i") {
    return "lower-roman";
  }

  if (listStyleType === "auto") {
    return "decimal";
  }

  return listStyleType || "decimal";
}

function formatOrderedListMarker(value: number, listStyleType: string): string {
  switch (listStyleType) {
    case "decimal-leading-zero":
      return `${value.toString().padStart(2, "0")}.`;
    case "lower-alpha":
    case "lower-latin":
      return `${formatAlpha(value).toLowerCase()}.`;
    case "upper-alpha":
    case "upper-latin":
      return `${formatAlpha(value)}.`;
    case "lower-roman":
      return `${formatRoman(value).toLowerCase()}.`;
    case "upper-roman":
      return `${formatRoman(value)}.`;
    default:
      return `${value}.`;
  }
}

function formatAlpha(value: number): string {
  if (value <= 0) {
    return value.toString();
  }

  let remaining = value;
  let label = "";

  while (remaining > 0) {
    remaining -= 1;
    label = String.fromCharCode(65 + (remaining % 26)) + label;
    remaining = Math.floor(remaining / 26);
  }

  return label;
}

function formatRoman(value: number): string {
  if (value <= 0 || value >= 4000) {
    return value.toString();
  }

  const numerals: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"]
  ];
  let remaining = value;
  let label = "";

  for (const [amount, numeral] of numerals) {
    while (remaining >= amount) {
      label += numeral;
      remaining -= amount;
    }
  }

  return label;
}

function parseInteger(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
export function htmlToPDF(options?: HtmlToPDFOptions): HtmlToPDFWorker {
  return new HtmlToPDFWorker(options);
}
