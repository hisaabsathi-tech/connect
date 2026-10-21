import { readCache, writeCache } from "@/lib/offline/cache";

import type { DrsOrder } from "./orders";

// The orders opened from the list, by id: the scan and update screens get only the id in their
// route and read the order here, as the list loaded it. Also saved on the phone, so the page
// survives the app being closed mid-delivery.
const opened = new Map<string, DrsOrder>();
const OPENED_CACHE = "opened-orders";

export function rememberOrder(order: DrsOrder) {
  opened.set(order.orderId, order);
  writeCache(OPENED_CACHE, order.orderId, order, 30);
}

export function openedOrder(orderId: string | undefined) {
  if (!orderId) return null;
  return opened.get(orderId) ?? readCache<DrsOrder>(OPENED_CACHE, orderId)?.data ?? null;
}

/** An opened order changed on this phone (saved offline): its page reads the new state. */
export function patchOpenedOrder(orderId: string, patch: Partial<DrsOrder>) {
  const order = openedOrder(orderId);
  if (order) rememberOrder({ ...order, ...patch });
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
