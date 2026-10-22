/** biome-ignore-all lint/correctness/useExhaustiveDependencies: <forced> */
import { Call02Icon, CheckmarkCircle02Icon, Location01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  View,
} from "react-native";

import { type DateRange, SearchRangeToolbar } from "@/components/modules/date-range";
import { useDialog } from "@/components/modules/dialog";
import { EmptyBlock } from "@/components/modules/empty-state";
import { TabScreen } from "@/components/modules/layout";
import { LastUpdated, OfflineChip, SyncBadge } from "@/components/modules/network";
import {
  distinctOrganizations,
  OrganizationBadge,
  OrganizationPicker,
} from "@/components/modules/organization";
import { RemarkBadge } from "@/components/modules/remark-badge";
import { BottomSheet } from "@/components/modules/sheet";
import { CardListSkeleton } from "@/components/modules/skeleton";
import { Text } from "@/components/modules/typography";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/config/colors";
import { FilterChips } from "@/features/orders/components/filter-chips";
import { isNetworkError } from "@/lib/api/network";
import {
  fetchMyPickupRequests,
  markPickupPickedUp,
  type PickupRequest,
  type PickupStatus,
} from "@/lib/api/pickups";
import { useAuthSession } from "@/lib/auth/session";
import { useViewer } from "@/lib/auth/viewer";
import { formatDayLabel, formatTime, useDateFilter } from "@/lib/date";
import { errorMessage } from "@/lib/errors";
import { haptic } from "@/lib/haptics";
import { isOnline, onReconnect } from "@/lib/network/connectivity";
import { readCache, writeCache } from "@/lib/offline/cache";
import { enqueue } from "@/lib/offline/outbox";
import { dialUrl, formatMobile } from "@/lib/phone";

import { usePickupMap } from "./hooks/use-pickup-map";

type Tab = "all" | "pending" | "picked";

const tabs: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Yet to pickup" },
  { id: "picked", label: "Picked up" },
];

/** Tapping the already-active tab clears it, back to "all" — the same as Orders' filter chips. */
function toggleTab(current: Tab, next: Tab): Tab {
  return current === next ? "all" : next;
}

const statusBadge: Record<
  PickupStatus,
  { label: string; variant: "delivered" | "destructive" | "rescheduled" | "transit" }
> = {
  OPEN: { label: "Open", variant: "transit" },
  ASSIGNED: { label: "Assigned", variant: "rescheduled" },
  RESOLVED: { label: "Picked up", variant: "delivered" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
  OUTDATED: { label: "Outdated", variant: "destructive" },
};

const PICKUPS_CACHE = "pickups";

function bounds(from: string, to: string) {
  return {
    from: new Date(`${from}T00:00:00.000+05:30`).toISOString(),
    to: new Date(`${to}T23:59:59.999+05:30`).toISOString(),
  };
}

function matchesTab(request: PickupRequest, tab: Tab) {
  if (tab === "all") return true;
  return tab === "pending"
    ? ["OPEN", "ASSIGNED"].includes(request.status)
    : request.status === "RESOLVED";
}

function PickupDetails({
  locating,
  onClose,
  onMap,
  request,
  visible,
}: {
  locating: boolean;
  onClose: () => void;
  onMap: () => void;
  request: PickupRequest | null;
  visible: boolean;
}) {
  if (!request) return null;
  const dial = dialUrl(request.phoneNumber);
  return (
    <BottomSheet onClose={onClose} visible={visible}>
      <Text className="mt-4 text-xl font-semibold text-foreground">{request.name}</Text>
      <Text className="mt-1 text-sm text-muted-foreground">
        {request.organizationName ?? "Pickup request"}
      </Text>
      <RemarkBadge {...statusBadge[request.status]} />
      <Text className="mt-5 text-xs text-muted-foreground">ADDRESS</Text>
      <Text className="mt-1 text-base leading-6 text-foreground">
        {request.address}, {request.pincode}
      </Text>
      <Text className="mt-5 text-xs text-muted-foreground">PREFERRED DATE & TIME</Text>
      <Text className="mt-1 text-base font-semibold text-foreground">
        {formatDayLabel(request.preferredAt.slice(0, 10))} · {formatTime(request.preferredAt)}
      </Text>
      <View className="mt-6 flex-row gap-3">
        {dial ? (
          <Pressable
            className="h-11 flex-1 items-center justify-center border border-primary"
            onPress={() => void Linking.openURL(dial)}
          >
            <Text className="font-medium text-primary">Call customer</Text>
          </Pressable>
        ) : null}
        <Pressable
          className="h-11 flex-1 items-center justify-center border border-primary"
          disabled={locating}
          onPress={onMap}
        >
          {locating ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text className="font-medium text-primary">View on map</Text>
          )}
        </Pressable>
      </View>
    </BottomSheet>
  );
}

