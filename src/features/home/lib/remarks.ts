import type { AttendanceSession, AttendanceSubStatus } from "@/lib/api/attendance";

import type { DayKind } from "../hooks/use-day-attendance";

/** The web app's order-status badge colours (`--order-status-*` in software/src/index.css). */
export type RemarkVariant = "delivered" | "destructive" | "rescheduled" | "transit";

export type Remark = { label: string; variant: RemarkVariant };

// Same labels and colours as the web attendance table's Remarks column.
const SUB_STATUS: Record<AttendanceSubStatus, Remark> = {
  LATE_ENTRY: { label: "Late Entry", variant: "rescheduled" },
  MISSED_CHECKOUT: { label: "Missed Checkout", variant: "destructive" },
  OVERTIME: { label: "Overtime", variant: "transit" },
};

const ABSENT: Remark = { label: "Absent", variant: "destructive" };
const ON_TIME: Remark = { label: "On Time", variant: "delivered" };

interface DayState {
  kind: DayKind;
  offDay: string | null;
  record: AttendanceSession | null;
}

/**
 * Badges under "Check In". With a record: Late Entry, or On Time when the check-in was within the
 * organisation's start time. Without one, the roster's day status: the holiday or weekly off by
 * name, Absent for a working day up to today, nothing for a future working day.
 */
export function checkInRemarks({ kind, offDay, record }: DayState): Remark[] {
  if (record) {
    return record.subStatuses?.includes("LATE_ENTRY") ? [SUB_STATUS.LATE_ENTRY] : [ON_TIME];
  }
  if (offDay) return [{ label: offDay, variant: "rescheduled" }];
  return kind === "future" ? [] : [ABSENT];
}

/**
 * Badges under "Check Out": Missed Checkout for an auto-closed session, Overtime past the
 * organisation's end time (still working or checked out). Otherwise Working while open today,
 * or Checked Out once closed.
 */
export function checkOutRemarks({ kind, record }: DayState): Remark[] {
  if (!record) return [];
  const remarks = (["MISSED_CHECKOUT", "OVERTIME"] as const)
    .filter((status) => record.subStatuses?.includes(status))
    .map((status) => SUB_STATUS[status]);
  if (remarks.length) return remarks;
  if (record.checkOutAt) return [{ label: "Checked Out", variant: "delivered" }];
  return kind === "today"
    ? [{ label: "Working", variant: "transit" }]
    : [SUB_STATUS.MISSED_CHECKOUT];
}
