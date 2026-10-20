// Calendar arithmetic on `YYYY-MM-DD` days. Done in UTC, so there is no timezone drift; the days
// themselves are India-time days (see `toIsoDate`).

const DAY_MS = 86_400_000;

const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** `iso` moved by `days` (negative goes back). */
export function addDays(iso: string, days: number) {
  return fromMs(toMs(iso) + days * DAY_MS);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string) {
  return Math.round((toMs(to) - toMs(from)) / DAY_MS);
}

/** Every day from `from` to `to`, both included, oldest first. */
export function eachDay(from: string, to: string) {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

/** The Monday of `iso`'s week (weeks run Monday to Sunday). */
export function startOfWeek(iso: string) {
  const weekday = new Date(toMs(iso)).getUTCDay();
  return addDays(iso, -((weekday + 6) % 7));
}

export function startOfMonth(iso: string) {
  return `${iso.slice(0, 8)}01`;
}

export function startOfYear(iso: string) {
  return `${iso.slice(0, 4)}-01-01`;
}

export function endOfYear(iso: string) {
  return `${iso.slice(0, 4)}-12-31`;
}

const weekdayFormatter = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", weekday: "long" });

/** "Monday" for a `YYYY-MM-DD` day. */
export function weekdayOf(iso: string) {
  return weekdayFormatter.format(new Date(toMs(iso)));
}

/** Midnight UTC of the day, for date pickers that take a `Date`. */
export function dateOf(iso: string) {
  return new Date(toMs(iso));
}
