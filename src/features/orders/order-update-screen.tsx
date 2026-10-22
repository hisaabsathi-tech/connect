import {
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  Image01Icon,
  Undo02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { BackHandler, Pressable, ScrollView, useWindowDimensions, View } from "react-native";

import { useDialog } from "@/components/modules/dialog";
import { TabScreen } from "@/components/modules/layout";
import { Skeleton } from "@/components/modules/skeleton";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import { OrderRouteMap } from "@/features/home/components/home-map";
import { useLiveLocation } from "@/hooks/use-live-location";
import { haptic } from "@/lib/haptics";

import { ConfirmDeliverySheet } from "./components/confirm-delivery-sheet";
import { OrderCard } from "./components/order-card";
import { OrderDetails } from "./components/order-details";
import { OrderReasonSheet, type ReasonKind } from "./components/order-reason-sheet";
import { useOrderDetails } from "./hooks/use-order-details";
import { useOrderMap } from "./hooks/use-order-map";
import { useOrderPin } from "./hooks/use-order-pin";
import { usePodPhoto } from "./hooks/use-pod-photo";
import { openedOrder } from "./lib/active-order";
import { joinAddress } from "./lib/order-place";
import { type DrsOrder, isDelivered, isPending, isReturned } from "./lib/orders";

/** The receiver's complete address from the order's tracking, when it has more than the DRS. */
function fullReceiverAddress(details: ReturnType<typeof useOrderDetails>) {
  const receiver = details?.receiver;
  if (!receiver) return null;
  return (
    joinAddress([
      receiver.addressLine1,
      receiver.addressLine2,
      receiver.area,
      receiver.state,
      receiver.pincode,
    ]) ||
    receiver.fullAddress?.trim() ||
    null
  );
}

/** The header's pill: scanned for an order being updated, or how a finished one ended. */
function StateBadge({ order }: { order: DrsOrder }) {
  const [label, color] = !isPending(order)
    ? isDelivered(order)
      ? ["Delivered", colors.success]
      : isReturned(order)
        ? ["RTO", RTO]
        : ["Updated", colors.mutedForeground]
    : ["Order Scanned", colors.success];
  return (
    <View className="mt-1 border px-2 py-1" style={{ borderColor: color }}>
      <Text className="text-[11px] font-medium uppercase tracking-[0.3px]" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

// The RTO button's amber, as in Connector v1.
const RTO = "#E39B2B";
// The route map at the bottom takes this share of the screen's height, within these bounds, so
// it is big enough to read on any phone without measuring the page above it.
const MAP_SHARE = 0.5;
const MAP_MIN_HEIGHT = 280;
const MAP_MAX_HEIGHT = 480;

function OutcomeButton({
  fullWidth = false,
  icon,
  label,
  onPress,
  tone,
}: {
  fullWidth?: boolean;
  icon: typeof Undo02Icon;
  label: string;
  onPress: () => void;
  tone: "rto" | "failed";
}) {
  const color = tone === "rto" ? RTO : colors.destructive;
  return (
    <Pressable
      accessibilityRole="button"
      className={`min-h-12 ${fullWidth ? "w-full" : "flex-1"} flex-row items-center justify-center gap-2 border px-3 py-2 active:opacity-80 ${tone === "rto" ? "bg-[#FFF6EC]" : "bg-card"}`}
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
 * A scanned order's update, as in Connector v1 (a finished order opens here straight from the
 * list, to look at): the order card with its full details (sender, shipment facts), then Confirm
 * Delivery, Order RTO or Order not Delivered, each finishing in its sheet and returning to the
 * list, and the delivery route on a map at the bottom. A delivered order still exposes Order RTO
 * for a necessary correction. Leaving a pending order without an update asks first, since the
 * parcel would have to be scanned again.
 */
export function OrderUpdateScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const order = openedOrder(orderId);
  const dialog = useDialog();
  const orderMap = useOrderMap();
  const details = useOrderDetails(order?.orderId ?? null);
  const place = useOrderPin(order);
  // A finished order (delivered, returned, cancelled) opens to be looked at, without actions.
  const finished = order ? !isPending(order) : false;
  // The delivery boy's position matters only for an order still to deliver.
  const live = useLiveLocation(Boolean(order) && !finished);
  const receiverAddress = fullReceiverAddress(details);
  const deliveredAt = order && isDelivered(order) ? (details?.deliveredAt ?? null) : null;
  // The photo sent with Confirm Delivery, when one was.
  const podStorageKey = details?.podStorageKey ?? null;
  const podPhoto = usePodPhoto();
  const { height: screenHeight } = useWindowDimensions();
  const mapHeight = Math.min(
    MAP_MAX_HEIGHT,
    Math.max(MAP_MIN_HEIGHT, Math.round(screenHeight * MAP_SHARE)),
  );
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

  // The phone's back (the page has no back button) asks before leaving an order being updated;
  // an open sheet closes itself first, and a finished order just goes back.
  useFocusEffect(
    useCallback(() => {
      if (!order || finished) return;
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        void leave();
        return true;
      });
      return () => subscription.remove();
    }, [finished, leave, order]),
  );

  return (
    <TabScreen>
      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-8">
        <View className="flex-row items-start gap-3">
          <View className="flex-1">
            <Text className="text-xl font-semibold leading-7 text-foreground">
              {finished ? "Order Details" : "Update Order"}
            </Text>
            <Text className="mt-0.5 text-sm text-muted-foreground">
              {finished ? "This order is already updated" : "Update the order details"}
            </Text>
          </View>
          {order ? <StateBadge order={order} /> : null}
        </View>

        {order ? (
          <View className="mt-5 gap-3">
            <OrderCard
              address={receiverAddress}
              locating={orderMap.locating === order.orderId}
              onViewMap={() => void orderMap.open(order, deliveredAt)}
              order={order}
            >
              <OrderDetails details={details} order={order} />
            </OrderCard>
            {finished ? (
              isDelivered(order) ? (
                <View className="gap-3">
                  <OutcomeButton
                    fullWidth
                    icon={Undo02Icon}
                    label="Order RTO"
                    onPress={() => setReason("rto")}
                    tone="rto"
                  />
                  {podStorageKey ? (
                    <Pressable
                      accessibilityRole="button"
                      className="min-h-12 w-full flex-row items-center justify-center gap-2 border border-primary bg-card px-3 py-2 active:opacity-80"
                      onPress={() => void podPhoto.open(podStorageKey, order.awbNo)}
                      onPressIn={() => haptic("light")}
                    >
                      <Text className="text-center text-sm font-medium text-primary">
                        Proof Of Delivery
                      </Text>
                      <HugeiconsIcon
                        color={colors.primary}
                        icon={Image01Icon}
                        size={18}
                        strokeWidth={1.8}
                      />
                    </Pressable>
                  ) : null}
                </View>
              ) : null
            ) : (
              <>
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
                <View className="gap-3">
                  <OutcomeButton
                    fullWidth
                    icon={CancelCircleIcon}
                    label="Order not Delivered"
                    onPress={() => setReason("not-delivered")}
                    tone="failed"
                  />
                  {/* Kept immediately before the route map, so RTO remains a clear final action. */}
                  <OutcomeButton
                    fullWidth
                    icon={Undo02Icon}
                    label="Order RTO"
                    onPress={() => setReason("rto")}
                    tone="rto"
                  />
                </View>
              </>
            )}
            {/* The way there (the delivery boy, the order and the road between them), or for a
                delivered order, its address and where it was handed over. */}
            {place.found ? (
              <View className="mt-2">
                <Text className="mb-2 text-[11px] font-medium uppercase tracking-[0.3px] text-muted-foreground">
                  {finished ? "Delivery Location" : "Delivery Route"}
                </Text>
                {/* A delivered order waits for its details, which carry where it was handed over. */}
                {place.pin && !(finished && !details) ? (
                  <OrderRouteMap
                    height={mapHeight}
                    live={live.location}
                    onExpand={() => void orderMap.open(order, deliveredAt)}
                    order={place.pin}
                    state={{ delivered: finished, deliveredAt }}
                  />
                ) : (
                  <Skeleton height={mapHeight} />
                )}
              </View>
            ) : null}
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
      {podPhoto.element}
    </TabScreen>
  );
}
