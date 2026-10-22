import { apiRequest } from "@/lib/api/client";

/** A Smart Sheet as the web app's sheet list shows it, with the organization it belongs to. */
export type SmartSheetSummary = {
  id: string;
  name: string;
  /** Rows with order details, whether or not they have an AWB number yet. */
  dataRows: number;
  /** Order rows with an AWB number, which the web can create as orders. */
  orderRows: number;
  /** Of those, the ones already created as orders. */
  syncedOrders: number;
  createdAt: string;
  updatedAt: string;
  organizationId: string;
  organizationName: string;
};

export type SmartSheetRecord = SmartSheetSummary & {
  version: number;
  /** The web editor's workbook snapshot: `sheetOrder` and each sheet's `cellData`. */
  workbook: Record<string, unknown>;
};

/** A same-owner organization whose sheets the member may read, and what else they may do there. */
export type SheetOrganization = {
  id: string;
  name: string;
  /** The organization the member is signed in to. */
  active: boolean;
  /** May start sheets and add orders there. */
  canCreate: boolean;
  /** May see its clients. */
  canListClients: boolean;
};

/** A credit customer of an organization: who a new sheet's orders are for. */
export type Client = {
  id: string;
  name: string;
  /** The organization's own id for the client, e.g. "PRAKRITIK". */
  orgGivenId: string;
};

/** One order from the Add Order form. */
export type SheetOrderInput = {
  clientId: string;
  /** `YYYY-MM-DD`. */
  orderDate: string;
  pincode: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  weight: number;
  volumetricWeight: number;
};

const LINKED = "/orders/smart-sheets/linked";
const part = encodeURIComponent;

/**
 * Every live sheet the member may read across the active owner's organizations, most recently
 * saved first, without switching organization. In each organization the server applies the
 * member's role there: the Smart Sheet menu, order view, and "own created" or "view all".
 */
export function fetchSmartSheets(token: string) {
  return apiRequest<SmartSheetSummary[]>(LINKED, token);
}

/** One sheet with its workbook, from whichever of those organizations it belongs to. */
export function fetchSmartSheet(
  token: string,
  sheet: Pick<SmartSheetSummary, "id" | "organizationId">,
) {
  return apiRequest<SmartSheetRecord>(
    `${LINKED}/${part(sheet.organizationId)}/${part(sheet.id)}`,
    token,
  );
}

/** The organizations whose sheets the member may read, by name. */
export function fetchSheetOrganizations(token: string) {
  return apiRequest<SheetOrganization[]>(`${LINKED}/organizations`, token);
}

/** An organization's credit clients, by name. */
export function fetchOrganizationClients(token: string, organizationId: string) {
  return apiRequest<Client[]>(`${LINKED}/${part(organizationId)}/clients`, token);
}

/** Starts a sheet for one client in an organization, named after the client and today. */
export function createClientSheet(token: string, organizationId: string, clientId: string) {
  return apiRequest<SmartSheetSummary>(`${LINKED}/${part(organizationId)}`, token, {
    body: JSON.stringify({ clientId }),
    method: "POST",
  });
}

/**
 * Adds one order row to the sheet, shown at once to anyone with it open on the web. Sending the
 * same `clientActionId` again (a retry) never adds the row twice.
 */
export function appendSheetRow(
  token: string,
  sheet: { id: string; organizationId: string },
  clientActionId: string,
  order: SheetOrderInput,
) {
  return apiRequest<{ dataRows: number; id: string; name: string; version: number }>(
    `${LINKED}/${part(sheet.organizationId)}/${part(sheet.id)}/rows`,
    token,
    { body: JSON.stringify({ ...order, clientActionId }), method: "POST" },
  );
}
