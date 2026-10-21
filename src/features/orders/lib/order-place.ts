import { joinAddress, lookUpAddress } from "@/lib/maps/address-lookup";
import type { Coordinates } from "@/lib/maps/geo";

import type { DrsOrder } from "./orders";

/** Where an order goes; `exact` when its street address was found, else its area's centre. */
export type OrderPin = Coordinates & {
  orderId: string;
  awbNo: string;
  receiver: string | null;
  /** The receiver's mobile, to call from the map. */
  mobile: string | null;
  /** The order's address as given (street, area, pincode). */
  address: string;
  exact: boolean;
};

export { joinAddress };

/**
 * The street address when there is one, else the area and pincode, which only places the pin
 * in the area (the server calls the first `hasAddress`).
 */
export async function placeOrder(token: string, order: DrsOrder): Promise<OrderPin | null> {
  const area = joinAddress([order.destinationArea, order.destinationPincode]);
  const street = joinAddress([order.addressLine1, order.addressLine2]);
  const base = {
    awbNo: order.awbNo,
    orderId: order.orderId,
    mobile: order.customerMobile?.trim() || null,
    receiver: order.receiverName?.trim() || order.customerName?.trim() || null,
  };
  const full = joinAddress([street, area]);
  if (street) {
    const exact = await lookUpAddress(token, full);
    if (exact) return { ...base, ...exact, address: full, exact: true };
  }
  const approximate = area ? await lookUpAddress(token, area) : null;
  // The card still shows the whole address, though the pin only marks its area.
  return approximate ? { ...base, ...approximate, address: full, exact: false } : null;
}

/** The order's whole delivery address on one line: street, area and pincode. */
export const orderAddress = (order: DrsOrder) =>
  joinAddress([
    order.addressLine1,
    order.addressLine2,
    order.destinationArea,
    order.destinationPincode,
  ]);
