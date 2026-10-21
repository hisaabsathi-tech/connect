import { beforeEach, describe, expect, it } from "bun:test";
import { liveTripsNow } from "@/features/live-trips/lib/live-trips-store";
import { openedOrder, rememberOrder } from "@/features/orders/lib/active-order";
import type { DrsOrder } from "@/features/orders/lib/orders";
import { submitOrderOutcome } from "@/features/orders/lib/submit-outcome";
import { isNetworkError } from "@/lib/api/network";
import { reportReachable, reportUnreachable } from "@/lib/network/connectivity";
import { clearOutbox, drainOutbox, outboxNow } from "@/lib/offline/outbox";

import { fake, freshPhone, refuse, TOKEN } from "./fake";

const order = {
  awbNo: "AWB-7",
  drsId: "DRS1",
  drsStatus: "OUT FOR DELIVERY",
  orderId: "O7",
  shipmentStatus: "OUT FOR DELIVERY",
} as unknown as DrsOrder;

const statusCalls = () =>
  fake.server.calls.filter((call) => call.path === "/orders/O7/shipment-status");

beforeEach(() => {
  freshPhone();
  clearOutbox();
  reportReachable();
  rememberOrder(order);
});

describe("recording a delivery outcome", () => {
  it("online: sends at once with an id, nothing left waiting", async () => {
    const result = await submitOrderOutcome({
      input: { shipmentStatus: "DELIVERED" },
      order,
      token: TOKEN,
    });
    expect(result).toBe("sent");
    const body = statusCalls()[0]?.body as { clientActionId: string; occurredAt: string };
    expect(body.clientActionId).toMatch(/^act-/);
    expect(outboxNow().items).toHaveLength(0);
  });

  it("offline: saved for later, and the order shows delivered on the phone at once", async () => {
    reportUnreachable("no_network");
    const result = await submitOrderOutcome({
      input: { description: "Customer not home", shipmentStatus: "DELIVERY ATTEMPT FAILED" },
      order,
      token: TOKEN,
    });
    expect(result).toBe("queued");
    expect(statusCalls()).toHaveLength(0);
    expect(outboxNow().items[0]?.label).toBe("AWB AWB-7 · Delivery attempt failed");
    expect(openedOrder("O7")?.shipmentStatus).toBe("DELIVERY ATTEMPT FAILED");
  });

  it("signal lost mid-send: queued under the same id, so the server can't apply it twice", async () => {
    // The request reaches the server, but the answer is lost on the way back.
    const sentIds: string[] = [];
    fake.server.routes.set("PATCH /orders/O7/shipment-status", (call) => {
      sentIds.push((call.body as { clientActionId: string }).clientActionId);
      throw new TypeError("Network request failed");
    });
    const result = await submitOrderOutcome({
      input: { shipmentStatus: "DELIVERED" },
      order,
      token: TOKEN,
    }).catch((error) => error);
    expect(result).toBe("queued");
    expect(outboxNow().items[0]?.id).toBe(sentIds[0]);

    // Back online: the resend carries the first attempt's id.
    fake.server.routes.clear();
    reportReachable();
    await drainOutbox();
    expect(sentIds[0]).toBe(
      (statusCalls().at(-1)?.body as { clientActionId: string }).clientActionId,
    );
  });

  it("an OTP delivery is never queued: offline it fails, saying so", async () => {
    reportUnreachable("no_network");
    const error = await submitOrderOutcome({
      input: { otp: "123456", shipmentStatus: "DELIVERED" },
      order,
      queueable: false,
      token: TOKEN,
    }).catch((caught) => caught);
    expect(isNetworkError(error)).toBe(true);
    expect(outboxNow().items).toHaveLength(0);
    expect(openedOrder("O7")?.shipmentStatus).toBe("OUT FOR DELIVERY");
  });

  it("the server's refusal (wrong OTP) is shown, not queued", async () => {
    fake.server.routes.set("PATCH /orders/O7/shipment-status", () =>
      refuse("Invalid delivery OTP"),
    );
    const error = await submitOrderOutcome({
      input: { otp: "000000", shipmentStatus: "DELIVERED" },
      order,
      queueable: false,
      token: TOKEN,
    }).catch((caught: Error) => caught);
    expect((error as Error).message).toBe("Invalid delivery OTP");
    expect(outboxNow().items).toHaveLength(0);
  });

  it("the live trip's block moves on at once, online or not", async () => {
    reportUnreachable("no_network");
    await submitOrderOutcome({ input: { shipmentStatus: "RTO_INITIATED" }, order, token: TOKEN });
    expect(liveTripsNow().trips.some((trip) => trip.orders.some((o) => o.orderId === "O7"))).toBe(
      false,
    );
  });
});
