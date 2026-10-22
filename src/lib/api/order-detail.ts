import { graphqlRequest } from "@/lib/api/graphql";

/** A sender or receiver as the order's tracking resolves them (cash parties or credit customers). */
export type OrderParty = {
  name: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  area: string | null;
  pincode: string | null;
  state: string | null;
  /** One line; only area and pincode when there is no street address. */
  fullAddress: string | null;
};

export type OrderDetail = {
  refNo: string | null;
  date: string | null;
  serviceType: string | null;
  packageType: string | null;
  senderName: string | null;
  customerName: string | null;
  actualWeight: number | null;
  chargableWeight: number | null;
  productValue: number | null;
  contentType: string | null;
  products: { productName: string | null; quantity: number | null }[] | null;
  ewayBill: string | null;
  deliveryAttemptCount: number | null;
};

const PARTY_FIELDS = "name phone addressLine1 addressLine2 area pincode state fullAddress";

const ORDER_QUERY = `
query ConnectOrderDetail($id: String!) {
  order(id: $id) {
    refNo date serviceType packageType senderName customerName
    actualWeight chargableWeight productValue contentType ewayBill deliveryAttemptCount
    products { productName quantity }
  }
}`;

const PARTIES_QUERY = `
query ConnectOrderParties($orderId: String!) {
  orderTracking(orderId: $orderId) {
    addresses {
      pickup { ${PARTY_FIELDS} }
      delivery { ${PARTY_FIELDS} }
    }
    logs { shipmentStatus latitude longitude address recordedAt }
    order { podStorageKey }
  }
}`;

type TrackingLog = {
  shipmentStatus: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  recordedAt: string | null;
};

/** Where the order was handed over: the location sent with its Confirm Delivery. */
export type DeliveredAt = { latitude: number; longitude: number; address: string | null };

/** The latest "delivered" log that carries a location. */
function deliveredAt(logs: TrackingLog[] | null | undefined): DeliveredAt | null {
  const delivered = (logs ?? [])
    .filter(
      (log) =>
        log.shipmentStatus === "DELIVERED" &&
        typeof log.latitude === "number" &&
        typeof log.longitude === "number",
    )
    .sort((a, b) => Date.parse(b.recordedAt ?? "") - Date.parse(a.recordedAt ?? ""))[0];
  return delivered
    ? {
        address: delivered.address?.trim() || null,
        latitude: delivered.latitude as number,
        longitude: delivered.longitude as number,
      }
    : null;
}

export type OrderDetails = {
  detail: OrderDetail | null;
  sender: OrderParty | null;
  receiver: OrderParty | null;
  /** Null until delivered, or when the delivery was confirmed without a location. */
  deliveredAt: DeliveredAt | null;
  /** Storage key of the photo sent with Confirm Delivery; `fetchViewUrl` signs it. */
  podStorageKey: string | null;
};

/**
 * The order's full record, its sender and receiver, and where it was delivered (from its
 * tracking logs). Each half loads on its own, so a part the member may not read (or that fails)
 * only leaves its own fields empty.
 */
export async function fetchOrderDetails(token: string, orderId: string): Promise<OrderDetails> {
  const [order, tracking] = await Promise.all([
    graphqlRequest<{ order: OrderDetail | null }>({
      query: ORDER_QUERY,
      token,
      variables: { id: orderId },
    }).catch(() => null),
    graphqlRequest<{
      orderTracking: {
        addresses: { pickup: OrderParty | null; delivery: OrderParty | null } | null;
        logs: TrackingLog[] | null;
        order: { podStorageKey: string | null } | null;
      } | null;
    }>({ query: PARTIES_QUERY, token, variables: { orderId } }).catch(() => null),
  ]);
  const addresses = tracking?.orderTracking?.addresses ?? null;
  return {
    deliveredAt: deliveredAt(tracking?.orderTracking?.logs),
    detail: order?.order ?? null,
    // From the tracking, which the delivery boy can read without order:GET.
    podStorageKey: tracking?.orderTracking?.order?.podStorageKey ?? null,
    receiver: addresses?.delivery ?? null,
    sender: addresses?.pickup ?? null,
  };
}
