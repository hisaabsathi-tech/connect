import { ScrollView, View } from "react-native";

import { HapticButton } from "@/components/modules/button";
import { BottomSheet } from "@/components/modules/sheet";
import { Text } from "@/components/modules/typography";
import { discardOutboxItem, retryOutboxItem, useOutbox } from "@/lib/offline/outbox";

/**
 * Updates saved offline that the server later refused (an order moved off the sheet, a pickup
 * cancelled meanwhile), each with its reason: try again, or discard it.
 */
export function SyncIssuesSheet({ onClose, visible }: { onClose: () => void; visible: boolean }) {
  const failed = useOutbox().items.filter((item) => item.state === "failed");
  return (
    <BottomSheet dragHandleOnly onClose={onClose} visible={visible}>
      <Text className="mt-4 text-xl font-semibold leading-7 text-foreground">
        Updates that need attention
      </Text>
      <Text className="mt-0.5 text-sm text-muted-foreground">
        Saved while offline, but the server didn't accept them.
      </Text>
      <ScrollView className="mt-4 max-h-[420px]" contentContainerClassName="gap-2">
        {failed.length ? (
          failed.map((item) => (
            <View className="border border-[#FECACA] bg-[#FFF1F2] px-4 py-3" key={item.id}>
              <Text className="text-base font-semibold text-foreground">{item.label}</Text>
              <Text className="mt-0.5 text-sm text-destructive">{item.error}</Text>
              <View className="mt-3 flex-row gap-3">
                <HapticButton
                  kind="light"
                  label="Discard"
                  onPress={() => discardOutboxItem(item.id)}
                />
                <HapticButton
                  kind="medium"
                  label="Try again"
                  onPress={() => retryOutboxItem(item.id)}
                  tone="brand"
                />
              </View>
            </View>
          ))
        ) : (
          <Text className="text-base text-muted-foreground">Nothing needs attention.</Text>
        )}
      </ScrollView>
    </BottomSheet>
  );
}
