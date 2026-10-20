import type { ReactNode } from "react";
import { View } from "react-native";

import { Text } from "@/components/modules/typography";

interface AuthCardProps {
  title: string;
  description: string;
  children: ReactNode;
}

/** Title, description and the stacked fields/actions of one auth step. */
export function AuthCard({ title, description, children }: AuthCardProps) {
  return (
    <View className="w-full max-w-sm">
      <Text className="text-2xl font-semibold tracking-[-0.5px] text-foreground">{title}</Text>
      <Text className="mt-2 max-w-sm text-sm leading-5 text-muted-foreground">{description}</Text>
      <View className="mt-7 gap-5">{children}</View>
    </View>
  );
}
