import { router } from "expo-router";

import { fetchDrs } from "@/lib/api/drs";

import { rememberOrder } from "./active-order";
import { isPending, ordersFromSheets } from "./orders";

/**
 * Opens one order from outside the Orders list (a live trip's next stop on Home), the way the
 * list does: loads its sheet for the full order line, then a pending order goes to the parcel
 * scan first (its update page opens only once the barcode matches), a finished one to its page.
 */
export async function openDrsOrder(token: string, drsId: string, orderId: string) {
  const sheet = await fetchDrs(token, drsId);
  const order = ordersFromSheets([sheet], sheet.id).find((item) => item.orderId === orderId);
  if (!order) throw new Error("This order is no longer on the DRS.");
  rememberOrder(order);
  router.push({
    params: { orderId },
    pathname: isPending(order) ? "/orders/scan" : "/orders/update",
  });
}
