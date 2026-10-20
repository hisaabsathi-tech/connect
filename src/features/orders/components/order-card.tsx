import { Call02Icon, Location01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ActivityIndicator, Linking, Pressable, View } from "react-native";

import { RemarkBadge } from "@/components/modules/remark-badge";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import type { Remark } from "@/lib/attendance/remarks";
import { haptic } from "@/lib/haptics";
import { dialUrl, formatMobile } from "@/lib/phone";

import { orderAddress } from "../lib/order-place";
import type { DrsOrder } from "../lib/orders";

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

function Label({ children }: { children: string }) {
  return (
    <Text className="text-[11px] font-medium uppercase tracking-[0.3px] text-muted-foreground">
      {children}
    </Text>
  );
}

/**
 * An order on the delivery boy's run, as the Figma lays it out: the AWB with its payment pill,
 * the receiver with a call button, the delivery address with View on Map, and the amount to
 * collect for COD and To Pay. The card itself isn't tappable yet; delivering from it comes later.
 */
export function OrderCard({
  locating,
  onViewMap,
  order,
}: {
  /** View on Map is finding the address. */
  locating: boolean;
  onViewMap: () => void;
  order: DrsOrder;
}) {
  const badge = paymentBadge(order);
  const name = order.receiverName?.trim() || order.customerName?.trim() || "—";
  const mobile = order.customerMobile?.trim() || null;
  const dial = dialUrl(mobile);
  const address = orderAddress(order);
  const amount = collectable(order);
  return (
    <View className="border border-[#EEF0F6] bg-card p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Label>AWB Number</Label>
          <Text className="mt-0.5 text-lg font-semibold leading-6 text-foreground" selectable>
            {order.awbNo}
          </Text>
        </View>
        {badge ? <RemarkBadge {...badge} size="md" /> : null}
      </View>

      <View className="mt-4 flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <Text className="text-2xl font-semibold leading-8 text-foreground" numberOfLines={2}>
            {name}
          </Text>
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
        {dial ? (
          <Pressable
            accessibilityLabel={`Call ${name}`}
            accessibilityRole="button"
            className="h-12 w-12 items-center justify-center bg-[#CDD4FF] active:opacity-80"
            onPress={() => void Linking.openURL(dial).catch(() => undefined)}
            onPressIn={() => haptic("light")}
          >
            <HugeiconsIcon color={colors.primary} icon={Call02Icon} size={20} strokeWidth={1.8} />
          </Pressable>
        ) : null}
      </View>

      <View className="mt-4 flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <Label>Address</Label>
          <Text className="mt-1 text-base leading-6 text-foreground">{address || "—"}</Text>
        </View>
        {address ? (
          <Pressable
            accessibilityLabel={`View ${order.awbNo} on the map`}
            accessibilityRole="button"
            className="h-10 min-w-[124px] flex-row items-center justify-center gap-1.5 border border-primary bg-[#F0F2FF] px-3 active:bg-accent"
            disabled={locating}
            onPress={onViewMap}
            onPressIn={() => haptic("light")}
          >
            {locating ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <>
                <Text className="text-sm font-medium text-primary">View on Map</Text>
                <HugeiconsIcon
                  color={colors.primary}
                  icon={Location01Icon}
                  size={16}
                  strokeWidth={1.8}
                />
              </>
            )}
          </Pressable>
        ) : null}
      </View>

      {amount ? (
        <View className="mt-4 bg-success-soft px-4 py-3">
          <Label>Collectable Amount</Label>
          <Text className="mt-0.5 text-2xl font-semibold leading-8 text-success">
            ₹{rupees.format(amount)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
