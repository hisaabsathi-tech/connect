import { Pressable } from "react-native";

import { Text } from "@/components/modules/typography";
import { haptic } from "@/lib/haptics";
import { useConnectivity } from "@/lib/network/connectivity";
import { useOutbox } from "@/lib/offline/outbox";

import { useNetwork } from "./network-provider";

/**
 * A small header pill: "Offline" (with how many updates wait to be sent), "Syncing 3" while they
 * go out, or "2 need attention" when the server refused some. Nothing when online and settled.
 */
export function OfflineChip() {
  const { status, reason } = useConnectivity();
  const { items, sending } = useOutbox();
  const { showOffline, showSyncIssues } = useNetwork();
  const waiting = items.filter((item) => item.state === "pending").length;
  const failed = items.length - waiting;
  const offline = status === "offline";
  const isServerDown = offline && reason === "server_unreachable";

  let label: string | null = null;
  let tone = "bg-[#FFF1F2] text-destructive";
  if (offline) {
    if (isServerDown) {
      label = waiting ? `Server unreachable · ${waiting} waiting` : "Server unreachable";
    } else {
      label = waiting ? `Offline · ${waiting} waiting` : "Offline";
    }
  } else if (failed) label = `${failed} need${failed === 1 ? "s" : ""} attention`;
  else if (waiting || sending) {
    label = `Syncing${waiting ? ` ${waiting}` : ""}`;
    tone = "bg-accent text-primary";
  }
  if (!label) return null;
  const [box, text] = tone.split(" ");
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      className={`h-7 flex-row items-center px-2.5 ${box}`}
      hitSlop={6}
      onPress={() => {
        haptic("light");
        if (!offline && failed) showSyncIssues();
        else showOffline();
      }}
    >
      <Text className={`text-xs font-medium ${text}`} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
