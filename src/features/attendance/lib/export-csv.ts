import { attendedDayRemarks, unattendedDayRemark } from "@/lib/attendance/remarks";
import { formatClock, formatDayLabel, formatDuration, weekdayOf } from "@/lib/date";

import type { DateRange } from "../hooks/use-attendance-range";
import { type AttendanceDayEntry, workedMs } from "./days";
import { type ExportFile, saveToDevice, shareFile } from "./device-files";

const COLUMNS = ["Date", "Day", "Status", "Check In", "Check Out", "Hours Worked", "Remarks"];

// Tells Excel the file is UTF-8, so holiday names keep their characters.
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

/**
 * A CSV field, quoted when it holds a comma, quote or line break. No-break spaces become plain
 * ones, which every spreadsheet reads.
 */
function field(text: string) {
  const value = text.replace(/[\u00a0\u202f]/g, " ");
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** The status and remark columns, matching the table: Present plus remarks, or why not. */
export function dayStatus(day: AttendanceDayEntry) {
  if (!day.record) {
    const remark = unattendedDayRemark(day.kind, day.offDay);
    return {
      remarks: remark.label === "Public Holiday" ? (day.offDay ?? "") : "",
      status: remark.label,
    };
  }
  const remarks = attendedDayRemarks(day.record, day.kind);
  return { remarks: remarks.map((remark) => remark.label).join(", "), status: "Present" };
}

function row(day: AttendanceDayEntry, today: string) {
  const { record } = day;
  const { remarks, status } = dayStatus(day);
  return [
    day.date,
    weekdayOf(day.date),
    status,
    record ? formatClock(record.checkInAt) : "",
    record?.checkOutAt ? formatClock(record.checkOutAt) : "",
    record && workedMs(record, today) ? formatDuration(record.checkInAt, record.checkOutAt) : "",
    remarks,
  ];
}

/** The table as CSV, with a byte-order mark so Excel reads it as UTF-8. */
export function attendanceCsv(days: AttendanceDayEntry[], today: string) {
  const lines = [COLUMNS, ...days.map((day) => row(day, today))].map((cells) =>
    cells.map(field).join(","),
  );
  return `${BYTE_ORDER_MARK}${lines.join("\r\n")}\r\n`;
}

const fileOf = (days: AttendanceDayEntry[], range: DateRange, today: string): ExportFile => ({
  contents: attendanceCsv(days, today),
  mimeType: "text/csv",
  name: `attendance-${range.from}-to-${range.to}.csv`,
});

/** Saves the range's CSV into the export folder on the device; see `saveToDevice`. */
export function saveAttendanceCsv(days: AttendanceDayEntry[], range: DateRange, today: string) {
  return saveToDevice([fileOf(days, range, today)]);
}

/** Opens the share sheet with the range's CSV. */
export function shareAttendanceCsv(days: AttendanceDayEntry[], range: DateRange, today: string) {
  return shareFile(
    fileOf(days, range, today),
    `Attendance ${formatDayLabel(range.from)} to ${formatDayLabel(range.to)}`,
  );
}
