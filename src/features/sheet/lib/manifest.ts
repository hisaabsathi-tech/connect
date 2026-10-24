import type { SmartSheetRecord } from "@/lib/api/smart-sheets";
import type { ExportFile } from "@/lib/files/device-files";
import { buildTableWorkbook, toBase64, XLSX_MIME_TYPE } from "@/lib/files/xlsx";

const MANIFEST_NAME = "Shipping Manifest";

/**
 * The manifest's columns, each with the sheet headers it is read from. Headers are compared as
 * the web editor writes them, without the leading `*` it puts on required ones.
 */
const COLUMNS = [
  // Always there, blank until the web fills a row's AWB number in.
  { from: ["AWB NO", "AWB NUMBER", "AWB"], label: "AWB No" },
  { from: ["CLIENT NAME"], label: "Client Name" },
  { from: ["DESTINATION PINCODE", "DEST PINCODE"], label: "Dest Pincode*" },
  { from: ["RECEIVER NAME"], label: "Receiver Name" },
  { from: ["RECEIVER PHONE", "RECEIVER PHONE NUMBER", "PHONE"], label: "Phone" },
] as const;

type Cell = { v?: unknown } | undefined;
type CellData = Record<string, Record<string, Cell> | undefined>;
type WorkbookSnapshot = {
  sheetOrder?: string[];
  sheets?: Record<string, { cellData?: CellData } | undefined>;
};

/** Where the destination pincode sits in a manifest row; its city goes right after it. */
const PINCODE_COLUMN = COLUMNS.findIndex((column) => column.label === "Dest Pincode*");

const withCity = (line: readonly string[], city: string) => [
  ...line.slice(0, PINCODE_COLUMN + 1),
  city,
  ...line.slice(PINCODE_COLUMN + 1),
];

/** "*Destination  pincode" → "DESTINATION PINCODE", as the web editor matches headers. */
const headerKey = (header: string) =>
  header.trim().replace(/^\*+/, "").replace(/\s+/g, " ").trim().toUpperCase();

const cellText = (cell: Cell) =>
  cell?.v === null || cell?.v === undefined ? "" : String(cell.v).trim();

/** The first tab's cells, the one the web editor fills. */
function firstSheetCells(workbook: Record<string, unknown>): CellData {
  const snapshot = workbook as WorkbookSnapshot;
  const sheetId = snapshot.sheetOrder?.[0];
  return (sheetId ? snapshot.sheets?.[sheetId]?.cellData : undefined) ?? {};
}

/**
 * The sheet's rows under the manifest's columns, header first, each destination pincode followed
 * by its city (from `cities`). Rows with none of the sheet's columns filled in are left out; a row
 * without an AWB number yet, or a sheet without one of the columns, leaves that cell blank.
 */
export function manifestRows(
  workbook: Record<string, unknown>,
  cities: Readonly<Record<string, string>> = {},
): string[][] {
  const cells = firstSheetCells(workbook);
  const header = cells[0] ?? {};
  const columnOf = new Map<string, number>();
  for (const [column, cell] of Object.entries(header)) {
    const key = headerKey(cellText(cell));
    if (key && !columnOf.has(key)) columnOf.set(key, Number(column));
  }
  const sources = COLUMNS.map(
    (column) =>
      column.from.map((name) => columnOf.get(name)).find((index) => index !== undefined) ?? null,
  );
  const rowIndexes = Object.keys(cells)
    .map(Number)
    .filter((index) => Number.isInteger(index) && index > 0)
    .sort((a, b) => a - b);
  const rows: string[][] = [];
  for (const index of rowIndexes) {
    const line = sources.map((column) =>
      column === null ? "" : cellText(cells[index]?.[String(column)]),
    );
    if (line.some(Boolean)) rows.push(withCity(line, cities[line[PINCODE_COLUMN] ?? ""] ?? ""));
  }
  return [
    withCity(
      COLUMNS.map((column) => column.label),
      "City",
    ),
    ...rows,
  ];
}

/** The destination pincodes of the sheet's manifest rows, to look their cities up. */
export function manifestPincodes(workbook: Record<string, unknown>) {
  return manifestRows(workbook)
    .slice(1)
    .map((line) => line[PINCODE_COLUMN] ?? "")
    .filter(Boolean);
}

/**
 * "Sarkiar Prakritik-14-10-2026 Shipping Manifest.xlsx": the sheet's name (the client and day for
 * a sheet started on the app) before the manifest's, without characters a file name can't hold.
 */
export function manifestFileName(sheetName: string) {
  const base = sheetName
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base ? `${base} ${MANIFEST_NAME}.xlsx` : `${MANIFEST_NAME}.xlsx`;
}

/** The sheet's Shipping Manifest as an Excel file, ready to save or share. */
export function manifestFile(
  sheet: Pick<SmartSheetRecord, "name" | "workbook">,
  cities: Readonly<Record<string, string>> = {},
): ExportFile {
  return {
    contents: toBase64(buildTableWorkbook(MANIFEST_NAME, manifestRows(sheet.workbook, cities))),
    encoding: "base64",
    mimeType: XLSX_MIME_TYPE,
    name: manifestFileName(sheet.name),
  };
}
