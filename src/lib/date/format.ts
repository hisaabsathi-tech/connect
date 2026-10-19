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
