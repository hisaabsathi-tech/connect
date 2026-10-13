import { Pressable, Text } from "react-native";

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

type Props = {
  label: string;
  kind: HapticKind;
  tone?: Tone;
  onPress?: () => void;
};

/** Button that fires its haptic on touch-down, so the feedback lands with the finger. */
export function HapticButton({ label, kind, tone = "neutral", onPress }: Props) {
  const style = tones[tone];
  return (
    <Pressable
      accessibilityRole="button"
      className={`h-12 flex-1 items-center justify-center rounded-2xl ${style.button}`}
      onPress={onPress}
      onPressIn={() => haptic(kind)}
    >
      <Text className={`text-sm font-bold ${style.label}`}>{label}</Text>
    </Pressable>
  );
}
