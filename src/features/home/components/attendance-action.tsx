import { Pressable, View } from "react-native";

import type { LocationStatus } from "@/hooks/use-live-location";

import type { DayKind } from "../hooks/use-day-attendance";
import { SwipeAttendance } from "./swipe-attendance";

interface AttendanceActionProps {
  attendedToday: boolean;
  isCheckedIn: boolean;
  busy: boolean;
  /** Today's status has loaded. */
  ready: boolean;
  /** Whether location may be read: permission and the device's location switch. */
  location: LocationStatus;
  /** The live position is known. */
  located: boolean;
  /** The calendar's selected day kind; the swipe only ever acts on today. */
  kind: DayKind;
  /** The swipe holds at the end, spinning, until this settles. */
  onSubmit: () => unknown;
  /** Asks for whatever location is missing (permission, or switching it on). */
  onFixLocation: () => void;
}

/** Whether the swipe belongs on screen: only for today, until today's attendance is closed. */
function showsAttendanceAction({
  attendedToday,
  isCheckedIn,
  kind,
}: Pick<AttendanceActionProps, "attendedToday" | "isCheckedIn" | "kind">) {
  return kind === "today" && !(attendedToday && !isCheckedIn);
}

/** Location the user has to fix before the swipe works. */
function missingLocation(location: LocationStatus) {
  return location === "denied" || location === "blocked" || location === "disabled";
}

/**
 * Swipe to check in or out, pinned above the navigation. Hidden on other days and once today
 * is done (the day record says so); while location is missing or today's status or position
 * loads it stays disabled and says why. Tapping it then asks for the missing location.
 */
export function AttendanceAction({
  busy,
  onFixLocation,
  onSubmit,
  ...state
}: AttendanceActionProps) {
  if (!showsAttendanceAction(state)) return null;
  const action = state.isCheckedIn ? "check out" : "check in";
  const blocked =
    state.location === "denied" || state.location === "blocked"
      ? `Allow location to ${action}`
      : state.location === "disabled"
        ? `Turn on location to ${action}`
        : !state.ready
          ? "Loading today's attendance"
          : !state.located
            ? "Waiting for your location"
            : undefined;
  const swipe = (
    <SwipeAttendance
      action={onSubmit}
      busy={busy}
      disabled={Boolean(blocked)}
      label={blocked}
      mode={state.isCheckedIn ? "out" : "in"}
    />
  );
  return (
    <View className="bg-background px-5 py-3">
      {missingLocation(state.location) ? (
        <Pressable accessibilityLabel={blocked} accessibilityRole="button" onPress={onFixLocation}>
          {swipe}
        </Pressable>
      ) : (
        swipe
      )}
    </View>
  );
}
