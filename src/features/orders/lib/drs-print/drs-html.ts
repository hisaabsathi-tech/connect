import { code128Svg } from "./barcode";
import type { DrsPrintData, DrsPrintRow } from "./template-data";

// The web app's classic DRS template (`templates/drs/classic`), in PDF points on an A4 sheet.
export const A4 = { height: 842, width: 595 };
const PAGE_PADDING = 20;
const CONTENT_WIDTH = A4.width - PAGE_PADDING * 2;
const HEADER_HEIGHT = 166;
const LOGO_HEIGHT = 32;
const TABLE_HEADER_HEIGHT = 28;
const ROW_HEIGHT = 62;
const RULE = "0.55pt solid #000";
const COLUMN_WIDTHS = [24, 155, 135, 154, 87] as const;
const COLUMNS = ["#", "Center", "Doc No", "Customer", "Signature"];
export const ROWS_PER_PAGE = 8;

/** Fonts and the fallback logo as data URIs, so the page renders without the network. */
export type DrsPrintAssets = {
  fontRegular: string | null;
  fontMedium: string | null;
  /** The organisation's logo, or the Hisaab Sathi mark when it has none. */
  logo: string | null;
  /** Width ÷ height of the fallback mark; an uploaded logo keeps its own shape. */
  fallbackLogoRatio: number | null;
};

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const cell = (index: number, body = "") =>
  `<div class="cell" style="width:${COLUMN_WIDTHS[index]}pt">${body}</div>`;

function header(data: DrsPrintData, assets: DrsPrintAssets) {
  const logoWidth = assets.fallbackLogoRatio
    ? `width:${LOGO_HEIGHT * assets.fallbackLogoRatio}pt;`
    : `max-width:${LOGO_HEIGHT * 6}pt;`;
  const logo = assets.logo
    ? `<img class="logo" src="${assets.logo}" style="height:${LOGO_HEIGHT}pt;${logoWidth}"/>`
    : "";
  const address = data.branchAddress
    .map((line) => `<div style="font-size:10.5pt;line-height:1.28">${escape(line)}</div>`)
    .join("");
  return `<div class="header">
  <div style="width:285pt">
    ${logo}
    <div class="bold" style="font-size:12pt;margin-top:8pt">${escape(data.branchName)}</div>
    <div style="margin-top:7pt">${address}</div>
    <div style="font-size:10.5pt;margin-top:10pt">Delivery Boy: ${escape(data.deliveryBoy)}</div>
  </div>
  <div style="width:240pt;display:flex;flex-direction:column;align-items:flex-end">
    ${code128Svg(data.drsNumber, 175, 30)}
    <div style="font-size:10.5pt;margin-top:5pt">${escape(data.drsNumber)}</div>
    <div style="font-size:10.5pt;margin-top:9pt">${escape(`${data.date} | ${data.time}`)}</div>
  </div>
</div>`;
}

function row(item: DrsPrintRow, serial: number) {
  const remarks = item.remarks
    ? `<div style="font-size:8pt;line-height:1.25;margin-top:4pt">Remarks: ${escape(item.remarks)}</div>`
    : "";
  const mobile = item.customerMobile
    ? `<div style="font-size:9.5pt;margin-top:5pt">${escape(item.customerMobile)}</div>`
    : "";
  return `<div class="row">
  ${cell(0, `<div style="font-size:10.5pt">${serial}.</div>`)}
  ${cell(1, `<div style="font-size:10.5pt">${escape(item.center)}</div><div style="font-size:10pt;margin-top:6pt">${escape(item.serviceType)}</div>${remarks}`)}
  ${cell(2, `${code128Svg(item.documentNumber, 108, 24)}<div style="font-size:10.5pt;letter-spacing:1pt;margin-top:3pt">${escape(item.documentNumber)}</div>`)}
  ${cell(3, `<div class="medium" style="font-size:10.5pt;letter-spacing:1.1pt">${escape(item.customerName)}</div>${mobile}`)}
  ${cell(4)}
</div>`;
}

function fontFaces(assets: DrsPrintAssets) {
  const face = (source: string | null, weight: string) =>
    source
      ? `@font-face{font-family:"Satoshi";src:url("${source}") format("opentype");font-weight:${weight};}`
      : "";
  // Only Regular and Medium ship with the app; bold text uses Medium rather than a faked bold.
  return [
    face(assets.fontRegular, "400"),
    face(assets.fontMedium, "500"),
    face(assets.fontMedium, "700"),
  ].join("");
}

/**
 * The printable sheet: one A4 page per 8 orders, each with the branch header, the DRS barcode
 * and the table with a blank Signature column, numbered on across pages.
 */
export function drsHtml(data: DrsPrintData, assets: DrsPrintAssets) {
  const pages: DrsPrintRow[][] = [];
  for (let offset = 0; offset < data.rows.length; offset += ROWS_PER_PAGE)
    pages.push(data.rows.slice(offset, offset + ROWS_PER_PAGE));
  if (!pages.length) pages.push([]);

  const tableHeader = `<div class="table-header">${COLUMNS.map((label, index) => cell(index, `<div class="medium" style="font-size:10pt">${label}</div>`)).join("")}</div>`;
  const body = pages
    .map(
      (rows, pageIndex) => `<section class="page">
  ${header(data, assets)}
  ${tableHeader}
  ${rows.map((item, index) => row(item, pageIndex * ROWS_PER_PAGE + index + 1)).join("")}
  <div class="page-label">Page: ${pageIndex + 1}</div>
</section>`,
    )
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>DRS ${escape(data.drsNumber)}</title>
<style>
${fontFaces(assets)}
@page { size: ${A4.width}pt ${A4.height}pt; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #fff; }
body {
  color: #000;
  font-family: "Satoshi", ui-sans-serif, system-ui, sans-serif;
  font-size: 10pt;
  line-height: 1.25;
  -webkit-print-color-adjust: exact;
}
.page {
  width: ${A4.width}pt;
  height: ${A4.height}pt;
  padding: ${PAGE_PADDING}pt;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  page-break-after: always;
  break-after: page;
}
.page:last-child { page-break-after: auto; break-after: auto; }
.header { display: flex; justify-content: space-between; height: ${HEADER_HEIGHT}pt; width: ${CONTENT_WIDTH}pt; }
.logo { display: block; object-fit: contain; object-position: left center; }
.table-header { display: flex; align-items: center; height: ${TABLE_HEADER_HEIGHT}pt; border-bottom: ${RULE}; width: ${CONTENT_WIDTH}pt; }
.row { display: flex; flex-shrink: 0; min-height: ${ROW_HEIGHT}pt; padding: 8pt 0 3pt; border-bottom: ${RULE}; width: ${CONTENT_WIDTH}pt; }
.cell { padding: 0 7pt; min-width: 0; overflow-wrap: anywhere; }
.cell svg { display: block; }
.medium { font-weight: 500; }
.bold { font-weight: 700; }
.page-label { margin-top: auto; text-align: right; font-size: 8pt; line-height: 1.35; }
</style>
</head>
<body>${body}</body>
</html>`;
}
