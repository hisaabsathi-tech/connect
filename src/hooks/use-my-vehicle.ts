import { useEffect, useSyncExternalStore } from "react";

import { graphqlRequest } from "@/lib/api/graphql";
import { useAuthSession } from "@/lib/auth/session";
import { onReconnect } from "@/lib/network/connectivity";
import { onCacheCleared, readCache, writeCache } from "@/lib/offline/cache";

/** The vehicle assigned to the signed-in member, as far as the maps need it. */
export type MyVehicle = { id: string; vehicleNo: string; wheelCount: string | null };

const VEHICLE_CACHE = "my-vehicle";

// Shared by every map on screen and kept on the phone, so the right pin shows offline too.
let vehicle: MyVehicle | null = readCache<MyVehicle | null>(VEHICLE_CACHE, "me")?.data ?? null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: MyVehicle | null) {
  vehicle = next;
  for (const listener of listeners) listener();
}

onCacheCleared(() => set(null));

/** Asks the server again; a member without a vehicle gets none (the server answers an error). */
function load(token: string) {
  loading ??= graphqlRequest<{ myVehicle?: MyVehicle | null }>({
    query: "query ConnectorMyVehicleWheels { myVehicle { id vehicleNo wheelCount } }",
    token,
  })
    .then(({ myVehicle }) => {
      const next = myVehicle ?? null;
      writeCache(VEHICLE_CACHE, "me", next, 1);
      set(next);
    })
    .catch(() => undefined)
    .finally(() => {
      loading = null;
    });
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The member's own vehicle (null without one), loaded once per run and again when the app is
 * back online, so a wheel count changed in the software reaches the maps.
 */
export function useMyVehicle() {
  const { token } = useAuthSession();
  useEffect(() => {
    if (!token) return;
    void load(token);
    return onReconnect(() => void load(token));
  }, [token]);
  return useSyncExternalStore(subscribe, () => vehicle);
}
