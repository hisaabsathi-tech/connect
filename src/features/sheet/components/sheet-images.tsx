import { Cancel01Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Image } from "expo-image";
import { useState } from "react";
import { FlatList, Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PhotoDialog } from "@/components/modules/photo";
import { Text } from "@/components/modules/typography";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/config/colors";
import type { SheetLabelScan } from "@/lib/api/label-scan";
import { errorMessage } from "@/lib/errors";
import { haptic } from "@/lib/haptics";

const stampFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  month: "short",
  timeZone: "Asia/Kolkata",
});

/** A photo nothing was read from: no order came of it. */
const NOT_USED = "File Not Used";

function placeLine(scan: SheetLabelScan) {
  const place = [scan.city, scan.state].filter(Boolean).join(", ");
  return [scan.pincode, place].filter(Boolean).join(" · ");
}

function ScanCard({ onOpen, scan }: { onOpen: () => void; scan: SheetLabelScan }) {
  return (
    <Pressable
      accessibilityLabel={`Label photo for ${scan.receiverName ?? "an order"}`}
      accessibilityRole="button"
      className="flex-1 border border-border bg-card p-2 active:border-primary"
      onPress={onOpen}
      onPressIn={() => haptic("light")}
    >
      <View className="aspect-square w-full overflow-hidden bg-muted">
        <Image contentFit="cover" source={{ uri: scan.thumbUrl }} style={{ flex: 1 }} />
        {scan.onSheet ? (
          <View className="absolute top-1.5 left-1.5 flex-row items-center gap-1 bg-[#E7F8EE] px-1.5 py-0.5">
            <HugeiconsIcon color={colors.success} icon={CheckmarkCircle02Icon} size={12} />
            <Text className="text-[11px] font-medium text-success">On sheet</Text>
          </View>
        ) : null}
      </View>
      <Text className="mt-2 text-sm font-medium text-foreground" numberOfLines={1}>
        {scan.receiverName || NOT_USED}
      </Text>
      {placeLine(scan) ? (
        <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
          {placeLine(scan)}
        </Text>
      ) : null}
      <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
        {stampFormatter.format(new Date(scan.scannedAt))}
        {scan.awbNo ? ` · ${scan.awbNo}` : ""}
      </Text>
    </Pressable>
  );
}

/**
 * Every label photo scanned for this sheet, two to a row; a tap shows one large (pinch to zoom).
 * Photos whose order was saved carry "On sheet". Without `onDelete` the large photo has no Delete.
 */
export function SheetImages({
  onClose,
  onDelete,
  scans,
  sheetName,
  visible,
}: {
  onClose: () => void;
  /** Deletes the photo for good on the server; left out when the member may not delete. */
  onDelete?: (scan: SheetLabelScan) => Promise<void>;
  scans: SheetLabelScan[];
  sheetName: string;
  visible: boolean;
}) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [open, setOpen] = useState<SheetLabelScan | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Delete on the large photo, once its own sheet has asked; then back to the photos.
  const remove = async (scan: SheetLabelScan) => {
    if (deleting || !onDelete) return;
    setDeleting(true);
    try {
      await onDelete(scan);
      haptic("success");
      toast.success("Photo deleted");
      setOpen(null);
    } catch (error) {
      haptic("error");
      toast.error("Couldn't delete the photo", errorMessage(error, "Please try again."));
    } finally {
      setDeleting(false);
    }
  };
  return (
    <Modal
      animationType="slide"
      navigationBarTranslucent
      onRequestClose={onClose}
      statusBarTranslucent
      visible={visible}
    >
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center gap-3 border-border border-b px-5 py-3">
          <View className="flex-1">
            <Text className="text-lg font-semibold text-foreground">Images</Text>
            <Text className="text-sm text-muted-foreground" numberOfLines={1}>
              {sheetName} · {scans.length} {scans.length === 1 ? "photo" : "photos"}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Close images"
            accessibilityRole="button"
            className="size-10 items-center justify-center rounded-full bg-[#161950]/10"
            hitSlop={8}
            onPress={onClose}
          >
            <HugeiconsIcon color={colors.foreground} icon={Cancel01Icon} size={18} />
          </Pressable>
        </View>
        <FlatList
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ gap: 12, padding: 20, paddingBottom: insets.bottom + 20 }}
          data={scans.length % 2 ? [...scans, null] : scans}
          keyExtractor={(scan) => scan?.id ?? "filler"}
          numColumns={2}
          renderItem={({ item }) =>
            // An odd last photo keeps its half of the row.
            item ? (
              <ScanCard onOpen={() => setOpen(item)} scan={item} />
            ) : (
              <View className="flex-1" />
            )
          }
        />
      </View>
      <PhotoDialog
        action={
          open && onDelete
            ? {
                busy: deleting,
                confirm: {
                  cancelLabel: "Keep",
                  confirmLabel: "Delete",
                  description: `The photo of ${open.receiverName || NOT_USED} is deleted from the server for good. It can't be restored.`,
                  title: "Delete this photo?",
                },
                label: "Delete",
                onPress: () => void remove(open),
                tone: "danger",
              }
            : undefined
        }
        onClose={() => setOpen(null)}
        title={open?.receiverName || NOT_USED}
        uri={open?.imageUrl ?? null}
        visible={open !== null}
      />
    </Modal>
  );
}
