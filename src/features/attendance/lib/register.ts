import type { AttendanceSubStatus } from "@/lib/api/attendance";
import type { RosterRow } from "@/lib/api/attendance-roster";

// The web app's "classic" daily attendance register (software/src/components/templates/
// attendance/classic/image.ts), drawn as SVG here because React Native has no canvas.

const REMARK_LABEL: Record<AttendanceSubStatus, string> = {
  LATE_ENTRY: "LATE ENTRY",
  MISSED_CHECKOUT: "MISSED CHECKOUT",
  OVERTIME: "OVERTIME",
};
const REMARK_ORDER: AttendanceSubStatus[] = ["LATE_ENTRY", "OVERTIME", "MISSED_CHECKOUT"];
const EMPTY_REMARK = "-";

export const REGISTER_STYLE = {
  absentColor: "#CA232D",
  bodyFill: "#FDF0E7",
  headerFill: "#F7C5A0",
  ink: "#111111",
  line: "#000000",
  metaFill: "#FFFFFF",
  titleFill: "#CCD3FF",
} as const;

// `spacing`: extra space between letters, in layout units. Android's SVG text layout applies the
// font's kerning itself and pulls some bold pairs together until they touch ("I" and "L" in
// DAILY), so bold text turns kerning off (register-image.tsx) and is spaced a little apart.
export const REGISTER_FONTS = {
  absent: { size: 14, spacing: 0.8, weight: "bold" },
  body: { size: 14, spacing: 0, weight: "normal" },
  header: { size: 13, spacing: 0.8, weight: "bold" },
  meta: { size: 14, spacing: 0.8, weight: "bold" },
  title: { size: 20, spacing: 2, weight: "bold" },
} as const;

type Font = (typeof REGISTER_FONTS)[keyof typeof REGISTER_FONTS];

export const REGISTER_HEIGHTS = { body: 30, header: 32, meta: 32, title: 48 } as const;
const PAD_X = 16;
const MIN = { checkIn: 156, checkOut: 176, name: 340 };

/**
 * Width of `text` in the register's sans-serif font, from typical glyph widths (there is no
 * canvas to measure with). Rounded up, so columns are never too narrow for their text.
 */
function textWidth(text: string, font: Font) {
  let ems = 0;
  for (const char of text) {
    if (/[A-Z]/.test(char)) ems += char === "M" || char === "W" ? 0.86 : 0.7;
    else if (/[a-z]/.test(char)) ems += char === "m" || char === "w" ? 0.82 : 0.56;
    else if (/[0-9]/.test(char)) ems += 0.58;
    else if (char === " ") ems += 0.28;
    else ems += 0.36;
  }
  return ems * font.size * (font.weight === "bold" ? 1.06 : 1) + font.spacing * text.length;
}

export type RegisterLine = {
  absent: boolean;
  checkIn: string;
  checkOut: string;
  name: string;
  /** Two remark cells, "-" where empty. */
  remarks: [string, string];
};

const twoDigits = (value: number) => String(value).padStart(2, "0");

/** "9:00AM" for an `HH:mm` working-hours time. */
function meridiem(hhmm: string) {
  const match = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!match) return hhmm.trim();
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]}${hour >= 12 ? "PM" : "AM"}`;
}

/** "09:51 PM" in India time. */
function clock(iso: string) {
  const ist = new Date(Date.parse(iso) + 330 * 60_000);
  const hour = ist.getUTCHours();
  return `${twoDigits(hour % 12 || 12)}:${twoDigits(ist.getUTCMinutes())} ${hour >= 12 ? "PM" : "AM"}`;
}

function remarkLabels(row: RosterRow): [string, string] {
  const labels: string[] = [];
  if (row.status === "HOLIDAY") labels.push(row.holidayName?.trim() || "HOLIDAY");
  for (const key of REMARK_ORDER) if (row.subStatuses.includes(key)) labels.push(REMARK_LABEL[key]);
  return [labels[0] ?? EMPTY_REMARK, labels[1] ?? EMPTY_REMARK];
}

function timeText(row: RosterRow, value: string | null) {
  if (row.status === "ABSENT") return "ABSENT";
  if (row.status === "HOLIDAY" || !value) return "";
  return clock(value);
}

/** One line per employee, by name, as in the web register. */
export function registerLines(rows: RosterRow[]): RegisterLine[] {
  return [...rows]
    .sort((left, right) => left.name.localeCompare(right.name, "en", { sensitivity: "base" }))
    .map((row) => ({
      absent: row.status === "ABSENT",
      checkIn: timeText(row, row.checkInAt),
      checkOut: timeText(row, row.checkOutAt),
      name: row.name.trim().toLocaleUpperCase("en-US"),
      remarks: remarkLabels(row),
    }));
}

export type RegisterLayout = {
  lines: RegisterLine[];
  title: string;
  hours: string;
  date: string;
  columns: { name: number; checkIn: number; checkOut: number; remark: number };
  width: number;
  height: number;
};

/** Everything the register image needs for one day: its lines, column widths and size. */
export function registerLayout(input: {
  date: string;
  rows: RosterRow[];
  workStartTime: string;
  workEndTime: string;
}): RegisterLayout {
  const lines = registerLines(input.rows);
  const [year, month, day] = input.date.split("-");
  const hours = `Working Hrs: ${meridiem(input.workStartTime)} - ${meridiem(input.workEndTime)}`;
  const date = `Date: ${Number(day)}/${Number(month)}/${year}`;
  const fit = (text: string, font: Font) => Math.ceil(textWidth(text, font) + PAD_X * 2);
  let name = Math.max(MIN.name, fit("NAME", REGISTER_FONTS.header));
  let checkIn = Math.max(MIN.checkIn, fit("CHECK IN TIME", REGISTER_FONTS.header));
  let checkOut = Math.max(MIN.checkOut, fit("CHECK OUT TIME", REGISTER_FONTS.header));
  let remark = fit("MISSED CHECKOUT", REGISTER_FONTS.body);
  for (const line of lines) {
    const timeFont = line.absent ? REGISTER_FONTS.absent : REGISTER_FONTS.body;
    name = Math.max(name, fit(line.name, REGISTER_FONTS.body));
    checkIn = Math.max(checkIn, fit(line.checkIn, timeFont));
    checkOut = Math.max(checkOut, fit(line.checkOut, timeFont));
    for (const label of line.remarks) remark = Math.max(remark, fit(label, REGISTER_FONTS.body));
  }
  remark = Math.max(
    remark,
    Math.ceil(fit("REMARKS", REGISTER_FONTS.header) / 2),
    Math.ceil(fit(date, REGISTER_FONTS.meta) / 2),
  );
  const hoursSpan = fit(hours, REGISTER_FONTS.meta);
  if (name + checkIn + checkOut < hoursSpan) name += hoursSpan - (name + checkIn + checkOut);
  const heights = REGISTER_HEIGHTS;
  return {
    columns: { checkIn, checkOut, name, remark },
    date,
    height: heights.title + heights.meta + heights.header + lines.length * heights.body,
    hours,
    lines,
    title: "DAILY ATTENDANCE REGISTER",
    width: name + checkIn + checkOut + remark * 2,
  };
}
