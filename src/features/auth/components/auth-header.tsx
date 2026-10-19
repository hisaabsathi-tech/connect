import { Image } from "expo-image";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Brand bar below the status bar. */
export function AuthHeader() {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-row items-center px-5"
      style={{ height: insets.top + 58, paddingTop: insets.top }}
    >
      <Image
        accessibilityLabel="Hisaab Sathi"
        contentFit="contain"
        source={require("@/assets/logo/splash/dark.webp")}
        style={{ height: 34, width: 158 }}
      />
    </View>
  );
}
