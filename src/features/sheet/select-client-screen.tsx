/** biome-ignore-all lint/correctness/useExhaustiveDependencies: <forced> */
import {
  ArrowRight01Icon,
  Building03Icon,
  Cancel01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, TextInput, View } from "react-native";

import { EmptyBlock } from "@/components/modules/empty-state";
import { TabScreen } from "@/components/modules/layout";
import { LastUpdated } from "@/components/modules/network";
import { Skeleton } from "@/components/modules/skeleton";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import { isNetworkError } from "@/lib/api/network";
import { type Client, fetchOrganizationClients } from "@/lib/api/smart-sheets";
import { useAuthSession } from "@/lib/auth/session";
import { errorMessage } from "@/lib/errors";
import { haptic } from "@/lib/haptics";
import { onReconnect } from "@/lib/network/connectivity";
import { readCache, writeCache } from "@/lib/offline/cache";

import { OrganizationPicker } from "./components/organization-picker";
import { useSheetOrganizations } from "./hooks/use-sheet-organizations";

const CLIENTS_CACHE = "sheet-clients";

function ClientCard({
  client,
  onPress,
  selected,
}: {
  client: Client;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={`${client.name}, client ID ${client.orgGivenId}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      className={`flex-row items-center gap-3 border px-4 py-4 ${selected ? "border-primary bg-[#F0F2FF]" : "border-[#E4E6EE] bg-card"}`}
      onPress={onPress}
      onPressIn={() => haptic("selection")}
    >
      <View className="flex-1">
        <Text className="text-lg text-foreground" numberOfLines={1}>
          {client.name}
        </Text>
        <Text className="mt-1 text-sm text-muted-foreground" numberOfLines={1}>
          Client ID: {client.orgGivenId}
        </Text>
      </View>
      <View
        className={`h-[22px] w-[22px] items-center justify-center rounded-full border ${selected ? "border-primary bg-primary" : "border-[#D0D3DC] bg-card"}`}
      >
        {selected ? <View className="h-2 w-2 rounded-full bg-card" /> : null}
      </View>
    </Pressable>
  );
}

function ClientListSkeleton() {
  return (
    <View className="gap-3">
      {["one", "two", "three", "four"].map((key) => (
        <View className="gap-2 border border-[#E4E6EE] bg-card px-4 py-4" key={key}>
          <Skeleton height={18} width={180} />
          <Skeleton height={12} width={120} />
        </View>
      ))}
    </View>
  );
}

/**
 * The first step of a new Smart Sheet: choosing the organization (when the member has more than
 * one where they may add orders) and the client the orders are for, from that organization's
 * credit customers, searchable by name or client ID.
 *
 * Opened for an existing sheet (`sheetId`, from its table's Add New), the organization is the
 * sheet's and the orders go into that sheet.
 */
export function SelectClientScreen() {
  const target = useLocalSearchParams<{
    dataRows?: string;
    organizationId?: string;
    sheetId?: string;
    sheetName?: string;
  }>();
  const { token } = useAuthSession();
  const { loaded: organizationsLoaded, organizations } = useSheetOrganizations();
  // Where the member may both see the clients and add orders; for an existing sheet, its own.
  const usable = useMemo(
    () =>
      organizations.filter(
        (item) =>
          item.canCreate &&
          item.canListClients &&
          (!target.sheetId || item.id === target.organizationId),
      ),
    [organizations, target.organizationId, target.sheetId],
  );
  const [pickedOrganizationId, setPickedOrganizationId] = useState<string | null>(null);
  // The one picked, else the signed-in one, else the first.
  const organization =
    usable.find((item) => item.id === pickedOrganizationId) ??
    usable.find((item) => item.active) ??
    usable[0] ??
    null;
  const organizationId = organization?.id ?? null;
  const [clients, setClients] = useState<Client[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  // When the shown list was saved, while a refresh couldn't reach the server (offline).
  const [staleSince, setStaleSince] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (quiet = false) => {
    if (!(token && organizationId)) return;
    const saved = readCache<Client[]>(CLIENTS_CACHE, organizationId);
    if (saved) {
      setClients(saved.data);
      setLoading(false);
    } else if (!quiet) setLoading(true);
    setFailure(null);
    try {
      const fresh = await fetchOrganizationClients(token, organizationId);
      writeCache(CLIENTS_CACHE, organizationId, fresh, 10);
      setClients(fresh);
      setStaleSince(null);
    } catch (error) {
      if (saved && isNetworkError(error)) setStaleSince(saved.savedAt);
      else if (!saved)
        setFailure(
          isNetworkError(error)
            ? "Check your connection and try again."
            : errorMessage(error, "Please try again."),
        );
    } finally {
      if (!quiet) setLoading(false);
    }
  };
  useEffect(() => {
    // Another organization's clients: start over with nothing chosen.
    setClients([]);
    setSelectedId(null);
    void load();
  }, [token, organizationId]);
  useEffect(() => onReconnect(() => void load(true)), [token, organizationId]);

  // Every client is loaded; the search filters them here, so typing needs no request.
  const shown = useMemo(() => {
    const words = query.trim().toLowerCase();
    if (!words) return clients;
    return clients.filter((client) =>
      `${client.name} ${client.orgGivenId}`.toLowerCase().includes(words),
    );
  }, [clients, query]);
  const selected = clients.find((client) => client.id === selectedId) ?? null;
  const noAccess = organizationsLoaded && usable.length === 0;
  const waiting = !noAccess && (loading || !organization);

  const proceed = () => {
    if (!(selected && organization)) return;
    haptic("medium");
    router.push({
      params: {
        clientCode: selected.orgGivenId,
        clientId: selected.id,
        clientName: selected.name,
        organizationId: organization.id,
        organizationName: organization.name,
        // For an existing sheet, its orders go into it.
        ...(target.sheetId
          ? {
              dataRows: target.dataRows ?? "0",
              mode: "append",
              sheetId: target.sheetId,
              sheetName: target.sheetName ?? "",
            }
          : {}),
      },
      pathname: "/sheet/add-order",
    });
  };

  const header = (
    <View className="pb-4">
      <Text className="text-2xl font-semibold text-foreground">Select Client</Text>
      <Text className="mt-0.5 text-sm text-muted-foreground">
        Choose the client for the orders you want to create
      </Text>
      <View className="mt-5 h-12 flex-row items-center border border-border bg-card">
        <View className="pl-3">
          <HugeiconsIcon color={colors.mutedForeground} icon={Search01Icon} size={20} />
        </View>
        <TextInput
          accessibilityLabel="Search clients"
          autoCapitalize="none"
          autoCorrect={false}
          className="h-full flex-1 px-3 font-sans text-base text-foreground"
          onChangeText={setQuery}
          placeholder="Search client name or client ID"
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="search"
          value={query}
        />
        {query ? (
          <Pressable
            accessibilityLabel="Clear search"
            accessibilityRole="button"
            className="h-full w-10 items-center justify-center"
            onPress={() => setQuery("")}
          >
            <HugeiconsIcon color={colors.mutedForeground} icon={Cancel01Icon} size={16} />
          </Pressable>
        ) : null}
        <OrganizationPicker
          onChange={(next) => {
            if (next) setPickedOrganizationId(next);
          }}
          organizations={usable}
          value={organizationId}
        />
      </View>
      {organization && usable.length > 1 ? (
        <View className="mt-3 flex-row items-center gap-1.5">
          <HugeiconsIcon color={colors.primary} icon={Building03Icon} size={14} />
          <Text className="shrink text-sm text-muted-foreground" numberOfLines={1}>
            Clients of <Text className="font-medium text-foreground">{organization.name}</Text>
          </Text>
        </View>
      ) : null}
      <LastUpdated at={staleSince} />
    </View>
  );

  return (
    <TabScreen>
      <FlatList
        accessibilityRole="radiogroup"
        contentContainerClassName="px-5 pb-6 pt-2"
        contentContainerStyle={{ flexGrow: 1 }}
        data={waiting || noAccess ? [] : shown}
        ItemSeparatorComponent={() => <View className="h-3" />}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          noAccess ? (
            <EmptyBlock
              description="Your role can't add orders or see clients in any organization."
              title="No access to create sheets"
            />
          ) : waiting ? (
            <ClientListSkeleton />
          ) : (
            <EmptyBlock
              action={failure ? { label: "Try again", onPress: () => void load() } : undefined}
              description={
                failure ??
                (query
                  ? `No client matches "${query}".`
                  : "Add credit clients on the web app to create sheets for them.")
              }
              title={failure ? "Couldn't load clients" : "No clients"}
            />
          )
        }
        ListHeaderComponent={header}
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
          <ClientCard
            client={item}
            onPress={() => setSelectedId(item.id)}
            selected={item.id === selectedId}
          />
        )}
      />
      <View className="px-5 pb-4 pt-2">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !selected }}
          className={`h-12 flex-row items-center justify-center gap-2 bg-primary ${selected ? "active:bg-primary-hover" : "opacity-40"}`}
          disabled={!selected}
          onPress={proceed}
        >
          <Text className="text-base font-medium text-primary-foreground">Continue</Text>
          <HugeiconsIcon color={colors.primaryForeground} icon={ArrowRight01Icon} size={18} />
        </Pressable>
      </View>
    </TabScreen>
  );
}
