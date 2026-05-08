# html-to-pdf-document

TypeScript-first browser library for converting HTML elements or HTML strings into downloadable PDF documents.

It exposes a small worker-style API:

```ts
import { htmlToPDF } from "html-to-pdf-document";

const content = document.getElementById("content-ashish");

if (content) {
  const pdf = await htmlToPDF().from(content).toPdf();

  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "document.pdf";
  link.click();
  URL.revokeObjectURL(url);
}
```

## Install

```sh
npm install html-to-pdf-document
```

`html2canvas` and `jspdf` are regular runtime dependencies, so npm installs them automatically when users install this package.

## Usage

### Download a PDF

```ts
import { htmlToPDF } from "html-to-pdf-document";

const content = document.getElementById("invoice");

if (content) {
  await htmlToPDF({ filename: "invoice.pdf" }).from(content).save();
}
```

### Return a Blob

```ts
const blob = await htmlToPDF()
  .from(document.getElementById("invoice")!)
  .toBlob();
```

### Render an HTML string

```ts
const html = `
  <!doctype html>
  <html>
    <body>
      <h1>Contract</h1>
      <p>Signed and sealed.</p>
    </body>
  </html>
`;

const pdf = await htmlToPDF({
  html: { width: 794, height: 1123 },
})
  .from(html)
  .toPdf();
```

### Configure output

```ts
const worker = htmlToPDF({
  fontFamily: "Inter, Arial, sans-serif",
  translatePageNumber: (pageNumber, totalPages) =>
    `page ${pageNumber} of ${totalPages}`,
  margin: [32, 40],
  page: {
    format: "a4",
    orientation: "portrait",
    unit: "pt",
  },
  image: {
    type: "jpeg",
    quality: 0.95,
  },
  html2canvas: {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
  },
});
```

### React component example

```ts
import { htmlToPDF } from "html-to-pdf-document";
import { useCallback, useId } from "react";

export default function GenerateAgreement() {
  const containerId = useId();
  const generatePDF = useCallback(async () => {
    const content = document.getElementById(containerId);
    if (content) {
      const pdf = await htmlToPDF().from(content.innerHTML).toPdf();
      const blob = new Blob([pdf], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "document.pdf";
      link.click();
      URL.revokeObjectURL(url);
    }
  }, [containerId]);

  return (
    <div>
      <button onClick={generatePDF}>
        Generate PDF
      </button>
      <div id={containerId}>
        <h1>Hello PDF</h1>
        <p>This will be converted to PDF.</p>
      </div>
    </div>
  );
}

```

## API

```ts
htmlToPDF(options?: HtmlToPDFOptions): HtmlToPDFWorker
```

`HtmlToPDFWorker` supports:

- `from(source)` accepts an `HTMLElement`, `Document`, or HTML string.
- `set(options)` merges new options into the worker.
- `toCanvas()` returns the rendered `HTMLCanvasElement`.
- `toPdf()` returns an `ArrayBuffer`.
- `toBlob()` returns a `Blob`.
- `toDataUri()` returns a PDF data URI string.
- `output("arraybuffer" | "blob" | "datauristring")` returns a typed PDF output.
- `save(filename?)` downloads the PDF.

`fontFamily` defaults to `Arial` and is applied to the cloned content before rendering, so the live page is not mutated.

### Page Numbers And Translation

By default, each generated PDF page gets a bottom-right footer label in the `page 1 of 1` format. Customize it with `translatePageNumber`:

```ts
const pdf = await htmlToPDF({
  translatePageNumber: (pageNumber, totalPages) =>
    `page ${pageNumber} of ${totalPages}`,
})
  .from(content)
  .toPdf();
```

For translated labels, return the localized text from `translatePageNumber`:

```ts
const pdf = await htmlToPDF({
  fontFamily: "Noto Sans Devanagari, Arial, sans-serif",
  translatePageNumber: (pageNumber, totalPages) =>
    `पृष्ठ ${pageNumber} का ${totalPages}`,
})
  .from(content)
  .toPdf();
```

The page-number footer is rendered through a browser canvas before being added to the PDF. This avoids garbled output from `jsPDF` built-in fonts and preserves translated labels visually, including Hindi and other non-Latin scripts. Make sure the browser can load a font that supports the target script. Return an empty string from `translatePageNumber` to skip the footer text.

## Notes

This is a client-side renderer. It captures the DOM with `html2canvas` and places the resulting image into a paginated `jsPDF` document. That keeps the API simple and works well for invoices, receipts, dashboards, and browser-generated reports.

For pixel-perfect CSS print fidelity, server-side Headless Chrome rendering is still the stronger architecture. [Doppio documents that approach](https://doc.doppio.sh/) as a managed API built around Headless Chrome rendering.
