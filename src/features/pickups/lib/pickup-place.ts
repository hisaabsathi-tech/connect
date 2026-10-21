import type { OrderPoint } from "@/features/home/components/home-map";
import type { PickupRequest } from "@/lib/api/pickups";
import { joinAddress, lookUpAddress } from "@/lib/maps/address-lookup";

/**
 * Where a pickup is, for the same full-screen map an order opens: `exact` when its address was
 * found, else the pin only marks its pincode's area. The card along the bottom shows the
 * customer's name as its title.
 */
export async function placePickup(
  token: string,
  request: PickupRequest,
): Promise<OrderPoint | null> {
  const base = {
    awbNo: request.name,
    mobile: request.phoneNumber.trim() || null,
    orderId: request.id,
    receiver: request.name.trim() || null,
  };
  const full = joinAddress([request.address, request.pincode]);
  const exact = await lookUpAddress(token, full);
  if (exact) return { ...base, ...exact, address: full, exact: true };
  const approximate = request.pincode ? await lookUpAddress(token, request.pincode) : null;
  // The card still shows the whole address, though the pin only marks its area.
  return approximate ? { ...base, ...approximate, address: full, exact: false } : null;
}
