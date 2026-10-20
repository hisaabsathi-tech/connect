import { formatDayLabel } from "@/lib/date";

/** Two `YYYY-MM-DD` days, both included. */
export type DateRange = { from: string; to: string };

/** "1st - 15th Oct, 2026", "28th Sep - 4th Oct, 2026", the full dates across years, or one day. */
export function rangeLabel({ from, to }: DateRange) {
  // One day (Today, Yesterday, or the same day tapped twice): just that date.
  if (from === to) return formatDayLabel(from);
  const [fromDay, fromMonth, fromYear] = formatDayLabel(from).replace(",", "").split(" ");
  const [toDay, toMonth, toYear] = formatDayLabel(to).replace(",", "").split(" ");
  if (fromYear !== toYear) return `${formatDayLabel(from)} - ${formatDayLabel(to)}`;
  if (fromMonth !== toMonth) return `${fromDay} ${fromMonth} - ${toDay} ${toMonth}, ${toYear}`;
  return `${fromDay} - ${toDay} ${toMonth}, ${toYear}`;
}
