import { useMemo } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { TabScreen } from "@/components/modules/layout";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/config/colors";
import { useLiveLocation } from "@/hooks/use-live-location";
import { checkInPointOf, checkOutPointOf } from "@/lib/api/attendance";
import { useAuthSession } from "@/lib/auth/session";
import { formatDuration, formatTime, useDateFilter } from "@/lib/date";

import { AttendanceAction } from "./components/attendance-action";
import { DateStrip } from "./components/date-strip";
import { DayRecord } from "./components/day-record";
import { HomeHeader } from "./components/home-header";
import { HomeMap } from "./components/home-map";
import { useDayAttendance } from "./hooks/use-day-attendance";
import { useHomeAttendance } from "./hooks/use-home-attendance";

/** Signed-in only: the tabs layout redirects to /auth before this renders without a session. */
export function HomeScreen() {
  const { token } = useAuthSession();
  const live = useLiveLocation(Boolean(token));
  const home = useHomeAttendance(token, live);
  const { resetToToday, selectedDate, today } = useDateFilter();
  const toast = useToast();
  // The calendar picks whose pins and record show; the swipe button always acts on today.
  const day = useDayAttendance(token, selectedDate, today);
  // Stable per record: the map re-frames its camera whenever its pins change.
  const dayCheckIn = useMemo(() => checkInPointOf(day.record), [day.record]);
  const dayCheckOut = useMemo(() => checkOutPointOf(day.record), [day.record]);

  const refresh = () => {
    resetToToday();
    void home.refresh();
    void day.reload();
  };

  const submit = async () => {
    const session = await home.submit();
    if (!session) return;
    // Show today's updated record, whichever day the calendar was on.
    resetToToday();
    void day.reload();
    toast.show(
      session.checkOutAt
        ? {
            description: `You worked ${formatDuration(session.checkInAt, session.checkOutAt)} today.`,
            title: `Checked out at ${formatTime(session.checkOutAt)}`,
            type: "success",
          }
        : {
            description: "Your working hours are now being tracked.",
            title: `Checked in at ${formatTime(session.checkInAt)}`,
            type: "success",
          },
    );
  };

  return (
    <TabScreen>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-5"
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={refresh}
            refreshing={home.refreshing}
            tintColor={colors.primary}
          />
        }
      >
        <HomeHeader identity={home.identity} />
        <HomeMap
          checkIn={dayCheckIn}
          checkOut={dayCheckOut}
          live={live}
          organization={home.organization}
        />
        <DateStrip />
        <DayRecord
          date={selectedDate}
          failed={day.failed}
          kind={day.kind}
          loading={day.loading}
          offDay={day.offDay}
          record={day.record}
        />
      </ScrollView>
      {/* Pinned above the navigation; anything added below the calendar scrolls behind it. */}
      <View className="bg-background px-5 py-3">
        <AttendanceAction
          attendedToday={home.attendedToday}
          busy={home.busy}
          date={selectedDate}
          isCheckedIn={home.isCheckedIn}
          kind={day.kind}
          located={Boolean(live)}
          onSubmit={submit}
          ready={home.statusLoaded}
        />
      </View>
    </TabScreen>
  );
}
