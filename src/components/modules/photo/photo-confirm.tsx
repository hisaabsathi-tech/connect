import { CheckmarkCircle02Icon, RefreshIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { colors } from "@/config/colors";

import { ZoomableImage } from "./zoomable-image";

interface PhotoConfirmProps {
  uri: string;
  onConfirm: () => void;
  onRetake: () => void;
  /** Saving or uploading after Confirm: both buttons wait and Confirm shows a spinner. */
  busy?: boolean;
}

/**
 * The Figma "Attendance-photo-confirm" frame: the photo (pinch to zoom, drag, double tap),
 * then Retake or Confirm. Used for attendance and profile photos. Rendered inside a `Modal`,
 * so it brings its own gesture root.
 */
export function PhotoConfirm({ busy = false, uri, onConfirm, onRetake }: PhotoConfirmProps) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View className="flex-1 bg-background px-4 pt-safe pb-safe">
        <View className="mt-10 mb-8 flex-1 border-2 border-primary bg-black">
          <ZoomableImage accessibilityLabel="Your photo" uri={uri} />
        </View>
        <View className="mb-6 flex-row gap-4">
          <Button
            className="h-12 flex-1 bg-primary/25"
            disabled={busy}
            onPress={onRetake}
            variant="secondary"
          >
            <ButtonText className="text-base text-foreground">Retake</ButtonText>
            <HugeiconsIcon
              color={colors.foreground}
              icon={RefreshIcon}
              size={18}
              strokeWidth={1.8}
            />
          </Button>
          <Button className="h-12 flex-1" disabled={busy} onPress={onConfirm}>
            <ButtonText className="text-base">{busy ? "Saving" : "Confirm"}</ButtonText>
            {busy ? (
              <ButtonSpinner color={colors.primaryForeground} size="small" />
            ) : (
              <HugeiconsIcon
                color={colors.primaryForeground}
                icon={CheckmarkCircle02Icon}
                size={18}
                strokeWidth={1.8}
              />
            )}
          </Button>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}
