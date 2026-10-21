import { beforeEach, describe, expect, it } from "bun:test";

import { reportReachable, reportUnreachable } from "@/lib/network/connectivity";
import {
  clearOutbox,
  discardOutboxItem,
  drainOutbox,
  enqueue,
  onOutboxRefused,
  outboxNow,
  pendingFor,
  retryOutboxItem,
  startOutbox,
} from "@/lib/offline/outbox";

import { fake, freshPhone, refuse, settle } from "./fake";

const delivered = (orderId: string) =>
  ({
    drsId: "DRS1",
    input: { latitude: 22.6, longitude: 88.3, shipmentStatus: "DELIVERED" },
    kind: "shipment-status",
    label: `AWB ${orderId} · Delivered`,
    orderId,
  }) as const;

const statusCalls = () =>
  fake.server.calls.filter((call) => call.path.endsWith("/shipment-status"));

beforeEach(() => {
  freshPhone();
  clearOutbox();
  reportReachable();
});

describe("outbox while offline", () => {
  it("keeps updates on the phone, sends nothing, and survives a restart", async () => {
    reportUnreachable("no_network");
    enqueue(delivered("O1"));
    enqueue(delivered("O2"));
    await settle();
    expect(statusCalls()).toHaveLength(0);
    expect(outboxNow().items.map((item) => item.state)).toEqual(["pending", "pending"]);
    // Saved to its file, so killing the app loses nothing.
    const saved = JSON.parse(fake.files.get("doc/outbox.json") ?? "[]") as unknown[];
    expect(saved).toHaveLength(2);
  });

  it("copies the photo out of the camera cache, so it is still there to send later", () => {
    reportUnreachable("no_network");
    fake.files.set("cache/camera/pod.jpg", "jpeg");
    const id = enqueue({ ...delivered("O1"), photo: "cache/camera/pod.jpg" });
    const item = outboxNow().items.find((held) => held.id === id);
    expect(item && "photo" in item ? item.photo : null).toBe(`doc/outbox/${id}.jpg`);
    expect(fake.files.has(`doc/outbox/${id}.jpg`)).toBe(true);
  });
});

