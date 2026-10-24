/** biome-ignore-all lint/correctness/useExhaustiveDependencies: <forced> */
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";

import { type DateRange, SearchRangeToolbar } from "@/components/modules/date-range";
import { EmptyBlock } from "@/components/modules/empty-state";
import { TabScreen } from "@/components/modules/layout";
import { LastUpdated, OfflineChip } from "@/components/modules/network";
import { OrganizationPicker } from "@/components/modules/organization";
import { CardListSkeleton } from "@/components/modules/skeleton";
import { Text } from "@/components/modules/typography";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/config/colors";
import { isNetworkError } from "@/lib/api/network";
import {
  fetchPincodeCities,
  fetchSmartSheet,
  fetchSmartSheets,
  type SmartSheetSummary,
} from "@/lib/api/smart-sheets";
import { useAuthSession } from "@/lib/auth/session";
import { useViewer } from "@/lib/auth/viewer";
import { useDateFilter } from "@/lib/date";
import { errorMessage } from "@/lib/errors";
import { saveToDevice, shareFile } from "@/lib/files/device-files";
import { onReconnect } from "@/lib/network/connectivity";
import { readCache, writeCache } from "@/lib/offline/cache";

import { DownloadManifestSheet } from "./components/download-manifest-sheet";
import { SheetCard } from "./components/sheet-card";
import { SheetHero } from "./components/sheet-hero";
import { useSheetOrganizations } from "./hooks/use-sheet-organizations";
import { sheetDay } from "./lib/format";
import { manifestFile, manifestPincodes } from "./lib/manifest";

const SHEETS_CACHE = "smart-sheets";

// Sheets come from several organizations, so a sheet is told apart by both ids.
const sheetKey = (sheet: SmartSheetSummary) => `${sheet.organizationId}-${sheet.id}`;

/**
 * The Sheet tab: the banner to start a new Smart Sheet, then the sheets the member can see in
 * every same-owner organization, without switching — in each, all of them or only their own, as
 * their role there allows — searchable by name or organization and narrowed to the days they were
 * last saved. Each card downloads its Shipping Manifest, once confirmed in a bottom sheet.
 */
