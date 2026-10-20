import { View } from "react-native";

import { Text } from "@/components/modules/typography";

import type { Remark, RemarkVariant } from "@/lib/attendance/remarks";

// Light-theme values of the web app's `--order-status-*` tokens.
const variants: Record<RemarkVariant, { background: string; color: string }> = {
  delivered: { background: "#ECFDF5", color: "#16A34A" },
  destructive: { background: "#FFF1F2", color: "#DC2626" },
  rescheduled: { background: "#FFF8ED", color: "#D97706" },
  transit: { background: "#EFF8FF", color: "#2563EB" },
};

/**
 * A remark pill with a leading dot, like the web table's `<Badge showDot>`. `md` is the larger
 * pill for a form field, such as a status select.
 */
export function RemarkBadge({ label, size = "sm", variant }: Remark & { size?: "sm" | "md" }) {
  const { background, color } = variants[variant];
  const md = size === "md";
  return (
    <View
      className={`flex-row items-center self-start ${md ? "gap-2 px-2.5 py-1" : "gap-1.5 px-2 py-1"}`}
      style={{ backgroundColor: background }}
    >
      <View
        className={md ? "h-2 w-2" : "h-1.5 w-1.5"}
        style={{ backgroundColor: color, borderRadius: md ? 4 : 3 }}
      />
      <Text
        className={`font-medium uppercase ${md ? "text-sm tracking-[0.3px]" : "text-[10px] tracking-[0.25px]"}`}
        style={{ color }}
      >
        {label}
      </Text>
    </View>
  );
}
