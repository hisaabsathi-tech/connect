import { describe, expect, it } from "bun:test";
import { bearingBetween, bearingTowardsTarget } from "@/lib/maps/geo";

describe("bearingTowardsTarget", () => {
  const origin = { latitude: 22.88, longitude: 87.78 };
  const targetEast = { latitude: 22.88, longitude: 87.98 }; // Directly East
  const targetNorth = { latitude: 23.08, longitude: 87.78 }; // Directly North

  it("calculates direct bearing when no route coordinates are given", () => {
    const bearingEast = bearingTowardsTarget(origin, targetEast, null);
    expect(Math.round(bearingEast)).toBe(90);

    const bearingNorth = bearingTowardsTarget(origin, targetNorth, null);
    expect(Math.round(bearingNorth)).toBe(0);
  });

  it("follows the road route leaving the origin towards the delivery address", () => {
    // Road leaves origin heading East, then turns North
    const routeCoords: [number, number][] = [
      [87.78, 22.88], // Origin
      [87.8, 22.88], // 2km East
      [87.8, 22.95], // turns North
    ];
    const bearing = bearingTowardsTarget(origin, targetNorth, routeCoords);
    // Even though destination is North, the road leaves origin towards East
    expect(Math.round(bearing)).toBe(90);
  });

  it("advances along the route when the vehicle moves forward", () => {
    const routeCoords: [number, number][] = [
      [87.78, 22.88], // Start
      [87.8, 22.88], // Corner
      [87.8, 22.95], // North to destination
    ];
    // Vehicle is now at the corner heading North
    const atCorner = { latitude: 22.88, longitude: 87.8 };
    const bearing = bearingTowardsTarget(atCorner, targetNorth, routeCoords);
    expect(Math.round(bearing)).toBe(0); // Heading North
  });

  it("falls back to target when route coordinates have only 1 point", () => {
    const routeCoords: [number, number][] = [[87.78, 22.88]];
    const bearing = bearingTowardsTarget(origin, targetEast, routeCoords);
    expect(Math.round(bearing)).toBe(90);
  });
});
