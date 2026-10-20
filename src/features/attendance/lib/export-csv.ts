import { attendedDayRemarks, unattendedDayRemark } from "@/lib/attendance/remarks";
import { formatClock, formatDayLabel, formatDuration, weekdayOf } from "@/lib/date";

import type { DateRange } from "../hooks/use-attendance-range";
import { type AttendanceDayEntry, workedMs } from "./days";

const COLUMNS = [
  "Date",
  "Day",
  "Status",
  "Check In",
  "Check Out",
  "Hours Worked",
  "Remarks",
  "Check In Address",
  "Check Out Address",
];

// Tells Excel the file is UTF-8, so names and addresses keep their characters.
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

/** A CSV field, quoted when it holds a comma, quote or line break. */
function field(value: string) {
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
  const [present, ...rest] = attendedDayRemarks(day.record, day.kind);
  return { remarks: rest.map((remark) => remark.label).join(", "), status: present.label };
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
    record?.checkInAddress ?? "",
    record?.checkOutAddress ?? "",
  ];
}

/** The table as CSV, with a byte-order mark so Excel reads it as UTF-8. */
export function attendanceCsv(days: AttendanceDayEntry[], today: string) {
  const lines = [COLUMNS, ...days.map((day) => row(day, today))].map((cells) =>
    cells.map(field).join(","),
  );
  return `${BYTE_ORDER_MARK}${lines.join("\r\n")}\r\n`;
}

/**
 * Writes the range's CSV to the cache and opens the share sheet (save to Files, email, chat).
 * The modules load on demand, so a build without them only fails here, not on opening the tab.
 */
export async function shareAttendanceCsv(
  days: AttendanceDayEntry[],
  range: DateRange,
  today: string,
) {
  const [{ File, Paths }, Sharing] = await Promise.all([
    import("expo-file-system"),
    import("expo-sharing"),
  ]);
  const file = new File(Paths.cache, `attendance-${range.from}-to-${range.to}.csv`);
  file.create({ overwrite: true });
  file.write(attendanceCsv(days, today));
  await Sharing.shareAsync(file.uri, {
    dialogTitle: `Attendance ${formatDayLabel(range.from)} to ${formatDayLabel(range.to)}`,
    mimeType: "text/csv",
    UTI: "public.comma-separated-values-text",
  });
}
