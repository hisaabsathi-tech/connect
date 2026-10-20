import { ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { ActionButton } from "@/components/modules/button";
import { RemarkBadge } from "@/components/modules/remark-badge";
import { BottomSheet } from "@/components/modules/sheet";
import { Text } from "@/components/modules/typography";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/config/colors";
import { type DrsSheet, type DrsStatus, patchDrs } from "@/lib/api/drs";
import { useAuthSession } from "@/lib/auth/session";
import { errorMessage } from "@/lib/errors";
import { haptic } from "@/lib/haptics";

import { drsBadge, drsNextStatuses } from "../lib/drs";

/** A status in its badge colours, with the server's full name ("OUT FOR DELIVERY"). */
function StatusPill({ status }: { status: DrsStatus }) {
  // The wrapper centres the pill in the field's row; the badge itself hugs the top-left.
  return (
    <View>
      <RemarkBadge label={status} size="md" variant={drsBadge(status).variant} />
    </View>
  );
}

/** Where the phone last was, if location is already allowed; the server notes it with the change. */
async function lastPosition() {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) return {};
    const position = await Location.getLastKnownPositionAsync();
    return position
      ? { latitude: position.coords.latitude, longitude: position.coords.longitude }
      : {};
  } catch {
    return {};
  }
}

/**
 * "Update DRS": the status field opens on the sheet's current status and lists the others a
 * delivery boy can pick (Issued → Out for delivery → Resolved). Confirm saves the change and hands
 * the updated sheet to `onUpdated`.
 */
export function DrsStatusSheet({
  onClose,
  onUpdated,
  sheet,
}: {
  onClose: () => void;
  onUpdated: (sheet: DrsSheet) => void;
  /** The sheet being edited; null hides it. */
  sheet: DrsSheet | null;
}) {
  const { token } = useAuthSession();
  const toast = useToast();
  // Kept through the closing slide, after `sheet` is already null.
  const [shown, setShown] = useState<DrsSheet | null>(sheet);
  const [draft, setDraft] = useState<DrsStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!sheet) return;
    setShown(sheet);
    setDraft(sheet.status);
    setOpen(false);
  }, [sheet]);

  // The field already shows the chosen status, so the list offers only the others.
  const options = shown
    ? [shown.status, ...drsNextStatuses(shown.status)].filter((option) => option !== draft)
    : [];
  const changed = Boolean(shown && draft && draft !== shown.status);

  const confirm = async () => {
    if (!(token && shown && draft && changed)) return;
    setSaving(true);
    try {
      const updated = await patchDrs(token, shown.id, { status: draft, ...(await lastPosition()) });
      haptic("success");
      toast.success("DRS updated", `${shown.id} is now ${draft.toLowerCase()}.`);
      onUpdated(updated);
      onClose();
    } catch (error) {
      toast.error("Couldn't update the DRS", errorMessage(error, "Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      dismissible={!saving}
      onClose={onClose}
      onClosed={() => setShown(null)}
      visible={sheet !== null}
    >
      <Text className="mt-5 text-xl font-semibold text-foreground">Update DRS</Text>
      <Text className="mt-6 text-base text-foreground">Update Status</Text>
      <Pressable
        accessibilityLabel="Status"
        accessibilityRole="combobox"
        accessibilityState={{ expanded: open }}
        className="mt-2 h-12 flex-row items-center justify-between border border-border bg-card px-4"
        onPress={() => setOpen((value) => !value)}
        onPressIn={() => haptic("light")}
      >
        {draft ? <StatusPill status={draft} /> : <View />}
        <HugeiconsIcon
          color={colors.foreground}
          icon={open ? ArrowUp01Icon : ArrowDown01Icon}
          size={20}
          strokeWidth={1.8}
        />
      </Pressable>
      {open ? (
        <View className="border border-border border-t-0 bg-card">
          {options.map((option) => (
            <Pressable
              accessibilityRole="menuitem"
              className="h-12 justify-center px-4 active:bg-[#F7F8FF]"
              key={option}
              onPress={() => {
                haptic("selection");
                setDraft(option);
                setOpen(false);
              }}
            >
              <StatusPill status={option} />
            </Pressable>
          ))}
        </View>
      ) : null}
      <View className="mt-8">
        <ActionButton
          arrow={false}
          disabled={!changed}
          label="Confirm"
          loading={saving}
          onPress={() => void confirm()}
        />
      </View>
    </BottomSheet>
  );
}
