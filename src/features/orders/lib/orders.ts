import type { DrsOrderLine, DrsSheet, DrsStatus } from "@/lib/api/drs";

/** An order on one of the delivery boy's sheets, with the sheet it rides on. */
export type DrsOrder = DrsOrderLine & { drsId: string; drsStatus: DrsStatus };

/** The orders on the sheets (or only on `drsId`'s), each once even if it moved between sheets. */
export function ordersFromSheets(sheets: DrsSheet[], drsId: string | null): DrsOrder[] {
  const seen = new Set<string>();
  const orders: DrsOrder[] = [];
  for (const sheet of sheets) {
    if (drsId && sheet.id !== drsId) continue;
    for (const line of sheet.orders) {
      if (seen.has(line.orderId)) continue;
      seen.add(line.orderId);
      orders.push({ ...line, drsId: sheet.id, drsStatus: sheet.status });
    }
  }
  return orders;
}

const status = (order: DrsOrder) => order.shipmentStatus?.trim().toUpperCase() ?? "";

export const isDelivered = (order: DrsOrder) => status(order) === "DELIVERED";

export const isReturned = (order: DrsOrder) => status(order).startsWith("RTO");

export const isAttemptFailed = (order: DrsOrder) =>
  ["DELIVERY ATTEMPT FAILED", "DELIVERY RESCHEDULED", "FAILED"].includes(status(order));

/** Still to be handed over: not delivered, not on its way back, not cancelled. */
export const isPending = (order: DrsOrder) =>
  !(isDelivered(order) || isReturned(order) || status(order) === "CANCELLED");

const payment = (order: DrsOrder) => order.paymentType?.trim().toUpperCase() ?? "";

export type OrderFilter =
  | "all"
  | "pending"
  | "delivered"
  | "failed"
  | "rto"
  | "cod"
  | "prepaid"
  | "to-pay";

export const ORDER_FILTERS: { id: OrderFilter; label: string }[] = [
  { id: "all", label: "All Orders" },
  { id: "pending", label: "Yet to deliver" },
  { id: "delivered", label: "Delivered" },
  { id: "failed", label: "Attempt failed" },
  { id: "rto", label: "RTO" },
  { id: "cod", label: "COD" },
  { id: "prepaid", label: "Prepaid" },
  { id: "to-pay", label: "To Pay" },
];

const FILTER_MATCHES: Record<OrderFilter, (order: DrsOrder) => boolean> = {
  all: () => true,
  cod: (order) => payment(order) === "COD",
  delivered: isDelivered,
  failed: isAttemptFailed,
  pending: isPending,
  prepaid: (order) => payment(order) === "PREPAID",
  rto: isReturned,
  "to-pay": (order) => payment(order) === "TO_PAY",
};

export const matchesOrderFilter = (order: DrsOrder, filter: OrderFilter) =>
  FILTER_MATCHES[filter](order);

/** AWB, reference, names, phone, address, area or pincode containing the search. */
export function matchesOrderSearch(order: DrsOrder, search: string) {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [
    order.awbNo,
    order.refNo,
    order.receiverName,
    order.customerName,
    order.customerMobile,
    order.addressLine1,
    order.addressLine2,
    order.destinationArea,
    order.destinationPincode,
  ].some((value) => value?.toLowerCase().includes(needle));
}
