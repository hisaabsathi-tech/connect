/**
 * A one-sheet Excel workbook (.xlsx) of plain text cells, written by hand: the web app's
 * `write-xlsx`, as an uncompressed ZIP of the few SpreadsheetML parts Excel needs. No library,
 * so it works the same in debug and release builds.
 */

export const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const CRC_TABLE = new Uint32Array(256);

for (let index = 0; index < CRC_TABLE.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  CRC_TABLE[index] = value >>> 0;
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function dosDateTime(date: Date) {
  const year = Math.max(date.getFullYear(), 1980);
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      (Math.floor(date.getSeconds() / 2) & 0x1f),
  };
}

/** Text safe inside XML, without the control characters Excel refuses to open. */
function xmlText(value: string) {
  let cleaned = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (!(code <= 0x08 || code === 0x0b || code === 0x0c || (code >= 0x0e && code <= 0x1f)))
      cleaned += char;
  }
  return cleaned.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** 0 → "A", 26 → "AA". */
function columnName(index: number) {
  let current = index + 1;
  let name = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

function sheetNameXml(name: string) {
  const cleaned = xmlText(name)
    .replaceAll(/[:\\/?*[\]]/g, " ")
    .trim();
  return (cleaned || "Sheet").slice(0, 31);
}

function worksheetXml(rows: string[][]) {
  const grid = rows.length > 0 ? rows : [[""]];
  const width = Math.max(1, ...grid.map((row) => row.length));
  const sheetRows = grid
    .map((row, rowIndex) => {
      const cells = row
        .map(
          (value, index) =>
            `<c r="${columnName(index)}${rowIndex + 1}" t="inlineStr"><is><t>${xmlText(value)}</t></is></c>`,
        )
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  // Each column wide enough for its longest value, within 12–40 characters.
  const widths = Array.from({ length: width }, (_, index) => {
    const longest = grid.reduce((max, row) => Math.max(max, row[index]?.length ?? 0), 0);
    const columnWidth = Math.min(40, Math.max(12, longest + 2));
    return `<col min="${index + 1}" max="${index + 1}" width="${columnWidth}" customWidth="1"/>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${columnName(width - 1)}${grid.length}"/>
  <cols>${widths}</cols>
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;
}

function workbookParts(sheetName: string, rows: string[][]) {
  return [
    {
      name: "[Content_Types].xml",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
    },
    {
      name: "_rels/.rels",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${sheetNameXml(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
    },
    { name: "xl/worksheets/sheet1.xml", text: worksheetXml(rows) },
  ];
}

type Stamp = { date: number; time: number };

function localHeader(name: Uint8Array, data: Uint8Array, crc: number, stamp: Stamp) {
  const header = new Uint8Array(30);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(10, stamp.time, true);
  view.setUint16(12, stamp.date, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, data.length, true);
  view.setUint32(22, data.length, true);
  view.setUint16(26, name.length, true);
  return header;
}

function centralHeader(
  name: Uint8Array,
  data: Uint8Array,
  crc: number,
  offset: number,
  stamp: Stamp,
) {
  const header = new Uint8Array(46);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(12, stamp.time, true);
  view.setUint16(14, stamp.date, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, data.length, true);
  view.setUint32(24, data.length, true);
  view.setUint16(28, name.length, true);
  view.setUint32(42, offset, true);
  return header;
}

/** The workbook's bytes: one sheet named `sheetName`, `rows[0]` as its header row. */
export function buildTableWorkbook(sheetName: string, rows: string[][]) {
  const encoder = new TextEncoder();
  const stamp = dosDateTime(new Date());
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const part of workbookParts(sheetName, rows)) {
    const name = encoder.encode(part.name);
    const data = encoder.encode(part.text);
    const crc = crc32(data);
    const local = concat([localHeader(name, data, crc, stamp), name, data]);
    locals.push(local);
    centrals.push(concat([centralHeader(name, data, crc, offset, stamp), name]));
    offset += local.length;
  }
  const centralDirectory = concat(centrals);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, centrals.length, true);
  endView.setUint16(10, centrals.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, offset, true);
  return concat([...locals, centralDirectory, end]);
}

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** The bytes as base64, for `ExportFile`'s `encoding: "base64"`. */
export function toBase64(bytes: Uint8Array) {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const b = bytes[index + 1];
    const c = bytes[index + 2];
    const chunk = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    output +=
      BASE64[(chunk >> 18) & 63] +
      BASE64[(chunk >> 12) & 63] +
      (b === undefined ? "=" : BASE64[(chunk >> 6) & 63]) +
      (c === undefined ? "=" : BASE64[chunk & 63]);
  }
  return output;
}
