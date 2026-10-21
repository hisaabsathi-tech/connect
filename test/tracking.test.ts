import { beforeEach, describe, expect, it } from "bun:test";

import { reportReachable, reportUnreachable } from "@/lib/network/connectivity";
import { flushTracking, watchTrackingFlush } from "@/lib/tracking/flush";
import { type Fix, shouldKeep } from "@/lib/tracking/sampler";
import { readTracking, writeTracking } from "@/lib/tracking/store";

import { fake, freshPhone, settle } from "./fake";

const point = (n: number) => ({
  accuracy: 8,
  clientPointId: `p${n}`,
  drsId: "DRS1",
  heading: null,
  latitude: 22.6 + n / 10_000,
  longitude: 88.3,
  queuedAt: Date.now(),
  recordedAt: new Date(Date.UTC(2026, 9, 21, 9, 0, n)).toISOString(),
  speed: 5,
  vehicleId: "VEH1",
});

const queue = (count: number) =>
  writeTracking((state) => ({
    ...state,
    failures: 0,
    queue: Array.from({ length: count }, (_, n) => point(n)),
    retryAt: 0,
  }));

const batches = () => fake.server.calls.filter((call) => call.path.endsWith("/track/batch"));

beforeEach(() => {
  freshPhone();
  reportReachable();
  writeTracking(() => ({ anchor: null, duty: null, failures: 0, queue: [], retryAt: 0 }));
});

describe("live location offline", () => {
  it("keeps recording while offline, sending nothing", async () => {
    fake.server.offline = true;
    reportUnreachable();
    queue(7);
    expect(await flushTracking({ force: true })).toBe("waiting");
    expect(batches()).toHaveLength(0);
    expect(readTracking().queue).toHaveLength(7);
  });

  it("back online, sends the whole backlog oldest first in batches of 50, emptying the queue", async () => {
    queue(120);
    expect(await flushTracking({ force: true })).toBe("sent");
    const sent = batches().map(
      (call) => (call.body as { points: { clientPointId: string }[] }).points,
    );
    expect(sent.map((points) => points.length)).toEqual([50, 50, 20]);
    expect(sent[0]?.[0]?.clientPointId).toBe("p0");
    expect(sent[2]?.at(-1)?.clientPointId).toBe("p119");
    expect(readTracking().queue).toHaveLength(0);
  });

  it("flushes by itself the moment the connection returns, without a new GPS reading", async () => {
    watchTrackingFlush();
    fake.server.offline = true;
    reportUnreachable();
    queue(3);
    await flushTracking({ force: true });
    expect(batches()).toHaveLength(0);
    fake.server.offline = false;
    reportReachable(); // back online
    await settle(5);
    expect(batches()).toHaveLength(1);
    expect(readTracking().queue).toHaveLength(0);
  });

  it("in the background, asks the server itself before deciding it is still offline", async () => {
    reportUnreachable(); // marked offline, but the network has quietly come back
    queue(2);
    expect(await flushTracking({ force: true })).toBe("sent");
  });

  it("drops the backlog once the server says the trip is over", async () => {
    fake.server.routes.set("POST /delivery/vehicles/VEH1/track/batch", () => ({
      body: { message: "No open vehicle trip for this DRS." },
      status: 422,
    }));
    queue(4);
    expect(await flushTracking({ force: true })).toBe("trip-over");
    expect(readTracking().queue).toHaveLength(0);
  });

  it("signed out: nothing is sent", async () => {
    fake.secure.clear();
    queue(2);
    expect(await flushTracking({ force: true })).toBe("signed-out");
  });
});

describe("which readings are kept", () => {
  const base: Fix = {
    accuracy: 10,
    at: 0,
    heading: null,
    latitude: 22.5,
    longitude: 88.3,
    speed: 0,
  };
  const east = (metres: number) => metres / 111_320 / Math.cos((22.5 * Math.PI) / 180);
  const cases: [string, Fix, Fix | null, boolean][] = [
    ["first fix kept", base, null, true],
    ["a coarse first fix (indoors) still kept", { ...base, accuracy: 80 }, null, true],
    ["a useless first fix dropped", { ...base, accuracy: 150 }, null, false],
    [
      "coarse fix while moving dropped",
      { ...base, accuracy: 80, at: 11_000, longitude: 88.3 + east(60), speed: 5 },
      base,
      false,
    ],
    [
      "parked jitter dropped",
      { ...base, at: 30_000, longitude: 88.3 + east(8), speed: 0.2 },
      base,
      false,
    ],
    ["parked heartbeat kept", { ...base, at: 300_000, longitude: 88.3 + east(5) }, base, true],
    [
      "town 45 m at 4 m/s kept",
      { ...base, at: 11_000, longitude: 88.3 + east(45), speed: 4 },
      base,
      true,
    ],
    [
      "town 15 m straight dropped",
      { ...base, at: 6_000, longitude: 88.3 + east(15), speed: 4 },
      base,
      false,
    ],
    [
      "highway 120 m at 20 m/s dropped",
      { ...base, at: 6_000, longitude: 88.3 + east(120), speed: 20 },
      base,
      false,
    ],
    [
      "highway 220 m at 20 m/s kept",
      { ...base, at: 11_000, longitude: 88.3 + east(220), speed: 20 },
      base,
      true,
    ],
    [
      "sharp turn kept",
      { ...base, at: 6_000, heading: 90, longitude: 88.3 + east(18), speed: 4 },
      { ...base, heading: 0 },
      true,
    ],
    [
      "GPS jump dropped",
      { ...base, at: 10_000, longitude: 88.3 + east(2_000), speed: 5 },
      base,
      false,
    ],
    [
      "too soon dropped",
      { ...base, at: 3_000, longitude: 88.3 + east(60), speed: 10 },
      base,
      false,
    ],
  ];
  for (const [name, fix, last, keep] of cases) {
    it(name, () => {
      expect(shouldKeep(fix, last)).toBe(keep);
    });
  }
});
