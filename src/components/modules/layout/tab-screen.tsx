import type { PropsWithChildren } from "react";
import { View } from "react-native";

import { useScreenTop } from "./use-screen-top";

/** Page frame for the signed-in destinations; the bottom navigation is the tabs layout's bar. */
export function TabScreen({ children }: PropsWithChildren) {
  const top = useScreenTop();
  return (
    <View className="flex-1 bg-background" style={{ paddingTop: top }}>
      {children}
    </View>
  );
}
