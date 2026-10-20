import { Image } from "expo-image";
import { View } from "react-native";

import { useScreenTop } from "@/components/modules/layout";

/** Brand bar below the status bar, starting at the same height as the tab screens. */
export function AuthHeader() {
  const top = useScreenTop();
  return (
    <View className="flex-row items-center px-5 pb-3" style={{ paddingTop: top }}>
      <Image
        accessibilityLabel="Hisaab Sathi"
        contentFit="contain"
        source={require("@/assets/logo/splash/dark.webp")}
        style={{ height: 34, width: 158 }}
      />
    </View>
  );
}
