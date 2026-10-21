import { apiRequest } from "@/lib/api/client";
import { graphqlRequest } from "@/lib/api/graphql";

export type PickupStatus = "OPEN" | "ASSIGNED" | "RESOLVED" | "CANCELLED" | "OUTDATED";

export type PickupRequest = {
  id: string;
  status: PickupStatus;
  name: string;
  phoneNumber: string;
  pincode: string;
  address: string;
  preferredAt: string;
  note: string | null;
  createdAt: string;
  organizationId: string;
  organizationName: string | null;
};

const MY_PICKUPS_QUERY = `
query MyPickupRequests($from: String $limit: Int $page: Int $q: String $status: String $to: String) {
  myPickupRequests(from: $from limit: $limit page: $page q: $q status: $status to: $to) {
    items { id status name phoneNumber pincode address preferredAt note createdAt organizationId organizationName }
    pagination { total }
  }
}`;

export async function fetchMyPickupRequests(
  token: string,
  input: { from: string; to: string; q?: string; status?: PickupStatus },
) {
  const payload = await graphqlRequest<{
    myPickupRequests: { items: PickupRequest[]; pagination: { total: number } };
  }>({ query: MY_PICKUPS_QUERY, token, variables: { ...input, limit: 200, page: 1 } });
  return payload.myPickupRequests.items;
}

export function markPickupPickedUp(
  token: string,
  pickup: Pick<PickupRequest, "id" | "organizationId">,
) {
  return apiRequest<{ pickupRequest: { id: string } }>(
    `/pickup-requests/${encodeURIComponent(pickup.id)}/picked-up`,
    token,
    { body: JSON.stringify({ organizationId: pickup.organizationId }), method: "PATCH" },
  );
}
