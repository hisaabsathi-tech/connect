import { Pressable } from "react-native";

import { Text } from "@/components/modules/typography";
import { haptic } from "@/lib/haptics";

/**
 * A labelled figure for the row of totals at the top of a page. With `onPress` it is a filter:
 * tapping shows just what it counts, and `active` outlines it in brand blue while it applies.
 */
export function StatCard({
  active = false,
  label,
  onPress,
  value,
}: {
  active?: boolean;
  label: string;
  onPress?: () => void;
  value: string;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityState={onPress ? { selected: active } : undefined}
      className={`flex-1 border px-4 py-3 ${active ? "border-primary bg-accent active:bg-accent" : "border-border bg-card active:bg-[#F7F8FF]"}`}
      disabled={!onPress}
      onPress={onPress}
      onPressIn={onPress ? () => haptic("selection") : undefined}
    >
      <Text
        className={`text-xs font-medium uppercase tracking-[0.3px] ${active ? "text-primary" : "text-muted-foreground"}`}
      >
        {label}
      </Text>
      <Text
        className={`mt-1 text-2xl font-semibold leading-8 ${active ? "text-primary" : "text-foreground"}`}
        numberOfLines={1}
      >
        {value}
      </Text>
    </Pressable>
  );
}
