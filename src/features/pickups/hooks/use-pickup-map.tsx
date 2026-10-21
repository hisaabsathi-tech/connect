import { useCallback, useState } from "react";

import { useToast } from "@/components/ui/toast";
import { OrderLocationMap, type OrderPoint } from "@/features/home/components/home-map";
import { useLiveLocation } from "@/hooks/use-live-location";
import type { PickupRequest } from "@/lib/api/pickups";
import { useAuthSession } from "@/lib/auth/session";

import { placePickup } from "../lib/pickup-place";

// A pickup is always still to collect on the map: the route runs from where the user is.
const STILL_TO_COLLECT = { delivered: false, deliveredAt: null };

/**
 * A pickup card's map button, the same as an order's View on Map: finds the pickup's address,
 * then opens the full-screen map with the user, the pickup's pin and the road between them, the
 * legend, and the card with View Location and Directions. `locating` is the request being
 * found. Render `element` once.
 */
export function usePickupMap() {
  const { token } = useAuthSession();
  const toast = useToast();
  const [locating, setLocating] = useState<string | null>(null);
  const [shown, setShown] = useState<OrderPoint | null>(null);
  // Read only while the map is open.
  const live = useLiveLocation(shown !== null);

  const open = useCallback(
    async (request: PickupRequest) => {
      if (!token || locating) return;
      setLocating(request.id);
      try {
        const pin = await placePickup(token, request);
        if (pin) setShown(pin);
        else
          toast.error(
            "Address not found on the map",
            "Use the address on the card, or call the customer.",
          );
      } finally {
        setLocating(null);
      }
    },
    [locating, toast, token],
  );

  const element = (
    <OrderLocationMap
      live={live.location}
      onClose={() => setShown(null)}
      order={shown}
      state={STILL_TO_COLLECT}
    />
  );

  return { element, locating, open };
}
