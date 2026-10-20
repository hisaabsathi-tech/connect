import { View } from "react-native";

import { Skeleton } from "./skeleton";

/** A card from the app's lists (title, status, two columns, a footer row), still loading. */
export function CardSkeleton() {
  return (
    <View className="border border-[#EEF0F6] bg-card p-4">
      <View className="flex-row items-start justify-between">
        <View className="gap-2">
          <Skeleton height={10} width={64} />
          <Skeleton height={18} width={160} />
        </View>
        <Skeleton height={22} width={72} />
      </View>
      <View className="mt-5 flex-row justify-between">
        <View className="gap-2">
          <Skeleton height={10} width={96} />
          <Skeleton height={16} width={120} />
        </View>
        <View className="items-end gap-2">
          <Skeleton height={10} width={96} />
          <Skeleton height={16} width={88} />
        </View>
      </View>
      <View className="mt-5 flex-row items-center justify-between">
        <Skeleton height={30} width={84} />
        <View className="flex-row gap-2">
          <Skeleton height={44} width={44} />
          <Skeleton height={44} width={44} />
        </View>
      </View>
    </View>
  );
}

/** Loading cards for a list, spaced like the list itself. */
export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View className="gap-3">
      {Array.from({ length: count }, (_, index) => (
        // Fixed placeholders that never reorder, so the index is a stable key.
        <CardSkeleton key={index} />
      ))}
    </View>
  );
}

/** A stat card's label and figure, still loading (same box as `StatCard`). */
export function StatCardSkeleton() {
  return (
    <View className="flex-1 border border-border bg-card px-4 py-4">
      <Skeleton height={12} width="70%" />
      <Skeleton className="mt-3" height={28} width={48} />
    </View>
  );
}

/**
 * A list page on its first load: title and subtitle, an optional tab switch, two stat cards,
 * the filter chips (when the page has them), the search bar and a few cards, laid out like the
 * real page so it settles in place.
 */
export function ListPageSkeleton({
  chips = true,
  tabs = false,
}: {
  chips?: boolean;
  tabs?: boolean;
}) {
  return (
    <View className="px-5">
      <Skeleton height={26} width="62%" />
      <Skeleton className="mt-2" height={14} width="78%" />
      {tabs ? <Skeleton className="mt-5" height={48} /> : null}
      <View className="mt-5 flex-row gap-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
      </View>
      {chips ? (
        <View className="mt-5 flex-row gap-2">
          <Skeleton height={40} width={92} />
          <Skeleton height={40} width={104} />
          <Skeleton height={40} width={84} />
        </View>
      ) : null}
      <Skeleton className={chips ? "mt-4" : "mt-5"} height={48} />
      <View className="mt-4">
        <CardListSkeleton count={2} />
      </View>
    </View>
  );
}
