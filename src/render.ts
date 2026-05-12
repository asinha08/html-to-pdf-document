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
  const renderableCanvasHeight = getRenderableCanvasHeight(canvas, sliceHeight);
  const pageSlices = createPageSlices(canvas, sliceHeight, renderableCanvasHeight);
  const totalPages = pageSlices.length;
  const sliceCanvas = canvas.ownerDocument.createElement("canvas");
  const sliceContext = sliceCanvas.getContext("2d");

  if (!sliceContext) {
    throw new HtmlToPDFError("Unable to create a canvas context for PDF pagination.");
  }

  sliceCanvas.width = canvas.width;

  for (const [pageIndex, pageSlice] of pageSlices.entries()) {
    const { y, height: currentSliceHeight } = pageSlice;
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

interface PageSlice {
  y: number;
  height: number;
}

function createPageSlices(
  canvas: HTMLCanvasElement,
  sliceHeight: number,
  renderableCanvasHeight: number
): PageSlice[] {
  const pageSlices: PageSlice[] = [];
  let sliceStartY = 0;

  while (sliceStartY < renderableCanvasHeight) {
    const remainingHeight = renderableCanvasHeight - sliceStartY;

    if (remainingHeight <= sliceHeight) {
      pageSlices.push({ y: sliceStartY, height: remainingHeight });
      break;
    }

    const sliceEndY = findPageSliceEndY(
      canvas,
      sliceStartY,
      sliceHeight,
      renderableCanvasHeight
    );
    const currentSliceHeight = Math.max(1, sliceEndY - sliceStartY);

    pageSlices.push({ y: sliceStartY, height: currentSliceHeight });
    sliceStartY += currentSliceHeight;
  }

  return pageSlices;
}

function findPageSliceEndY(
  canvas: HTMLCanvasElement,
  sliceStartY: number,
  sliceHeight: number,
  renderableCanvasHeight: number
): number {
  const desiredEndY = Math.min(sliceStartY + sliceHeight, renderableCanvasHeight);

  if (desiredEndY >= renderableCanvasHeight) {
    return renderableCanvasHeight;
  }

  const minEndY = Math.max(sliceStartY + 1, sliceStartY + Math.floor(sliceHeight * 0.55));
  const searchBackHeight = Math.min(720, Math.max(160, Math.floor(sliceHeight * 0.3)));
  const searchStartY = Math.max(minEndY, desiredEndY - searchBackHeight);
  const bandHeight = Math.min(5, Math.max(2, Math.floor(sliceHeight * 0.002)));
  const blankBandEndY = findBlankBandEndY(canvas, searchStartY, desiredEndY, bandHeight);

  return blankBandEndY ?? desiredEndY;
}

function findBlankBandEndY(
  canvas: HTMLCanvasElement,
  searchStartY: number,
  searchEndY: number,
  bandHeight: number
): number | undefined {
  for (
    let bandStartY = searchEndY - bandHeight;
    bandStartY >= searchStartY;
    bandStartY -= 1
  ) {
    if (isCanvasRegionBlank(canvas, bandStartY, bandHeight)) {
      return bandStartY + Math.floor(bandHeight / 2);
    }
  }

  return undefined;
}

function getRenderableCanvasHeight(canvas: HTMLCanvasElement, sliceHeight: number): number {
  if (canvas.height <= sliceHeight) {
    return canvas.height;
  }

  const trailingSliceHeight = canvas.height % sliceHeight;

  if (trailingSliceHeight === 0) {
    return canvas.height;
  }

  const maxTrailingBlankSliceHeight = Math.max(1, Math.floor(sliceHeight * 0.2));

  if (trailingSliceHeight > maxTrailingBlankSliceHeight) {
    return canvas.height;
  }

  const trailingSliceStart = canvas.height - trailingSliceHeight;

  return isCanvasRegionBlank(canvas, trailingSliceStart, trailingSliceHeight)
    ? trailingSliceStart
    : canvas.height;
}

function isCanvasRegionBlank(
  canvas: HTMLCanvasElement,
  startY: number,
  height: number
): boolean {
  const context = canvas.getContext("2d");

  if (!context) {
    return false;
  }

  try {
    const data = context.getImageData(0, startY, canvas.width, height).data;

    if (data.length < 4) {
      return true;
    }

    const tolerance = 8;
    const stride = canvas.width * 4;

    // Compare each row to the first row so blank bands can include page backgrounds,
    // shadows, or margins that vary horizontally but not vertically.
    for (let row = 1; row < height; row += 1) {
      const rowOffset = row * stride;

      for (let columnOffset = 0; columnOffset < stride; columnOffset += 4) {
        if (hasPixelChanged(data, rowOffset + columnOffset, columnOffset, tolerance)) {
          return false;
        }
      }
    }

    return true;
  } catch {
    return false;
  }
}

function hasPixelChanged(
  data: Uint8ClampedArray,
  currentOffset: number,
  baselineOffset: number,
  tolerance: number
): boolean {
  return (
    Math.abs((data[currentOffset] ?? 0) - (data[baselineOffset] ?? 0)) > tolerance ||
    Math.abs((data[currentOffset + 1] ?? 0) - (data[baselineOffset + 1] ?? 0)) > tolerance ||
    Math.abs((data[currentOffset + 2] ?? 0) - (data[baselineOffset + 2] ?? 0)) > tolerance ||
    Math.abs((data[currentOffset + 3] ?? 0) - (data[baselineOffset + 3] ?? 0)) > tolerance
  );
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
