import { useEffect, useMemo, useState } from "react";

import {
  isDrsOngoing,
  isPending,
  type OrderPin,
  ordersFromSheets,
  placeOrder,
  useDrsSheets,
} from "@/features/orders";
import { addDays } from "@/lib/date";

export type { OrderPin };

// A DRS can stay open past the day it was issued; sheets this recent still count.
const OPEN_SHEET_DAYS = 30;
// Addresses looked up at a time, so a long run sheet doesn't flood the server.
const GEOCODE_BATCH = 4;

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
