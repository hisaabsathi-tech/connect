import { CheckmarkCircle02Icon, RefreshIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Image } from "expo-image";
import { View } from "react-native";

import { Button, ButtonText } from "@/components/ui/button";
import { colors } from "@/config/colors";

interface PhotoConfirmProps {
  uri: string;
  onConfirm: () => void;
  onRetake: () => void;
}

/** The Figma "Attendance-photo-confirm" frame: the cropped photo, then Retake or Confirm. */
export function PhotoConfirm({ uri, onConfirm, onRetake }: PhotoConfirmProps) {
  return (
    <View className="flex-1 gap-6 bg-background px-4 pt-safe pb-safe">
      <View className="mt-4 flex-1 border-2 border-primary">
        <Image
          accessibilityLabel="Your photo"
          contentFit="cover"
          source={{ uri }}
          style={{ flex: 1 }}
        />
      </View>
      <View className="mb-4 flex-row gap-4">
        <Button className="h-12 flex-1 bg-primary/25" onPress={onRetake} variant="secondary">
          <HugeiconsIcon color={colors.foreground} icon={RefreshIcon} size={18} strokeWidth={1.8} />
          <ButtonText className="text-base text-foreground">Retake</ButtonText>
        </Button>
        <Button className="h-12 flex-1" onPress={onConfirm}>
          <HugeiconsIcon
            color={colors.primaryForeground}
            icon={CheckmarkCircle02Icon}
            size={18}
            strokeWidth={1.8}
          />
          <ButtonText className="text-base">Confirm</ButtonText>
        </Button>
      </View>
    </View>
  );
}
