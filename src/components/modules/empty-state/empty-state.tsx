import { Pressable, View } from "react-native";

import { Text } from "@/components/modules/typography";

export interface EmptyStateProps {
  title: string;
  /** One muted line per entry. */
  description: string[];
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center p-6">
      <Text className="text-2xl font-semibold text-foreground">{title}</Text>
      {description.map((line, index) => (
        <Text className={`${index ? "mt-1" : "mt-2"} text-muted-foreground`} key={line}>
          {line}
        </Text>
      ))}
      {action ? (
        <Pressable className="mt-6 rounded-xl bg-primary px-5 py-3" onPress={action.onPress}>
          <Text className="font-medium text-white">{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
