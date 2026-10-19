import { RefreshControl, ScrollView, View } from "react-native";

import { TabScreen } from "@/components/modules/layout";
import { colors } from "@/config/colors";
import { useLiveLocation } from "@/hooks/use-live-location";
import { useAuthSession } from "@/lib/auth/session";
import { useDateFilter } from "@/lib/date";

import { AttendanceAction } from "./components/attendance-action";
import { DateStrip } from "./components/date-strip";
import { HomeHeader } from "./components/home-header";
import { HomeMap } from "./components/home-map";
import { useHomeAttendance } from "./hooks/use-home-attendance";

/** Signed-in only: the tabs layout redirects to /auth before this renders without a session. */
export function HomeScreen() {
  const { token } = useAuthSession();
  const live = useLiveLocation(Boolean(token));
  const home = useHomeAttendance(token, live);
  const { resetToToday } = useDateFilter();

  const refresh = () => {
    resetToToday();
    void home.refresh();
  };

  return (
    <TabScreen>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-5 pt-5"
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
          checkIn={home.checkInPoint}
          checkOut={home.checkOutPoint}
          live={live}
          organization={home.organization}
        />
        <DateStrip />
      </ScrollView>
      {/* Pinned above the navigation; anything added below the calendar scrolls behind it. */}
      <View className="bg-background px-5 py-3">
        <AttendanceAction
          attendedToday={home.attendedToday}
          busy={home.busy}
          canSubmit={Boolean(live)}
          isCheckedIn={home.isCheckedIn}
          onSubmit={home.submit}
        />
      </View>
    </TabScreen>
  );
}
