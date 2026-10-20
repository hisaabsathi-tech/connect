import { View } from "react-native";

import { Text } from "@/components/modules/typography";

import type { Remark, RemarkVariant } from "../lib/remarks";

// Light-theme values of the web app's `--order-status-*` tokens.
const variants: Record<RemarkVariant, { background: string; color: string }> = {
  delivered: { background: "#ECFDF5", color: "#16A34A" },
  destructive: { background: "#FFF1F2", color: "#DC2626" },
  rescheduled: { background: "#FFF8ED", color: "#D97706" },
  transit: { background: "#EFF8FF", color: "#2563EB" },
};

/** A remark pill with a leading dot, like the web table's `<Badge showDot>`. */
export function RemarkBadge({ label, variant }: Remark) {
  const { background, color } = variants[variant];
  return (
    <View
      className="flex-row items-center gap-1.5 self-start px-2 py-1"
      style={{ backgroundColor: background }}
    >
      <View className="h-1.5 w-1.5" style={{ backgroundColor: color, borderRadius: 3 }} />
      <Text className="text-[10px] font-medium uppercase tracking-wide" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}
