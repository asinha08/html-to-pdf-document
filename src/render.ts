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

    addPageNumber(pdf, pageIndex + 1, totalPages, options, canvas.ownerDocument);
  }

  return pdf;
}

function addPageNumber(
  pdf: PdfDocument,
  pageNumber: number,
  totalPages: number,
  options: ResolvedHtmlToPDFOptions,
  ownerDocument: Document
): void {
  const label = options.translatePageNumber(pageNumber, totalPages);

  if (!label) {
    return;
  }

  const pageNumberImage = createPageNumberImage(ownerDocument, label, options.fontFamily);

  if (!pageNumberImage) {
    return;
  }

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const footerRight = pageWidth - options.margin.right;
  const footerCenterY = pageHeight - (options.margin.bottom > 0 ? options.margin.bottom / 2 : 12);
  const imageWidth = pointsToPdfUnit(pdf, cssPixelsToPoints(pageNumberImage.width));
  const imageHeight = pointsToPdfUnit(pdf, cssPixelsToPoints(pageNumberImage.height));

  pdf.addImage(
    pageNumberImage.dataUrl,
    "PNG",
    footerRight - imageWidth,
    footerCenterY - imageHeight / 2,
    imageWidth,
    imageHeight
  );
}

interface PageNumberImage {
  dataUrl: string;
  width: number;
  height: number;
}

function createPageNumberImage(
  ownerDocument: Document,
  label: string,
  fontFamily: string
): PageNumberImage | undefined {
  const fontSize = 10;
  const verticalPadding = 3;
  const horizontalPadding = 4;
  const scale = 2;
  const pageNumberCanvas = ownerDocument.createElement("canvas");
  const context = pageNumberCanvas.getContext("2d");

  if (!context) {
    return undefined;
  }

  context.font = toCanvasFont(fontSize, fontFamily);

  const textMetrics = context.measureText(label);
  const cssWidth = Math.ceil(textMetrics.width + horizontalPadding * 2);
  const cssHeight = Math.ceil(fontSize * 1.5 + verticalPadding * 2);

  pageNumberCanvas.width = cssWidth * scale;
  pageNumberCanvas.height = cssHeight * scale;
  context.scale(scale, scale);
  context.clearRect(0, 0, cssWidth, cssHeight);
  context.font = toCanvasFont(fontSize, fontFamily);
  context.fillStyle = "rgb(90, 90, 90)";
  context.textAlign = "right";
  context.textBaseline = "middle";
  context.fillText(label, cssWidth - horizontalPadding, cssHeight / 2);

  return {
    dataUrl: pageNumberCanvas.toDataURL("image/png"),
    width: cssWidth,
    height: cssHeight
  };
}

function toCanvasFont(fontSize: number, fontFamily: string): string {
  return `${fontSize}pt ${fontFamily}`;
}

function cssPixelsToPoints(value: number): number {
  return value * 0.75;
}

function pointsToPdfUnit(pdf: PdfDocument, value: number): number {
  return value / pdf.internal.scaleFactor;
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
