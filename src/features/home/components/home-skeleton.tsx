import { View } from "react-native";

import { Skeleton } from "@/components/modules/skeleton";

// Day cells of the date strip, as many as it shows across the screen.
const STRIP_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/**
 * Home on its first load, in the page's own layout: the greeting, the map, the date strip, the
 * day's record and the swipe button. It covers the page until everything has loaded and settled,
 * then fades away, so the page never shows itself moving into place.
 */
export function HomeSkeleton() {
  return (
    <View className="flex-1">
      <View className="flex-1 px-5">
        <View className="mb-3 flex-row items-center gap-3">
          <Skeleton height={52} width={52} />
          <View className="flex-1 gap-2">
            <Skeleton height={18} width="45%" />
            <Skeleton height={13} width="75%" />
          </View>
          <Skeleton height={36} width={36} />
        </View>
        {/* The map takes the height the rest leaves, as on the page, without measuring first. */}
        <Skeleton className="flex-1" style={{ minHeight: 200 }} />
        <View className="mt-3.5 mb-2">
          <Skeleton className="mb-2" height={16} width={120} />
          <View className="h-16 flex-row gap-px">
            {STRIP_DAYS.map((day) => (
              <Skeleton className="flex-1" height={64} key={day} />
            ))}
          </View>
        </View>
        <Skeleton className="mt-2" height={136} />
      </View>
      <View className="px-5 py-3">
        <Skeleton height={52} />
      </View>
    </View>
  );
}