export function SheetsScreen() {
  const { token } = useAuthSession();
  const viewer = useViewer();
  const toast = useToast();
  const { today } = useDateFilter();
  const [range, setRange] = useState<DateRange | null>(null);
  const [query, setQuery] = useState("");
  const [sheets, setSheets] = useState<SmartSheetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // When the shown list was saved, while a refresh couldn't reach the server (offline).
  const [staleSince, setStaleSince] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  // The sheet whose manifest download is being confirmed, and the one confirmed, which downloads
  // once the confirmation has slid away.
  const [confirming, setConfirming] = useState<SmartSheetSummary | null>(null);
  const confirmed = useRef<SmartSheetSummary | null>(null);
  const { organizations } = useSheetOrganizations();
  // One organization's sheets, or every organization's (null).
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const organization = organizations.find((item) => item.id === organizationId) ?? null;

  const load = async (quiet = false) => {
    if (!(token && viewer.canViewSheets)) return;
    const saved = readCache<SmartSheetSummary[]>(SHEETS_CACHE, "list");
    if (saved) {
      setSheets(saved.data);
      setLoading(false);
    } else if (!quiet) setLoading(true);
    setFailed(false);
    try {
      const fresh = await fetchSmartSheets(token);
      writeCache(SHEETS_CACHE, "list", fresh, 1);
      setSheets(fresh);
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
  }, [token, viewer.canViewSheets]);
  useEffect(() => onReconnect(() => void load(true)), [token, viewer.canViewSheets]);
  // Back from adding orders, the sheet they went into shows with its new count.
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) void load(true);
      focusedOnce.current = true;
    }, [token, viewer.canViewSheets]),
  );

  // Every sheet is loaded; the filters narrow it here, so they work offline.
  const shown = useMemo(() => {
    const words = query.trim().toLowerCase();
    return sheets.filter((sheet) => {
      if (organization && sheet.organizationId !== organization.id) return false;
      if (words && !`${sheet.name} ${sheet.organizationName}`.toLowerCase().includes(words))
        return false;
      if (!range) return true;
      const day = sheetDay(sheet);
      return day >= range.from && day <= range.to;
    });
  }, [organization, query, range, sheets]);
  // Each card names its organization only when the sheets come from more than one.
  const manyOrganizations = useMemo(
    () => new Set(sheets.map((sheet) => sheet.organizationId)).size > 1,
    [sheets],
  );

  const download = async (sheet: SmartSheetSummary) => {
    if (!token || downloading) return;
    setDownloading(sheetKey(sheet));
    try {
      const record = await fetchSmartSheet(token, sheet);
      // Without the cities (offline lookup, an older server) the manifest still downloads.
      const cities = await fetchPincodeCities(
        token,
        sheet.organizationId,
        manifestPincodes(record.workbook),
      ).catch(() => ({}));
      const file = manifestFile(record, cities);
      const folder = await saveToDevice([file]);
      if (folder) toast.success("Manifest downloaded", `Saved to ${folder} on your device.`);
      // Backed out of choosing a folder: it can still be sent on from the share sheet.
      else await shareFile(file, "Shipping Manifest");
    } catch (error) {
      toast.error("Couldn't download manifest", errorMessage(error, "Please try again."));
    } finally {
      setDownloading(null);
    }
  };
  const startConfirmed = () => {
    const sheet = confirmed.current;
    confirmed.current = null;
    if (sheet) void download(sheet);
  };

  const header = (
    <View className="pb-4">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-2xl font-semibold text-foreground">Smart Sheet</Text>
        <OfflineChip />
      </View>
      <Text className="mt-0.5 text-sm text-muted-foreground">
        Shipping manifest for your orders
      </Text>
      <View className="mt-5">
        <SheetHero onCreate={() => router.push("/sheet/client")} />
      </View>
      <View className="mt-4">
        <SearchRangeToolbar
          accessory={
            <OrganizationPicker
              allowAll
              description="Show the sheets of one organization"
              onChange={setOrganizationId}
              organizations={organizations}
              value={organization?.id ?? null}
            />
          }
          autoCapitalize="none"
          filterChip={
            organization
              ? { label: organization.name, onClear: () => setOrganizationId(null) }
              : null
          }
          onQueryChange={setQuery}
          onRangeChange={setRange}
          query={query}
          range={range}
          searchLabel="Search sheets"
          today={today}
        />
        <LastUpdated at={staleSince} />
      </View>
    </View>
  );

  return (
    <TabScreen>
      <FlatList
        contentContainerClassName="px-5 pb-8 pt-2"
        contentContainerStyle={{ flexGrow: 1 }}
        data={loading || !viewer.isLoaded ? [] : shown}
        ItemSeparatorComponent={() => <View className="h-3" />}
        keyboardShouldPersistTaps="handled"
        keyExtractor={sheetKey}
        ListEmptyComponent={
          loading || !viewer.isLoaded ? (
            <CardListSkeleton count={2} />
          ) : (
            <EmptyBlock
              action={failed ? { label: "Try again", onPress: () => void load() } : undefined}
              description={
                failed
                  ? "Check your connection and try again."
                  : query
                    ? `No sheet matches "${query}".`
                    : range
                      ? "No sheet was saved in these dates."
                      : organization
                        ? `${organization.name} has no sheets yet.`
                        : "Sheets you create will show up here."
              }
              title={failed ? "Couldn't load sheets" : "No sheets yet"}
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
          <SheetCard
            downloading={downloading === sheetKey(item)}
            onDownload={() => {
              if (!downloading) setConfirming(item);
            }}
            onOpen={() =>
              router.push({
                params: {
                  name: item.name,
                  organizationId: item.organizationId,
                  sheetId: item.id,
                },
                pathname: "/sheet/rows",
              })
            }
            sheet={item}
            showOrganization={manyOrganizations}
          />
        )}
      />
      <DownloadManifestSheet
        onClose={() => setConfirming(null)}
        onClosed={startConfirmed}
        onConfirm={() => {
          confirmed.current = confirming;
          setConfirming(null);
        }}
        sheet={confirming}
      />
    </TabScreen>
  );
}
