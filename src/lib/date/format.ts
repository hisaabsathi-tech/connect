const isoFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });

/** `YYYY-MM-DD` of a date in India time, the app's calendar day. */
export function toIsoDate(date: Date) {
  return isoFormatter.format(date);
}

export function todayIsoDate() {
  return toIsoDate(new Date());
}

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  hour12: true,
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

// Intl puts a narrow no-break space (U+202F) before am/pm; plain spaces keep the text the same
// everywhere it goes, e.g. spreadsheets that otherwise show it as "â€¯".
const plainSpaces = (text: string) => text.replace(/\s/g, " ");

/** "10:20 am" in India time. */
export function formatTime(iso: string) {
  return plainSpaces(timeFormatter.format(new Date(iso))).toLowerCase();
}

const clockFormatter = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit",
  hour12: true,
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

/** "09:51 PM" in India time. */
export function formatClock(iso: string) {
  return plainSpaces(clockFormatter.format(new Date(iso))).toUpperCase();
}

const twoDigits = (value: number) => String(value).padStart(2, "0");

/** "08:20:11" (hours:minutes:seconds) between two instants; open-ended runs up to now. */
export function formatDuration(fromIso: string, toIso: string | null, now = Date.now()) {
  return formatElapsed(durationMs(fromIso, toIso, now));
}

/** Milliseconds between two instants; an open-ended run counts up to now. */
export function durationMs(fromIso: string, toIso: string | null, now = Date.now()) {
  return Math.max(0, (toIso ? Date.parse(toIso) : now) - Date.parse(fromIso));
}

/** "7.5" hours, to one decimal place and without a trailing ".0". */
export function formatHours(ms: number) {
  return String(Math.round(ms / 360_000) / 10);
}

/** "38h 05m" (hours and minutes, no seconds) for a length of time in milliseconds. */
export function formatHoursMinutes(ms: number) {
  const minutes = Math.floor(ms / 60_000);
  return `${Math.floor(minutes / 60)}h ${twoDigits(minutes % 60)}m`;
}

/** "08:20:11" (hours:minutes:seconds) for a length of time in milliseconds. */
export function formatElapsed(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  return `${twoDigits(hours)}:${twoDigits(Math.floor((seconds % 3600) / 60))}:${twoDigits(seconds % 60)}`;
}

const dayLabelFormatters = {
  long: new Intl.DateTimeFormat("en-IN", { month: "long", timeZone: "UTC", year: "numeric" }),
  short: new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC", year: "numeric" }),
};

function ordinal(day: number) {
  if (day % 100 >= 11 && day % 100 <= 13) return `${day}th`;
  return `${day}${["th", "st", "nd", "rd"][day % 10] ?? "th"}`;
}

/** "20th Oct, 2026" (or "20th October, 2026" with `monthStyle: "long"`) for a `YYYY-MM-DD` day. */
export function formatDayLabel(iso: string, monthStyle: "long" | "short" = "short") {
  const date = new Date(`${iso}T00:00:00Z`);
  const parts = dayLabelFormatters[monthStyle].formatToParts(date);
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  return `${ordinal(date.getUTCDate())} ${month}, ${year}`;
}
