const isoFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });

/** `YYYY-MM-DD` of a date in India time, the app's calendar day. */
export function toIsoDate(date: Date) {
  return isoFormatter.format(date);
}

export function todayIsoDate() {
  return toIsoDate(new Date());
}
