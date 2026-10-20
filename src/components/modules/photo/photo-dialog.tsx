import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ActivityIndicator, Modal, Pressable, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

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
  /** A button along the bottom, such as Re-upload. */
  action?: { label: string; onPress: () => void };
}

/**
 * A photo in a dialog covering 90% of the screen (pinch to zoom, drag, double tap), closed with
 * the round cross at the top right, the backdrop or the back button.
 */
export function PhotoDialog({ action, error, onClose, title, uri, visible }: PhotoDialogProps) {
  return (
    <Modal
      animationType="fade"
      navigationBarTranslucent
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <GestureHandlerRootView style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
        <Pressable
          accessibilityLabel="Close photo"
          className="absolute inset-0 bg-[#161950]/60"
          onPress={onClose}
        />
        <View className="bg-card" style={{ elevation: 12, height: "90%", width: "90%" }}>
          <View className="flex-row items-center justify-between border-border border-b px-4 py-3">
            <Text className="text-lg font-semibold text-foreground">{title}</Text>
            <Pressable
              accessibilityLabel="Close photo"
              accessibilityRole="button"
              className="size-9 items-center justify-center rounded-full bg-[#161950]/10"
              hitSlop={8}
              onPress={onClose}
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
              className="h-12 items-center justify-center bg-primary active:bg-primary-hover"
              onPress={action.onPress}
            >
              <Text className="text-base font-semibold text-primary-foreground">
                {action.label}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