/** `showOrganization` tags the card with its organization, for a list holding more than one's. */
function PickupCard({
  busy,
  locating,
  onMap,
  onOpen,
  onPickedUp,
  request,
  showOrganization,
}: {
  busy: boolean;
  /** The map button's spinner while the address is being found. */
  locating: boolean;
  onMap: () => void;
  onOpen: () => void;
  onPickedUp: () => void;
  request: PickupRequest;
  showOrganization: boolean;
}) {
  const dial = dialUrl(request.phoneNumber);
  return (
    <View className="border border-[#EEF0F6] bg-card p-4">
      {showOrganization && request.organizationName ? (
        <OrganizationBadge name={request.organizationName} />
      ) : null}
      <Pressable accessibilityRole="button" onPress={onOpen} onPressIn={() => haptic("light")}>
        <View className="flex-row items-start gap-3">
          <View className="flex-1">
            <Text className="text-lg font-semibold text-foreground">{request.name}</Text>
            <Text className="mt-1 text-base text-muted-foreground">
              {formatMobile(request.phoneNumber)}
            </Text>
          </View>
          <View className="items-end gap-1">
            <RemarkBadge {...statusBadge[request.status]} />
            <SyncBadge id={request.id} />
          </View>
        </View>
        {/* The call and map buttons share the label's line, so the address below them gets the
          card's full width. */}
        <View className="mt-4 flex-row items-center justify-between gap-3">
          <Text className="text-sm text-muted-foreground mt-4">Address</Text>
          <View className="flex-row gap-2">
            {dial ? (
              <Pressable
                accessibilityLabel="Call customer"
                className="h-10 w-10 items-center justify-center bg-accent"
                onPress={() => void Linking.openURL(dial)}
              >
                <HugeiconsIcon color={colors.primary} icon={Call02Icon} size={20} />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityLabel="View on map"
              className="h-10 w-10 items-center justify-center bg-accent"
              disabled={locating}
              onPress={onMap}
            >
              {locating ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <HugeiconsIcon color={colors.primary} icon={Location01Icon} size={20} />
              )}
            </Pressable>
          </View>
        </View>
        <Text className="mt-2 text-base leading-6 text-foreground">
          {request.address}, {request.pincode}
        </Text>
        <Text className="mt-4 text-xs text-muted-foreground">PREFERRED DATE & TIME</Text>
        <Text className="mt-1 text-base font-semibold text-foreground">
          {formatDayLabel(request.preferredAt.slice(0, 10))} · {formatTime(request.preferredAt)}
        </Text>
        {request.note ? (
          <>
            <Text className="mt-4 text-xs text-muted-foreground">NOTE</Text>
            <Text className="mt-1 text-base leading-6 text-foreground">{request.note}</Text>
          </>
        ) : null}
      </Pressable>
      {request.status === "ASSIGNED" ? (
        <Pressable
          accessibilityLabel={`Mark ${request.name}'s pickup as picked up`}
          className="mt-4 h-11 flex-row items-center justify-center gap-2 border border-[#86EFAC] bg-[#ECFDF5]"
          disabled={busy}
          onPress={onPickedUp}
          onPressIn={() => haptic("light")}
        >
          {busy ? (
            <ActivityIndicator color="#16A34A" size="small" />
          ) : (
            <>
              <Text className="font-medium text-[#16A34A]">Mark as picked up</Text>
              <HugeiconsIcon color="#16A34A" icon={CheckmarkCircle02Icon} size={18} />
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

export function PickupsScreen() {
  const { token } = useAuthSession();
  const viewer = useViewer();
  const dialog = useDialog();
  const pickupMap = usePickupMap();
  const toast = useToast();
  const { resetToToday, selectedDate, today } = useDateFilter();
  const [tab, setTab] = useState<Tab>("all");
  const [range, setRange] = useState<DateRange | null>(null);
  const [query, setQuery] = useState("");
  const [requests, setRequests] = useState<PickupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // When the shown list was saved, while a refresh couldn't reach the server (offline).
  const [staleSince, setStaleSince] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [selected, setSelected] = useState<PickupRequest | null>(null);
  // One organization's pickups, or every organization's (null).
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const from = range?.from ?? selectedDate;
  const to = range?.to ?? selectedDate;
  // The whole range is loaded (and saved on the phone); the search filters it here, so typing
  // needs no request and works offline.
  const rangeKey = `${from}|${to}`;
  const load = async (quiet = false) => {
    if (!token) return;
    const saved = readCache<PickupRequest[]>(PICKUPS_CACHE, rangeKey);
    if (saved) {
      setRequests(saved.data);
      setLoading(false);
    } else if (!quiet) setLoading(true);
    setFailed(false);
    try {
      const fresh = await fetchMyPickupRequests(token, bounds(from, to));
      writeCache(PICKUPS_CACHE, rangeKey, fresh, 30);
      setRequests(fresh);
      setStaleSince(null);
    } catch (error) {
      if (saved && isNetworkError(error)) setStaleSince(saved.savedAt);
      else if (!saved) setFailed(true);
    } finally {
      if (!quiet) setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [from, to, token]);
  useEffect(() => onReconnect(() => void load(true)), [from, to, token]);
  useEffect(() => {
    setRange(null);
  }, [selectedDate]);
  const organizations = useMemo(() => distinctOrganizations(requests), [requests]);
  // Each card names its organization only when the pickups come from more than one.
  const manyOrganizations = organizations.length > 1;
  // The chosen organization only narrows the list while the range's pickups span several.
  const organization = manyOrganizations
    ? (organizations.find((item) => item.id === organizationId) ?? null)
    : null;
  const shown = useMemo(() => {
    const words = query.trim().toLowerCase();
    return requests.filter(
      (request) =>
        (!organization || request.organizationId === organization.id) &&
        matchesTab(request, tab) &&
        (!words ||
          [
            request.name,
            request.phoneNumber,
            request.address,
            request.pincode,
            request.note,
            request.organizationName,
          ]
            .join(" ")
            .toLowerCase()
            .includes(words)),
    );
  }, [organization, query, requests, tab]);
  const confirmPickedUp = async (request: PickupRequest) => {
    if (!token || updating) return;
    const accepted = await dialog.confirm({
      title: "Mark pickup as picked up?",
      description: `Confirm collection from ${request.name}.`,
      confirmLabel: "Mark picked up",
      cancelLabel: "Not now",
    });
    if (!accepted) return;
    setUpdating(request.id);
    // Shown collected at once; offline it is saved and sent the moment the app is back online.
    const collected = () => {
      const next = requests.map((item) =>
        item.id === request.id ? { ...item, status: "RESOLVED" as const } : item,
      );
      setRequests(next);
      writeCache(PICKUPS_CACHE, rangeKey, next, 30);
    };
    const queue = () => {
      enqueue({
        kind: "pickup-picked-up",
        label: `Pickup · ${request.name}`,
        organizationId: request.organizationId,
        pickupId: request.id,
      });
      collected();
      toast.success("Saved offline", "The pickup will be marked picked up once you're online.");
    };
    try {
      if (!isOnline()) {
        queue();
        return;
      }
      await markPickupPickedUp(token, request);
      collected();
      toast.success("Pickup updated", "The pickup has been marked as picked up.");
      await load(true);
    } catch (error) {
      if (isNetworkError(error)) queue();
      else toast.error("Couldn't update pickup", errorMessage(error, "Please try again."));
    } finally {
      setUpdating(null);
    }
  };
  const header = (
    <View className="pb-4">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-2xl font-semibold text-foreground">Order Pickup</Text>
        <OfflineChip />
      </View>
      <Text className="mt-0.5 text-sm text-muted-foreground">
        See all your order pickup requests
      </Text>
      <FilterChips
        onChange={(next) => setTab((current) => toggleTab(current, next))}
        options={tabs}
        value={tab}
      />
      <View className="mt-5">
        <SearchRangeToolbar
          accessory={
            <OrganizationPicker
              allowAll
              description="Show the pickups of one organization"
              onChange={setOrganizationId}
              organizations={organizations}
              value={organization?.id ?? null}
            />
          }
          // Sheets and pickups can be issued ahead, so upcoming days can be picked.
          allowFuture
          filterChip={
            organization
              ? { label: organization.name, onClear: () => setOrganizationId(null) }
              : null
          }
          onQueryChange={setQuery}
          onRangeChange={setRange}
          onSelectedDateClear={resetToToday}
          query={query}
          range={range}
          searchLabel="Search pickup requests"
          selectedDate={selectedDate === today ? null : selectedDate}
          today={today}
        />
        <LastUpdated at={staleSince} />
      </View>
    </View>
  );
  if (!viewer.isLoaded)
    return (
      <TabScreen>
        <FlatList
          contentContainerClassName="px-5 pb-8 pt-2"
          data={[]}
          ListEmptyComponent={<CardListSkeleton />}
          ListHeaderComponent={header}
          renderItem={() => null}
        />
      </TabScreen>
    );
  if (!viewer.canViewPickups)
    return (
      <TabScreen>
        <EmptyBlock
          description="Pickup requests are not available for this organization."
          title="No Pickup access"
        />
      </TabScreen>
    );
  return (
    <TabScreen>
      <FlatList
        contentContainerClassName="px-5 pb-8 pt-2"
        contentContainerStyle={{ flexGrow: 1 }}
        data={loading ? [] : shown}
        keyExtractor={(item) => `${item.organizationId}-${item.id}`}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? (
            <CardListSkeleton />
          ) : (
            <EmptyBlock
              action={failed ? { label: "Try again", onPress: () => void load() } : undefined}
              description={
                failed
                  ? "Check your connection and try again."
                  : query
                    ? `No pickup matches "${query}".`
                    : organization
                      ? `${organization.name} has no pickup requests for this date.`
                      : "There are no pickup requests for this date."
              }
              title={failed ? "Couldn't load pickups" : "No pickup requests"}
            />
          )
        }
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={() => {
              setRefreshing(true);
              void load(true).finally(() => setRefreshing(false));
            }}
            refreshing={refreshing}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <PickupCard
            busy={updating === item.id}
            locating={pickupMap.locating === item.id}
            onMap={() => void pickupMap.open(item)}
            onOpen={() => setSelected(item)}
            onPickedUp={() => void confirmPickedUp(item)}
            request={item}
            showOrganization={manyOrganizations}
          />
        )}
      />
      <PickupDetails
        locating={selected !== null && pickupMap.locating === selected.id}
        onClose={() => setSelected(null)}
        onMap={() => {
          if (!selected) return;
          // The map opens full screen; the sheet closes so it isn't left behind it.
          void pickupMap.open(selected).then(() => setSelected(null));
        }}
        request={selected}
        visible={Boolean(selected)}
      />
      {pickupMap.element}
    </TabScreen>
  );
}
