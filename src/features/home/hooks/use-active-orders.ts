import { useEffect, useMemo, useState } from "react";

import {
  type DrsOrder,
  isDrsOngoing,
  isPending,
  ordersFromSheets,
  useDrsSheets,
} from "@/features/orders";
import { geocodeAddress } from "@/lib/api/maps";
import { addDays } from "@/lib/date";
import type { Coordinates } from "@/lib/maps/geo";

/** Where an order goes; `exact` when its street address was found, else its area's centre. */
export type OrderPin = Coordinates & {
  orderId: string;
  awbNo: string;
  receiver: string | null;
  /** The order's address as given (street, area, pincode). */
  address: string;
  exact: boolean;
};

// A DRS can stay open past the day it was issued; sheets this recent still count.
const OPEN_SHEET_DAYS = 30;
// Addresses looked up at a time, so a long run sheet doesn't flood the server.
const GEOCODE_BATCH = 4;

// Looked-up places, kept for the app run (the server caches them for longer).
const places = new Map<string, Promise<Coordinates | null>>();

function lookUp(token: string, address: string) {
  const key = address.toLowerCase();
  let place = places.get(key);
  if (!place) {
    place = geocodeAddress(address, token)
      .then((result) => (result ? { latitude: result.lat, longitude: result.lng } : null))
      .catch(() => {
        places.delete(key);
        return null;
      });
    places.set(key, place);
  }
  return place;
}

const join = (parts: (string | null | undefined)[]) =>
  parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");

/**
 * The street address when there is one, else the area and pincode, which only places the pin
 * in the area (the server calls the first `hasAddress`).
 */
async function placeOrder(token: string, order: DrsOrder): Promise<OrderPin | null> {
  const area = join([order.destinationArea, order.destinationPincode]);
  const street = join([order.addressLine1, order.addressLine2]);
  const base = {
    awbNo: order.awbNo,
    orderId: order.orderId,
    receiver: order.receiverName?.trim() || order.customerName?.trim() || null,
  };
  const full = join([street, area]);
  if (street) {
    const exact = await lookUp(token, full);
    if (exact) return { ...base, ...exact, address: full, exact: true };
  }
  const approximate = area ? await lookUp(token, area) : null;
  // The card still shows the whole address, though the pin only marks its area.
  return approximate ? { ...base, ...approximate, address: full, exact: false } : null;
}

/**
 * A delivery boy's orders still to hand over, on any of their open sheets, with a map pin for
 * each. `active` is known from the sheets alone, before (or without) the pins.
 */
export function useActiveOrders(token: string | null, today: string) {
  const sheets = useDrsSheets(token, { from: addDays(today, -OPEN_SHEET_DAYS), to: today });
  const orders = useMemo(
    () => ordersFromSheets(sheets.sheets.filter(isDrsOngoing), null).filter(isPending),
    [sheets.sheets],
  );
  const [pins, setPins] = useState<OrderPin[]>([]);

  useEffect(() => {
    if (!(token && orders.length)) {
      setPins([]);
      return;
    }
    let current = true;
    void (async () => {
      const placed: OrderPin[] = [];
      for (let start = 0; start < orders.length; start += GEOCODE_BATCH) {
        const batch = await Promise.all(
          orders.slice(start, start + GEOCODE_BATCH).map((order) => placeOrder(token, order)),
        );
        if (!current) return;
        placed.push(...batch.filter((pin): pin is OrderPin => pin !== null));
        // Pins appear batch by batch rather than all at the end.
        setPins([...placed]);
      }
    })();
    return () => {
      current = false;
    };
  }, [orders, token]);

  return { active: orders.length > 0, pins, reload: sheets.load };
}
