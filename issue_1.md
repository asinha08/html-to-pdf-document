# Code Review: Bugs and Improvements

Here is a review of the `html-to-pdf` codebase, detailing identified bugs, edge cases, and suggested code improvements.

## 🐛 Bugs & Critical Issues

### 1. DOM Leak on Timeout in `prepareHtmlString`
In `src/browser.ts`, when generating a PDF from an HTML string, a hidden `iframe` is appended to the document body. If the `load` event times out after 15 seconds, the Promise rejects, but the `iframe` is never removed from the DOM.
**Location:** `src/browser.ts` (lines ~66-81)
**Fix:** Remove the iframe from the DOM when the timeout triggers before rejecting the promise.
```typescript
    const timer = window.setTimeout(() => {
      iframe.remove(); // Add this line
      reject(new HtmlToPDFError("Timed out while preparing the HTML string source."));
    }, 15000);
```

### 2. Margin Values Ignore PDF Units
In `src/render.ts`, the margins are directly subtracted from the page width/height without unit conversion. The default margin is `36` (presumably `pt`), but users can change `options.page.unit` to `"in"`, `"mm"`, or `"cm"`. If a user sets `unit: "in"`, a margin of `36` would mean 36 inches, which instantly results in a negative printable area and throws `"Margins leave no printable area on the PDF page."`
**Location:** `src/render.ts` (lines ~26-31)
**Fix:** Make margins unit-aware, or set the default margin to `0` when a non-`pt` unit is specified. Alternatively, convert the numeric margin values to match the target page unit before subtracting them from `pageWidth` and `pageHeight`.

### 3. Cached Promise Rejections in `HtmlToPDFWorker`
The `worker.ts` file caches the promises for canvas and PDF generation (`this.canvasTask` and `this.pdfTask`). If `html2canvas` throws an error or the PDF generation fails, the rejected promise remains cached. Any subsequent calls to `.toPdf()` or `.toBlob()` will immediately re-throw the same error without attempting to re-render.
**Location:** `src/worker.ts` (lines ~37-40, ~114-117)
**Fix:** Catch errors and clear the cache if the promise rejects, so that the worker can try again if called later.
```typescript
  toCanvas(): Promise<HTMLCanvasElement> {
    if (!this.canvasTask) {
      this.canvasTask = this.createCanvas().catch(err => {
        this.canvasTask = undefined;
        throw err;
      });
    }
    return this.canvasTask;
  }
```

### 4. Premature `URL.revokeObjectURL` in `save()`
In `src/worker.ts`, `URL.revokeObjectURL(url)` is called synchronously right after `link.click()`. In some browsers (especially older ones or certain mobile browsers), this can abort the download process or result in an empty file being downloaded because the object URL is destroyed before the browser's download manager actually accesses it.
**Location:** `src/worker.ts` (line ~79)
**Fix:** Delay the revocation using `setTimeout` or `requestAnimationFrame`.
```typescript
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
```

---

## 🛠️ Code Improvements & Refactoring

### 1. Hardcoded Timeout in `prepareHtmlString`
The `15000ms` timeout in `prepareHtmlString` is hardcoded. For very large HTML strings or slow network conditions (if the HTML contains external resources), 15 seconds might not be enough.
**Improvement:** Expose a `timeout` option in `HtmlStringOptions` so users can configure or disable the iframe load timeout.

### 2. Incomplete Image Waiting Logic
The `waitForImages` function only looks for `<img>` tags. It doesn't account for images loaded via `<picture>` tags with `<source>`, or CSS `background-image`s. While `html2canvas` has its own internal mechanisms for loading resources, relying strictly on `img.complete` might lead to premature rendering.
**Improvement:** If pre-loading is strictly necessary, consider detecting CSS background images and `<picture>` sources, or rely entirely on `html2canvas`'s `useCORS` and built-in image loader.

### 3. Default Values for Partial Margins
In `src/options.ts`, if a user provides a partial margin object like `{ top: 10 }`, the `normalizeMargin` function fills in the missing sides with `DEFAULT_MARGIN` (36). Usually, users expect unspecified margins in a partial object to default to `0`, not the global default.
**Improvement:** Change the logic to fall back to `0` for missing explicit sides when an object is provided, or document this behavior clearly.
```typescript
  return {
    top: margin.top ?? 0,
    right: margin.right ?? 0,
    bottom: margin.bottom ?? 0,
    left: margin.left ?? 0
  };
```

### 4. Improve HTML Iframe Dimensions Calculation
When measuring the iframe document dimensions in `prepareHtmlString` (`scrollWidth` and `scrollHeight`), depending on CSS, elements might overflow or collapse in ways that aren't perfectly captured by `body.scrollWidth`.
**Improvement:** Adding a small `requestAnimationFrame` delay or `setTimeout(..., 0)` after the `load` event before measuring `scrollWidth`/`scrollHeight` can sometimes yield more accurate dimensions as it allows the browser a render cycle to apply complex CSS layouts.
