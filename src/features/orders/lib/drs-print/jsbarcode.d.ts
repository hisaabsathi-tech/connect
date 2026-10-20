// JsBarcode's encoders, which work without a DOM; the package only types its DOM renderer.
declare module "jsbarcode/bin/barcodes/CODE128" {
  export class CODE128 {
    constructor(data: string, options: Record<string, unknown>);
    valid(): boolean;
    /** Bars and spaces as "1" and "0", one module each. */
    encode(): { data: string; text: string };
  }
}
