import { Download02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ActivityIndicator, Pressable, View } from "react-native";

import { OrganizationBadge } from "@/components/modules/organization";
import { SheetIcon } from "@/components/modules/sheet-icon";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import type { SmartSheetSummary } from "@/lib/api/smart-sheets";
import { haptic } from "@/lib/haptics";

import { createdStatus, formatSheetStamp } from "../lib/format";

/**
 * One sheet in the list: its name across the card, when it was last saved and how many orders
 * it holds, and a full-width button that downloads its Shipping Manifest. Tapping the card opens
 * its orders. `showOrganization` adds the organization it belongs to, for a list that holds more
 * than one organization's sheets.
 */
export function SheetCard({
  downloading,
  onDownload,
  onOpen,
  sheet,
  showOrganization = false,
}: {
  /** The button's spinner while the manifest is built. */
  downloading: boolean;
  onDownload: () => void;
  onOpen: () => void;
  sheet: SmartSheetSummary;
  showOrganization?: boolean;
}) {
  return (
    <Pressable
      accessibilityHint="Opens the sheet's orders"
      accessibilityRole="button"
      className="border border-[#E4E6EE] bg-card p-4 active:bg-[#FAFBFF]"
      onPress={onOpen}
      onPressIn={() => haptic("light")}
    >
      <View className="flex-row items-center gap-3">
        <SheetIcon size={34} />
        <Text className="flex-1 text-base font-semibold text-foreground" numberOfLines={2}>
          {sheet.name}
        </Text>
        {showOrganization ? (
          <OrganizationBadge corner="top-right" name={sheet.organizationName} />
        ) : null}
      </View>
      <View className="mt-3 flex-row items-center justify-between gap-3">
        <Text className="shrink text-sm text-muted-foreground" numberOfLines={1}>
          {formatSheetStamp(sheet.updatedAt)}
        </Text>
        <Text className="text-sm text-foreground">{createdStatus(sheet)}</Text>
      </View>
      <Pressable
        accessibilityLabel={`Download the shipping manifest of ${sheet.name}`}
        accessibilityRole="button"
        accessibilityState={{ busy: downloading }}
        className="mt-4 h-11 flex-row items-center justify-center gap-2 bg-primary active:bg-primary-hover"
        disabled={downloading}
        onPress={onDownload}
        onPressIn={() => haptic("light")}
      >
        {downloading ? (
          <ActivityIndicator color={colors.primaryForeground} size="small" />
        ) : (
          <>
            <Text className="text-sm font-medium text-primary-foreground">Download Manifest</Text>
            <HugeiconsIcon color={colors.primaryForeground} icon={Download02Icon} size={18} />
          </>
        )}
      </Pressable>
    </Pressable>
  );
}
