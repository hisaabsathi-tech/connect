import type { AttendanceRange, AttendanceRecord } from "@/lib/api/attendance";
import { type DayKind, dayKindOf, isWeeklyOff } from "@/lib/attendance/remarks";
import { daysBetween, durationMs, eachDay, startOfMonth, startOfWeek } from "@/lib/date";

/** One calendar day in the list or table: its session, or why there is none. */
export type AttendanceDayEntry = {
  date: string;
  kind: DayKind;
  /** The latest session checked in that day, or null. */
  record: AttendanceRecord | null;
  /** Holiday name or weekday when the organisation's calendar marks the day off, else null. */
  offDay: string | null;
};

/** Every day from `from` to `to` with its attendance; newest first unless `oldestFirst`. */
export function buildDays(
  range: AttendanceRange,
  from: string,
  to: string,
  today: string,
  oldestFirst = false,
): AttendanceDayEntry[] {
  const records = new Map<string, AttendanceRecord>();
  // Oldest first from the server, so a later session on the same day replaces an earlier one.
  for (const item of range.items) records.set(item.date, item);
  const offDays = new Map(range.nonWorkingDays.map((day) => [day.date, day.name]));
  const days = eachDay(from, to).map((date) => ({
    date,
    kind: dayKindOf(date, today),
    offDay: offDays.get(date) ?? null,
    record: records.get(date) ?? null,
  }));
  return oldestFirst ? days : days.reverse();
}

/**
 * Time worked in a session. An open session counts up to now only while it is today's; an older
 * one left open (the server normally auto-closes those) counts nothing.
 */
export function workedMs(record: AttendanceRecord, today: string, now = Date.now()) {
  if (!record.checkOutAt && record.date !== today) return 0;
  return durationMs(record.checkInAt, record.checkOutAt, now);
}

/**
 * The top cards' numbers for a period: by default this month's days and this week's hours, or
 * the applied date range for both.
 */
export type AttendanceSummary = {
  /** Days attended in the period: only days with a check-in. */
  presentDays: number;
  /** Every day in the period (31 for October), nothing subtracted. */
  totalDays: number;
  /** Time worked in the period's closed sessions. */
  closedMs: number;
  /** Check-in time of today's session while it is still open, which keeps adding to the time. */
  openSince: string | null;
};

/** The period's time worked at `now`: the closed sessions plus today's open one so far. */
export function workedSoFarMs(summary: AttendanceSummary, now = Date.now()) {
  return summary.closedMs + (summary.openSince ? durationMs(summary.openSince, null, now) : 0);
}

/** Today's session if it is still open, else undefined. */
const openToday = (records: AttendanceRecord[], today: string) =>
  records.find((record) => !record.checkOutAt && record.date === today);

/** Total time of closed sessions, leaving out `open`. */
const closedTime = (
  records: AttendanceRecord[],
  open: AttendanceRecord | undefined,
  today: string,
) =>
  records
    .filter((record) => record !== open)
    .reduce((total, record) => total + workedMs(record, today), 0);

/** The day that a summary's range has to start on to cover both this month and this week. */
export function summaryStart(today: string) {
  const month = startOfMonth(today);
  const week = startOfWeek(today);
  return month < week ? month : week;
}

/** The top cards' numbers from a range starting at `summaryStart(today)` and ending today. */
export function summarize(range: AttendanceRange, today: string): AttendanceSummary {
  const monthStart = startOfMonth(today);
  const weekStart = startOfWeek(today);
  const attended = new Set(
    range.items.filter((item) => item.date >= monthStart).map((item) => item.date),
  );
  const week = range.items.filter((item) => item.date >= weekStart);
  const open = openToday(week, today);
  return {
    closedMs: closedTime(week, open, today),
    openSince: open?.checkInAt ?? null,
    presentDays: attended.size,
    // Day 0 of next month is this month's last day.
    totalDays: new Date(
      Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0),
    ).getUTCDate(),
  };
}

/** The top cards' numbers for an applied date range: its present days, all its days and hours. */
export function summarizeRange(
  days: AttendanceDayEntry[],
  range: { from: string; to: string },
  today: string,
): AttendanceSummary {
  const records = days.flatMap((day) => (day.record ? [day.record] : []));
  const open = openToday(records, today);
  return {
    closedMs: closedTime(records, open, today),
    openSince: open?.checkInAt ?? null,
    presentDays: records.length,
    totalDays: daysBetween(range.from, range.to) + 1,
  };
}

/** The organisation's holidays (weekly offs left out), soonest first. */
export function holidaysOf(nonWorkingDays: AttendanceRange["nonWorkingDays"]) {
  return nonWorkingDays
    .filter((day) => !isWeeklyOff(day.name))
    .sort((a, b) => a.date.localeCompare(b.date));
}
