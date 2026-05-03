import type {
  HtmlToPDFOptions,
  MarginInput,
  NormalizedMargin,
  ResolvedHtmlToPDFOptions
} from "./types";

const DEFAULT_MARGIN = 36;

export function normalizeMargin(margin: MarginInput = DEFAULT_MARGIN): NormalizedMargin {
  if (typeof margin === "number") {
    return {
      top: margin,
      right: margin,
      bottom: margin,
      left: margin
    };
  }

  if (Array.isArray(margin)) {
    if (margin.length === 2) {
      const [vertical, horizontal] = margin;
      return {
        top: vertical,
        right: horizontal,
        bottom: vertical,
        left: horizontal
      };
    }

    const [top, right, bottom, left] = margin;
    return { top, right, bottom, left };
  }

  return {
    top: margin.top ?? DEFAULT_MARGIN,
    right: margin.right ?? DEFAULT_MARGIN,
    bottom: margin.bottom ?? DEFAULT_MARGIN,
    left: margin.left ?? DEFAULT_MARGIN
  };
}

export function getCanvasScale(): number {
  const ratio = globalThis.devicePixelRatio;
  return typeof ratio === "number" && Number.isFinite(ratio) ? Math.max(1, ratio) : 2;
}

export function resolveOptions(options: HtmlToPDFOptions = {}): ResolvedHtmlToPDFOptions {
  return {
    filename: options.filename ?? "document.pdf",
    margin: normalizeMargin(options.margin),
    page: {
      format: options.page?.format ?? "a4",
      orientation: options.page?.orientation ?? "portrait",
      unit: options.page?.unit ?? "pt",
      compress: options.page?.compress ?? true,
      putOnlyUsedFonts: options.page?.putOnlyUsedFonts ?? true,
      precision: options.page?.precision ?? 16
    },
    image: {
      type: options.image?.type ?? "jpeg",
      quality: options.image?.quality ?? 0.95
    },
    html: {
      width: options.html?.width ?? 794,
      height: options.html?.height ?? 1123
    },
    html2canvas: {
      backgroundColor: "#ffffff",
      useCORS: true,
      scale: getCanvasScale(),
      ...options.html2canvas
    }
  };
}

export function mergeOptions(
  current: ResolvedHtmlToPDFOptions,
  next: HtmlToPDFOptions
): ResolvedHtmlToPDFOptions {
  return {
    filename: next.filename ?? current.filename,
    margin: next.margin === undefined ? current.margin : normalizeMargin(next.margin),
    page: {
      ...current.page,
      ...next.page
    },
    image: {
      ...current.image,
      ...next.image
    },
    html: {
      ...current.html,
      ...next.html
    },
    html2canvas: {
      ...current.html2canvas,
      ...next.html2canvas
    }
  };
}
