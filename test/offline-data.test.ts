import { beforeEach, describe, expect, it } from "bun:test";
import {
  cachedDrsSheets,
  cachedRange,
  loadDrsSheets,
  patchCachedOrder,
} from "@/features/orders/lib/drs-cache";
import type { DrsSheet } from "@/lib/api/drs";
import { isNetworkError } from "@/lib/api/network";
import { reportReachable, reportUnreachable } from "@/lib/network/connectivity";
import { clearCache, onCacheCleared, readCache, writeCache } from "@/lib/offline/cache";

import { fake, freshPhone, TOKEN } from "./fake";

const sheet = {
  areas: [],
  id: "DRS1",
  issuedAt: "2026-10-21T03:30:00.000Z",
  orders: [{ awbNo: "A1", orderId: "O1", shipmentStatus: "OUT FOR DELIVERY" }],
  pincodes: [],
  scanCopy: null,
  status: "OUT FOR DELIVERY",
} as unknown as DrsSheet;
const day = { from: "2026-10-20T18:30:00.000Z", to: "2026-10-21T18:29:59.999Z" };

beforeEach(() => {
  freshPhone();
  reportReachable();
});

describe("saved cache", () => {
  it("keeps answers in a file, so they are there after the app restarts", () => {
    writeCache("profile", "me", { name: "Suman" });
    expect(readCache<{ name: string }>("profile", "me")?.data.name).toBe("Suman");
    expect(fake.files.has("doc/offline/profile.json")).toBe(true);
  });

  it("keeps only the newest entries of a kind", async () => {
    for (const day of ["d1", "d2", "d3"]) {
      writeCache("days", day, day, 2);
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
    expect(readCache("days", "d1")).toBeNull();
    expect(readCache("days", "d3")?.data).toBe("d3");
  });

  it("forgets everything on sign-out or an organisation switch, telling the stores", () => {
    let told = false;
    onCacheCleared(() => {
      told = true;
    });
    writeCache("profile", "me", { name: "Suman" });
    clearCache();
    expect(readCache("profile", "me")).toBeNull();
    expect(told).toBe(true);
  });
});

describe("DRS sheets offline", () => {
  it("shows the last loaded sheets when offline, with when they were loaded", async () => {
    fake.server.routes.set("POST /graphql", () => ({
      body: { data: { myDrsSheets: { items: [sheet], pagination: { total: 1 } } } },
    }));
    await loadDrsSheets("s", TOKEN, day);
    fake.server.offline = true;
    reportUnreachable();
    const error = await loadDrsSheets("s", TOKEN, day).catch((caught) => caught);
    expect(isNetworkError(error)).toBe(true);
    expect(cachedDrsSheets("s", day)?.[0]?.id).toBe("DRS1");
    expect(typeof cachedRange("s", day)?.savedAt).toBe("number");
  });

  it("shows an order updated offline as updated everywhere at once", async () => {
    fake.server.routes.set("POST /graphql", () => ({
      body: { data: { myDrsSheets: { items: [sheet], pagination: { total: 1 } } } },
    }));
    await loadDrsSheets("s", TOKEN, day);
    patchCachedOrder("O1", { shipmentStatus: "DELIVERED" });
    expect(cachedDrsSheets("s", day)?.[0]?.orders[0]?.shipmentStatus).toBe("DELIVERED");
  });
});
