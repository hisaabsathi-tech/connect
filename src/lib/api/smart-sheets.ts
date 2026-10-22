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
  /** May change and remove a sheet's orders. */
  canUpdate: boolean;
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
  /** Optional. On an edit, empty clears the sheet's AWB cell. */
  awbNo?: string;
  /** Optional, likewise. */
  refNo?: string;
  /**
   * The booking, each by name as `fetchBookingOptions` lists it; optional, and on an edit empty
   * clears the sheet's cell.
   */
  courierPartner?: string;
  serviceType?: string;
  packageType?: string;
  travelMode?: string;
};

/**
 * What an order can be booked with in an organization, as the web's order form offers it: its
 * courier partners, each with the service types it offers, and its package types and travel
 * modes.
 */
export type BookingOptions = {
  couriers: { id: string; name: string; serviceTypes: string[] }[];
  packageTypes: string[];
  travelModes: string[];
};

const LINKED = "/orders/smart-sheets/linked";

/** Where a number is already taken: by an order, or by another order of the sheet. */
export type IdentifierClash = "order" | "sheet" | null;

/**
 * Whether an AWB or reference number is free, as the web Smart Sheet checks it: not an order's
 * already (AWB numbers across organizations, reference numbers in this one), nor another order's
 * in the sheet (leaving out `row`, the one being edited).
 */
export function checkSheetIdentifiers(
  token: string,
  organizationId: string,
  input: { awbNo?: string; refNo?: string; row?: number; sheetId?: string },
) {
  return apiRequest<{ awbNo: IdentifierClash; refNo: IdentifierClash }>(
    `${LINKED}/${encodeURIComponent(organizationId)}/check`,
    token,
    { body: JSON.stringify(input), method: "POST" },
  );
}
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

/** What an order of a sheet in an organization can be booked with. */
export function fetchBookingOptions(token: string, organizationId: string) {
  return apiRequest<BookingOptions>(`${LINKED}/${part(organizationId)}/booking-options`, token);
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

/** One order of a sheet, as its table on the app shows it. */
export type SheetOrderRow = {
  /** Its row in the sheet; names it for an edit or a removal. */
  row: number;
  serial: number | null;
  awbNo: string;
  refNo: string;
  clientName: string;
  clientCode: string;
  /** `YYYY-MM-DD`, or null when the sheet's cell isn't a date. */
  orderDate: string | null;
  pincode: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  weight: number | null;
  volumetricWeight: number | null;
  courierPartner: string;
  serviceType: string;
  packageType: string;
  travelMode: string;
};

export type SheetOrderRows = {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
  rows: SheetOrderRow[];
  /** The sheet's saved version; a change is made on it, so it never lands on a moved row. */
  version: number;
  /** May change and remove the orders (order update there). */
  canUpdate: boolean;
};

/** The sheet's orders, top to bottom. */
export function fetchSheetRows(token: string, sheet: { id: string; organizationId: string }) {
  return apiRequest<SheetOrderRows>(
    `${LINKED}/${part(sheet.organizationId)}/${part(sheet.id)}/rows`,
    token,
  );
}

type RowChange = { dataRows: number; id: string; version: number };

/**
 * Changes one order of the sheet, on the version the app read; refused (409) when the sheet has
 * changed since, so the table is reloaded first.
 */
export function editSheetRow(
  token: string,
  sheet: { id: string; organizationId: string },
  change: { row: number; version: number },
  order: Omit<SheetOrderInput, "clientId">,
) {
  return apiRequest<RowChange>(
    `${LINKED}/${part(sheet.organizationId)}/${part(sheet.id)}/rows/${change.row}`,
    token,
    { body: JSON.stringify({ ...order, version: change.version }), method: "PATCH" },
  );
}

/** Removes one order of the sheet, on the version the app read; the rows under it move up. */
export function removeSheetRow(
  token: string,
  sheet: { id: string; organizationId: string },
  change: { row: number; version: number },
) {
  return apiRequest<RowChange>(
    `${LINKED}/${part(sheet.organizationId)}/${part(sheet.id)}/rows/${change.row}?version=${change.version}`,
    token,
    { method: "DELETE" },
  );
}
