import { Call02Icon, Location01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import type { ReactNode } from "react";
import { ActivityIndicator, Linking, Pressable, View } from "react-native";

import { SyncBadge } from "@/components/modules/network";
import { RemarkBadge } from "@/components/modules/remark-badge";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import type { Remark } from "@/lib/attendance/remarks";
import { haptic } from "@/lib/haptics";
import { dialUrl, formatMobile } from "@/lib/phone";

import { orderAddress } from "../lib/order-place";
import { type DrsOrder, isDelivered } from "../lib/orders";

const payment = (order: DrsOrder) => order.paymentType?.trim().toUpperCase() ?? "";

/** The payment pill in the corner, in the web app's colours: COD green, Prepaid amber, To Pay blue. */
function paymentBadge(order: DrsOrder): Remark | null {
  switch (payment(order)) {
    case "COD":
      return { label: "COD", variant: "delivered" };
    case "PREPAID":
      return { label: "Prepaid", variant: "rescheduled" };
    case "TO_PAY":
      return { label: "To Pay", variant: "transit" };
    default:
      return null;
  }
}

/** What the delivery boy collects at the door: the invoice for COD, the freight for To Pay. */
function collectable(order: DrsOrder) {
  const amount =
    payment(order) === "COD"
      ? order.finalInvoiceAmount
      : payment(order) === "TO_PAY"
        ? (order.topayAmount ?? order.finalInvoiceAmount)
        : null;
  return amount && amount > 0 ? amount : null;
}

const rupees = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

/** A tinted square icon button on the receiver's row (call, view on map). */
function ActionSquare({
  busy = false,
  icon,
  label,
  onPress,
}: {
  busy?: boolean;
  icon: typeof Call02Icon;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      className="h-12 w-12 items-center justify-center bg-[#CDD4FF] active:opacity-80"
      disabled={busy}
      onPress={onPress}
      onPressIn={() => haptic("light")}
    >
      {busy ? (
        <ActivityIndicator color={colors.primary} size="small" />
      ) : (
        <HugeiconsIcon color={colors.primary} icon={icon} size={20} strokeWidth={1.8} />
      )}
    </Pressable>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Text className="text-[11px] font-medium uppercase tracking-[0.3px] text-muted-foreground">
      {children}
    </Text>
  );
}

/**
 * An order on the delivery boy's run, as the Figma lays it out: the AWB with its payment pill,
 * the receiver with View on Map and Call buttons, the delivery address, and the amount to
 * collect for COD and To Pay. With `onPress` the card opens the order's scan and update.
 */
export function OrderCard({
  address: fullAddress,
  children,
  locating,
  onPress,
  onViewMap,
  order,
}: {
  /** View on Map is finding the address. */
  locating: boolean;
  onViewMap: () => void;
  /** Opens the order to scan and update it; without it the card isn't tappable. */
  onPress?: () => void;
  /** More of the order, shown in the card under the address (the update page's details). */
  children?: ReactNode;
  /** The receiver's complete address when known (the update page), in place of the DRS's. */
  address?: string | null;
  order: DrsOrder;
}) {
  // A delivered order says so in the corner; until then the corner shows how it is paid.
  const badge: Remark | null = isDelivered(order)
    ? { label: "Delivered", variant: "delivered" }
    : paymentBadge(order);
  const name = order.receiverName?.trim() || order.customerName?.trim() || "—";
  const mobile = order.customerMobile?.trim() || null;
  const dial = dialUrl(mobile);
  const address = fullAddress?.trim() || orderAddress(order);
  const amount = collectable(order);
  return (
    <Pressable
      accessibilityHint={onPress ? "Scan the parcel to update this order" : undefined}
      accessibilityRole={onPress ? "button" : undefined}
      className={`border border-[#EEF0F6] bg-card p-4 ${onPress ? "active:bg-[#F7F8FF]" : ""}`}
      disabled={!onPress}
      onPress={onPress}
      onPressIn={onPress ? () => haptic("light") : undefined}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Label>AWB Number</Label>
          <Text className="mt-0.5 text-lg font-semibold leading-6 text-foreground" selectable>
            {order.awbNo}
          </Text>
        </View>
        <View className="items-end gap-1">
          {badge ? <RemarkBadge {...badge} size="md" /> : null}
          {/* Updated offline: waiting to reach the server, or refused by it. */}
          <SyncBadge id={order.orderId} />
        </View>
      </View>

      <View className="mt-4 flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <Text className="text-2xl font-semibold leading-8 text-foreground">{name}</Text>
          {mobile ? (
            <View className="mt-0.5 flex-row items-center gap-1.5">
              <HugeiconsIcon
                color={colors.mutedForeground}
                icon={Call02Icon}
                size={15}
                strokeWidth={1.6}
              />
              <Text className="text-sm text-muted-foreground" selectable>
                {formatMobile(mobile)}
              </Text>
            </View>
          ) : null}
        </View>
        {/* The receiver's actions side by side: View on Map, then Call. */}
        <View className="flex-row gap-2">
          {address ? (
            <ActionSquare
              busy={locating}
              icon={Location01Icon}
              label={`View ${order.awbNo} on the map`}
              onPress={onViewMap}
            />
          ) : null}
          {dial ? (
            <ActionSquare
              icon={Call02Icon}
              label={`Call ${name}`}
              onPress={() => void Linking.openURL(dial).catch(() => undefined)}
            />
          ) : null}
        </View>
      </View>

      <View className="mt-4">
        <Label>Address</Label>
        <Text className="mt-1 text-base leading-6 text-foreground">{address || "—"}</Text>
      </View>

      {children}

      {amount ? (
        <View className="mt-4 bg-success-soft px-4 py-3">
          <Label>{payment(order) === "COD" ? "Collect COD Amount" : "Collectable Amount"}</Label>
          <Text className="mt-0.5 text-2xl font-semibold leading-8 text-success">
            ₹{rupees.format(amount)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
