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

/** "10:20 am" in India time. */
export function formatTime(iso: string) {
  return timeFormatter.format(new Date(iso)).toLowerCase();
}

const twoDigits = (value: number) => String(value).padStart(2, "0");

/** "08:20:11" (hours:minutes:seconds) between two instants; open-ended runs up to now. */
export function formatDuration(fromIso: string, toIso: string | null, now = Date.now()) {
  const end = toIso ? Date.parse(toIso) : now;
  const seconds = Math.max(0, Math.floor((end - Date.parse(fromIso)) / 1000));
  const hours = Math.floor(seconds / 3600);
  return `${twoDigits(hours)}:${twoDigits(Math.floor((seconds % 3600) / 60))}:${twoDigits(seconds % 60)}`;
}

const dayLabelFormatter = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

function ordinal(day: number) {
  if (day % 100 >= 11 && day % 100 <= 13) return `${day}th`;
  return `${day}${["th", "st", "nd", "rd"][day % 10] ?? "th"}`;
}

/** "20th Oct, 2026" for a `YYYY-MM-DD` calendar day. */
export function formatDayLabel(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  const parts = dayLabelFormatter.formatToParts(date);
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  return `${ordinal(date.getUTCDate())} ${month}, ${year}`;
}
