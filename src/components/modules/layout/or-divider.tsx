import { View } from "react-native";

import { Text } from "@/components/modules/typography";

/** Horizontal rule with a centred label separating alternative actions. */
export function OrDivider({ label = "or" }: { label?: string }) {
  return (
    <View className="flex-row items-center gap-4">
      <View className="h-px flex-1 bg-border" />
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <View className="h-px flex-1 bg-border" />
    </View>
  );
}
