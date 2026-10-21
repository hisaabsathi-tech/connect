import { settleLiveTripOrder } from "@/features/live-trips/lib/live-trips-store";
import { uploadOrderPod } from "@/lib/api/media";
import { isNetworkError, NetworkError } from "@/lib/api/network";
import {
  type DeliveryOutcome,
  type ShipmentStatusInput,
  setShipmentStatus,
} from "@/lib/api/order-tracking";
import { isOnline } from "@/lib/network/connectivity";
import { enqueue, newActionId } from "@/lib/offline/outbox";

import { patchOpenedOrder } from "./active-order";
import { patchCachedOrder } from "./drs-cache";
import type { DrsOrder } from "./orders";

const OUTCOME_LABELS: Record<DeliveryOutcome, string> = {
  DELIVERED: "Delivered",
  "DELIVERY ATTEMPT FAILED": "Delivery attempt failed",
  RTO_INITIATED: "Return to origin",
};

/**
 * Records an order's outcome: sent now when the server is reachable, otherwise saved on the
 * phone (with the photo and the time it happened) and sent the moment the app is back online.
 * Either way the order shows its new status everywhere at once. Errors other than being offline
 * (a wrong OTP, the order no longer on the sheet) are thrown as before.
 */
export async function submitOrderOutcome({
  input,
  order,
  photo,
  queueable = true,
  token,
}: {
  /** False: the server must take it now (a delivery checked by OTP); offline is an error. */
  queueable?: boolean;
  input: Omit<ShipmentStatusInput, "clientActionId" | "occurredAt" | "scanCopy">;
  order: Pick<DrsOrder, "awbNo" | "drsId" | "orderId">;
  /** Proof-of-delivery photo (local file). */
  photo?: string | null;
  token: string;
}): Promise<"sent" | "queued"> {
  const id = newActionId();
  const occurredAt = new Date().toISOString();
  const queue = () => {
    enqueue(
      {
        drsId: order.drsId,
        input,
        kind: "shipment-status",
        label: `AWB ${order.awbNo} · ${OUTCOME_LABELS[input.shipmentStatus]}`,
        orderId: order.orderId,
        ...(photo ? { photo } : {}),
      },
      { id, occurredAt },
    );
  };
  let result: "sent" | "queued" = "sent";
  if (isOnline()) {
    try {
      const scanCopy = photo ? (await uploadOrderPod(token, photo)).objectKey : undefined;
      await setShipmentStatus(token, order.orderId, {
        ...input,
        clientActionId: id,
        occurredAt,
        scanCopy,
      });
    } catch (error) {
      if (!(queueable && isNetworkError(error))) throw error;
      queue();
      result = "queued";
    }
  } else if (queueable) {
    queue();
    result = "queued";
  } else {
    throw new NetworkError();
  }
  // Shown updated right away: the order lists, its page and the Home trip block.
  patchCachedOrder(order.orderId, { shipmentStatus: input.shipmentStatus });
  patchOpenedOrder(order.orderId, { shipmentStatus: input.shipmentStatus });
  settleLiveTripOrder(order.orderId);
  return result;
}
