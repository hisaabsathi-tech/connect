import { apiRequest } from "@/lib/api/client";

/** A Smart Sheet as the web app's sheet list shows it. */
export type SmartSheetSummary = {
  id: string;
  name: string;
  /** Order rows filled in the sheet. */
  orderRows: number;
  /** Of those, the ones already created as orders. */
  syncedOrders: number;
  createdAt: string;
  updatedAt: string;
};

export type SmartSheetRecord = SmartSheetSummary & {
  version: number;
  /** The web editor's workbook snapshot: `sheetOrder` and each sheet's `cellData`. */
  workbook: Record<string, unknown>;
};

/**
 * The organisation's live sheets, most recently saved first. The server keeps a member whose
 * role has only the "own created" view to the sheets they made.
 */
export function fetchSmartSheets(token: string) {
  return apiRequest<SmartSheetSummary[]>("/orders/smart-sheets", token);
}

/** One sheet with its workbook. */
export function fetchSmartSheet(token: string, id: string) {
  return apiRequest<SmartSheetRecord>(`/orders/smart-sheets/${encodeURIComponent(id)}`, token);
}
