import { useEffect, useState } from "react";

import { fetchOrderDetails, type OrderDetails } from "@/lib/api/order-detail";
import { useAuthSession } from "@/lib/auth/session";

/** The order's full record with its sender and receiver; null while it loads. */
export function useOrderDetails(orderId: string | null) {
  const { token } = useAuthSession();
  const [details, setDetails] = useState<OrderDetails | null>(null);
  useEffect(() => {
    if (!(token && orderId)) return;
    let current = true;
    setDetails(null);
    void fetchOrderDetails(token, orderId).then((next) => {
      if (current) setDetails(next);
    });
    return () => {
      current = false;
    };
  }, [orderId, token]);
  return details;
}
