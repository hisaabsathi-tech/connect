import { Pressable, ScrollView } from "react-native";

import { Text } from "@/components/modules/typography";
import { haptic } from "@/lib/haptics";

/** A row of status filters that scrolls sideways; the chosen one is tinted brand blue. */
export function FilterChips<T extends string>({
  className = "mt-5",
  onChange,
  options,
  value,
}: {
  /** The row's spacing from what sits above it. */
  className?: string;
  onChange: (value: T) => void;
  options: { id: T; label: string }[];
  value: T;
}) {
  return (
    <ScrollView
      className={`-mx-5 ${className}`}
      contentContainerClassName="gap-2 px-5"
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
    >
      {options.map((option) => {
        const active = option.id === value;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={`h-10 justify-center border px-4 ${active ? "border-[#C7CFFF] bg-accent active:bg-accent" : "border-[#E6E8EE] bg-[#F5F6F8] active:bg-[#ECEEF2]"}`}
            key={option.id}
            onPress={() => {
              haptic("selection");
              onChange(option.id);
            }}
          >
            <Text className={`text-sm ${active ? "font-medium text-primary" : "text-foreground"}`}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
