import { Pressable } from "react-native";

import { Text } from "@/components/modules/typography";

const alignments = { center: "text-center", left: "text-left", right: "text-right" } as const;

export interface TextButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  align?: keyof typeof alignments;
}

/** Inline link-style action, e.g. "Forgot password?". */
export function TextButton({ label, onPress, disabled = false, align = "left" }: TextButtonProps) {
  return (
    <Pressable disabled={disabled} onPress={onPress}>
      <Text
        className={`text-sm font-medium ${alignments[align]} ${disabled ? "text-muted-foreground" : "text-primary"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
