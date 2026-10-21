import { LocationOffline03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { View } from "react-native";

import { HapticButton } from "@/components/modules/button";
import { BottomSheet } from "@/components/modules/sheet";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import type { TrackingBlocker } from "@/lib/tracking/duty";

const copy: Record<TrackingBlocker, { title: string; description: string; action: string }> = {
  background: {
    action: "Allow all the time",
    description:
      "Your delivery is being tracked live. Set location to “Allow all the time” so tracking keeps going while the app is in the background or the screen is off.",
    title: "Keep location on all the time",
  },
  permission: {
    action: "Allow location",
    description:
      "Your delivery is being tracked live, and the office and the customer follow it on the map. Allow location to continue.",
    title: "Location permission needed",
  },
  services: {
    action: "Turn on location",
    description:
      "Your phone's location is switched off, so live tracking has stopped. Turn it on to continue the delivery.",
    title: "Turn on device location",
  },
};

/**
 * Shown over every screen while a live trip is on and location is blocked. It can't be dismissed:
 * the trip only stays live while the phone reports where it is. Closes by itself once fixed.
 */
export function LocationGuardSheet({
  blocker,
  busy,
  onFix,
}: {
  blocker: TrackingBlocker | null;
  busy: boolean;
  onFix: () => void;
}) {
  const shown = blocker ?? "permission";
  return (
    <BottomSheet dismissible={false} onClose={() => undefined} visible={blocker !== null}>
      <View accessibilityRole="alert">
        <View className="mt-5 h-12 w-12 items-center justify-center rounded-full bg-[#FFF1F2]">
          <HugeiconsIcon
            color={colors.destructive}
            icon={LocationOffline03Icon}
            size={26}
            strokeWidth={1.5}
          />
        </View>
        <Text className="mt-4 text-xl font-semibold text-foreground">{copy[shown].title}</Text>
        <Text className="mt-2 text-base leading-6 text-muted-foreground">
          {copy[shown].description}
        </Text>
        <View className="mt-7 flex-row">
          <HapticButton disabled={busy} kind="medium" label={copy[shown].action} onPress={onFix} />
        </View>
      </View>
    </BottomSheet>
  );
}
