import { Pressable, ScrollView } from "react-native";

import { Text } from "@/components/modules/typography";
import { haptic } from "@/lib/haptics";

/** A row of status filters that scrolls sideways; the chosen one is tinted brand blue. */
export function FilterChips<T extends string>({
  onChange,
  options,
  value,
}: {
  onChange: (value: T) => void;
  options: { id: T; label: string }[];
  value: T;
}) {
  return (
    <ScrollView
      className="mt-5 -mx-5"
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
            className={`h-10 justify-center border px-4 ${active ? "border-[#C7CFFF] bg-accent" : "border-[#E6E8EE] bg-[#F5F6F8] active:bg-[#ECEEF2]"}`}
            key={option.id}
            onPress={() => {
              if (active) return;
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
