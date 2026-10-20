import { View } from "react-native";

import { Skeleton } from "@/components/modules/skeleton";
import { Text } from "@/components/modules/typography";
import type { OrderDetails as Details } from "@/lib/api/order-detail";
import { formatDayLabel, toIsoDate } from "@/lib/date";
import { formatMobile } from "@/lib/phone";
import { humanizeLabel } from "@/lib/text";

import { joinAddress } from "../lib/order-place";
import type { DrsOrder } from "../lib/orders";

// The sender's block is hidden for now; flip this to show who sent the order again.
const SHOW_SENDER = false;

// The facts grid's loading cells (three rows of two).
const FACT_PLACEHOLDERS = ["fact-1", "fact-2", "fact-3", "fact-4", "fact-5", "fact-6"];

const rupees = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

function Label({ children }: { children: string }) {
  return (
    <Text className="text-[11px] font-medium uppercase tracking-[0.3px] text-muted-foreground">
      {children}
    </Text>
  );
}

/** One fact in the two-column grid; `wide` takes the whole row (a long remark). */
function Fact({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <View className={`pb-3 ${wide ? "w-full" : "w-1/2 pr-3"}`}>
      <Label>{label}</Label>
      <Text className="mt-0.5 text-sm text-foreground" selectable>
        {value}
      </Text>
    </View>
  );
}

const text = (value: string | null | undefined) => value?.trim() || null;

function bookedOn(date: string | null) {
  if (!date) return null;
  const day = new Date(date);
  return Number.isNaN(day.getTime()) ? null : formatDayLabel(toIsoDate(day));
}

/** The facts worth having at the door, in order; those the order lacks are left out. */
function facts(order: DrsOrder, details: Details | null) {
  const detail = details?.detail ?? null;
  const weight = detail?.chargableWeight ?? detail?.actualWeight ?? null;
  const products = (detail?.products ?? []).filter((product) => text(product.productName));
  const pieces = (detail?.products ?? []).reduce(
    (sum, product) => sum + (product.quantity ?? 0),
    0,
  );
  const contents =
    text(detail?.contentType) ??
    (products.length ? products.map((product) => product.productName?.trim()).join(", ") : null);
  const service = [
    text(order.serviceType) ?? text(detail?.serviceType),
    text(order.packageType) ?? text(detail?.packageType),
  ]
    .filter(Boolean)
    .map((part) => humanizeLabel(part))
    .join(" · ");
  return [
    { label: "Ref No", value: text(order.refNo) ?? text(detail?.refNo) },
    { label: "DRS ID", value: order.drsId },
    { label: "Service", value: service || null },
    { label: "Booked On", value: bookedOn(detail?.date ?? null) },
    { label: "Weight", value: weight ? `${weight} kg` : null },
    { label: "Pieces", value: pieces ? String(pieces) : null },
    { label: "Contents", value: contents },
    {
      label: "Declared Value",
      value: detail?.productValue ? `₹${rupees.format(detail.productValue)}` : null,
    },
    { label: "Center", value: text(order.center) },
    {
      label: "Attempts",
      value: detail?.deliveryAttemptCount ? String(detail.deliveryAttemptCount) : null,
    },
    { label: "E-way Bill", value: text(detail?.ewayBill) },
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact.value));
}

/**
 * The rest of an order, under its card on the update page: who sent it (hidden for now, see
 * `SHOW_SENDER`), then the shipment's facts (reference, DRS, service, booking date, weight,
 * contents…) and any remark. Skeleton lines hold its place while it loads.
 */
export function OrderDetails({ details, order }: { details: Details | null; order: DrsOrder }) {
  const sender = details?.sender ?? null;
  const senderName =
    text(sender?.name) ?? text(details?.detail?.senderName) ?? text(details?.detail?.customerName);
  const senderAddress =
    text(sender?.fullAddress) ??
    (sender
      ? joinAddress([sender.addressLine1, sender.addressLine2, sender.area, sender.pincode])
      : null);
  const remark = text(order.remarks);

  return (
    <View className="mt-4 border-[#EEF0F6] border-t pt-4">
      {!SHOW_SENDER ? null : (
        <View className="mb-4">
          <Label>Sender</Label>
          {details ? (
            <>
              <Text className="mt-0.5 text-base font-medium text-foreground" numberOfLines={2}>
                {senderName ?? "—"}
              </Text>
              {text(sender?.phone) ? (
                <Text className="text-sm text-muted-foreground" selectable>
                  {formatMobile(sender?.phone ?? "")}
                </Text>
              ) : null}
              {senderAddress ? (
                <Text className="mt-1 text-sm leading-5 text-muted-foreground">
                  {senderAddress}
                </Text>
              ) : null}
            </>
          ) : (
            <View className="mt-1.5 gap-2">
              <Skeleton height={16} width="50%" />
              <Skeleton height={12} width="80%" />
            </View>
          )}
        </View>
      )}

      <View className="flex-row flex-wrap">
        {details ? (
          <>
            {facts(order, details).map((fact) => (
              <Fact key={fact.label} label={fact.label} value={fact.value} />
            ))}
            {remark ? <Fact label="Remarks" value={remark} wide /> : null}
          </>
        ) : (
          FACT_PLACEHOLDERS.map((key) => (
            <View className="w-1/2 gap-1.5 pr-3 pb-3" key={key}>
              <Skeleton height={10} width="45%" />
              <Skeleton height={14} width="70%" />
            </View>
          ))
        )}
      </View>
    </View>
  );
}
