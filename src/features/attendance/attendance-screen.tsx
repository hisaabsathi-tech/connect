import { Download02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from "react-native";

import { TabScreen } from "@/components/modules/layout";
import { Text } from "@/components/modules/typography";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/config/colors";
import { PhotoViewer, type PhotoViewerTarget } from "@/features/attendance-photo";
import { useAuthSession } from "@/lib/auth/session";
import { useDateFilter } from "@/lib/date";
import { haptic } from "@/lib/haptics";

import { AttendanceDayCard } from "./components/attendance-day-card";
import { AttendanceHeader, AttendanceSummaryCards } from "./components/attendance-summary";
import { AttendanceTable } from "./components/attendance-table";
import { DateRangeFilter } from "./components/date-range-filter";
import { EmptyBlock } from "./components/empty-block";
import { HolidaySheet } from "./components/holiday-sheet";
import { useAttendanceDays } from "./hooks/use-attendance-days";
import { type DateRange, useAttendanceRange } from "./hooks/use-attendance-range";
import { useAttendanceSummary } from "./hooks/use-attendance-summary";
import { useHolidays } from "./hooks/use-holidays";
import { type AttendanceDayEntry, summarizeRange } from "./lib/days";
import { saveAttendanceCsv, shareAttendanceCsv } from "./lib/export-csv";

function Separator() {
  return <View className="h-3" />;
}

/**
 * The member's attendance: this month's present days and this week's hours on top, then every
 * day from today backwards as cards (a week first, a month more on each scroll to the end). With
 * a date range applied, that range shows as a table instead, which can be exported as CSV.
 */
export function AttendanceScreen() {
  const { token } = useAuthSession();
  const { today } = useDateFilter();
  const toast = useToast();
  const summary = useAttendanceSummary(token, today);
  const { holidays, reload: reloadHolidays } = useHolidays(token, today);
  const list = useAttendanceDays(token, today);
  const [range, setRange] = useState<DateRange | null>(null);
  const table = useAttendanceRange(token, range, today);
  // Only days with a check-in get a card; absent days, holidays and weekly offs are left out.
  const attendedDays = useMemo(() => list.days.filter((day) => day.record), [list.days]);
  // A list too short to scroll never reaches its end, so load the month before right away.
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const { done, loadMore, loading, loadingMore, moreFailed } = list;
  useEffect(() => {
    const short = viewportHeight > 0 && contentHeight > 0 && contentHeight < viewportHeight;
    if (!range && short && !(loading || loadingMore || done || moreFailed)) loadMore();
  }, [contentHeight, done, loadMore, loading, loadingMore, moreFailed, range, viewportHeight]);
  // With a range applied the top cards describe it: present days out of all its days, and the
  // total time worked in it.
  const rangeSummary = useMemo(
    () =>
      range && !table.loading && !table.failed ? summarizeRange(table.days, range, today) : null,
    [range, table.days, table.failed, table.loading, today],
  );
  const [photo, setPhoto] = useState<PhotoViewerTarget | null>(null);
  const [holidaysOpen, setHolidaysOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Coming back to the tab (e.g. after checking in on Home) refreshes the numbers and this week
  // in place. The first focus is the initial load, which the hooks already do.
  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!focusedBefore.current) {
        focusedBefore.current = true;
        return;
      }
      void summary.reload();
      void list.refreshRecent();
    }, [list.refreshRecent, summary.reload]),
  );

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        summary.reload(),
        reloadHolidays(),
        range ? table.reload() : list.reset(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const exportRange = async () => {
    if (!range || exporting) return;
    setExporting(true);
    try {
      // Saved on the device first, so the file is kept even if the share sheet is dismissed.
      const folder = await saveAttendanceCsv(table.days, range, today);
      if (folder) toast.success("Attendance exported", `Saved to ${folder} on your device.`);
      await shareAttendanceCsv(table.days, range, today);
    } catch {
      toast.error("Couldn't export", "Please update the app and try again.");
    } finally {
      setExporting(false);
    }
  };

  const openPhoto = (day: AttendanceDayEntry, side: PhotoViewerTarget["side"]) => {
    if (day.record) setPhoto({ date: day.date, id: day.record.id, side });
  };

  const header = (
    <View className="pb-4">
      <AttendanceHeader
        onOpenHolidays={holidays.length ? () => setHolidaysOpen(true) : undefined}
      />
      <AttendanceSummaryCards
        ranged={Boolean(range)}
        summary={range ? rangeSummary : summary.summary}
      />
      <View className="mt-5 flex-row items-center justify-between gap-3">
        <View className="flex-shrink">
          <DateRangeFilter onChange={setRange} range={range} today={today} />
        </View>
        {range && table.days.length ? (
          <Pressable
            accessibilityRole="button"
            className={`h-11 flex-row items-center gap-2 bg-primary px-3 active:bg-primary-hover ${exporting ? "opacity-60" : ""}`}
            disabled={exporting}
            onPress={() => void exportRange()}
            onPressIn={() => haptic("light")}
          >
            <Text className="text-sm font-medium text-primary-foreground">Export</Text>
            {exporting ? (
              <ActivityIndicator color={colors.primaryForeground} size="small" />
            ) : (
              <HugeiconsIcon
                color={colors.primaryForeground}
                icon={Download02Icon}
                size={18}
                strokeWidth={1.8}
              />
            )}
          </Pressable>
        ) : null}
      </View>
      {range ? (
        <AttendanceTable
          days={table.days}
          failed={table.failed}
          loading={table.loading}
          onRetry={() => void table.reload()}
        />
      ) : null}
    </View>
  );

  // With no cards yet, the empty block shows loading and errors instead.
  const footer =
    range || !attendedDays.length ? null : list.loadingMore ? (
      <View className="py-6">
        <ActivityIndicator color={colors.primary} />
      </View>
    ) : list.moreFailed ? (
      <Pressable accessibilityRole="button" className="items-center py-6" onPress={list.retryMore}>
        <Text className="text-sm text-primary">Couldn't load earlier days. Tap to retry</Text>
      </Pressable>
    ) : list.done ? (
      <Text className="py-6 text-center text-sm text-muted-foreground">No earlier attendance</Text>
    ) : null;

  const empty = range ? null : list.loading || (list.loadingMore && !attendedDays.length) ? (
    <EmptyBlock />
  ) : list.failed ? (
    <EmptyBlock
      action={{ label: "Try again", onPress: () => void list.reset() }}
      description="Check your connection and try again."
      title="Couldn't load attendance"
    />
  ) : list.moreFailed && !attendedDays.length ? (
    <EmptyBlock
      action={{ label: "Try again", onPress: list.retryMore }}
      description="Check your connection and try again."
      title="Couldn't load attendance"
    />
  ) : list.done ? (
    <EmptyBlock description="Days you check in will show here." title="No attendance yet" />
  ) : null;

  return (
    <TabScreen>
      <FlatList
        className="flex-1"
        contentContainerClassName="px-5 pb-8"
        data={range ? [] : attendedDays}
        ItemSeparatorComponent={Separator}
        keyExtractor={(day) => day.date}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        ListHeaderComponent={header}
        onContentSizeChange={(_, height) => setContentHeight(height)}
        onEndReached={range ? undefined : () => list.loadMore()}
        onEndReachedThreshold={0.4}
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={() => void refresh()}
            refreshing={refreshing}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <AttendanceDayCard day={item} onOpenPhoto={(side) => openPhoto(item, side)} />
        )}
      />
      <HolidaySheet
        holidays={holidays}
        onClose={() => setHolidaysOpen(false)}
        today={today}
        visible={holidaysOpen}
      />
      <PhotoViewer onClose={() => setPhoto(null)} target={photo} token={token} />
    </TabScreen>
  );
}
