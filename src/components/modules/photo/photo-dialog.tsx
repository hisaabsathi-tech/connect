import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticButton } from "@/components/modules/button";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";

import { ZoomableImage } from "./zoomable-image";

interface PhotoDialogProps {
  visible: boolean;
  title: string;
  /** The photo; while null (and no `error`) a spinner shows. */
  uri: string | null;
  error?: string | null;
  onClose: () => void;
  /**
   * A button along the bottom, such as Re Upload; `danger` makes it red (Delete). With `confirm`
   * it first asks in a sheet over the photo (inside this dialog, so it shows above it).
   */
  action?: {
    label: string;
    onPress: () => void;
    tone?: "danger";
    busy?: boolean;
    confirm?: { title: string; description: string; confirmLabel: string; cancelLabel?: string };
  };
}

/**
 * A photo in a dialog covering 90% of the screen (pinch to zoom, drag, double tap), closed with
 * the round cross at the top right, the backdrop or the back button.
 */
export function PhotoDialog({ action, error, onClose, title, uri, visible }: PhotoDialogProps) {
  const insets = useSafeAreaInsets();
  const [asking, setAsking] = useState(false);
  const close = () => {
    setAsking(false);
    onClose();
  };
  return (
    <Modal
      animationType="fade"
      navigationBarTranslucent
      // Back closes the question first, then the photo.
      onRequestClose={() => (asking ? setAsking(false) : close())}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <GestureHandlerRootView style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
        <Pressable
          accessibilityLabel="Close photo"
          className="absolute inset-0 bg-[#161950]/60"
          onPress={close}
        />
        <View className="bg-card" style={{ elevation: 12, height: "90%", width: "90%" }}>
          <View className="flex-row items-center justify-between border-border border-b px-4 py-3">
            <Text className="text-lg font-semibold text-foreground">{title}</Text>
            <Pressable
              accessibilityLabel="Close photo"
              accessibilityRole="button"
              className="size-9 items-center justify-center rounded-full bg-[#161950]/10"
              hitSlop={8}
              onPress={close}
            >
              <HugeiconsIcon
                color={colors.foreground}
                icon={Cancel01Icon}
                size={18}
                strokeWidth={2}
              />
            </Pressable>
          </View>
          <View className="flex-1 items-center justify-center bg-black">
            {uri ? (
              <View className="size-full">
                <ZoomableImage accessibilityLabel={title} uri={uri} />
              </View>
            ) : error ? (
              <Text className="px-6 text-center text-base text-white">{error}</Text>
            ) : (
              <ActivityIndicator color="#FFFFFF" />
            )}
          </View>
          {action ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: action.busy, disabled: action.busy }}
              className={`h-12 items-center justify-center ${
                action.tone === "danger"
                  ? "bg-destructive active:opacity-80"
                  : "bg-primary active:bg-primary-hover"
              }`}
              disabled={action.busy}
              onPress={action.confirm ? () => setAsking(true) : action.onPress}
            >
              {action.busy ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text className="text-base font-semibold text-primary-foreground">
                  {action.label}
                </Text>
              )}
            </Pressable>
          ) : null}
        </View>
        {action?.confirm && asking ? (
          <View className="absolute inset-0 justify-end">
            <Animated.View
              className="absolute inset-0 bg-[#161950]/50"
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(150)}
            >
              <Pressable
                accessibilityLabel="Close"
                className="flex-1"
                onPress={() => setAsking(false)}
              />
            </Animated.View>
            <Animated.View
              accessibilityRole="alert"
              className="rounded-t-3xl bg-card px-5 pt-3"
              entering={SlideInDown.duration(240)}
              exiting={SlideOutDown.duration(180)}
              style={{ paddingBottom: insets.bottom + 20 }}
            >
              <View className="h-1.5 w-12 self-center rounded-full bg-border" />
              <Text className="mt-5 text-xl font-semibold text-foreground">
                {action.confirm.title}
              </Text>
              <Text className="mt-2 text-base leading-6 text-muted-foreground">
                {action.confirm.description}
              </Text>
              <View className="mt-7 flex-row gap-3">
                <HapticButton
                  kind="light"
                  label={action.confirm.cancelLabel ?? "Cancel"}
                  onPress={() => setAsking(false)}
                />
                <HapticButton
                  kind="heavy"
                  label={action.confirm.confirmLabel}
                  onPress={() => {
                    setAsking(false);
                    action.onPress();
                  }}
                  tone={action.tone === "danger" ? "danger" : "brand"}
                />
              </View>
            </Animated.View>
          </View>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}
