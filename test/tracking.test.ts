import { beforeEach, describe, expect, it } from "bun:test";

import { reportReachable, reportUnreachable } from "@/lib/network/connectivity";
import { flushTracking, watchTrackingFlush } from "@/lib/tracking/flush";
import { type Fix, MAX_SPEED_MPS, shouldKeep } from "@/lib/tracking/sampler";
import {
  type QueuedPoint,
  readTracking,
  setTrackingIdentity,
  writeTracking,
} from "@/lib/tracking/store";

import { fake, freshPhone, settle } from "./fake";

const ME = "USR1:ORG1";
const OTHER_ORG = "USR1:ORG2";

const point = (n: number, scope: string | null = ME): QueuedPoint => ({
  accuracy: 8,
  clientPointId: `p${n}`,
  drsId: "DRS1",
  heading: null,
  latitude: 22.6 + n / 10_000,
  longitude: 88.3,
  queuedAt: Date.now(),
  recordedAt: new Date(Date.UTC(2026, 9, 21, 9, 0, n)).toISOString(),
  scope,
  speed: 5,
  tripId: "TRIP1",
  vehicleId: "VEH1",
});

const queue = (count: number, scope: string | null = ME) =>
  writeTracking((state) => ({
    ...state,
    failures: 0,
    queue: Array.from({ length: count }, (_, n) => point(n, scope)),
    retryAfter: false,
    retryAt: 0,
  }));

const batches = () => fake.server.calls.filter((call) => call.path.endsWith("/track/batch"));
const sentIds = () =>
  batches().flatMap((call) =>
    (call.body as { points: { clientPointId: string }[] }).points.map((p) => p.clientPointId),
  );

/** The server acknowledges every point it is sent. */
const acknowledgeAll = () =>
  fake.server.routes.set("POST /delivery/vehicles/VEH1/track/batch", (call) => ({
    body: {
      data: {
        accepted: (call.body as { points: { clientPointId: string }[] }).points.map(
          (p) => p.clientPointId,
        ),
        rejected: [],
      },
      success: true,
    },
  }));

beforeEach(() => {
  freshPhone();
  reportReachable();
  writeTracking(() => ({
    anchor: null,
    duty: null,
    failures: 0,
    identity: ME,
    queue: [],
    retryAfter: false,
    retryAt: 0,
  }));
  acknowledgeAll();
});

describe("live location offline", () => {
  it("keeps recording while offline, sending nothing", async () => {
    fake.server.offline = true;
    reportUnreachable("no_network");
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

  it("sends each point's trip id, and its queue depth and age for the server's metrics", async () => {
    let headers: Record<string, string> = {};
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
      if (String(input).endsWith("/track/batch")) {
        headers = Object.fromEntries(new Headers(init.headers).entries());
      }
      return original(input, init);
    }) as typeof fetch;
    try {
      queue(3);
      await flushTracking({ force: true });
    } finally {
      globalThis.fetch = original;
    }
    const body = batches()[0]?.body as { points: { tripId: string }[] };
    expect(body.points.every((p) => p.tripId === "TRIP1")).toBe(true);
    expect(headers["x-tracking-queue-depth"]).toBe("3");
    expect(Number(headers["x-tracking-queue-age-ms"])).toBeGreaterThanOrEqual(0);
  });

  it("flushes by itself the moment the connection returns, without a new GPS reading", async () => {
    watchTrackingFlush();
    fake.server.offline = true;
    reportUnreachable("no_network");
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
    reportUnreachable("no_network"); // marked offline, but the network has quietly come back
    queue(2);
    expect(await flushTracking({ force: true })).toBe("sent");
  });

  it("signed out: nothing is sent, nothing is lost", async () => {
    fake.secure.clear();
    queue(2);
    expect(await flushTracking({ force: true })).toBe("signed-out");
    expect(readTracking().queue).toHaveLength(2);
  });
});

