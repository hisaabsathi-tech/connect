import { useEffect, useState } from "react";

import { fetchOrderDetails, type OrderDetails } from "@/lib/api/order-detail";
import { useAuthSession } from "@/lib/auth/session";
import { onReconnect } from "@/lib/network/connectivity";
import { readCache, writeCache } from "@/lib/offline/cache";

const DETAILS_CACHE = "order-details";
// Enough for a long day's sheets; the oldest go first.
const DETAILS_LIMIT = 200;

const hasContent = (details: OrderDetails) =>
  Boolean(details.detail || details.receiver || details.sender);

/** The saved details of an order, if it was ever opened or prefetched on this phone. */
export function savedOrderDetails(orderId: string) {
  return readCache<OrderDetails>(DETAILS_CACHE, orderId)?.data ?? null;
}

/**
 * Loads an order's details and keeps them on the phone. An answer with nothing in it (offline)
 * never replaces what was saved.
 */
export async function loadOrderDetails(token: string, orderId: string) {
  const fresh = await fetchOrderDetails(token, orderId);
  if (hasContent(fresh)) {
    writeCache(DETAILS_CACHE, orderId, fresh, DETAILS_LIMIT);
    return fresh;
  }
  return savedOrderDetails(orderId) ?? fresh;
}

/**
 * Saves the details of every order a sheet takes out, ahead of time, so each one's page opens
 * offline on the road. One at a time, quietly; already saved orders are skipped.
 */
export async function prefetchOrderDetails(token: string, orderIds: string[]) {
  for (const orderId of orderIds) {
    if (savedOrderDetails(orderId)) continue;
    try {
      await loadOrderDetails(token, orderId);
    } catch {
      return;
    }
  }
}

/** The order's full record with its sender and receiver; the saved one at once, null otherwise. */
export function useOrderDetails(orderId: string | null) {
  const { token } = useAuthSession();
  const [details, setDetails] = useState<OrderDetails | null>(() =>
    orderId ? savedOrderDetails(orderId) : null,
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => onReconnect(() => setAttempt((count) => count + 1)), []);
  useEffect(() => {
    if (!(token && orderId)) return;
    let current = true;
    // This order's saved details (or none, showing its loading state), never another order's.
    setDetails(savedOrderDetails(orderId));
    void loadOrderDetails(token, orderId)
      .then((next) => {
        if (current) setDetails(next);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [attempt, orderId, token]);
  return details;
}
