import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ZoomableImage } from "@/components/modules/photo";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import { fetchMyAttendancePhotos } from "@/lib/api/attendance";
import { errorMessage } from "@/lib/errors";

export type PhotoViewerTarget = {
  /** The attendance record's id. */
  id: string;
  /** The record's `YYYY-MM-DD` day. */
  date: string;
  side: "checkIn" | "checkOut";
};

interface PhotoViewerProps {
  token: string | null;
  target: PhotoViewerTarget | null;
  onClose: () => void;
}

/**
 * The member's own check-in or check-out photo in a dialog covering 90% of the screen, closed
 * with the round cross at the top right, the backdrop or the back button.
 */
export function PhotoViewer({ token, target, onClose }: PhotoViewerProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);
    setError(null);
    if (!(token && target)) return;
    let active = true;
    fetchMyAttendancePhotos(token, target.id, target.date)
      .then((photos) => {
        if (!active) return;
        const next = photos[target.side];
        if (next) setUrl(next);
        else setError("This photo is not available.");
      })
      .catch((fetchError: unknown) => {
        if (active) setError(errorMessage(fetchError, "Could not load the photo."));
      });
    return () => {
      active = false;
    };
  }, [target, token]);

  const title = target?.side === "checkOut" ? "Check-out photo" : "Check-in photo";

  return (
    <Modal
      animationType="fade"
      navigationBarTranslucent
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={target !== null}
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
            {url ? (
              <View className="size-full">
                <ZoomableImage accessibilityLabel={title} uri={url} />
              </View>
            ) : error ? (
              <Text className="px-6 text-center text-base text-white">{error}</Text>
            ) : (
              <ActivityIndicator color="#FFFFFF" />
            )}
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
