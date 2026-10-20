import { Download02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useFocusEffect } from "expo-router";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from "react-native";

import { type DateRange, SearchRangeToolbar } from "@/components/modules/date-range";
import { EmptyBlock } from "@/components/modules/empty-state";
import { TabScreen } from "@/components/modules/layout";
import { CardSkeleton, ListPageSkeleton } from "@/components/modules/skeleton";
import { StatCard } from "@/components/modules/stat-card";
import { Text } from "@/components/modules/typography";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/config/colors";
import type { AttendanceRecord } from "@/lib/api/attendance";
import type { RosterRow } from "@/lib/api/attendance-roster";
import { useAuthSession } from "@/lib/auth/session";
import { useDateFilter } from "@/lib/date";
import { errorMessage } from "@/lib/errors";
import { saveToDevice, shareFile } from "@/lib/files/device-files";
import { haptic } from "@/lib/haptics";

import { AttendanceDetailSheet, hasAttendanceDetails } from "./components/attendance-detail-sheet";
import { RosterCard } from "./components/roster-card";
import { useRegisterDownload } from "./hooks/use-register-download";
import { useRoster } from "./hooks/use-roster";
import { recordOfRow } from "./lib/roster";

// Typing pauses this long before the search runs.
const SEARCH_DELAY_MS = 350;

function Separator() {
  return <View className="h-3" />;
}

/**
 * The organisation's attendance for its owner: totals on top, then every
 * employee's day as a card, absent and holidays included. By default today; the calendar in the
 * search bar picks a date range, and the search narrows to an employee's name. Download saves the
 * web app's daily register as a PNG per day. `tabs` (Company / Own) sits under the title.
 */
export function CompanyAttendance({ tabs }: { tabs?: ReactNode }) {
  const { token } = useAuthSession();
  const { resetToToday, selectedDate, today } = useDateFilter();
  const toast = useToast();
  const [range, setRange] = useState<DateRange | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  // A date picked in Home applies here until the user picks a local date range instead.
  useEffect(() => setRange(null), [selectedDate]);
  const selectedDayRange = selectedDate === today ? null : { from: selectedDate, to: selectedDate };
  const activeRange = range ?? selectedDayRange;
  const from = activeRange?.from ?? today;
  const to = activeRange?.to ?? today;
  const roster = useRoster(token, { from, search, to });
  const register = useRegisterDownload(token, today);
  const [downloading, setDownloading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<{ record: AttendanceRecord; name: string } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // Coming back to the tab refreshes the roster (people check in and out all day).
  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!focusedBefore.current) {
        focusedBefore.current = true;
        return;
      }
      void roster.reset();
    }, [roster.reset]),
  );

  const refresh = async () => {
    setRefreshing(true);
    try {
      await roster.reset();
    } finally {
      setRefreshing(false);
    }
  };

  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const files = await register.build(activeRange);
      const folder = await saveToDevice(files);
      if (folder)
        toast.success(
          "Attendance downloaded",
          files.length === 1
            ? `Saved to ${folder} on your device.`
            : `Saved ${files.length} registers to ${folder} on your device.`,
        );
      // A single day can be sent on straight away; several stay in the folder.
      if (files.length === 1) await shareFile(files[0], "Attendance register");
    } catch (error) {
      toast.error("Couldn't download attendance", errorMessage(error, "Please try again."));
    } finally {
      setDownloading(false);
    }
  };

  const openDetail = (row: RosterRow) => {
    const record = recordOfRow(row);
    if (record) setDetail({ name: row.name, record });
  };

  const totals = roster.totals;
  const header = (
    <View className="pb-4">
      <View className="flex-row items-start gap-3">
        <View className="flex-1">
          <Text className="text-2xl font-semibold leading-8 text-foreground">Attendance</Text>
          <Text className="mt-0.5 text-sm text-muted-foreground">Attendance record</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          className={`h-10 flex-row items-center gap-2 bg-primary px-3 active:bg-primary-hover ${downloading ? "opacity-60" : ""}`}
          disabled={downloading}
          onPress={() => void download()}
          onPressIn={() => haptic("light")}
        >
          <Text className="text-sm font-medium text-primary-foreground">Download</Text>
          {downloading ? (
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
      </View>
      {tabs}
      <View className="mt-5 flex-row gap-3">
        <StatCard label="Total Employees" value={totals ? String(totals.totalEmployees) : "--"} />
        <StatCard
          label={activeRange ? "Present" : "Present Today"}
          value={totals ? String(totals.present) : "--"}
        />
      </View>
      <View className="mt-5">
        <SearchRangeToolbar
          onQueryChange={setQuery}
          onSelectedDateClear={resetToToday}
          onRangeChange={setRange}
          query={query}
          range={range}
          searchLabel="Search employees"
          selectedDate={selectedDate === today ? null : selectedDate}
          today={today}
        />
      </View>
    </View>
  );

  const empty = roster.loading ? (
    <EmptyBlock />
  ) : roster.failed ? (
    <EmptyBlock
      action={{ label: "Try again", onPress: () => void roster.reset() }}
      description="Check your connection and try again."
      title="Couldn't load attendance"
    />
  ) : (
    <EmptyBlock
      description={search ? `No employee matches "${search}".` : "There are no employees to show."}
      title={search ? "No employees found" : "No attendance"}
    />
  );

  const footer = !roster.rows.length ? null : roster.loadingMore ? (
    <View className="pt-3">
      <CardSkeleton />
    </View>
  ) : roster.moreFailed ? (
    <Pressable accessibilityRole="button" className="items-center py-6" onPress={roster.retryMore}>
      <Text className="text-sm text-primary">Couldn't load more. Tap to retry</Text>
    </Pressable>
  ) : null;

  // The first load fills the page; later ones (a new search or range) load inside the list.
  if (roster.loading && !roster.totals)
    return (
      <TabScreen>
        <ListPageSkeleton chips={false} />
      </TabScreen>
    );

  return (
    <TabScreen>
      <FlatList
        className="flex-1"
        contentContainerClassName="px-5 pb-8"
        data={roster.loading ? [] : roster.rows}
        ItemSeparatorComponent={Separator}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(row) => row.id}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        ListHeaderComponent={header}
        onEndReached={() => roster.loadMore()}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={() => void refresh()}
            refreshing={refreshing}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => {
          const record = recordOfRow(item);
          return (
            <RosterCard
              onPress={record && hasAttendanceDetails(record) ? () => openDetail(item) : undefined}
              row={item}
              showDate={Boolean(range)}
              today={today}
            />
          );
        }}
      />
      <AttendanceDetailSheet
        heading={detail?.name}
        onClose={() => setDetail(null)}
        record={detail?.record ?? null}
        scope="organization"
        token={token}
      />
      {register.element}
    </TabScreen>
  );
}
