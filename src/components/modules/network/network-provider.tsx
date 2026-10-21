import { ServerOffIcon, WifiDisconnected02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Linking, Platform, View } from "react-native";

import { HapticButton } from "@/components/modules/button";
import { BottomSheet } from "@/components/modules/sheet";
import { Text } from "@/components/modules/typography";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/config/colors";
import { startMapNetwork } from "@/lib/maps/map-network";
import { isOnline, probe, startConnectivity, useConnectivity } from "@/lib/network/connectivity";
import { onOutboxRefused, startOutbox, useOutbox } from "@/lib/offline/outbox";

import { SyncIssuesSheet } from "./sync-issues-sheet";

// Back online at least this long before going offline again shows the sheet again.
const RESHOW_AFTER_MS = 60_000;

type NetworkApi = {
  /**
   * True when online. Offline it opens the sheet saying `action` needs internet (e.g. "Check-in")
   * and returns false, so the caller stops.
   */
  requireOnline: (action: string) => boolean;
  /** Opens the offline sheet (the Offline chip). */
  showOffline: () => void;
  /** Opens the list of updates the server refused. */
  showSyncIssues: () => void;
};

const NetworkContext = createContext<NetworkApi | null>(null);

/** Opens the phone's network settings (mobile data, Wi-Fi), or the app's settings on iOS. */
async function openNetworkSettings() {
  if (Platform.OS === "android") {
    try {
      await Linking.sendIntent("android.settings.WIRELESS_SETTINGS");
      return;
    } catch {
      // Some phones lack that page; the app settings still reach the network toggles.
    }
  }
  await Linking.openSettings().catch(() => undefined);
}

/**
 * Watches the connection and sends saved updates when it is back. Going offline shows a sheet
 * once (with a shortcut to the network settings); the app keeps working on saved data, and
 * actions that need the server ask through `requireOnline`.
 */
export function NetworkProvider({ children }: PropsWithChildren) {
  const toast = useToast();
  const { status, reason, since } = useConnectivity();
  const { items } = useOutbox();
  const [sheet, setSheet] = useState<{ action: string | null } | null>(null);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    startConnectivity();
    startOutbox();
    startMapNetwork();
  }, []);

  // Offline: the sheet once. It shows again only after the app has been back online a while,
  // so a flaky connection doesn't keep raising it.
  const shownFor = useRef<number | null>(null);
  const onlineSince = useRef<number | null>(null);
  useEffect(() => {
    if (status === "online") {
      onlineSince.current = since;
      setSheet((open) => (open?.action === null ? null : open));
      return;
    }
    if (status !== "offline") return;
    const steady = onlineSince.current === null || since - onlineSince.current >= RESHOW_AFTER_MS;
    if (shownFor.current !== null && !steady) return;
    shownFor.current = since;
    setSheet({ action: null });
  }, [since, status]);

  // Each update the server refuses is told once; the chip keeps them until dealt with.
  useEffect(
    () =>
      onOutboxRefused((item) =>
        toast.error("An update couldn't be saved", `${item.label}: ${item.error ?? ""}`.trim()),
      ),
    [toast],
  );

  // Everything saved offline has gone through.
  const waiting = items.filter((item) => item.state === "pending").length;
  const previous = useRef(waiting);
  useEffect(() => {
    if (previous.current > 0 && waiting === 0 && isOnline()) {
      toast.success("All updates synced", "Everything saved offline has reached the server.");
    }
    previous.current = waiting;
  }, [toast, waiting]);

  const requireOnline = useCallback((action: string) => {
    if (isOnline()) return true;
    setSheet({ action });
    return false;
  }, []);
  const api = useMemo<NetworkApi>(
    () => ({
      requireOnline,
      showOffline: () => setSheet({ action: null }),
      showSyncIssues: () => setIssuesOpen(true),
    }),
    [requireOnline],
  );

  const action = sheet?.action ?? null;
  const isServerDown = status === "offline" && reason === "server_unreachable";

  const title = isServerDown
    ? action
      ? `${action} needs server connection`
      : "Server unreachable"
    : action
      ? `${action} needs internet`
      : "You're offline";

  const description = isServerDown
    ? action
      ? "The server couldn't be reached right now. Deliveries and pickups can still be updated offline; they'll sync automatically once the server is back."
      : "Your phone is connected, but our server couldn't be reached. Showing your last saved data. Deliveries and pickups you update are saved on the phone and sent automatically once the server is back."
    : action
      ? "Turn on mobile data or Wi-Fi, then try again. Deliveries and pickups can still be updated offline; they're sent automatically when you're back online."
      : "Showing your last saved data. Deliveries and pickups you update are saved on the phone and sent automatically the moment you're back online.";

  const primaryLabel = isServerDown
    ? retrying
      ? "Checking..."
      : action
        ? "Try again"
        : "Retry connection"
    : "Turn on internet";

  const handlePrimaryPress = async () => {
    if (isServerDown) {
      setRetrying(true);
      try {
        await probe();
      } finally {
        setRetrying(false);
        setSheet(null);
      }
    } else {
      setSheet(null);
      void openNetworkSettings();
    }
  };

  return (
    <NetworkContext.Provider value={api}>
      {children}
      <BottomSheet onClose={() => setSheet(null)} visible={sheet !== null}>
        <View accessibilityRole="alert">
          <View className="mt-5 h-12 w-12 items-center justify-center rounded-full bg-[#FFF1F2]">
            <HugeiconsIcon
              color={colors.destructive}
              icon={isServerDown ? ServerOffIcon : WifiDisconnected02Icon}
              size={26}
              strokeWidth={1.5}
            />
          </View>
          <Text className="mt-4 text-xl font-semibold text-foreground">
            {title}
          </Text>
          <Text className="mt-2 text-base leading-6 text-muted-foreground">
            {description}
          </Text>
          <View className="mt-7 flex-row gap-3">
            <HapticButton
              kind="light"
              label={action ? "Not now" : "Continue offline"}
              onPress={() => setSheet(null)}
            />
            <HapticButton
              disabled={retrying}
              kind="medium"
              label={primaryLabel}
              onPress={handlePrimaryPress}
              tone="brand"
            />
          </View>
        </View>
      </BottomSheet>
      <SyncIssuesSheet onClose={() => setIssuesOpen(false)} visible={issuesOpen} />
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const api = useContext(NetworkContext);
  if (!api) throw new Error("useNetwork must be used inside NetworkProvider");
  return api;
}
