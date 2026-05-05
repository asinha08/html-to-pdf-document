import { describe, expect, it } from "vitest";
import { mergeOptions, normalizeMargin, resolveOptions } from "../src/options";

describe("normalizeMargin", () => {
  it("uses the same margin on every side for a number", () => {
    expect(normalizeMargin(12)).toEqual({
      top: 12,
      right: 12,
      bottom: 12,
      left: 12
    });
  });

  it("supports CSS-like two-value tuples", () => {
    expect(normalizeMargin([10, 20])).toEqual({
      top: 10,
      right: 20,
      bottom: 10,
      left: 20
    });
  });

  it("supports CSS-like four-value tuples", () => {
    expect(normalizeMargin([1, 2, 3, 4])).toEqual({
      top: 1,
      right: 2,
      bottom: 3,
      left: 4
    });
  });
});

describe("mergeOptions", () => {
  it("defaults the PDF content font family to Arial", () => {
    expect(resolveOptions().fontFamily).toBe("Arial");
  });

  it("defaults the page number translator to English page labels", () => {
    expect(resolveOptions().translatePageNumber(1, 3)).toBe("page 1 of 3");
  });

  it("deep merges nested option groups", () => {
    const translatePageNumber = (pageNumber: number, totalPages: number) =>
      `seite ${pageNumber} von ${totalPages}`;
    const current = resolveOptions({
      filename: "invoice.pdf",
      fontFamily: "Inter, sans-serif",
      translatePageNumber,
      image: {
        type: "png",
        quality: 1
      },
      page: {
        format: "letter",
        orientation: "portrait"
      }
    });

    const merged = mergeOptions(current, {
      image: {
        quality: 0.7
      },
      page: {
        orientation: "landscape"
      }
    });

    expect(merged).toMatchObject({
      filename: "invoice.pdf",
      fontFamily: "Inter, sans-serif",
      image: {
        type: "png",
        quality: 0.7
      },
      page: {
        format: "letter",
        orientation: "landscape"
      }
    });
    expect(merged.translatePageNumber(2, 4)).toBe("seite 2 von 4");
  });
});
