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
  it("deep merges nested option groups", () => {
    const current = resolveOptions({
      filename: "invoice.pdf",
      image: {
        type: "png",
        quality: 1
      },
      page: {
        format: "letter",
        orientation: "portrait"
      }
    });

    expect(
      mergeOptions(current, {
        image: {
          quality: 0.7
        },
        page: {
          orientation: "landscape"
        }
      })
    ).toMatchObject({
      filename: "invoice.pdf",
      image: {
        type: "png",
        quality: 0.7
      },
      page: {
        format: "letter",
        orientation: "landscape"
      }
    });
  });
});
