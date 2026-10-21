/**
 * How a vehicle is drawn on every map (and on the trip card's progress bar), chosen from its
 * wheel count as set on the vehicle in the software. Change the drawing here and only here.
 */

/** The wheel counts a vehicle can be saved with. */
export type WheelCount = "2" | "3" | "4";

/** The vehicle markers there is artwork for. */
export type VehiclePin = "rider" | "truck";

/** Which marker each wheel count gets: a two-wheeler is the rider, anything bigger the truck. */
export const VEHICLE_PIN_BY_WHEELS: Record<WheelCount, VehiclePin> = {
  "2": "rider",
  "3": "truck",
  "4": "truck",
};

/** A vehicle whose wheel count isn't set yet (saved before it was asked). */
export const UNKNOWN_WHEELS_PIN: VehiclePin = "rider";

/**
 * Each marker's artwork, seen from above with the front facing up, and its size on a map. The
 * maps turn it to the direction of travel; the trip card turns it a quarter to drive right.
 */
export const VEHICLE_PIN_ART: Record<
  VehiclePin,
  {
    source: number;
    /** Width ÷ height of the artwork. */
    aspect: number;
    /** Its size on a map. */
    map: { width: number; height: number };
    /** Its length along the trip card's progress bar. */
    bar: number;
  }
> = {
  // 410×614
  rider: {
    aspect: 410 / 614,
    bar: 44,
    map: { height: 48, width: 32 },
    source: require("@/assets/map-pin/delivery-pin.webp"),
  },
  // 140×342
  truck: {
    aspect: 140 / 342,
    bar: 56,
    map: { height: 50, width: 20 },
    source: require("@/assets/map-pin/truck.webp"),
  },
};

/** The marker for a vehicle with `wheelCount` wheels ("2", "3", "4"; null or unknown → default). */
export function vehiclePinFor(wheelCount: string | null | undefined): VehiclePin {
  return VEHICLE_PIN_BY_WHEELS[wheelCount as WheelCount] ?? UNKNOWN_WHEELS_PIN;
}
