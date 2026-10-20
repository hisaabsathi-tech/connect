import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView } from "react-native";

import { TabScreen } from "@/components/modules/layout";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/config/colors";
import { PhotoViewer, type PhotoViewerTarget } from "@/features/attendance-photo";
import { type LiveLocation, useLiveLocation } from "@/hooks/use-live-location";
import { checkInPointOf, checkOutPointOf } from "@/lib/api/attendance";
import { useAuthSession } from "@/lib/auth/session";
import { useViewer } from "@/lib/auth/viewer";
import { formatDuration, formatTime, useDateFilter } from "@/lib/date";

import { AttendanceAction } from "./components/attendance-action";
import { AttendanceCard } from "./components/attendance-card";
import { DateStrip } from "./components/date-strip";
import { DayRecord } from "./components/day-record";
import { HomeHeader } from "./components/home-header";
import { HomeMap } from "./components/home-map";
import { LocationIndicator, type LocationIndicatorState } from "./components/location-indicator";
import { OrdersCard } from "./components/orders-card";
import { useActiveOrders } from "./hooks/use-active-orders";
import { useDayAttendance } from "./hooks/use-day-attendance";
import { useHomeAttendance } from "./hooks/use-home-attendance";

// The map takes whatever height the rest of the page leaves on screen, within these bounds, so
// the day's record and the swipe usually fit without scrolling.
const MAP_MIN_HEIGHT = 200;
const MAP_MAX_HEIGHT = 360;

/** What the header's location button shows; the one place that decides when each state appears. */
function locationIndicatorState({
  locating,
  status,
}: Pick<LiveLocation, "locating" | "status">): LocationIndicatorState {
  if (status === "denied" || status === "blocked" || status === "disabled") return "off";
  return locating || status === "checking" ? "active" : "on";
}

/** Signed-in only: the tabs layout redirects to /auth before this renders without a session. */
export function HomeScreen() {
  const { token } = useAuthSession();
  const { isDeliveryBoy } = useViewer();
  const location = useLiveLocation(Boolean(token));
  const live = location.location;
  const home = useHomeAttendance(token, live);
  const { resetToToday, selectedDate, today } = useDateFilter();
  const toast = useToast();
  // The calendar picks whose pins and record show; the swipe button always acts on today.
  const day = useDayAttendance(token, selectedDate, today);
  // Stable per record: the map re-frames its camera whenever its pins change.
  const dayCheckIn = useMemo(() => checkInPointOf(day.record), [day.record]);
  const dayCheckOut = useMemo(() => checkOutPointOf(day.record), [day.record]);
  // A delivery boy's orders still to deliver; while there are any, today's map shows them.
  const deliveries = useActiveOrders(isDeliveryBoy ? token : null, today);
  const showOrders = deliveries.active && selectedDate === today;
  const [photo, setPhoto] = useState<PhotoViewerTarget | null>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  // Content height minus the map: everything else on the page, which the map makes room for.
  const [restHeight, setRestHeight] = useState(0);
  const mapHeight =
    viewportHeight && restHeight
      ? Math.min(MAP_MAX_HEIGHT, Math.max(MAP_MIN_HEIGHT, viewportHeight - restHeight))
      : MAP_MAX_HEIGHT;
  // The height the content was last laid out with, to subtract from its measured size.
  const renderedMapHeight = useRef(mapHeight);
  renderedMapHeight.current = mapHeight;

  // Coming back from the Orders tab drops the orders delivered meanwhile.
  const focusedBefore = useRef(false);
  const reloadDeliveries = deliveries.reload;
  useFocusEffect(
    useCallback(() => {
      if (!focusedBefore.current) {
        focusedBefore.current = true;
        return;
      }
      void reloadDeliveries(true);
    }, [reloadDeliveries]),
  );

  const refresh = () => {
    resetToToday();
    void home.refresh();
    void day.reload();
    void deliveries.reload(true);
  };

  const submit = async () => {
    // Location may have been switched off since it was last checked; this asks again if so.
    if (!(await location.ensure())) return;
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
        contentContainerClassName="px-5 pb-4"
        onContentSizeChange={(_, height) => setRestHeight(height - renderedMapHeight.current)}
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={refresh}
            refreshing={home.refreshing}
            tintColor={colors.primary}
          />
        }
      >
        <HomeHeader identity={home.identity}>
          <LocationIndicator onPress={location.resolve} state={locationIndicatorState(location)} />
        </HomeHeader>
        <HomeMap
          checkIn={dayCheckIn}
          checkOut={dayCheckOut}
          deliveryBoy={isDeliveryBoy}
          height={mapHeight}
          live={live}
          orders={showOrders ? deliveries.pins : null}
          organization={home.organization}
        />
        <DateStrip />
        {/* A superadmin without Superadmin Attendance doesn't check in: the card leads to the
            organisation's attendance instead of their own day. */}
        {home.selfAttendance ? (
          <DayRecord
            date={selectedDate}
            failed={day.failed}
            kind={day.kind}
            loading={day.loading}
            offDay={day.offDay}
            onOpenPhoto={(side) => {
              if (day.record) setPhoto({ date: selectedDate, id: day.record.id, side });
            }}
            record={day.record}
          />
        ) : (
          <AttendanceCard />
        )}
        {/* Under the day's record; the page scrolls once the map is down to its smallest. */}
        {isDeliveryBoy ? <OrdersCard /> : null}
      </ScrollView>
      {/* Pinned above the navigation; anything added below the calendar scrolls behind it. */}
      {home.selfAttendance ? (
        <AttendanceAction
          attendedToday={home.attendedToday}
          busy={home.busy}
          isCheckedIn={home.isCheckedIn}
          kind={day.kind}
          located={Boolean(live)}
          location={location.status}
          onFixLocation={location.resolve}
          onSubmit={submit}
          ready={home.statusLoaded}
        />
      ) : null}
      {home.photoModal}
      <PhotoViewer onClose={() => setPhoto(null)} target={photo} token={token} />
    </TabScreen>
  );
}
