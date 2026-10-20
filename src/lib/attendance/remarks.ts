import type { AttendanceSession, AttendanceSubStatus } from "@/lib/api/attendance";

export type DayKind = "past" | "today" | "future";

export function dayKindOf(date: string, today: string): DayKind {
  return date < today ? "past" : date > today ? "future" : "today";
}

/** The web app's order-status badge colours (`--order-status-*` in software/src/index.css). */
export type RemarkVariant = "delivered" | "destructive" | "rescheduled" | "transit";

export type Remark = { label: string; variant: RemarkVariant };

// Same labels and colours as the web attendance table's Remarks column.
const SUB_STATUS: Record<AttendanceSubStatus, Remark> = {
  LATE_ENTRY: { label: "Late Entry", variant: "rescheduled" },
  MISSED_CHECKOUT: { label: "Missed Checkout", variant: "destructive" },
  OVERTIME: { label: "Overtime", variant: "transit" },
};

/** Under "Check In": Late Entry past the organisation's start time, else On Time. */
export function checkInRemarks(record: AttendanceSession): Remark[] {
  return record.subStatuses?.includes("LATE_ENTRY")
    ? [SUB_STATUS.LATE_ENTRY]
    : [{ label: "On Time", variant: "delivered" }];
}

/**
 * Under "Check Out" (or the live hours while working): Missed Checkout for an auto-closed
 * session, Overtime past the organisation's end time. Otherwise Working while open today,
 * or Checked Out once closed.
 */
export function checkOutRemarks(record: AttendanceSession, kind: DayKind): Remark[] {
  const remarks = (["MISSED_CHECKOUT", "OVERTIME"] as const)
    .filter((status) => record.subStatuses?.includes(status))
    .map((status) => SUB_STATUS[status]);
  if (remarks.length) return remarks;
  if (record.checkOutAt) return [{ label: "Checked Out", variant: "delivered" }];
  return kind === "today"
    ? [{ label: "Working", variant: "transit" }]
    : [SUB_STATUS.MISSED_CHECKOUT];
}

export type DayStateTone = "absent" | "holiday" | "plain";

export type DayState = { label: string; value: string; tone: DayStateTone };

const WEEKDAYS = new Set([
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]);

/**
 * The single block shown for a day without attendance, like the web roster's day status.
 * The server names a weekly off by its weekday and a holiday by its own name.
 */
export function dayStateWithoutRecord(kind: DayKind, offDay: string | null): DayState {
  if (offDay && isWeeklyOff(offDay)) {
    const weekend = offDay === "Saturday" || offDay === "Sunday";
    return {
      label: "Weekly Off",
      tone: "plain",
      value: weekend ? "Weekend Holiday" : `${offDay} Off`,
    };
  }
  if (offDay) return { label: "Public Holiday", tone: "holiday", value: offDay };
  if (kind === "future") return { label: "Upcoming", tone: "plain", value: "Not Started" };
  if (kind === "today") return { label: "Today", tone: "plain", value: "Not checked in yet" };
  return { label: "Absent", tone: "absent", value: "No attendance" };
}

/** The server names a weekly off by its weekday, a holiday by its own name. */
export function isWeeklyOff(offDay: string) {
  return WEEKDAYS.has(offDay);
}

/**
 * Pills on an attendance list card: Late Entry, Overtime and Missed Checkout, or Working while
 * today's session is still open. None for an on-time, closed day. There is no Present pill, since
 * the list only has days that were attended.
 */
export function attendedDayRemarks(record: AttendanceSession, kind: DayKind): Remark[] {
  const remarks: Remark[] = [];
  if (record.subStatuses?.includes("LATE_ENTRY")) remarks.push(SUB_STATUS.LATE_ENTRY);
  if (record.subStatuses?.includes("OVERTIME")) remarks.push(SUB_STATUS.OVERTIME);
  if (record.checkOutAt) {
    if (record.subStatuses?.includes("MISSED_CHECKOUT")) remarks.push(SUB_STATUS.MISSED_CHECKOUT);
  } else
    remarks.push(
      kind === "today" ? { label: "Working", variant: "transit" } : SUB_STATUS.MISSED_CHECKOUT,
    );
  return remarks;
}

/** The one pill for a day without attendance: a holiday, a weekly off, today, or absent. */
export function unattendedDayRemark(kind: DayKind, offDay: string | null): Remark {
  if (offDay && isWeeklyOff(offDay)) return { label: "Weekly Off", variant: "transit" };
  if (offDay) return { label: "Public Holiday", variant: "rescheduled" };
  if (kind === "today") return { label: "Not checked in", variant: "transit" };
  return { label: "Absent", variant: "destructive" };
}
