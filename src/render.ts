import { jsPDF } from "jspdf";
import { HtmlToPDFError } from "./errors";
import type { ImageType, ResolvedHtmlToPDFOptions } from "./types";

export type PdfDocument = InstanceType<typeof jsPDF>;

export function renderCanvasToPdf(
  canvas: HTMLCanvasElement,
  options: ResolvedHtmlToPDFOptions
): PdfDocument {
  if (canvas.width <= 0 || canvas.height <= 0) {
    throw new HtmlToPDFError("Cannot create a PDF from an empty canvas.");
  }

  const pdf = new jsPDF({
    orientation: options.page.orientation,
    unit: options.page.unit,
    format: options.page.format,
    compress: options.page.compress,
    putOnlyUsedFonts: options.page.putOnlyUsedFonts,
    precision: options.page.precision
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const printableWidth = pageWidth - options.margin.left - options.margin.right;
  const printableHeight = pageHeight - options.margin.top - options.margin.bottom;

  if (printableWidth <= 0 || printableHeight <= 0) {
    throw new HtmlToPDFError("Margins leave no printable area on the PDF page.");
  }

  const sliceHeight = Math.max(1, Math.floor((printableHeight / printableWidth) * canvas.width));
  const totalPages = Math.ceil(canvas.height / sliceHeight);
  const sliceCanvas = canvas.ownerDocument.createElement("canvas");
  const sliceContext = sliceCanvas.getContext("2d");

  if (!sliceContext) {
    throw new HtmlToPDFError("Unable to create a canvas context for PDF pagination.");
  }

  sliceCanvas.width = canvas.width;

  for (let y = 0, pageIndex = 0; y < canvas.height; y += sliceHeight, pageIndex += 1) {
    const currentSliceHeight = Math.min(sliceHeight, canvas.height - y);
    sliceCanvas.height = currentSliceHeight;
    sliceContext.clearRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    sliceContext.drawImage(
      canvas,
      0,
      y,
      canvas.width,
      currentSliceHeight,
      0,
      0,
      canvas.width,
      currentSliceHeight
    );

    if (pageIndex > 0) {
      pdf.addPage();
    }

    const imageData = sliceCanvas.toDataURL(toMimeType(options.image.type), options.image.quality);
    const renderedHeight = (currentSliceHeight / canvas.width) * printableWidth;

    pdf.addImage(
      imageData,
      toJsPdfImageType(options.image.type),
      options.margin.left,
      options.margin.top,
      printableWidth,
      renderedHeight,
      undefined,
      "FAST"
    );

    addPageNumber(pdf, pageIndex + 1, totalPages, options);
  }

  return pdf;
}

function addPageNumber(
  pdf: PdfDocument,
  pageNumber: number,
  totalPages: number,
  options: ResolvedHtmlToPDFOptions
): void {
  const label = options.translatePageNumber(pageNumber, totalPages);

  if (!label) {
    return;
  }

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const footerY = pageHeight - (options.margin.bottom > 0 ? options.margin.bottom / 2 : 12);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(90);
  pdf.text(label, pageWidth / 2, footerY, { align: "center" });
}

function toMimeType(type: ImageType): string {
  return `image/${type}`;
}

function toJsPdfImageType(type: ImageType): "JPEG" | "PNG" | "WEBP" {
  if (type === "jpeg") {
    return "JPEG";
  }

  return type.toUpperCase() as "PNG" | "WEBP";
}
