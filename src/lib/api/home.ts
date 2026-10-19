import { graphqlRequest } from "@/lib/api/graphql";

export type HomeIdentity = {
  name: string;
  image: string | null;
  roleSlug: string | null;
  menus: string[];
  organization: { name: string; address: string } | null;
};

const HOME_QUERY = `
query ConnectorHome {
  me {
    menus
    orgRole { slug }
    user { name image }
    organization { name }
  }
  organization {
    name addressLine1 addressLine2 city state pincode country
  }
}`;

export async function fetchHomeIdentity(token: string): Promise<HomeIdentity> {
  const payload = await graphqlRequest<{
    me: {
      menus?: string[] | null;
      orgRole?: { slug?: string | null } | null;
      user: { name: string; image?: string | null };
      organization?: { name?: string | null } | null;
    };
    organization?: {
      name: string;
      addressLine1?: string | null;
      addressLine2?: string | null;
      city?: string | null;
      state?: string | null;
      pincode?: string | null;
      country?: string | null;
    } | null;
  }>({ query: HOME_QUERY, token });
  const organization = payload.organization;
  const address = organization
    ? [
        organization.addressLine1,
        organization.addressLine2,
        organization.city,
        organization.state,
        organization.pincode,
        organization.country,
      ]
        .filter((part): part is string => Boolean(part?.trim()))
        .join(", ")
    : "";
  return {
    image: payload.me.user.image ?? null,
    menus: payload.me.menus ?? [],
    name: payload.me.user.name,
    organization: organization ? { address, name: organization.name } : null,
    roleSlug: payload.me.orgRole?.slug ?? null,
  };
}
