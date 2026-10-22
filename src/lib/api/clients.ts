import { graphqlRequest } from "@/lib/api/graphql";

/** A credit customer the organisation books orders for, as the Smart Sheet's client. */
export type Client = {
  id: string;
  name: string;
  /** The organisation's own id for the client, e.g. "PRAKRITIK". */
  orgGivenId: string;
};

const CLIENTS_QUERY = `
query SheetClients($filter: CustomerFilterInput $limit: Int $page: Int) {
  customers(filter: $filter limit: $limit page: $page) {
    items { id name orgGivenId }
    pagination { total }
  }
}`;

// The server's largest page.
const PAGE_SIZE = 200;

/**
 * Every credit customer in the active organisation, by name: the clients the web Smart Sheet
 * offers. Needs customer GET_ALL.
 */
export async function fetchClients(token: string): Promise<Client[]> {
  const clients: Client[] = [];
  for (let page = 1; ; page += 1) {
    const payload = await graphqlRequest<{
      customers: { items: Client[]; pagination: { total: number } };
    }>({
      query: CLIENTS_QUERY,
      token,
      variables: { filter: { baseRole: { eq: "CREDIT" } }, limit: PAGE_SIZE, page },
    });
    const { items, pagination } = payload.customers;
    clients.push(...items);
    if (items.length < PAGE_SIZE || clients.length >= pagination.total) break;
  }
  return clients.sort((a, b) => a.name.localeCompare(b.name));
}