describe("outbox when back online", () => {
  it("sends everything in the order it happened, with its id and time", async () => {
    reportUnreachable("no_network");
    const first = enqueue(delivered("O1"));
    await settle(2);
    const second = enqueue(delivered("O2"));
    reportReachable();
    await drainOutbox();
    const calls = statusCalls();
    expect(calls.map((call) => call.path)).toEqual([
      "/orders/O1/shipment-status",
      "/orders/O2/shipment-status",
    ]);
    const body = calls[0]?.body as { clientActionId: string; occurredAt: string };
    expect(body.clientActionId).toBe(first);
    expect(Date.parse(body.occurredAt)).toBeLessThan(Date.now() + 1);
    expect((calls[1]?.body as { clientActionId: string }).clientActionId).toBe(second);
    expect(outboxNow().items).toHaveLength(0);
  });

  it("starts sending the moment the connection returns, without any tap", async () => {
    startOutbox();
    reportUnreachable("no_network");
    enqueue(delivered("O1"));
    await settle();
    expect(statusCalls()).toHaveLength(0);
    reportReachable(); // the connectivity store's "back online"
    await settle(5);
    expect(statusCalls()).toHaveLength(1);
    expect(outboxNow().items).toHaveLength(0);
  });

  it("uploads the proof photo at send time, then attaches it", async () => {
    reportUnreachable("no_network");
    fake.files.set("cache/pod.jpg", "jpeg");
    fake.server.routes.set("POST /media/upload-url", () => ({
      body: { data: { mediaId: "M1", uploadUrl: "http://storage.test/put" }, success: true },
    }));
    fake.server.routes.set("POST /media/M1/confirm", () => ({
      body: { data: { mediaId: "M1", objectKey: "pod/M1.jpg" }, success: true },
    }));
    const id = enqueue({ ...delivered("O1"), photo: "cache/pod.jpg" });
    reportReachable();
    await drainOutbox();
    expect(fake.server.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      "POST /media/upload-url",
      "PUT http://storage.test/put",
      "POST /media/M1/confirm",
      "PATCH /orders/O1/shipment-status",
    ]);
    expect((statusCalls()[0]?.body as { scanCopy: string }).scanCopy).toBe("pod/M1.jpg");
    // The kept copy is cleaned up once sent.
    expect(fake.files.has(`doc/outbox/${id}.jpg`)).toBe(false);
  });

  it("stops at a dropped connection mid-way and keeps the rest for later", async () => {
    reportUnreachable("no_network");
    enqueue(delivered("O1"));
    enqueue(delivered("O2"));
    reportReachable();
    let sent = 0;
    fake.server.routes.set("PATCH /orders/O1/shipment-status", () => {
      sent += 1;
      fake.server.offline = true; // the signal drops right after this answer
      return {};
    });
    await drainOutbox();
    expect(sent).toBe(1);
    expect(
      outboxNow().items.map((item) => item.kind === "shipment-status" && item.orderId),
    ).toEqual(["O2"]);
    expect(outboxNow().items[0]?.state).toBe("pending");
  });

  it("keeps an update the server refuses as needing attention, and carries on with the rest", async () => {
    const refused: string[] = [];
    const stop = onOutboxRefused((item) => refused.push(item.label));
    reportUnreachable("no_network");
    enqueue(delivered("O1"));
    enqueue(delivered("O2"));
    fake.server.routes.set("PATCH /orders/O1/shipment-status", () =>
      refuse("This order is no longer on your DRS."),
    );
    reportReachable();
    await drainOutbox();
    expect(refused).toEqual(["AWB O1 · Delivered"]);
    const [first] = outboxNow().items;
    expect(first?.state).toBe("failed");
    expect(first?.error).toBe("This order is no longer on your DRS.");
    expect(statusCalls().map((call) => call.path)).toContain("/orders/O2/shipment-status");
    expect(outboxNow().items).toHaveLength(1);
    stop();
  });

  it("drops an update the server says it already has (a resend after a lost answer)", async () => {
    reportUnreachable("no_network");
    enqueue(delivered("O1"));
    fake.server.routes.set("PATCH /orders/O1/shipment-status", () =>
      refuse("This update was already saved.", 409),
    );
    reportReachable();
    await drainOutbox();
    expect(outboxNow().items).toHaveLength(0);
  });

  it("lets the rider retry or discard a refused update", async () => {
    reportUnreachable("no_network");
    const id = enqueue(delivered("O1"));
    let refuseIt = true;
    fake.server.routes.set("PATCH /orders/O1/shipment-status", () =>
      refuseIt ? refuse("Order is locked") : {},
    );
    reportReachable();
    await drainOutbox();
    expect(outboxNow().items[0]?.state).toBe("failed");
    refuseIt = false;
    retryOutboxItem(id);
    await settle(5);
    expect(outboxNow().items).toHaveLength(0);

    reportUnreachable("no_network");
    const other = enqueue(delivered("O2"));
    discardOutboxItem(other);
    expect(outboxNow().items).toHaveLength(0);
  });

  it("sends a pickup with when it was collected, and a DRS scan through its upload", async () => {
    reportUnreachable("no_network");
    enqueue({ kind: "pickup-picked-up", label: "Pickup", organizationId: "ORG", pickupId: "P1" });
    fake.files.set("cache/scan.jpg", "jpeg");
    fake.server.routes.set("POST /media/upload-url", () => ({
      body: { data: { mediaId: "M2", uploadUrl: "http://storage.test/put" }, success: true },
    }));
    fake.server.routes.set("POST /media/M2/confirm", () => ({
      body: { data: { mediaId: "M2", objectKey: "scan/M2.jpg" }, success: true },
    }));
    fake.server.routes.set("PATCH /delivery/drs/DRS1", () => ({
      body: { data: { drs: { id: "DRS1" } }, success: true },
    }));
    enqueue({ drsId: "DRS1", kind: "drs-scan", label: "Scan", photo: "cache/scan.jpg" });
    reportReachable();
    await drainOutbox();
    const pickup = fake.server.calls.find((call) => call.path === "/pickup-requests/P1/picked-up");
    expect((pickup?.body as { occurredAt: string; organizationId: string }).organizationId).toBe(
      "ORG",
    );
    expect(typeof (pickup?.body as { occurredAt: string }).occurredAt).toBe("string");
    const drs = fake.server.calls.find((call) => call.path === "/delivery/drs/DRS1");
    expect((drs?.body as { scanCopy: string }).scanCopy).toBe("scan/M2.jpg");
    expect(outboxNow().items).toHaveLength(0);
  });

  it("finds what is waiting for one order, pickup or sheet (the cards' badges)", () => {
    reportUnreachable("no_network");
    enqueue(delivered("O1"));
    const items = outboxNow().items;
    expect(pendingFor(items, "O1")).toHaveLength(1);
    expect(pendingFor(items, "DRS1")).toHaveLength(1);
    expect(pendingFor(items, "O9")).toHaveLength(0);
  });

  it("sends nothing without a signed-in session", async () => {
    reportUnreachable("no_network");
    enqueue(delivered("O1"));
    fake.secure.clear();
    reportReachable();
    await drainOutbox();
    expect(statusCalls()).toHaveLength(0);
    expect(outboxNow().items).toHaveLength(1);
  });
});
