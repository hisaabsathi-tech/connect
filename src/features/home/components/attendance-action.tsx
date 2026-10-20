import { formatDayLabel } from "@/lib/date";

import type { DayKind } from "../hooks/use-day-attendance";
import { SwipeAttendance } from "./swipe-attendance";

interface AttendanceActionProps {
  attendedToday: boolean;
  isCheckedIn: boolean;
  busy: boolean;
  /** Today's status has loaded. */
  ready: boolean;
  /** The live position is known. */
  located: boolean;
  /** The calendar's selected day; the swipe only ever acts on today. */
  date: string;
  kind: DayKind;
  onSubmit: () => void;
}

/** Why the swipe can't be used right now, or null when it can. */
function blockedLabel({
  attendedToday,
  date,
  isCheckedIn,
  kind,
  located,
  ready,
}: Omit<AttendanceActionProps, "busy" | "onSubmit">) {
  if (kind === "future") return `Check-in opens on ${formatDayLabel(date)}`;
  if (kind === "past") return `Check-in closed for ${formatDayLabel(date)}`;
  if (!ready) return "Loading today's attendance";
  if (attendedToday && !isCheckedIn) return "Attendance completed for today";
  if (!located) return "Waiting for your location";
  return null;
}

/**
 * Swipe to check in or out. On any other day than today, once today is done, or while the
 * status or location is still loading, the button stays disabled and says why.
 */
export function AttendanceAction({ busy, onSubmit, ...state }: AttendanceActionProps) {
  const blocked = blockedLabel(state);
  return (
    <SwipeAttendance
      action={onSubmit}
      busy={busy}
      disabled={Boolean(blocked)}
      label={blocked ?? undefined}
      mode={state.kind === "today" && state.isCheckedIn ? "out" : "in"}
    />
  );
}
