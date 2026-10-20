import {
  ArrowLeft01Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  Undo02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { BackHandler, Pressable, ScrollView, View } from "react-native";

import { useDialog } from "@/components/modules/dialog";
import { TabScreen } from "@/components/modules/layout";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import { haptic } from "@/lib/haptics";

import { ConfirmDeliverySheet } from "./components/confirm-delivery-sheet";
import { OrderCard } from "./components/order-card";
import { OrderReasonSheet, type ReasonKind } from "./components/order-reason-sheet";
import { useOrderMap } from "./hooks/use-order-map";
import { openedOrder } from "./lib/active-order";

// The RTO button's amber, as in Connector v1.
const RTO = "#E39B2B";

function OutcomeButton({
  icon,
  label,
  onPress,
  tone,
}: {
  icon: typeof Undo02Icon;
  label: string;
  onPress: () => void;
  tone: "rto" | "failed";
}) {
  const color = tone === "rto" ? RTO : colors.destructive;
  return (
    <Pressable
      accessibilityRole="button"
      className={`min-h-12 flex-1 flex-row items-center justify-center gap-2 border px-3 py-2 active:opacity-80 ${tone === "rto" ? "bg-[#FFF6EC]" : "bg-card"}`}
      onPress={onPress}
      onPressIn={() => haptic("light")}
      style={{ borderColor: color }}
    >
      <Text className="text-center text-sm font-medium" style={{ color }}>
        {label}
      </Text>
      <HugeiconsIcon color={color} icon={icon} size={18} strokeWidth={1.8} />
    </Pressable>
  );
}

/**
 * A scanned order's update, as in Connector v1: the order card, then Confirm Delivery, Order
 * RTO or Order not Delivered, each finishing in its sheet and returning to the list. Leaving
 * without an update asks first, since the parcel would have to be scanned again.
 */
export function OrderUpdateScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const order = openedOrder(orderId);
  const dialog = useDialog();
  const orderMap = useOrderMap();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState<ReasonKind | null>(null);

  const done = useCallback(() => {
    setConfirming(false);
    setReason(null);
    router.dismissTo("/orders");
  }, []);

  const leave = useCallback(async () => {
    const sure = await dialog.confirm({
      cancelLabel: "Stay",
      confirmLabel: "Go back",
      description: "Leave this order without updating it? You'll scan the parcel again next time.",
      title: "Go back?",
    });
    if (sure) router.back();
  }, [dialog]);

  // The system back asks too (an open sheet closes itself first).
  useFocusEffect(
    useCallback(() => {
      if (!order) return;
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        void leave();
        return true;
      });
      return () => subscription.remove();
    }, [leave, order]),
  );

  return (
    <TabScreen>
      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-8">
        <View className="flex-row items-start gap-3">
          <Pressable
            accessibilityLabel="Back to orders"
            accessibilityRole="button"
            className="mt-2 h-10 w-10 items-center justify-center bg-primary active:bg-primary-hover"
            onPress={() => (order ? void leave() : router.back())}
            onPressIn={() => haptic("light")}
          >
            <HugeiconsIcon
              color={colors.primaryForeground}
              icon={ArrowLeft01Icon}
              size={20}
              strokeWidth={2}
            />
          </Pressable>
          <View className="flex-1">
            <Text className="text-xl font-semibold leading-7 text-foreground">Update Order</Text>
            <Text className="mt-0.5 text-sm text-muted-foreground">Update the order details</Text>
          </View>
          {order ? (
            <View className="mt-1 border border-success px-2 py-1">
              <Text className="text-[11px] font-medium uppercase tracking-[0.3px] text-success">
                Order Scanned
              </Text>
            </View>
          ) : null}
        </View>

        {order ? (
          <View className="mt-5 gap-3">
            <OrderCard
              locating={orderMap.locating === order.orderId}
              onViewMap={() => void orderMap.open(order)}
              order={order}
            />
            <Pressable
              accessibilityRole="button"
              className="h-12 flex-row items-center justify-center gap-2 bg-primary active:bg-primary-hover"
              onPress={() => setConfirming(true)}
              onPressIn={() => haptic("medium")}
            >
              <Text className="text-base font-semibold text-primary-foreground">
                Confirm Delivery
              </Text>
              <HugeiconsIcon
                color={colors.primaryForeground}
                icon={CheckmarkCircle02Icon}
                size={20}
                strokeWidth={1.8}
              />
            </Pressable>
            <View className="flex-row gap-3">
              <OutcomeButton
                icon={Undo02Icon}
                label="Order RTO"
                onPress={() => setReason("rto")}
                tone="rto"
              />
              <OutcomeButton
                icon={CancelCircleIcon}
                label="Order not Delivered"
                onPress={() => setReason("not-delivered")}
                tone="failed"
              />
            </View>
          </View>
        ) : (
          <Text className="mt-8 text-center text-sm text-muted-foreground">
            This order isn't open any more. Go back and tap it in the list again.
          </Text>
        )}
      </ScrollView>
      {order ? (
        <>
          <ConfirmDeliverySheet
            onClose={() => setConfirming(false)}
            onDelivered={done}
            order={order}
            visible={confirming}
          />
          <OrderReasonSheet
            kind={reason}
            onClose={() => setReason(null)}
            onDone={done}
            order={order}
          />
        </>
      ) : null}
      {orderMap.element}
    </TabScreen>
  );
}
