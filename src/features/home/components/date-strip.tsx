import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  View,
} from "react-native";

import { Text } from "@/components/modules/typography";
import { useDateFilter } from "@/lib/date";

const VISIBLE_DAYS = 7;
const CENTER = Math.floor(VISIBLE_DAYS / 2);
// Days either side of the anchor day that can be scrolled to.
const RANGE_DAYS = 30;
const BORDER_WIDTH = 1;

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

interface CalendarDay {
  id: string;
  date: number;
  weekday: string;
  month: number;
  year: number;
}

/** `iso` shifted by `offset` days. Pure calendar arithmetic in UTC, so no timezone drift. */
function calendarDay(iso: string, offset: number): CalendarDay {
  const value = new Date(`${iso}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return {
    id: value.toISOString().slice(0, 10),
    date: value.getUTCDate(),
    weekday: WEEKDAYS[value.getUTCDay()],
    month: value.getUTCMonth(),
    year: value.getUTCFullYear(),
  };
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/** "October, 2026", "September - October, 2026" or "December, 2026 - January, 2027". */
function rangeLabel(first: CalendarDay, last: CalendarDay) {
  if (first.year !== last.year)
    return `${MONTHS[first.month]}, ${first.year} - ${MONTHS[last.month]}, ${last.year}`;
  if (first.month !== last.month)
    return `${MONTHS[first.month]} - ${MONTHS[last.month]}, ${last.year}`;
  return `${MONTHS[first.month]}, ${first.year}`;
}

/**
 * A week of connected day cells with today in the middle, bound to the shared date filter.
 * Swipes snap a day at a time; at midnight the strip scrolls so the new day is centred.
 */
export function DateStrip() {
  const { today, selectedDate, setSelectedDate, centerRequest } = useDateFilter();
  const [anchor, setAnchor] = useState(today);
  const [width, setWidth] = useState(0);
  const list = useRef<FlatList<CalendarDay>>(null);

  const todayIndex = RANGE_DAYS + daysBetween(anchor, today);
  // Today moved past what the list holds (app left open for weeks): rebuild around it.
  if (todayIndex < CENTER || todayIndex > RANGE_DAYS * 2 - CENTER) setAnchor(today);

  const days = useMemo(
    () => Array.from({ length: RANGE_DAYS * 2 + 1 }, (_, i) => calendarDay(anchor, i - RANGE_DAYS)),
    [anchor],
  );
  const cell = (width - BORDER_WIDTH) / VISIBLE_DAYS;
  // Exact per-day stops: Android truncates `snapToInterval` to whole pixels, so with a fractional
  // cell width the stops drift off the cell edges further along the list.
  const snapOffsets = useMemo(() => days.map((_, index) => index * cell), [days, cell]);
  const [start, setStart] = useState(todayIndex - CENTER);

  // Centre the requested day: today on mount, at midnight, and after a pull to refresh.
  useEffect(() => {
    if (cell <= 0) return;
    const index = RANGE_DAYS + daysBetween(anchor, centerRequest.date);
    list.current?.scrollToOffset({ animated: true, offset: (index - CENTER) * cell });
  }, [anchor, cell, centerRequest]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / cell);
    setStart(Math.min(Math.max(next, 0), days.length - VISIBLE_DAYS));
  };

  const first = days[start] ?? days[todayIndex - CENTER];
  const last = days[start + VISIBLE_DAYS - 1] ?? days[todayIndex + CENTER];
  return (
    <View className="my-3">
      <Text className="mb-2.5 text-base font-medium text-muted-foreground">
        {rangeLabel(first, last)}
      </Text>
      <View
        className="h-16 border-l border-[#D4DAFB]"
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      >
        {cell > 0 ? (
          <FlatList
            data={days}
            decelerationRate="fast"
            extraData={`${selectedDate}:${cell}`}
            getItemLayout={(_, index) => ({ index, length: cell, offset: cell * index })}
            horizontal
            initialScrollIndex={todayIndex - CENTER}
            keyExtractor={(day) => day.id}
            onScroll={onScroll}
            ref={list}
            renderItem={({ item }) => {
              const active = item.id === selectedDate;
              return (
                <Pressable
                  className={`h-full items-center justify-center border-y border-r ${active ? "border-primary bg-primary" : "border-[#D4DAFB] bg-[#F0F2FF]"}`}
                  onPress={() => setSelectedDate(item.id)}
                  style={{ width: cell }}
                >
                  <Text
                    className={`text-xl font-semibold leading-6 ${active ? "text-white" : "text-foreground"}`}
                  >
                    {item.date}
                  </Text>
                  <Text
                    className={`mt-1 text-[10px] leading-[14px] tracking-[1px] ${active ? "text-white" : "text-muted-foreground"}`}
                  >
                    {item.weekday}
                  </Text>
                </Pressable>
              );
            }}
            scrollEventThrottle={16}
            showsHorizontalScrollIndicator={false}
            snapToOffsets={snapOffsets}
          />
        ) : null}
      </View>
    </View>
  );
}
