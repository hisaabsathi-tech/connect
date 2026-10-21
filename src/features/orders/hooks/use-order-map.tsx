import { useCallback, useState } from "react";

import { useToast } from "@/components/ui/toast";
import { OrderLocationMap, type OrderMapState } from "@/features/home/components/home-map";
import { useLiveLocation } from "@/hooks/use-live-location";
import { useAuthSession } from "@/lib/auth/session";
import { isOnline } from "@/lib/network/connectivity";

import { type OrderPin, placeOrder } from "../lib/order-place";
import { type DrsOrder, isDelivered } from "../lib/orders";

/**
 * An order card's View on Map: finds the order's address, then opens the full-screen map on it
 * with the delivery boy's position beside it. Their location is read only while the map is open.
 * `locating` is the order whose address is being found. Render `element` once.
 */
export function useOrderMap() {
  const { token } = useAuthSession();
  const toast = useToast();
  const [locating, setLocating] = useState<string | null>(null);
  const [shown, setShown] = useState<OrderPin | null>(null);
  const [state, setState] = useState<OrderMapState>({ delivered: false, deliveredAt: null });
  // A delivered order's map shows where it went, not where the delivery boy is now.
  const live = useLiveLocation(shown !== null && !state.delivered);

  /** `deliveredAt`: where a delivered order was handed over, when known (the update page). */
  const open = useCallback(
    async (order: DrsOrder, deliveredAt: OrderMapState["deliveredAt"] = null) => {
      if (!token || locating) return;
      setLocating(order.orderId);
      try {
        const pin = await placeOrder(token, order);
        if (pin) {
          setState({ delivered: isDelivered(order), deliveredAt });
          setShown(pin);
        }
        // Offline the place couldn't be looked up at all; that isn't a bad address.
        else
          toast.error(
            isOnline() ? "Address not found on the map" : "The map needs internet",
            isOnline()
              ? "Use the address on the card, or call the receiver."
              : "This address hasn't been found before. Use the address on the card for now.",
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
      state={state}
    />
  );

  return { element, locating, open };
}
