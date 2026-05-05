import type html2canvas from "html2canvas";

export type HtmlToPDFSource = HTMLElement | Document | string;

export type StandardPdfFormat =
  | "a0"
  | "a1"
  | "a2"
  | "a3"
  | "a4"
  | "a5"
  | "a6"
  | "a7"
  | "a8"
  | "a9"
  | "a10"
  | "b0"
  | "b1"
  | "b2"
  | "b3"
  | "b4"
  | "b5"
  | "b6"
  | "b7"
  | "b8"
  | "b9"
  | "b10"
  | "c0"
  | "c1"
  | "c2"
  | "c3"
  | "c4"
  | "c5"
  | "c6"
  | "c7"
  | "c8"
  | "c9"
  | "c10"
  | "dl"
  | "letter"
  | "government-letter"
  | "legal"
  | "junior-legal"
  | "ledger"
  | "tabloid"
  | "credit-card";

export type PdfFormat = StandardPdfFormat | [number, number] | (string & {});
export type PdfOrientation = "portrait" | "landscape" | "p" | "l";
export type PdfUnit = "pt" | "mm" | "cm" | "in" | "px";
export type ImageType = "jpeg" | "png" | "webp";
export type MarginTuple = [number, number] | [number, number, number, number];

export type MarginInput =
  | number
  | MarginTuple
  | Partial<Record<"top" | "right" | "bottom" | "left", number>>;

export type Html2CanvasOptions = NonNullable<Parameters<typeof html2canvas>[1]>;
export type PageNumberTranslator = (pageNumber: number, totalPages: number) => string;

export interface NormalizedMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PdfPageOptions {
  format?: PdfFormat;
  orientation?: PdfOrientation;
  unit?: PdfUnit;
  compress?: boolean;
  putOnlyUsedFonts?: boolean;
  precision?: number;
}

export interface PdfImageOptions {
  type?: ImageType;
  quality?: number;
}

export interface HtmlStringOptions {
  width?: number;
  height?: number;
}

export interface HtmlToPDFOptions {
  filename?: string;
  fontFamily?: string;
  margin?: MarginInput;
  page?: PdfPageOptions;
  image?: PdfImageOptions;
  html?: HtmlStringOptions;
  html2canvas?: Partial<Html2CanvasOptions>;
  translatePageNumber?: PageNumberTranslator;
}

export interface ResolvedPdfPageOptions {
  format: PdfFormat;
  orientation: PdfOrientation;
  unit: PdfUnit;
  compress: boolean;
  putOnlyUsedFonts: boolean;
  precision: number;
}

export interface ResolvedPdfImageOptions {
  type: ImageType;
  quality: number;
}

export interface ResolvedHtmlStringOptions {
  width: number;
  height: number;
}

export interface ResolvedHtmlToPDFOptions {
  filename: string;
  fontFamily: string;
  margin: NormalizedMargin;
  page: ResolvedPdfPageOptions;
  image: ResolvedPdfImageOptions;
  html: ResolvedHtmlStringOptions;
  html2canvas: Partial<Html2CanvasOptions>;
  translatePageNumber: PageNumberTranslator;
}

export type PdfOutputType = "arraybuffer" | "blob" | "datauristring";

export type PdfOutput<TType extends PdfOutputType> = TType extends "blob"
  ? Blob
  : TType extends "datauristring"
    ? string
    : ArrayBuffer;

export interface HtmlToPDFWorker extends PromiseLike<ArrayBuffer> {
  from(source: HtmlToPDFSource): this;
  set(options: HtmlToPDFOptions): this;
  toCanvas(): Promise<HTMLCanvasElement>;
  toPdf(): Promise<ArrayBuffer>;
  toBlob(): Promise<Blob>;
  toDataUri(): Promise<string>;
  output<TType extends PdfOutputType>(type: TType): Promise<PdfOutput<TType>>;
  save(filename?: string): Promise<void>;
}
