import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeOut } from "react-native-reanimated";

import { TabScreen, useScreenTop } from "@/components/modules/layout";
import { LocationIndicator, locationIndicatorState } from "@/components/modules/location";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/config/colors";
import { PhotoViewer, type PhotoViewerTarget } from "@/features/attendance-photo";
import { useLiveLocation } from "@/hooks/use-live-location";
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
import { HomeSkeleton } from "./components/home-skeleton";
import { OrdersCard } from "./components/orders-card";
import { useActiveOrders } from "./hooks/use-active-orders";
import { useDayAttendance } from "./hooks/use-day-attendance";
import { useHomeAttendance } from "./hooks/use-home-attendance";

// The map takes whatever height the rest of the page leaves on screen, within these bounds, so
// the day's record and the swipe usually fit without scrolling.
const MAP_MIN_HEIGHT = 200;
const MAP_MAX_HEIGHT = 360;
// A delivery boy's map shows their deliveries, so it gets more room: the Orders card may sit just
// under the fold (the page scrolls to it), and the map fills the rest within these bounds.
const DELIVERY_MAP_MIN_HEIGHT = 300;
const DELIVERY_MAP_MAX_HEIGHT = 560;
// The scroll content's bottom padding (`pb-4`), part of what has to fit with the map.
const CONTENT_BOTTOM_PADDING = 16;
// The longest the first-load skeleton stays up, whatever is still loading.
const REVEAL_TIMEOUT_MS = 8000;

/** Signed-in only: the tabs layout redirects to /auth before this renders without a session. */
export function HomeScreen() {
  const { token } = useAuthSession();
  const viewer = useViewer();
  const { isDeliveryBoy } = viewer;
  const screenTop = useScreenTop();
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
  // Bumped by a pull to refresh, which recenters the map.
  const [mapResetKey, setMapResetKey] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  // Everything else on the page, which the map makes room for: the greeting above it and the
  // blocks below. Measured on their own (not from the scroll content), so the map's animated
  // height never feeds back into its own size.
  const [headerHeight, setHeaderHeight] = useState(0);
  const [belowHeight, setBelowHeight] = useState(0);
  // The Orders card's height (with its margin), left out of what must fit on screen.
  const [ordersCardHeight, setOrdersCardHeight] = useState(0);
  const [minHeight, maxHeight] = isDeliveryBoy
    ? [DELIVERY_MAP_MIN_HEIGHT, DELIVERY_MAP_MAX_HEIGHT]
    : [MAP_MIN_HEIGHT, MAP_MAX_HEIGHT];
  const measured = Boolean(viewportHeight && headerHeight && belowHeight);
  const onScreen =
    headerHeight + belowHeight + CONTENT_BOTTOM_PADDING - (isDeliveryBoy ? ordersCardHeight : 0);
  const mapHeight = measured
    ? Math.min(maxHeight, Math.max(minHeight, viewportHeight - onScreen))
    : maxHeight;

  // The skeleton covers the page until the member's role, today's status and the day's record
  // have loaded and the page has measured itself; then it fades out over the settled page.
  // Later changes (another day, a reload) happen in place, with the map's height easing.
  const settled = viewer.isLoaded && home.settled && !day.loading && measured;
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (settled) setRevealed(true);
  }, [settled]);
  // A request that hangs rather than fails would keep the page hidden; past this, show it as is.
  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), REVEAL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

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
    setMapResetKey((key) => key + 1);
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
        <View onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}>
          <HomeHeader identity={home.identity}>
            <LocationIndicator
              onPress={location.resolve}
              state={locationIndicatorState(location)}
            />
          </HomeHeader>
        </View>
        <HomeMap
          animateHeight={revealed}
          checkIn={dayCheckIn}
          checkOut={dayCheckOut}
          deliveryBoy={isDeliveryBoy}
          height={mapHeight}
          live={live}
          orders={showOrders ? deliveries.pins : null}
          organization={home.organization}
          resetKey={mapResetKey}
        />
        <View onLayout={(event) => setBelowHeight(event.nativeEvent.layout.height)}>
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
          {isDeliveryBoy ? (
            <View onLayout={(event) => setOrdersCardHeight(event.nativeEvent.layout.height)}>
              <OrdersCard />
            </View>
          ) : null}
        </View>
      </ScrollView>
      {/* Below the scrolling page, just above the navigation; it never covers the content. */}
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
      {revealed ? null : (
        <Animated.View
          exiting={FadeOut.duration(260)}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { paddingTop: screenTop }]}
        >
          <View className="flex-1 bg-background">
            <HomeSkeleton />
          </View>
        </Animated.View>
      )}
      {home.photoModal}
      <PhotoViewer onClose={() => setPhoto(null)} target={photo} token={token} />
    </TabScreen>
  );
}
