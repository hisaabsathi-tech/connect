import { View } from "react-native";

import { Text } from "@/components/modules/typography";

import { SwipeAttendance } from "./swipe-attendance";

interface AttendanceActionProps {
  attendedToday: boolean;
  isCheckedIn: boolean;
  busy: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
}

/** Swipe to check in or out, or a done banner once today's attendance is closed. */
export function AttendanceAction({
  attendedToday,
  isCheckedIn,
  busy,
  canSubmit,
  onSubmit,
}: AttendanceActionProps) {
  if (attendedToday && !isCheckedIn)
    return (
      <View className="h-[52px] items-center justify-center bg-[#EDF8F0]">
        <Text className="font-medium text-success">Attendance completed for today</Text>
      </View>
    );
  return (
    <SwipeAttendance
      action={onSubmit}
      busy={busy}
      disabled={!canSubmit}
      mode={isCheckedIn ? "out" : "in"}
    />
  );
}
