import { Image, View } from "react-native";
import { SvgUri } from "react-native-svg";

import { Text } from "@/components/modules/typography";
import release from "../../../../version.json";

const logo = Image.resolveAssetSource(require("@/assets/logo/splash/dark.svg"));

/** Brand mark, version and tagline at the bottom of the profile. */
export function BrandFooter() {
  return (
    <View className="items-center pb-1">
      <SvgUri height={34} uri={logo.uri} width={158} />
      <Text className="mt-2 text-sm font-medium text-muted-foreground">
        Version: {release.version}
      </Text>
      <Text className="mt-0.5 text-sm text-muted-foreground">Har bill ka smart tarika</Text>
    </View>
  );
}
