import { apiRequest } from "@/lib/api/client";

/** The outcomes a delivery boy can record for an order on their run. */
export type DeliveryOutcome = "DELIVERED" | "DELIVERY ATTEMPT FAILED" | "RTO_INITIATED";

export type ShipmentStatusInput = {
  shipmentStatus: DeliveryOutcome;
  /** Why it wasn't delivered (a reason from the list). */
  description?: string;
  /** The receiver's 6-digit delivery OTP; checked only when sent. */
  otp?: string;
  /** Storage key of the proof-of-delivery photo. */
  scanCopy?: string;
  /** Where the update was made, when the phone knows (always for a delivery). */
  latitude?: number;
  longitude?: number;
  /** That spot's street address, when it resolved. */
  address?: string;
  /** This update's id on the phone; the server applies a resend of it only once. */
  clientActionId?: string;
  /** When it happened, for an update saved offline and sent later (ISO time). */
  occurredAt?: string;
};

/** Records the order's last-mile outcome; the delivery boy on its DRS may do this. */
export function setShipmentStatus(token: string, orderId: string, input: ShipmentStatusInput) {
  return apiRequest<{ order: { id: string } }>(
    `/orders/${encodeURIComponent(orderId)}/shipment-status`,
    token,
    { body: JSON.stringify(input), method: "PATCH" },
  );
}

/** Sends the receiver a new delivery OTP (the old one stops working). */
export function resendDeliveryOtp(token: string, orderId: string) {
  return apiRequest<{ sent: true }>(`/orders/${encodeURIComponent(orderId)}/delivery-otp`, token, {
    method: "POST",
  });
}
