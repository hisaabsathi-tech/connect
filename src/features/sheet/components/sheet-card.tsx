import { Download02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ActivityIndicator, Pressable, View } from "react-native";

import { SheetIcon } from "@/components/modules/sheet-icon";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import type { SmartSheetSummary } from "@/lib/api/smart-sheets";
import { haptic } from "@/lib/haptics";

import { createdStatus, formatSheetStamp } from "../lib/format";

/** One sheet in the list: its name, when it was last saved, how many orders are created, and its manifest download. */
export function SheetCard({
  downloading,
  onDownload,
  sheet,
}: {
  /** The download button's spinner while the manifest is built. */
  downloading: boolean;
  onDownload: () => void;
  sheet: SmartSheetSummary;
}) {
  return (
    <View className="flex-row items-center gap-4 border border-[#E4E6EE] bg-card px-4 py-5">
      <SheetIcon size={34} />
      <View className="flex-1">
        <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
          {sheet.name}
        </Text>
        <Text className="mt-2 text-sm text-muted-foreground">
          {formatSheetStamp(sheet.updatedAt)}
        </Text>
      </View>
      <View className="items-end gap-2">
        <Text className="text-sm text-foreground">{createdStatus(sheet)}</Text>
        <Pressable
          accessibilityLabel={`Download the shipping manifest of ${sheet.name}`}
          accessibilityRole="button"
          className="h-7 w-7 items-center justify-center bg-primary active:bg-primary-hover"
          disabled={downloading}
          hitSlop={8}
          onPress={onDownload}
          onPressIn={() => haptic("light")}
        >
          {downloading ? (
            <ActivityIndicator color={colors.primaryForeground} size="small" />
          ) : (
            <HugeiconsIcon color={colors.primaryForeground} icon={Download02Icon} size={18} />
          )}
        </Pressable>
      </View>
    </View>
  );
}
