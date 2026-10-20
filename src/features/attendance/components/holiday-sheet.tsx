import { ScrollView, useWindowDimensions, View } from "react-native";

import { BottomSheet } from "@/components/modules/sheet";
import { Text } from "@/components/modules/typography";
import type { NonWorkingDay } from "@/lib/api/attendance";
import { weekdayOf } from "@/lib/date";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function HolidayRow({ holiday, today }: { holiday: NonWorkingDay; today: string }) {
  const past = holiday.date < today;
  const isToday = holiday.date === today;
  return (
    <View
      className={`flex-row items-center gap-4 border-border border-b py-3 ${past ? "opacity-50" : ""}`}
    >
      <View
        className={`h-14 w-14 items-center justify-center ${isToday ? "bg-primary" : "bg-accent"}`}
      >
        <Text
          className={`text-xl font-semibold leading-6 ${isToday ? "text-primary-foreground" : "text-foreground"}`}
        >
          {Number(holiday.date.slice(8, 10))}
        </Text>
        <Text
          className={`text-[11px] uppercase ${isToday ? "text-primary-foreground" : "text-muted-foreground"}`}
        >
          {MONTHS[Number(holiday.date.slice(5, 7)) - 1]}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-base font-medium text-foreground">{holiday.name}</Text>
        <Text className="mt-0.5 text-sm text-muted-foreground">
          {isToday ? "Today" : weekdayOf(holiday.date)}
        </Text>
      </View>
    </View>
  );
}

/**
 * This year's holidays from the organisation's attendance configuration, in date order; past
 * ones are dimmed. The list scrolls inside the sheet, so only the handle drags it down.
 */
export function HolidaySheet({
  holidays,
  onClose,
  today,
  visible,
}: {
  holidays: NonWorkingDay[];
  onClose: () => void;
  today: string;
  visible: boolean;
}) {
  const { height } = useWindowDimensions();
  const upcoming = holidays.filter((holiday) => holiday.date >= today).length;
  return (
    <BottomSheet dragHandleOnly onClose={onClose} visible={visible}>
      <Text className="mt-2 text-xl font-semibold leading-7 text-foreground">Holiday List</Text>
      <Text className="mt-0.5 text-sm text-muted-foreground">
        {today.slice(0, 4)} · {holidays.length} {holidays.length === 1 ? "holiday" : "holidays"}
        {upcoming ? ` · ${upcoming} upcoming` : ""}
      </Text>
      <ScrollView className="mt-3" style={{ maxHeight: height * 0.6, minHeight: height * 0.35 }}>
        {holidays.map((holiday) => (
          <HolidayRow holiday={holiday} key={holiday.date} today={today} />
        ))}
      </ScrollView>
    </BottomSheet>
  );
}
