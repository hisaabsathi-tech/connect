import type { DrsSheet, DrsStatus } from "@/lib/api/drs";
import type { Remark } from "@/lib/attendance/remarks";

import { isDelivered, isPending } from "./orders";

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

export type DrsFilter = "all" | "ongoing" | "all-delivered" | "all-not-delivered" | DrsStatus;

export const DRS_FILTERS: { id: DrsFilter; label: string }[] = [
  { id: "all", label: "All DRS" },
  { id: "all-not-delivered", label: "All not delivered" },
  { id: "all-delivered", label: "All delivered" },
  { id: "ongoing", label: "Ongoing" },
  { id: "ISSUED", label: "Issued" },
  { id: "OUT FOR DELIVERY", label: "Out for delivery" },
  { id: "DELIVERING ORDERS", label: "Delivering" },
  { id: "RESOLVED", label: "Resolved" },
];

export const matchesDrsFilter = (sheet: DrsSheet, filter: DrsFilter) => {
  if (filter === "all") return true;
  if (filter === "all-delivered") return areAllOrdersDelivered(sheet);
  if (filter === "all-not-delivered")
    return sheet.status === "DELIVERING ORDERS" && areNoOrdersDelivered(sheet);
  return filter === "ongoing" ? isDrsOngoing(sheet) : sheet.status === filter;
};

const unique = (values: (string | null | undefined)[]) => [
  ...new Set(values.map((value) => value?.trim()).filter((value): value is string => !!value)),
];

export const drsAreas = (sheet: DrsSheet) => unique(sheet.areas.map((area) => area.area));

export const drsPincodes = (sheet: DrsSheet) => unique(sheet.pincodes);

/** How many parcels on the run sheet have reached the recipient. */
export const deliveredOrderCount = (sheet: DrsSheet) => sheet.orders.filter(isDelivered).length;

/** Every order is delivered; an empty DRS is not considered complete. */
export const areAllOrdersDelivered = (sheet: DrsSheet) =>
  sheet.orders.length > 0 && deliveredOrderCount(sheet) === sheet.orders.length;

/** No order is left to hand over: each one is delivered, returned or cancelled. */
export const areAllOrdersFinished = (sheet: DrsSheet) =>
  sheet.orders.length > 0 &&
  sheet.orders.every((order) => !isPending({ ...order, drsId: sheet.id, drsStatus: sheet.status }));

/**
 * The one step the card offers, within what the server allows a delivery boy (`DELIVERING
 * ORDERS` is set by the server, and a resolved sheet is final): an issued sheet goes out for
 * delivery; one on the road is resolved once no order is left to hand over. Null otherwise.
 */
export function drsAdvance(sheet: DrsSheet): DrsStatus | null {
  if (sheet.status === "ISSUED") return "OUT FOR DELIVERY";
  const onTheRoad = sheet.status === "OUT FOR DELIVERY" || sheet.status === "DELIVERING ORDERS";
  return onTheRoad && areAllOrdersFinished(sheet) ? "RESOLVED" : null;
}

/** A delivery run has started, but none of its parcels have reached a recipient yet. */
export const areNoOrdersDelivered = (sheet: DrsSheet) =>
  sheet.orders.length > 0 && deliveredOrderCount(sheet) === 0;

/**
 * The DRS list is a work queue: sheets being delivered come before those merely issued, and
 * resolved sheets sink to the end. Within a state, the most delivered orders come first.
 */
const deliveryStateRank: Record<DrsStatus, number> = {
  "DELIVERING ORDERS": 0,
  "OUT FOR DELIVERY": 1,
  ISSUED: 2,
  RESOLVED: 3,
};

export function compareDrsForDelivery(left: DrsSheet, right: DrsSheet) {
  const stateDifference = deliveryStateRank[left.status] - deliveryStateRank[right.status];
  if (stateDifference) return stateDifference;
  return deliveredOrderCount(right) - deliveredOrderCount(left);
}

/** While viewing Delivering DRS, surface untouched runs before partially completed ones. */
export function compareDeliveringDrs(left: DrsSheet, right: DrsSheet) {
  const leftUntouched = areNoOrdersDelivered(left);
  const rightUntouched = areNoOrdersDelivered(right);
  if (leftUntouched !== rightUntouched) return leftUntouched ? -1 : 1;
  return deliveredOrderCount(right) - deliveredOrderCount(left);
}

/** The first instant of `from` and the last of `to`, both India days, as ISO times. */
export function istDayBounds(from: string, to: string) {
  return {
    from: new Date(`${from}T00:00:00.000+05:30`).toISOString(),
    to: new Date(`${to}T23:59:59.999+05:30`).toISOString(),
  };
}
