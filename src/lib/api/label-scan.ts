import { File } from "expo-file-system";

import { apiRequest } from "@/lib/api/client";

/** The upload and the server's OCR together take longer than an ordinary save. */
const SCAN_TIMEOUT_MS = 60_000;

export type LabelScanField =
  | "awbNo"
  | "receiverName"
  | "receiverPhone"
  | "receiverAddress"
  | "pincode";

/** The receiver as read off a parcel's label; any field may be missing. */
export type LabelScan = {
  scanId: string;
  receiverName: string | null;
  receiverPhone: string | null;
  receiverAddress: string | null;
  pincode: string | null;
  place: { city: string; state: string } | null;
  /** The courier's AWB number, when the label carries one (barcode or printed). */
  awbNo: string | null;
  /** Fields left empty or read uncertainly, for the person to check. */
  unsure: LabelScanField[];
};

/**
 * Sends a photo of a shipping label to be read. The server keeps the photo; the order's sheet
 * gets it once the order is saved (`attachLabelScan`).
 */
export function scanShippingLabel(
  token: string,
  input: { uri: string; organizationId: string; clientId?: string; smartSheetId?: string },
) {
  const body = new FormData();
  // Expo's fetch can't send React Native's `{ uri, name, type }` file parts: it fails before the
  // request leaves the phone. An expo-file-system File is read and sent as the photo's bytes.
  body.append("file", new File(input.uri));
  body.append("organizationId", input.organizationId);
  if (input.clientId) body.append("clientId", input.clientId);
  if (input.smartSheetId) body.append("smartSheetId", input.smartSheetId);
  return apiRequest<LabelScan>(
    "/label-scan",
    token,
    { body, method: "POST" },
    { timeoutMs: SCAN_TIMEOUT_MS },
  );
}

/** Files a scan in the sheet its order was saved to, labelled with the order as saved. */
export function attachLabelScan(
  token: string,
  scanId: string,
  order: {
    smartSheetId: string;
    receiverName: string;
    receiverPhone: string;
    pincode: string;
    awbNo: string | null;
  },
) {
  return apiRequest<{ scanId: string }>(`/label-scan/${encodeURIComponent(scanId)}/attach`, token, {
    body: JSON.stringify(order),
    method: "POST",
  });
}

/** Files photos taken before their sheet existed (this form's earlier scans) under it. */
export function linkLabelScans(token: string, smartSheetId: string, scanIds: string[]) {
  return apiRequest<{ linked: number }>("/label-scan/link", token, {
    body: JSON.stringify({ scanIds, smartSheetId }),
    method: "POST",
  });
}

/** A label photo kept for a sheet, with links valid for an hour. */
export type SheetLabelScan = {
  id: string;
  imageUrl: string;
  thumbUrl: string;
  receiverName: string | null;
  receiverPhone: string | null;
  pincode: string | null;
  city: string | null;
  state: string | null;
  awbNo: string | null;
  /** Its order was saved to the sheet. */
  onSheet: boolean;
  scannedAt: string;
};

/** The label photos scanned for a sheet, newest first. */
export function listSheetLabelScans(token: string, organizationId: string, smartSheetId: string) {
  return apiRequest<SheetLabelScan[]>(
    `/label-scan/linked/${encodeURIComponent(organizationId)}?smartSheetId=${encodeURIComponent(smartSheetId)}`,
    token,
  );
}

/** Deletes a sheet's label photo for good. */
export function deleteSheetLabelScan(token: string, organizationId: string, scanId: string) {
  return apiRequest<{ scanId: string }>(
    `/label-scan/linked/${encodeURIComponent(organizationId)}/${encodeURIComponent(scanId)}`,
    token,
    { method: "DELETE" },
  );
}
