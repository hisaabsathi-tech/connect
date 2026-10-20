import type { AttendanceRange, AttendanceRecord } from "@/lib/api/attendance";
import { type DayKind, dayKindOf, isWeeklyOff } from "@/lib/attendance/remarks";
import { durationMs, eachDay, startOfMonth, startOfWeek } from "@/lib/date";

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

export type AttendanceSummary = {
  /** Days attended this month. */
  presentDays: number;
  /**
   * Working days this month up to today: holidays and weekly offs from the organisation's
   * attendance configuration are left out, unless the member worked that day anyway.
   */
  workingDays: number;
  /** Time worked this week (Monday to today) in closed sessions. */
  weekClosedMs: number;
  /** Check-in time of today's session while it is still open, which keeps adding to the week. */
  openSince: string | null;
};

/** This week's hours at `now`: the closed sessions plus today's open one so far. */
export function weekWorkedMs(summary: AttendanceSummary, now = Date.now()) {
  return summary.weekClosedMs + (summary.openSince ? durationMs(summary.openSince, null, now) : 0);
}

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
  const offDays = new Set(range.nonWorkingDays.map((day) => day.date));
  const attended = new Set(
    range.items.filter((item) => item.date >= monthStart).map((item) => item.date),
  );
  const week = range.items.filter((item) => item.date >= weekStart);
  const open = week.find((item) => !item.checkOutAt && item.date === today);
  return {
    openSince: open?.checkInAt ?? null,
    presentDays: attended.size,
    weekClosedMs: week
      .filter((item) => item !== open)
      .reduce((total, item) => total + workedMs(item, today), 0),
    workingDays: eachDay(monthStart, today).filter(
      (date) => !offDays.has(date) || attended.has(date),
    ).length,
  };
}

/** The organisation's holidays (weekly offs left out), soonest first. */
export function holidaysOf(nonWorkingDays: AttendanceRange["nonWorkingDays"]) {
  return nonWorkingDays
    .filter((day) => !isWeeklyOff(day.name))
    .sort((a, b) => a.date.localeCompare(b.date));
}
