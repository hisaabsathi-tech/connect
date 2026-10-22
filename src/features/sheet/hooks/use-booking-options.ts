import { useCallback, useEffect, useState } from "react";

import { type BookingOptions, fetchBookingOptions } from "@/lib/api/smart-sheets";
import { useAuthSession } from "@/lib/auth/session";
import { onReconnect } from "@/lib/network/connectivity";
import { readCache, writeCache } from "@/lib/offline/cache";

const BOOKING_CACHE = "sheet-booking-options";
const ORGANIZATIONS_KEPT = 20;

const NONE: BookingOptions = { couriers: [], packageTypes: [], travelModes: [] };

/**
 * What an order in the organization can be booked with, for Add Order's courier partner, service
 * type, package type and travel mode. Opens with the lists saved last time (offline too) while
 * fresh ones load; empty until the first answer.
 */
export function useBookingOptions(organizationId: string) {
  const { token } = useAuthSession();
  const [options, setOptions] = useState<BookingOptions>(
    () => readCache<BookingOptions>(BOOKING_CACHE, organizationId)?.data ?? NONE,
  );
  const [loaded, setLoaded] = useState(() => options.couriers.length > 0);

  const load = useCallback(async () => {
    if (!(token && organizationId)) return;
    try {
      const fresh = await fetchBookingOptions(token, organizationId);
      writeCache(BOOKING_CACHE, organizationId, fresh, ORGANIZATIONS_KEPT);
      setOptions(fresh);
    } catch {
      // Keeps the saved lists; the fields just offer nothing new.
    } finally {
      setLoaded(true);
    }
  }, [organizationId, token]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => onReconnect(() => void load()), [load]);

  return { loaded, options };
}
