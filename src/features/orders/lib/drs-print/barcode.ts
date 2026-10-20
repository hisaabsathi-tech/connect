import { CODE128 } from "jsbarcode/bin/barcodes/CODE128";

/**
 * A CODE128 barcode as an inline SVG string, drawn with the same encoder the web template uses
 * (JsBarcode), stretched to the box like its `fit="fill"` image. Empty for a value it can't encode.
 */
export function code128Svg(value: string, width: number, height: number): string {
  if (!value.trim()) return "";
  const barcode = new CODE128(value, {});
  if (!barcode.valid()) return "";
  const { data } = barcode.encode();
  let bars = "";
  for (let start = 0; start < data.length; ) {
    if (data[start] !== "1") {
      start += 1;
      continue;
    }
    let end = start;
    while (data[end] === "1") end += 1;
    bars += `<rect x="${start}" y="0" width="${end - start}" height="1"/>`;
    start = end;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}pt" height="${height}pt" viewBox="0 0 ${data.length} 1" preserveAspectRatio="none" shape-rendering="crispEdges"><rect width="${data.length}" height="1" fill="#fff"/><g fill="#000">${bars}</g></svg>`;
}
