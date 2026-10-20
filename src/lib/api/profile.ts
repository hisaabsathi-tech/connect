import { graphqlRequest } from "@/lib/api/graphql";
import { env } from "@/lib/env";

export type Profile = {
  address: string | null;
  email: string;
  /** User id; seeds the generated avatar. */
  id: string;
  image: string | null;
  name: string;
  phoneNumber: string | null;
  organizationName: string | null;
  /** The active organisation, to mark it in the organisation switcher. */
  organizationId: string | null;
  role: string | null;
  /** The vehicle assigned in the active organisation (delivery boys), or null. */
  vehicleNo: string | null;
};

const PROFILE_QUERY = `
query ConnectorProfile {
  me {
    orgRole { role }
    organization { id name }
    user { id name email image phoneNumber address }
  }
}`;

/**
 * The vehicle assigned to the signed-in member in the active organisation. The server answers
 * VEHICLE_NOT_FOUND for someone without one, and it is a separate request so that error can't
 * fail the whole profile: any failure here just means there is no vehicle to show.
 */
async function fetchMyVehicleNo(token: string) {
  try {
    const payload = await graphqlRequest<{ myVehicle?: { vehicleNo?: string | null } | null }>({
      query: "query ConnectorMyVehicle { myVehicle { vehicleNo } }",
      token,
    });
    return payload.myVehicle?.vehicleNo?.trim() || null;
  } catch {
    return null;
  }
}

/** The signed-in person's contact data shown in the profile tab, with their vehicle if any. */
export async function fetchProfile(token: string): Promise<Profile> {
  const [payload, vehicleNo] = await Promise.all([
    graphqlRequest<{
      me: {
        orgRole?: { role?: string | null } | null;
        organization?: { id?: string | null; name?: string | null } | null;
        user: Omit<Profile, "organizationId" | "organizationName" | "role" | "vehicleNo">;
      };
    }>({ query: PROFILE_QUERY, token }),
    fetchMyVehicleNo(token),
  ]);
  return {
    ...payload.me.user,
    organizationId: payload.me.organization?.id ?? null,
    organizationName: payload.me.organization?.name ?? null,
    role: payload.me.orgRole?.role ?? null,
    vehicleNo,
  };
}

/** Updates the signed-in user's own profile; `image` takes an uploaded photo's storage key. */
export async function patchProfile(
  token: string,
  input: Partial<Pick<Profile, "address" | "image" | "phoneNumber">>,
): Promise<Pick<Profile, "address" | "phoneNumber">> {
  const response = await fetch(`${env.apiUrl}${env.apiPrefix}/me`, {
    body: JSON.stringify(input),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    method: "PATCH",
  });
  const payload = (await response.json().catch(() => null)) as {
    data?: Pick<Profile, "address" | "phoneNumber">;
    message?: string;
  } | null;
  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "Could not update profile.");
  }
  return payload.data;
}
