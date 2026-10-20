import { PencilEdit02Icon, PrinterIcon, Upload06Icon, ViewIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ActivityIndicator, Pressable, View } from "react-native";

import { RemarkBadge } from "@/components/modules/remark-badge";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import type { DrsSheet } from "@/lib/api/drs";
import { haptic } from "@/lib/haptics";

import { drsAreas, drsBadge, drsNextStatuses, drsPincodes } from "../lib/drs";
import { isDelivered } from "../lib/orders";

// The Figma's tinted action squares: print in grey, the scan in amber, editing in brand blue.
const ACTIONS = {
  edit: { background: "#E1E5FF", color: colors.primary },
  print: { background: "#EEEFF2", color: colors.foreground },
  scan: { background: "#FFF1DD", color: "#E8900C" },
} as const;

function ActionSquare({
  busy,
  icon,
  label,
  onPress,
  tone,
}: {
  busy?: boolean;
  icon: typeof PrinterIcon;
  label: string;
  onPress: () => void;
  tone: keyof typeof ACTIONS;
}) {
  const { background, color } = ACTIONS[tone];
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      className="h-11 w-11 items-center justify-center active:opacity-70"
      disabled={busy}
      hitSlop={4}
      onPress={onPress}
      onPressIn={() => haptic("light")}
      style={{ backgroundColor: background }}
    >
      {busy ? (
        <ActivityIndicator color={color} size="small" />
      ) : (
        <HugeiconsIcon color={color} icon={icon} size={20} strokeWidth={1.8} />
      )}
    </Pressable>
  );
}

function Field({
  align,
  label,
  values,
}: {
  align: "left" | "right";
  label: string;
  values: string[];
}) {
  const right = align === "right";
  return (
    <View className={`flex-1 ${right ? "items-end" : ""}`}>
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text
        className={`mt-1 text-base font-semibold leading-6 text-foreground ${right ? "text-right" : ""}`}
      >
        {values.length ? values.join(", ") : "--"}
      </Text>
    </View>
  );
}

/** The DRS status plus live order progress, so the delivery boy knows when it can be resolved. */
function DrsStatusBadge({ sheet }: { sheet: DrsSheet }) {
  const total = sheet.orders.length;
  const delivered = sheet.orders.filter(isDelivered).length;
  const allDelivered = total > 0 && delivered === total;

  // Before resolution, make the completed run unmissable. A resolved sheet still says Resolved.
  if (sheet.status !== "RESOLVED" && allDelivered)
    return <RemarkBadge label="All orders delivered" variant="delivered" />;

  if (sheet.status !== "DELIVERING ORDERS") return <RemarkBadge {...drsBadge(sheet.status)} />;

  return (
    <View className="flex-row items-center self-start bg-[#FFF8ED] px-2 py-1">
      <View className="mr-1.5 h-1.5 w-1.5 rounded-full bg-[#D97706]" />
      <Text className="text-[10px] font-medium uppercase tracking-[0.25px] text-[#D97706]">
        Delivering
      </Text>
      {/* Separates the DRS status from its delivered / total order count. */}
      <View className="mx-2 h-4 w-px bg-[#F2D6A8]" />
      <Text className="text-[10px] font-medium text-[#D97706]">
        {delivered}/{total}
      </Text>
    </View>
  );
}

/**
 * One delivery run sheet: its id and status, the areas and pincodes it covers, and how many
 * orders ride on it. Tapping the card shows those orders; the squares print it, attach (or show)
 * the scan of the signed sheet, and move its status on while it isn't resolved.
 */
export function DrsCard({
  onEdit,
  onOpen,
  onPrint,
  onScan,
  printing,
  sheet,
}: {
  onEdit: () => void;
  onOpen: () => void;
  onPrint: () => void;
  /** Upload a scan, or view the one attached. */
  onScan: () => void;
  printing: boolean;
  sheet: DrsSheet;
}) {
  const pincodes = drsPincodes(sheet);
  const orders = sheet.orders.length;
  return (
    <Pressable
      accessibilityHint="Shows this DRS's orders"
      accessibilityRole="button"
      className="border border-[#EEF0F6] bg-card p-4 active:bg-[#F7F8FF]"
      onPress={onOpen}
      onPressIn={() => haptic("light")}
    >
      <View className="flex-row items-start gap-3">
        <View className="flex-1">
          <Text className="text-[11px] font-medium uppercase tracking-[0.3px] text-muted-foreground">
            DRS ID
          </Text>
          <Text className="mt-0.5 text-lg font-semibold leading-6 text-foreground" selectable>
            {sheet.id}
          </Text>
        </View>
        <DrsStatusBadge sheet={sheet} />
      </View>
      <View className="mt-4 flex-row">
        <Field align="left" label="Deliverable Areas" values={drsAreas(sheet)} />
        <View className="mx-3 my-1 w-px bg-border" />
        <Field
          align="right"
          label={pincodes.length > 1 ? "Deliverable Pincodes" : "Deliverable Pincode"}
          values={pincodes}
        />
      </View>
      <View className="mt-4 flex-row items-center justify-between gap-3">
        <View className="border border-primary px-3 py-1.5">
          <Text className="text-xs font-medium text-primary">
            {orders === 1 ? "1 Order" : `${orders} Orders`}
          </Text>
        </View>
        <View className="flex-row gap-2">
          <ActionSquare
            busy={printing}
            icon={PrinterIcon}
            label={`Print DRS ${sheet.id}`}
            onPress={onPrint}
            tone="print"
          />
          <ActionSquare
            icon={sheet.scanCopy ? ViewIcon : Upload06Icon}
            label={sheet.scanCopy ? "View the DRS scan" : "Upload the DRS scan"}
            onPress={onScan}
            tone="scan"
          />
          {drsNextStatuses(sheet.status).length ? (
            <ActionSquare
              icon={PencilEdit02Icon}
              label="Update the DRS status"
              onPress={onEdit}
              tone="edit"
            />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
