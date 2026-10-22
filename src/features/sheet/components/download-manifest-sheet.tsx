import { useEffect, useState } from "react";
import { View } from "react-native";

import { ActionButton } from "@/components/modules/button";
import { BottomSheet } from "@/components/modules/sheet";
import { SheetIcon } from "@/components/modules/sheet-icon";
import { Text } from "@/components/modules/typography";
import type { SmartSheetSummary } from "@/lib/api/smart-sheets";
import { haptic } from "@/lib/haptics";

import { createdStatus, formatSheetStamp } from "../lib/format";
import { manifestFileName } from "../lib/manifest";

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-4 py-2">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="shrink text-right text-sm font-medium text-foreground">{value}</Text>
    </View>
  );
}

/**
 * The last step before a sheet's Shipping Manifest downloads: which sheet it is, what it holds
 * and the file it saves as, then Download or Cancel. Download only confirms; the screen starts
 * the download once the sheet has slid away, so the folder picker or share sheet never opens
 * over it.
 */
export function DownloadManifestSheet({
  onClose,
  onClosed,
  onConfirm,
  sheet,
}: {
  onClose: () => void;
  onClosed: () => void;
  onConfirm: () => void;
  /** The sheet to download, or null to close. */
  sheet: SmartSheetSummary | null;
}) {
  // Holds the last sheet, so its details stay put while the sheet slides away.
  const [shown, setShown] = useState(sheet);
  useEffect(() => {
    if (sheet) setShown(sheet);
  }, [sheet]);

  return (
    <BottomSheet onClose={onClose} onClosed={onClosed} visible={sheet !== null}>
      {shown ? (
        <>
          <Text className="mt-5 text-xl font-semibold text-foreground">Download manifest</Text>
          <Text className="mt-1 text-sm text-muted-foreground">
            Save this sheet's Shipping Manifest as an Excel file on your device.
          </Text>

          <View className="mt-5 border border-[#E4E6EE] bg-[#FAFBFF] p-4">
            <View className="flex-row items-center gap-3">
              <SheetIcon size={30} />
              <Text className="flex-1 text-base font-semibold text-foreground" numberOfLines={2}>
                {shown.name}
              </Text>
            </View>
            <View className="mt-3 border-t border-[#E4E6EE] pt-1">
              <Detail label="Orders" value={createdStatus(shown)} />
              <Detail label="Last saved" value={formatSheetStamp(shown.updatedAt)} />
              <Detail label="File" value={manifestFileName(shown.name)} />
            </View>
          </View>

          <View className="mt-6 flex-row gap-3">
            <View className="flex-1">
              <ActionButton arrow={false} label="Cancel" onPress={onClose} outline />
            </View>
            <View className="flex-1">
              <ActionButton
                arrow={false}
                label="Download"
                onPress={() => {
                  haptic("light");
                  onConfirm();
                }}
              />
            </View>
          </View>
        </>
      ) : null}
    </BottomSheet>
  );
}
