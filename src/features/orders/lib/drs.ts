import type { DrsSheet, DrsStatus } from "@/lib/api/drs";
import type { Remark } from "@/lib/attendance/remarks";

/**
 * The statuses a delivery boy can move a DRS on to, as the server allows. `DELIVERING ORDERS` is
 * set by the server once an order on the sheet is delivered, and a resolved sheet is final.
 */
const NEXT_STATUSES: Record<DrsStatus, DrsStatus[]> = {
  "DELIVERING ORDERS": ["RESOLVED"],
  ISSUED: ["OUT FOR DELIVERY"],
  "OUT FOR DELIVERY": ["RESOLVED"],
  RESOLVED: [],
};

export function drsNextStatuses(status: DrsStatus): DrsStatus[] {
  return NEXT_STATUSES[status] ?? [];
}

const STATUS_LABELS: Record<DrsStatus, string> = {
  "DELIVERING ORDERS": "Delivering",
  ISSUED: "Issued",
  "OUT FOR DELIVERY": "Out for delivery",
  RESOLVED: "Resolved",
};

export function drsStatusLabel(status: DrsStatus) {
  return STATUS_LABELS[status] ?? status;
}

/** The card's status pill, in the web app's order-status colours. */
export function drsBadge(status: DrsStatus): Remark {
  const label = drsStatusLabel(status);
  if (status === "RESOLVED") return { label, variant: "delivered" };
  if (status === "ISSUED") return { label, variant: "transit" };
  return { label, variant: "rescheduled" };
}

/** Ongoing until resolved. */
export const isDrsOngoing = (sheet: DrsSheet) => sheet.status !== "RESOLVED";

export type DrsFilter = "all" | "ongoing" | DrsStatus;

export const DRS_FILTERS: { id: DrsFilter; label: string }[] = [
  { id: "all", label: "All DRS" },
  { id: "ongoing", label: "Ongoing" },
  { id: "ISSUED", label: "Issued" },
  { id: "OUT FOR DELIVERY", label: "Out for delivery" },
  { id: "DELIVERING ORDERS", label: "Delivering" },
  { id: "RESOLVED", label: "Resolved" },
];

export const matchesDrsFilter = (sheet: DrsSheet, filter: DrsFilter) =>
  filter === "all" || (filter === "ongoing" ? isDrsOngoing(sheet) : sheet.status === filter);

const unique = (values: (string | null | undefined)[]) => [
  ...new Set(values.map((value) => value?.trim()).filter((value): value is string => !!value)),
];

export const drsAreas = (sheet: DrsSheet) => unique(sheet.areas.map((area) => area.area));

export const drsPincodes = (sheet: DrsSheet) => unique(sheet.pincodes);

/** The first instant of `from` and the last of `to`, both India days, as ISO times. */
export function istDayBounds(from: string, to: string) {
  return {
    from: new Date(`${from}T00:00:00.000+05:30`).toISOString(),
    to: new Date(`${to}T23:59:59.999+05:30`).toISOString(),
  };
}
