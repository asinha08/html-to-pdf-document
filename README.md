# html-to-pdf-document

TypeScript-first browser library for converting HTML elements or HTML strings into downloadable PDF documents.

It exposes a small worker-style API:

```ts
import { htmlToPDF } from "html-to-pdf-document";

const content = document.getElementById("content-ashish");

if (content) {
  const pdf = await htmlToPDF()
    .from(content)
    .toPdf();

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
  await htmlToPDF({ filename: "invoice.pdf" })
    .from(content)
    .save();
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
  html: { width: 794, height: 1123 }
})
  .from(html)
  .toPdf();
```

### Configure output

```ts
const worker = htmlToPDF({
  margin: [32, 40],
  page: {
    format: "a4",
    orientation: "portrait",
    unit: "pt"
  },
  image: {
    type: "jpeg",
    quality: 0.95
  },
  html2canvas: {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff"
  }
});
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

## Notes

This is a client-side renderer. It captures the DOM with `html2canvas` and places the resulting image into a paginated `jsPDF` document. That keeps the API simple and works well for invoices, receipts, dashboards, and browser-generated reports.

For pixel-perfect CSS print fidelity, server-side Headless Chrome rendering is still the stronger architecture. [Doppio documents that approach](https://doc.doppio.sh/) as a managed API built around Headless Chrome rendering.
