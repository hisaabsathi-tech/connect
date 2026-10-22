/** biome-ignore-all lint/correctness/useExhaustiveDependencies: <forced> */
import { ArrowRight01Icon, Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, TextInput, View } from "react-native";

import { EmptyBlock } from "@/components/modules/empty-state";
import { TabScreen } from "@/components/modules/layout";
import { LastUpdated } from "@/components/modules/network";
import { Skeleton } from "@/components/modules/skeleton";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import { type Client, fetchClients } from "@/lib/api/clients";
import { isNetworkError } from "@/lib/api/network";
import { useAuthSession } from "@/lib/auth/session";
import { errorMessage } from "@/lib/errors";
import { haptic } from "@/lib/haptics";
import { onReconnect } from "@/lib/network/connectivity";
import { readCache, writeCache } from "@/lib/offline/cache";

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
 * The first step of a new Smart Sheet: choosing the client its orders are for, from the
 * organisation's credit customers, searchable by name or client ID.
 */
export function SelectClientScreen() {
  const { token } = useAuthSession();
  const [clients, setClients] = useState<Client[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  // When the shown list was saved, while a refresh couldn't reach the server (offline).
  const [staleSince, setStaleSince] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (quiet = false) => {
    if (!token) return;
    const saved = readCache<Client[]>(CLIENTS_CACHE, "list");
    if (saved) {
      setClients(saved.data);
      setLoading(false);
    } else if (!quiet) setLoading(true);
    setFailure(null);
    try {
      const fresh = await fetchClients(token);
      writeCache(CLIENTS_CACHE, "list", fresh, 1);
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
    void load();
  }, [token]);
  useEffect(() => onReconnect(() => void load(true)), [token]);

  // Every client is loaded; the search filters them here, so typing needs no request.
  const shown = useMemo(() => {
    const words = query.trim().toLowerCase();
    if (!words) return clients;
    return clients.filter((client) =>
      `${client.name} ${client.orgGivenId}`.toLowerCase().includes(words),
    );
  }, [clients, query]);
  const selected = clients.find((client) => client.id === selectedId) ?? null;

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
      </View>
      <LastUpdated at={staleSince} />
    </View>
  );

  return (
    <TabScreen>
      <FlatList
        accessibilityRole="radiogroup"
        contentContainerClassName="px-5 pb-6 pt-2"
        contentContainerStyle={{ flexGrow: 1 }}
        data={loading ? [] : shown}
        ItemSeparatorComponent={() => <View className="h-3" />}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          loading ? (
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
          // The next step, adding the orders for `selected`, is still to be built.
          onPress={() => haptic("medium")}
        >
          <Text className="text-base font-medium text-primary-foreground">Continue</Text>
          <HugeiconsIcon color={colors.primaryForeground} icon={ArrowRight01Icon} size={18} />
        </Pressable>
      </View>
    </TabScreen>
  );
}
