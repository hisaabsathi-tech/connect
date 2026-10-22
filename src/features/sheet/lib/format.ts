import type { SmartSheetSummary } from "@/lib/api/smart-sheets";
import { toIsoDate } from "@/lib/date";

const dayFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Kolkata",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  hour12: true,
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

/** "14 Oct 2026" for a `YYYY-MM-DD` day. */
export function formatOrderDay(iso: string) {
  return dayFormatter.format(new Date(`${iso}T12:00:00+05:30`));
}

/** "14 Oct 2026, 1:50 PM" in India time. */
export function formatSheetStamp(iso: string) {
  const date = new Date(iso);
  // Plain spaces: Intl puts a narrow no-break space before AM/PM.
  const time = timeFormatter.format(date).replace(/\s/g, " ").toUpperCase();
  return `${dayFormatter.format(date)}, ${time}`;
}

/**
 * "0/5 orders created", as the web sheet list words it; "3 shipments" for rows still waiting
 * for their AWB numbers (added from the app).
 */
export function createdStatus(sheet: SmartSheetSummary) {
  if (sheet.orderRows === 0) {
    const shipments = sheet.dataRows ?? 0;
    if (shipments > 0) return `${shipments} ${shipments === 1 ? "shipment" : "shipments"}`;
    return "No orders to create";
  }
  const noun = sheet.orderRows === 1 ? "order" : "orders";
  if (sheet.syncedOrders >= sheet.orderRows) return `${sheet.orderRows} ${noun} created`;
  return `${sheet.syncedOrders}/${sheet.orderRows} ${noun} created`;
}

/** The India-time day a sheet was last saved, which the web list's date range filters on. */
export const sheetDay = (sheet: SmartSheetSummary) => toIsoDate(new Date(sheet.updatedAt));
