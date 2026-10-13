import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export type HapticKind =
  | "light"
  | "medium"
  | "heavy"
  | "selection"
  | "success"
  | "warning"
  | "error"
  | "toggle-on"
  | "toggle-off";

// Android's own haptic constants feel crisper than the Vibrator-based impact/notification calls
// and need no VIBRATE permission, so Android uses them; other platforms use the portable API.
const android: Record<HapticKind, Haptics.AndroidHaptics> = {
  light: Haptics.AndroidHaptics.Virtual_Key,
  medium: Haptics.AndroidHaptics.Context_Click,
  heavy: Haptics.AndroidHaptics.Long_Press,
  selection: Haptics.AndroidHaptics.Segment_Tick,
  success: Haptics.AndroidHaptics.Confirm,
  warning: Haptics.AndroidHaptics.Gesture_End,
  error: Haptics.AndroidHaptics.Reject,
  "toggle-on": Haptics.AndroidHaptics.Toggle_On,
  "toggle-off": Haptics.AndroidHaptics.Toggle_Off,
};

function portable(kind: HapticKind): Promise<void> {
  switch (kind) {
    case "light":
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    case "medium":
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    case "heavy":
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    case "success":
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    case "warning":
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    case "error":
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    case "toggle-on":
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    case "toggle-off":
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    default:
      return Haptics.selectionAsync();
  }
}

/** Fire-and-forget haptic; a device without haptics simply stays silent. */
export function haptic(kind: HapticKind): void {
  const run =
    Platform.OS === "android" ? Haptics.performAndroidHapticsAsync(android[kind]) : portable(kind);
  run.catch(() => undefined);
}
