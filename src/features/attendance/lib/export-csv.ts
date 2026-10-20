import * as SecureStore from "expo-secure-store";

import { attendedDayRemarks, unattendedDayRemark } from "@/lib/attendance/remarks";
import { formatClock, formatDayLabel, formatDuration, weekdayOf } from "@/lib/date";

import type { DateRange } from "../hooks/use-attendance-range";
import { type AttendanceDayEntry, workedMs } from "./days";

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

// Where the folder picker opens the first time: Android's Download folder.
const DOWNLOADS_URI = "content://com.android.externalstorage.documents/document/primary%3ADownload";
// The folder the member picked for exports; Android keeps the app's access to it.
const EXPORT_FOLDER_KEY = "hisaabsathi.connector.export-folder";

const fileNameOf = (range: DateRange) => `attendance-${range.from}-to-${range.to}.csv`;

/**
 * Saves the range's CSV straight into a folder on the device, without needing the share sheet.
 * The first time (or if access to the folder was lost) the system folder picker opens at
 * Download for the member to choose one; later exports save there without asking. Resolves to
 * the folder's name, or null when the member backed out of choosing one.
 *
 * The file modules load on demand, so a build without them only fails here, not on opening the
 * tab.
 */
export async function saveAttendanceCsv(
  days: AttendanceDayEntry[],
  range: DateRange,
  today: string,
): Promise<string | null> {
  const { Directory } = await import("expo-file-system");
  const csv = attendanceCsv(days, today);
  // Android names a repeat "… (1).csv" rather than overwriting.
  const write = (folder: InstanceType<typeof Directory>) => {
    folder.createFile(fileNameOf(range), "text/csv").write(csv);
    return folder.name || "your folder";
  };
  const saved = await SecureStore.getItemAsync(EXPORT_FOLDER_KEY).catch(() => null);
  if (saved) {
    try {
      return write(new Directory(saved));
    } catch {
      // Access was revoked or the folder is gone: ask for one again.
      await SecureStore.deleteItemAsync(EXPORT_FOLDER_KEY).catch(() => undefined);
    }
  }
  let folder: InstanceType<typeof Directory>;
  try {
    folder = await Directory.pickDirectoryAsync(DOWNLOADS_URI);
  } catch {
    return null;
  }
  await SecureStore.setItemAsync(EXPORT_FOLDER_KEY, folder.uri).catch(() => undefined);
  return write(folder);
}

/** Writes the range's CSV to the cache and opens the share sheet (email, chat, Drive). */
export async function shareAttendanceCsv(
  days: AttendanceDayEntry[],
  range: DateRange,
  today: string,
) {
  const [{ File, Paths }, Sharing] = await Promise.all([
    import("expo-file-system"),
    import("expo-sharing"),
  ]);
  const file = new File(Paths.cache, fileNameOf(range));
  file.create({ overwrite: true });
  file.write(attendanceCsv(days, today));
  await Sharing.shareAsync(file.uri, {
    dialogTitle: `Attendance ${formatDayLabel(range.from)} to ${formatDayLabel(range.to)}`,
    mimeType: "text/csv",
    UTI: "public.comma-separated-values-text",
  });
}
