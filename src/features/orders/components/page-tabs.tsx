import { Pressable, View } from "react-native";

import { Text } from "@/components/modules/typography";
import { haptic } from "@/lib/haptics";

export type PageTab = "orders" | "drs";

const TABS: { id: PageTab; label: string }[] = [
  { id: "orders", label: "Orders" },
  { id: "drs", label: "DRS" },
];

/** The page's Orders | DRS switch: the active half filled in brand blue. */
export function PageTabs({
  onChange,
  value,
}: {
  onChange: (tab: PageTab) => void;
  value: PageTab;
}) {
  return (
    <View
      accessibilityRole="tablist"
      className="mt-3 h-12 flex-row gap-1.5 border border-border bg-card p-1"
    >
      {TABS.map((tab) => {
        const active = tab.id === value;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className={`flex-1 items-center justify-center ${active ? "bg-primary active:bg-primary" : "active:bg-[#F7F8FF]"}`}
            key={tab.id}
            onPress={() => {
              if (active) return;
              haptic("selection");
              onChange(tab.id);
            }}
          >
            <Text
              className={`text-base ${active ? "font-medium text-primary-foreground" : "text-foreground"}`}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
