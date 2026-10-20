import { useEffect, useState } from "react";

import { useAuthSession } from "@/lib/auth/session";

import { type OrderPin, placeOrder } from "../lib/order-place";
import type { DrsOrder } from "../lib/orders";

/**
 * Where the order goes on the map (its address looked up, cached for the app run). `found` is
 * false once the lookup finished without a place.
 */
export function useOrderPin(order: DrsOrder | null) {
  const { token } = useAuthSession();
  const [pin, setPin] = useState<OrderPin | null>(null);
  const [looked, setLooked] = useState(false);
  useEffect(() => {
    if (!(token && order)) return;
    let current = true;
    setLooked(false);
    void placeOrder(token, order).then((next) => {
      if (!current) return;
      setPin(next);
      setLooked(true);
    });
    return () => {
      current = false;
    };
  }, [order, token]);
  return { found: !looked || pin !== null, pin };
}
