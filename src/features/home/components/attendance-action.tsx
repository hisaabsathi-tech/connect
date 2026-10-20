import { View } from "react-native";

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
  /** The calendar's selected day kind; the swipe only ever acts on today. */
  kind: DayKind;
  onSubmit: () => void;
}

/** Whether the swipe belongs on screen: only for today, until today's attendance is closed. */
function showsAttendanceAction({
  attendedToday,
  isCheckedIn,
  kind,
}: Pick<AttendanceActionProps, "attendedToday" | "isCheckedIn" | "kind">) {
  return kind === "today" && !(attendedToday && !isCheckedIn);
}

/**
 * Swipe to check in or out, pinned above the navigation. Hidden on other days and once today
 * is done (the day record says so); while today's status or location loads it stays disabled
 * and says why.
 */
export function AttendanceAction({ busy, onSubmit, ...state }: AttendanceActionProps) {
  if (!showsAttendanceAction(state)) return null;
  const blocked = !state.ready
    ? "Loading today's attendance"
    : !state.located
      ? "Waiting for your location"
      : undefined;
  return (
    <View className="bg-background px-5 py-3">
      <SwipeAttendance
        action={onSubmit}
        busy={busy}
        disabled={Boolean(blocked)}
        label={blocked}
        mode={state.isCheckedIn ? "out" : "in"}
      />
    </View>
  );
}
