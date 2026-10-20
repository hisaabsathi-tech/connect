import { View } from "react-native";

import { Text } from "@/components/modules/typography";
import { humanizeLabel } from "@/lib/text";

import type { DrsOrder } from "../lib/orders";

/**
 * A stand-in for the order card (the next step): the AWB, who it goes to, and where it stands.
 */
export function OrderRow({ order }: { order: DrsOrder }) {
  return (
    <View className="border border-[#EEF0F6] bg-card p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-[11px] font-medium uppercase tracking-[0.3px] text-muted-foreground">
            AWB Number
          </Text>
          <Text className="mt-0.5 text-base font-semibold text-foreground" selectable>
            {order.awbNo}
          </Text>
        </View>
        <Text className="text-xs font-medium uppercase text-primary">
          {order.paymentType ? humanizeLabel(order.paymentType) : ""}
        </Text>
      </View>
      <Text className="mt-3 text-base font-medium text-foreground" numberOfLines={1}>
        {order.receiverName || order.customerName || "--"}
      </Text>
      <Text className="mt-1 text-sm text-muted-foreground">
        {humanizeLabel(order.shipmentStatus) || "--"} · {order.drsId}
      </Text>
    </View>
  );
}
