import { router } from "expo-router";

import { EmptyState } from "@/components/modules/empty-state";
import { TabScreen } from "@/components/modules/layout";
import { useDateFilter } from "@/lib/date";

export function AttendanceScreen() {
  const { selectedDate } = useDateFilter();
  return (
    <TabScreen>
      <EmptyState
        action={{ label: "Home", onPress: () => router.navigate("/") }}
        description={[
          `Selected date: ${selectedDate}`,
          "Your attendance records will appear here.",
        ]}
        title="Attendance"
      />
    </TabScreen>
  );
}
