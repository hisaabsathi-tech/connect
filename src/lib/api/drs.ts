import { apiRequest } from "@/lib/api/client";
import { graphqlRequest } from "@/lib/api/graphql";

/** A DRS's life: issued, taken out, orders being delivered (set by the server), resolved. */
export const DRS_STATUSES = [
  "ISSUED",
  "OUT FOR DELIVERY",
  "DELIVERING ORDERS",
  "RESOLVED",
] as const;

export type DrsStatus = (typeof DRS_STATUSES)[number];

export type DrsOrderLine = {
  orderId: string;
  awbNo: string;
  refNo: string | null;
  receiverName: string | null;
  customerName: string | null;
  customerMobile: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  destinationArea: string | null;
  destinationPincode: string | null;
  /** `COD`, `PREPAID` or `TO_PAY`. */
  paymentType: string | null;
  shipmentStatus: string | null;
  finalInvoiceAmount: number | null;
  topayAmount: number | null;
  deliveryOtpRequired: boolean;
  center: string | null;
  serviceType: string | null;
  packageType: string | null;
  remarks: string | null;
};

export type DrsSheet = {
  id: string;
  status: DrsStatus;
  issuedAt: string;
  pincodes: string[];
  areas: { pincode: string; area: string }[];
  /** Storage key of the uploaded scan of the signed sheet. */
  scanCopy: string | null;
  orders: DrsOrderLine[];
  /** The organization it was issued in; missing on a sheet the phone saved before the app asked. */
  organizationId?: string;
  organizationName?: string | null;
};

const DRS_SHEET_FIELDS = `
  id status issuedAt pincodes scanCopy organizationId organizationName
  areas { pincode area }
  orders {
    orderId awbNo refNo receiverName customerName customerMobile addressLine1 addressLine2
    destinationArea destinationPincode paymentType shipmentStatus finalInvoiceAmount topayAmount
    deliveryOtpRequired center serviceType packageType remarks
  }`;

const MY_DRS_SHEETS_QUERY = `
query MyDrsSheets($from: String $limit: Int $page: Int $q: String $to: String) {
  myDrsSheets(from: $from limit: $limit page: $page q: $q to: $to) {
    items { ${DRS_SHEET_FIELDS} }
    pagination { total }
  }
}`;

const DRS_QUERY = `
query Drs($id: String!) {
  drs(id: $id) { ${DRS_SHEET_FIELDS} }
}`;

// The server's largest page; a day rarely has more than a handful of sheets.
const PAGE_SIZE = 200;

/**
 * Every DRS assigned to the signed-in delivery boy that was issued between two instants (ISO
 * times), newest first. `q` matches the DRS id.
 */
export async function fetchMyDrsSheets(
  token: string,
  { from, q, to }: { from: string; to: string; q?: string },
): Promise<DrsSheet[]> {
  const sheets: DrsSheet[] = [];
  for (let page = 1; ; page += 1) {
    const { myDrsSheets } = await graphqlRequest<{
      myDrsSheets: { items: DrsSheet[]; pagination: { total: number } };
    }>({
      query: MY_DRS_SHEETS_QUERY,
      token,
      variables: { from, limit: PAGE_SIZE, page, q: q || undefined, to },
    });
    sheets.push(...myDrsSheets.items);
    if (!myDrsSheets.items.length || sheets.length >= myDrsSheets.pagination.total) return sheets;
  }
}

export async function fetchDrs(token: string, id: string): Promise<DrsSheet> {
  const { drs } = await graphqlRequest<{ drs: DrsSheet }>({
    query: DRS_QUERY,
    token,
    variables: { id },
  });
  return drs;
}

export type DrsPatch = {
  status?: DrsStatus;
  scanCopy?: string;
  /** Where the change was made, when the phone knows. */
  latitude?: number;
  longitude?: number;
};

/** Moves the DRS on to a status, or attaches its scan; the assigned delivery boy may do both. */
export async function patchDrs(token: string, id: string, patch: DrsPatch): Promise<DrsSheet> {
  const { drs } = await apiRequest<{ drs: DrsSheet }>(
    `/delivery/drs/${encodeURIComponent(id)}`,
    token,
    { body: JSON.stringify(patch), method: "PATCH" },
  );
  return drs;
}

/** A short-lived URL to show a stored file (such as a DRS scan) by its storage key. */
export async function fetchViewUrl(token: string, ref: string): Promise<string> {
  const { items } = await apiRequest<{ items: { ref: string; url: string }[] }>(
    "/media/view-urls",
    token,
    { body: JSON.stringify({ refs: [ref] }), method: "POST" },
  );
  const url = items.find((item) => item.ref === ref)?.url ?? items[0]?.url;
  if (!url) throw new Error("The scan could not be found.");
  return url;
}
