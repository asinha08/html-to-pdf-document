import { HtmlToPDFError } from "./errors";
import type { HtmlToPDFSource, ResolvedHtmlToPDFOptions } from "./types";

export interface PreparedSource {
  element: HTMLElement;
  cleanup(): void;
}

export function assertBrowser(): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new HtmlToPDFError("html-to-pdf-document can only render inside a browser environment.");
  }
}

export async function prepareSource(
  source: HtmlToPDFSource,
  options: ResolvedHtmlToPDFOptions
): Promise<PreparedSource> {
  assertBrowser();

  if (typeof source === "string") {
    return prepareHtmlString(source, options);
  }

  if (isDocument(source)) {
    return {
      element: source.body ?? source.documentElement,
      cleanup: noop
    };
  }

  return {
    element: source,
    cleanup: noop
  };
}

export async function waitForRenderableAssets(element: HTMLElement): Promise<void> {
  const ownerDocument = element.ownerDocument;
  const documentWithFonts = ownerDocument as Document & {
    fonts?: {
      ready?: Promise<unknown>;
    };
  };

  await documentWithFonts.fonts?.ready?.catch(noop);
  await waitForImages(element);
}

async function prepareHtmlString(
  html: string,
  options: ResolvedHtmlToPDFOptions
): Promise<PreparedSource> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.top = "0";
  iframe.style.left = "-100000px";
  iframe.style.width = `${options.html.width}px`;
  iframe.style.height = `${options.html.height}px`;
  iframe.style.border = "0";
  iframe.style.pointerEvents = "none";

  document.body.appendChild(iframe);

  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new HtmlToPDFError("Timed out while preparing the HTML string source."));
    }, 15000);

    iframe.addEventListener(
      "load",
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true }
    );

    iframe.srcdoc = html;
  });

  const iframeDocument = iframe.contentDocument;

  if (!iframeDocument?.body) {
    iframe.remove();
    throw new HtmlToPDFError("Unable to create a document from the provided HTML string.");
  }

  const width = Math.max(
    options.html.width,
    iframeDocument.documentElement.scrollWidth,
    iframeDocument.body.scrollWidth
  );
  const height = Math.max(
    options.html.height,
    iframeDocument.documentElement.scrollHeight,
    iframeDocument.body.scrollHeight
  );

  iframe.style.width = `${width}px`;
  iframe.style.height = `${height}px`;

  return {
    element: iframeDocument.body,
    cleanup: () => iframe.remove()
  };
}

function isDocument(value: HtmlToPDFSource): value is Document {
  return typeof Document !== "undefined" && value instanceof Document;
}

function waitForImages(element: HTMLElement): Promise<void> {
  const images = Array.from(element.querySelectorAll("img"));

  return Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }

          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        })
    )
  ).then(() => undefined);
}

function noop(): void {
  // Intentionally empty.
}
