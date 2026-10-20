import type { DrsOrder } from "./orders";

// The orders opened from the list, by id: the scan and update screens get only the id in their
// route and read the order here, as the list loaded it.
const opened = new Map<string, DrsOrder>();

export function rememberOrder(order: DrsOrder) {
  opened.set(order.orderId, order);
}

export function openedOrder(orderId: string | undefined) {
  return orderId ? (opened.get(orderId) ?? null) : null;
}

/** The scanned text is the order's AWB or its reference number (case and spacing ignored). */
export function barcodeMatches(text: string, order: Pick<DrsOrder, "awbNo" | "refNo">) {
  const value = text.trim().toLowerCase();
  if (!value) return false;
  const ref = order.refNo?.trim().toLowerCase() ?? "";
  return value === order.awbNo.trim().toLowerCase() || (ref.length > 0 && value === ref);
}

/** The DRS is out on the road, so its orders can be scanned and delivered. */
export const drsOnTheRoad = (order: DrsOrder) =>
  order.drsStatus === "OUT FOR DELIVERY" || order.drsStatus === "DELIVERING ORDERS";
