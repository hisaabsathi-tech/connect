import { describe, expect, it } from "bun:test";

import { newerPoint } from "@/features/live-trips/lib/live-trips-store";
import { mergeTripPath, type TripPathPoint } from "@/lib/api/live-trips";
import { distanceInMetres, simplifyForDisplay } from "@/lib/maps/geo";

const at = (id: string, second: number, lat = 22.5): TripPathPoint => ({
  id,
  latitude: lat,
  longitude: 88.3,
  recordedAt: new Date(Date.UTC(2026, 9, 21, 9, 0, second)).toISOString(),
});

describe("the trip path", () => {
  it("merges pages and pushed points by id, oldest first, never doubling a point", () => {
    const pageOne = [at("a", 1), at("b", 2)];
    const pushed = [at("c", 4), at("b", 2)];
    const late = [at("x", 3)]; // an offline backlog arriving after newer points
    const merged = mergeTripPath(mergeTripPath(pageOne, pushed), late);
    expect(merged.map((p) => p.id)).toEqual(["a", "b", "x", "c"]);
  });

  it("keeps two different points with the same timestamp", () => {
    const merged = mergeTripPath([at("a", 1)], [at("b", 1, 22.6)]);
    expect(merged.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("the vehicle sits at the newer of the path's end and the snapshot's last point", () => {
    const pathEnd = at("a", 10);
    const snapshot = { latitude: 22.7, longitude: 88.3, recordedAt: at("z", 20).recordedAt };
    expect(newerPoint(pathEnd, snapshot)).toBe(snapshot);
    expect(newerPoint(snapshot, pathEnd)).toBe(snapshot);
    expect(newerPoint(null, pathEnd)).toBe(pathEnd);
    expect(newerPoint(null, null)).toBeNull();
  });
});

describe("drawing a long path", () => {
  // A straight road east with a little GPS wobble, then a right-angle turn north.
  const line = [
    ...Array.from({ length: 400 }, (_, i) => ({
      latitude: 22.5 + (i % 2 ? 0.000_01 : 0),
      longitude: 88.3 + i * 0.000_1,
    })),
    ...Array.from({ length: 400 }, (_, i) => ({
      latitude: 22.5 + (i + 1) * 0.000_1,
      longitude: 88.3 + 399 * 0.000_1,
    })),
  ];

  it("keeps short paths exactly as they are", () => {
    expect(simplifyForDisplay(line.slice(0, 50))).toHaveLength(50);
  });

  it("thins a long path, keeping both ends and the turn", () => {
    const shown = simplifyForDisplay(line);
    expect(shown.length).toBeLessThan(line.length / 10);
    expect(shown[0]).toBe(line[0]);
    expect(shown.at(-1)).toBe(line.at(-1));
    const corner = line[399];
    if (!corner) throw new Error("no corner");
    expect(shown.some((p) => distanceInMetres(p, corner) < 5)).toBe(true);
  });
});
