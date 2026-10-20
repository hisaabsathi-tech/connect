import { Pressable } from "react-native";

import { Text } from "@/components/modules/typography";
import { type HapticKind, haptic } from "@/lib/haptics";

type Tone = "brand" | "neutral" | "success" | "warning" | "danger";

const tones: Record<Tone, { button: string; label: string }> = {
  brand: { button: "bg-primary active:bg-primary-hover", label: "text-primary-foreground" },
  neutral: {
    button: "border border-border bg-card active:bg-muted",
    label: "text-card-foreground",
  },
  success: { button: "bg-success active:opacity-80", label: "text-success-foreground" },
  warning: { button: "bg-tertiary active:opacity-80", label: "text-tertiary-foreground" },
  danger: {
    button: "bg-destructive active:opacity-80",
    label: "text-destructive-foreground",
  },
};

export interface HapticButtonProps {
  label: string;
  kind: HapticKind;
  tone?: Tone;
  onPress?: () => void;
  /** Dimmed, with no press or haptic. */
  disabled?: boolean;
}

/** Button that fires its haptic on touch-down, so the feedback lands with the finger. */
export function HapticButton({
  disabled = false,
  label,
  kind,
  tone = "neutral",
  onPress,
}: HapticButtonProps) {
  const style = tones[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={`h-12 flex-1 items-center justify-center rounded-2xl ${style.button} ${disabled ? "opacity-50" : ""}`}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => haptic(kind)}
    >
      <Text className={`text-sm font-bold ${style.label}`}>{label}</Text>
    </Pressable>
  );
}
