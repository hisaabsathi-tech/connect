import { useCallback, useState } from "react";

import { useToast } from "@/components/ui/toast";
import { OrderLocationMap } from "@/features/home/components/home-map";
import { useLiveLocation } from "@/hooks/use-live-location";
import { useAuthSession } from "@/lib/auth/session";

import { type OrderPin, placeOrder } from "../lib/order-place";
import type { DrsOrder } from "../lib/orders";

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
  const live = useLiveLocation(shown !== null);

  const open = useCallback(
    async (order: DrsOrder) => {
      if (!token || locating) return;
      setLocating(order.orderId);
      try {
        const pin = await placeOrder(token, order);
        if (pin) setShown(pin);
        else
          toast.error(
            "Address not found on the map",
            "Use the address on the card, or call the receiver.",
          );
      } finally {
        setLocating(null);
      }
    },
    [locating, toast, token],
  );

  const element = (
    <OrderLocationMap live={live.location} onClose={() => setShown(null)} order={shown} />
  );

  return { element, locating, open };
}
