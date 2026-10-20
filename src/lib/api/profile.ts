import { graphqlRequest } from "@/lib/api/graphql";
import { env } from "@/lib/env";

export type Profile = {
  address: string | null;
  email: string;
  image: string | null;
  name: string;
  phoneNumber: string | null;
  organizationName: string | null;
  role: string | null;
};

const PROFILE_QUERY = `
query ConnectorProfile {
  me {
    orgRole { role }
    organization { name }
    user { name email image phoneNumber address }
  }
}`;

/** The signed-in person's contact data shown in the profile tab. */
export async function fetchProfile(token: string): Promise<Profile> {
  const payload = await graphqlRequest<{
    me: {
      orgRole?: { role?: string | null } | null;
      organization?: { name?: string | null } | null;
      user: Omit<Profile, "organizationName" | "role">;
    };
  }>({ query: PROFILE_QUERY, token });
  return {
    ...payload.me.user,
    organizationName: payload.me.organization?.name ?? null,
    role: payload.me.orgRole?.role ?? null,
  };
}

export async function patchProfile(
  token: string,
  input: Pick<Profile, "address" | "phoneNumber">,
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