describe("acknowledgement", () => {
  it("deletes only acknowledged points, keeps retryable ones and quarantines permanent ones", async () => {
    fake.server.routes.set("POST /delivery/vehicles/VEH1/track/batch", () => ({
      body: {
        data: {
          accepted: ["p0"],
          rejected: [
            { clientPointId: "p1", code: "UNAVAILABLE", retryable: true },
            { clientPointId: "p2", code: "OUTSIDE_TRIP", retryable: false },
          ],
        },
        success: true,
      },
    }));
    queue(4); // p3 got no answer at all
    expect(await flushTracking({ force: true })).toBe("failed");
    const left = readTracking().queue.map((p) => p.clientPointId);
    expect(left).toEqual(["p1", "p3"]);
    expect(fake.sqliteRows.get("p2")?.state).toBe("quarantined");
    expect(fake.sqliteRows.has("p0")).toBe(false);
  });

  it("respects the server's Retry-After, even for a forced send", async () => {
    fake.server.routes.set("POST /delivery/vehicles/VEH1/track/batch", () => ({
      body: { message: "Slow down" },
      status: 429,
    }));
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const response = await original(input, init);
      if (!String(input).endsWith("/track/batch")) return response;
      return new Response(await response.text(), {
        headers: { "Retry-After": "120" },
        status: response.status,
      });
    }) as typeof fetch;
    try {
      queue(2);
      expect(await flushTracking({ force: true })).toBe("failed");
    } finally {
      globalThis.fetch = original;
    }
    const state = readTracking();
    expect(state.retryAfter).toBe(true);
    expect(state.retryAt - Date.now()).toBeGreaterThan(100_000);
    acknowledgeAll();
    expect(await flushTracking({ force: true })).toBe("waiting");
    expect(readTracking().queue).toHaveLength(2);
  });

  it("backs off with jitter after a failure, never hammering the server", async () => {
    fake.server.routes.set("POST /delivery/vehicles/VEH1/track/batch", () => ({ status: 500 }));
    queue(1);
    await flushTracking({ force: true });
    const first = readTracking();
    expect(first.failures).toBe(1);
    expect(first.retryAt).toBeGreaterThan(Date.now());
    expect(await flushTracking()).toBe("waiting");
  });
});

describe("whose points go out", () => {
  it("sends only the signed-in login's points; another organisation's wait for it", async () => {
    writeTracking((state) => ({
      ...state,
      queue: [point(1, ME), point(2, OTHER_ORG), point(3, ME)],
    }));
    expect(await flushTracking({ force: true })).toBe("sent");
    expect(sentIds()).toEqual(["p1", "p3"]);
    expect(readTracking().queue.map((p) => p.clientPointId)).toEqual(["p2"]);
  });

  it("while the login is unknown (signing out, switching), nothing is sent and nothing lost", async () => {
    queue(3);
    setTrackingIdentity(null);
    expect(await flushTracking({ force: true })).toBe("waiting");
    expect(batches()).toHaveLength(0);
    setTrackingIdentity(ME);
    expect(await flushTracking({ force: true })).toBe("sent");
    expect(sentIds()).toHaveLength(3);
  });

  it("points saved before scoping are claimed by the first known login", async () => {
    setTrackingIdentity(null);
    queue(2, null);
    setTrackingIdentity(ME);
    expect(readTracking().queue.every((p) => p.scope === ME)).toBe(true);
    expect(await flushTracking({ force: true })).toBe("sent");
  });

  it("migrates the old JSON queue into SQLite once, without losing or doubling a point", async () => {
    fake.sqliteRows.clear();
    fake.files.set(
      "doc/live-trip.json",
      JSON.stringify({
        anchor: null,
        duty: { drsId: "DRS1", label: "DRS DRS1", tripId: "TRIP1", vehicleId: "VEH1" },
        failures: 0,
        queue: [point(1, null), point(2, null)].map(({ scope: _, tripId: __, ...old }) => old),
        retryAt: 0,
      }),
    );
    setTrackingIdentity(ME); // a fresh read, as at app launch
    const migrated = readTracking().queue;
    expect(migrated.map((p) => p.clientPointId)).toEqual(["p1", "p2"]);
    expect(migrated.every((p) => p.tripId === "TRIP1")).toBe(true);
    expect(fake.sqliteRows.size).toBe(2);
    setTrackingIdentity(ME); // read again: the JSON queue is not imported twice
    expect(fake.sqliteRows.size).toBe(2);
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
    ["parked heartbeat kept", { ...base, at: 60_000, longitude: 88.3 + east(5) }, base, true],
    [
      "parked, before the heartbeat, dropped",
      { ...base, at: 50_000, longitude: 88.3 + east(5) },
      base,
      false,
    ],
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
      "highway 260 m at 20 m/s (13 s) kept",
      { ...base, at: 13_000, longitude: 88.3 + east(260), speed: 20 },
      base,
      true,
    ],
    [
      "350 km/h train, 1.2 km in 12.5 s, kept",
      { ...base, at: 12_500, longitude: 88.3 + east(1_200), speed: MAX_SPEED_MPS * 0.99 },
      base,
      true,
    ],
    [
      "faster than 350 km/h is a jump, dropped",
      { ...base, at: 10_000, longitude: 88.3 + east(1_200), speed: 97 },
      base,
      false,
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
      "noisy but honest fixes are not a jump (accuracy allowance)",
      {
        ...base,
        accuracy: 45,
        at: 11_000,
        // 1.1 km in 11 s is 100 m/s (360 km/h) raw, 92 m/s once both 45 m radii are allowed for.
        longitude: 88.3 + east(1_100),
        speed: 90,
      },
      { ...base, accuracy: 45 },
      true,
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
