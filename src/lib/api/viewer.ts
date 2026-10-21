import { graphqlRequest } from "@/lib/api/graphql";

export type ViewerOrganization = {
  name: string;
  /** A displayable URL, or null when the organisation has no logo. */
  logo: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
};

export type Viewer = {
  name: string;
  roleSlug: string | null;
  organization: ViewerOrganization | null;
  /** The member's granted `attendance` actions (GET, GET_ALL, CREATE, …); empty without any. */
  attendanceActions: string[];
  /** The member's granted `order` actions (GET, UPDATE, …); empty without any. */
  orderActions: string[];
  /** True when an enabled same-owner organization grants this delivery boy Pickup access. */
  canViewPickups: boolean;
};

const VIEWER_QUERY = `
query ConnectorViewer {
  me {
    orgRole { slug }
    permissions { resource actions }
    user { name }
  }
  organization {
    name logo addressLine1 addressLine2 city state pincode
  }
  pickupAvailability { eligible }
}`;

const isUrl = (value: string | null | undefined) => /^(https?:|data:)/i.test(value?.trim() ?? "");

/** Who is signed in to the active organisation: their name, role, attendance access, and the organisation. */
export async function fetchViewer(token: string): Promise<Viewer> {
  const payload = await graphqlRequest<{
    me: {
      orgRole?: { slug?: string | null } | null;
      permissions?: { resource: string; actions: string[] }[] | null;
      user: { name: string };
    };
    organization?: {
      name: string;
      logo?: string | null;
      addressLine1?: string | null;
      addressLine2?: string | null;
      city?: string | null;
      state?: string | null;
      pincode?: string | null;
    } | null;
    pickupAvailability?: { eligible?: boolean | null } | null;
  }>({ query: VIEWER_QUERY, token });
  const organization = payload.organization;
  const actionsOn = (resource: string) =>
    payload.me.permissions?.find((grant) => grant.resource === resource)?.actions ?? [];
  return {
    attendanceActions: actionsOn("attendance"),
    canViewPickups: Boolean(payload.pickupAvailability?.eligible),
    name: payload.me.user.name,
    organization: organization
      ? {
          addressLine1: organization.addressLine1 ?? null,
          addressLine2: organization.addressLine2 ?? null,
          city: organization.city ?? null,
          logo: isUrl(organization.logo) ? (organization.logo ?? null) : null,
          name: organization.name,
          pincode: organization.pincode ?? null,
          state: organization.state ?? null,
        }
      : null,
    orderActions: actionsOn("order"),
    roleSlug: payload.me.orgRole?.slug ?? null,
  };
}
