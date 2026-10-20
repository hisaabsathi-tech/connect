import type { DrsSheet } from "@/lib/api/drs";
import type { ViewerOrganization } from "@/lib/api/viewer";

/** One order line of the printed sheet. */
export type DrsPrintRow = {
  id: string;
  center: string;
  serviceType: string;
  remarks: string | null;
  documentNumber: string;
  customerName: string;
  customerMobile: string | null;
};

/** What the classic DRS template prints; the same fields as the web app's `DrsTemplateData`. */
export type DrsPrintData = {
  branchName: string;
  branchAddress: string[];
  companyLogo: string | null;
  deliveryBoy: string;
  drsNumber: string;
  date: string;
  time: string;
  rows: DrsPrintRow[];
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// India's offset; the sheet shows the time it was issued there.
const IST_OFFSET_MS = 330 * 60 * 1000;

/** "October 21, 2026" and "9:05:07 AM", as the web template formats `issuedAt`. */
function issuedLabels(iso: string) {
  const date = new Date(new Date(iso).getTime() + IST_OFFSET_MS);
  const hours = date.getUTCHours();
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    date: `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`,
    time: `${hours % 12 || 12}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} ${hours < 12 ? "AM" : "PM"}`,
  };
}

/** "+91 98765 43210" for an Indian number; anything else as entered. */
function formatMobile(value: string | null) {
  const raw = value?.trim() ?? "";
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  const local =
    digits.length === 12 && digits.startsWith("91")
      ? digits.slice(2)
      : digits.length === 10
        ? digits
        : null;
  return local ? `+91 ${local.slice(0, 5)} ${local.slice(5)}` : raw;
}

/** The web app's `drsClassicTemplateData`: the sheet, its organisation and delivery boy. */
export function drsPrintData(
  sheet: DrsSheet,
  organization: ViewerOrganization | null,
  deliveryBoy: string,
): DrsPrintData {
  const name = organization?.name ?? "";
  const address = organization
    ? [
        organization.addressLine1,
        organization.addressLine2,
        [organization.city, organization.state, organization.pincode].filter(Boolean).join(", "),
      ].filter((line): line is string => Boolean(line?.trim()))
    : [];
  return {
    branchAddress: address.length ? address : [name].filter(Boolean),
    branchName: name,
    companyLogo: organization?.logo ?? null,
    deliveryBoy,
    drsNumber: sheet.id,
    rows: sheet.orders.map((order) => ({
      center: order.center?.trim() || "—",
      customerMobile: formatMobile(order.customerMobile),
      customerName: order.customerName?.trim() || "—",
      documentNumber: order.awbNo,
      id: order.orderId,
      remarks: order.remarks?.trim() || null,
      serviceType:
        [order.serviceType?.trim(), order.packageType?.trim()].filter(Boolean).join(" - ") || "—",
    })),
    ...issuedLabels(sheet.issuedAt),
  };
}
