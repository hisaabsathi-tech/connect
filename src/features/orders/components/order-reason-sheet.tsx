import { Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";

import { ActionButton } from "@/components/modules/button";
import { BottomSheet } from "@/components/modules/sheet";
import { Text } from "@/components/modules/typography";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/config/colors";
import { useAuthSession } from "@/lib/auth/session";
import { errorMessage } from "@/lib/errors";
import { haptic } from "@/lib/haptics";
import { lastPosition } from "@/lib/maps/last-position";

import type { DrsOrder } from "../lib/orders";
import { submitOrderOutcome } from "../lib/submit-outcome";

export type ReasonKind = "rto" | "not-delivered";

// Connector v1's reasons, word for word: the server stores the chosen one as the update's note.
const REASONS: Record<ReasonKind, readonly string[]> = {
  "not-delivered": [
    "Contact name/dept not mentioned",
    "Last date over for submission",
    "Consignor refused RTO shipment",
    "Area non serviceable",
    "Restricted entry",
    "Local holiday",
    "Last mile misroute",
    "Consignment lost",
    "Could not attempt",
    "Location inaccessible/restricted area",
    "Vehicle breakdown",
    "Severe weather conditions",
    "Package damaged in transit",
    "Ran out of delivery time",
    "Wrong delivery address provided",
    "Address correct and pincode wrong",
    "Address incomplete or wrong",
  ],
  rto: [
    "Receiver not available at address",
    "Receiver refused delivery",
    "Receiver refused delivery due to damage",
    "Receiver requested delivery on another date",
    "Receiver wants open delivery",
    "Receiver not available/reachable over phone",
    "Receiver shifted from given address",
    "Customer will self collect",
    "Customer refused to share KYC/NDC/SCD",
    "Collection amount not ready",
    "Address OK but no such person",
    "Door locked",
    "Paperwork required",
    "OTP not generated",
  ],
};

const COPY: Record<
  ReasonKind,
  { title: string; status: "RTO_INITIATED" | "DELIVERY ATTEMPT FAILED"; done: string }
> = {
  "not-delivered": {
    done: "Marked not delivered",
    status: "DELIVERY ATTEMPT FAILED",
    title: "Order not delivered",
  },
  rto: { done: "Marked for RTO", status: "RTO_INITIATED", title: "Order RTO" },
};

// The reason list stops at this share of the screen and scrolls past it.
const LIST_SHARE = 0.5;

/**
 * Order RTO or Order not delivered, as in Connector v1: pick the reason from its list, then
 * Update records the outcome (RTO initiated, or a failed delivery attempt) with that reason.
 */
export function OrderReasonSheet({
  kind,
  onClose,
  onDone,
  order,
}: {
  /** Which list to show; null hides the sheet. */
  kind: ReasonKind | null;
  onClose: () => void;
  onDone: () => void;
  order: DrsOrder;
}) {
  const { token } = useAuthSession();
  const toast = useToast();
  const { height } = useWindowDimensions();
  // Kept through the closing slide, after `kind` is already null.
  const [shown, setShown] = useState<ReasonKind>(kind ?? "rto");
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!kind) return;
    setShown(kind);
    setSelected(null);
    setMessage(null);
  }, [kind]);

  const copy = COPY[shown];
  const update = async () => {
    if (!(token && selected) || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      // Sent now, or saved on the phone and sent once back online; off the road at once either way.
      const result = await submitOrderOutcome({
        input: {
          description: selected,
          shipmentStatus: copy.status,
          ...(await lastPosition()),
        },
        order,
        token,
      });
      haptic("success");
      toast.success(
        result === "queued" ? "Saved offline" : copy.done,
        result === "queued"
          ? `${order.awbNo}: ${selected}. It will sync as soon as you're back online.`
          : `${order.awbNo}: ${selected}.`,
      );
      onDone();
    } catch (error) {
      haptic("error");
      setMessage(errorMessage(error, "Couldn't update this order. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet dismissible={!saving} dragHandleOnly onClose={onClose} visible={kind !== null}>
      <Text className="mt-5 text-xl font-semibold text-foreground">{copy.title}</Text>
      <Text className="mt-1 text-sm text-muted-foreground">Choose a reason, then update.</Text>
      <ScrollView className="mt-4" style={{ maxHeight: height * LIST_SHARE }}>
        <View className="gap-2">
          {REASONS[shown].map((reason) => {
            const active = reason === selected;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                className={`min-h-12 flex-row items-center gap-3 border px-3 py-2.5 ${active ? "border-primary bg-accent active:bg-accent" : "border-border bg-card active:bg-[#F7F8FF]"}`}
                key={reason}
                onPress={() => {
                  haptic("selection");
                  setSelected(reason);
                }}
              >
                <Text
                  className={`flex-1 text-sm ${active ? "font-medium text-primary" : "text-foreground"}`}
                >
                  {reason}
                </Text>
                {active ? (
                  <HugeiconsIcon color={colors.primary} icon={Tick02Icon} size={18} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      {message ? <Text className="mt-3 text-sm text-destructive">{message}</Text> : null}
      <View className="mt-5">
        <ActionButton
          arrow={false}
          disabled={!selected}
          label="Update"
          loading={saving}
          onPress={() => void update()}
        />
      </View>
    </BottomSheet>
  );
}
