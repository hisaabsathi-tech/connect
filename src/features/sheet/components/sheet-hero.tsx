import { CirclePlusIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Image } from "expo-image";
import { Pressable, useWindowDimensions, View } from "react-native";

import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import { haptic } from "@/lib/haptics";

// "Auto filled by AI" over a sheet (462×371).
const ILLUSTRATION = require("@/assets/illustrations/sheet.svg");
const ILLUSTRATION_RATIO = 371 / 462;
// The page's side gutters (px-5) and the card's own padding (p-6), both sides.
const CARD_INSET = 40 + 48;

/** The Sheet page's banner: what Smart Sheet does, the button to start one, and the artwork. */
export function SheetHero({ onCreate }: { onCreate: () => void }) {
  const { width } = useWindowDimensions();
  // The artwork takes about two fifths of the card, so the copy keeps room on narrow phones.
  const artWidth = Math.min(140, (width - CARD_INSET) * 0.42);
  return (
    <View className="flex-row items-center bg-[#F0F2FF] p-4">
      <View className="flex-1 pr-2">
        <Text className="text-[22px] font-semibold leading-7 text-foreground">
          Create Shipping Manifest
        </Text>
        <Text className="mt-2 text-[13px] leading-5 text-muted-foreground">
          Fill a few details and generate a shipping manifest.
        </Text>
        <Pressable
          accessibilityRole="button"
          className="mt-5 h-11 flex-row items-center gap-2 self-start bg-primary px-4 active:bg-primary-hover"
          onPress={onCreate}
          onPressIn={() => haptic("light")}
        >
          <Text className="text-sm font-medium text-primary-foreground">Create Sheet</Text>
          <HugeiconsIcon color={colors.primaryForeground} icon={CirclePlusIcon} size={18} />
        </Pressable>
      </View>
      <Image
        accessibilityIgnoresInvertColors
        contentFit="contain"
        source={ILLUSTRATION}
        style={{ height: artWidth * ILLUSTRATION_RATIO, width: artWidth }}
      />
    </View>
  );
}
