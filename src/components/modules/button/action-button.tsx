import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { View } from "react-native";

import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { colors } from "@/config/colors";

export interface ActionButtonProps {
  label: string;
  onPress: () => void;
  outline?: boolean;
  disabled?: boolean;
  arrow?: boolean;
  loading?: boolean;
}

/** Full-width form action with a trailing arrow, or a spinner while `loading`. */
export function ActionButton({
  label,
  onPress,
  outline = false,
  disabled = false,
  arrow = true,
  loading = false,
}: ActionButtonProps) {
  const color = outline ? colors.foreground : colors.primaryForeground;
  return (
    <Button
      className="h-12 w-full"
      disabled={disabled || loading}
      onPress={onPress}
      variant={outline ? "outline" : "default"}
    >
      <View className="flex-row items-center gap-2">
        <ButtonText className="text-base font-semibold">{label}</ButtonText>
        {loading ? (
          <ButtonSpinner color={color} size="small" />
        ) : arrow ? (
          <HugeiconsIcon color={color} icon={ArrowRight01Icon} size={20} strokeWidth={2} />
        ) : null}
      </View>
    </Button>
  );
}
