/** biome-ignore-all lint/correctness/useExhaustiveDependencies: <forced> */
import { Redirect, router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";

import { type DateRange, rangeLabel, SearchRangeToolbar } from "@/components/modules/date-range";
import { useDialog } from "@/components/modules/dialog";
import { EmptyBlock } from "@/components/modules/empty-state";
import { TabScreen } from "@/components/modules/layout";
import { LocationIndicator, locationIndicatorState } from "@/components/modules/location";
import {
  CardListSkeleton,
  ListPageSkeleton,
  Skeleton,
  StatCardSkeleton,
} from "@/components/modules/skeleton";
import { StatCard } from "@/components/modules/stat-card";
import { Text } from "@/components/modules/typography";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/config/colors";
import { reloadLiveTrips } from "@/features/live-trips";
import { useLiveLocation } from "@/hooks/use-live-location";
import { type DrsSheet, type DrsStatus, patchDrs } from "@/lib/api/drs";
import { useAuthSession } from "@/lib/auth/session";
import { useViewer } from "@/lib/auth/viewer";
import { formatDayLabel, useDateFilter } from "@/lib/date";
import { errorMessage } from "@/lib/errors";
import { haptic } from "@/lib/haptics";
import { lastPosition } from "@/lib/maps/last-position";
import { useTrackingStatus } from "@/lib/tracking/status";

import { DrsCard } from "./components/drs-card";
import { DrsPicker } from "./components/drs-picker";
import { FilterChips } from "./components/filter-chips";
import { OrderCard } from "./components/order-card";
import { type PageTab, PageTabs } from "./components/page-tabs";
import { useDrsPrint } from "./hooks/use-drs-print";
import { useDrsScan } from "./hooks/use-drs-scan";
import { useDrsSheets } from "./hooks/use-drs-sheets";
import { useOrderMap } from "./hooks/use-order-map";
import { drsOnTheRoad, rememberOrder } from "./lib/active-order";
import {
  compareDeliveringDrs,
  compareDrsForDelivery,
  DRS_FILTERS,
  type DrsFilter,
  drsAreas,
  drsPincodes,
  isDrsOngoing,
  matchesDrsFilter,
} from "./lib/drs";
import {
  type DrsOrder,
  isDelivered,
  isPending,
  matchesOrderFilter,
  matchesOrderSearch,
  ORDER_FILTERS,
  type OrderFilter,
  ordersFromSheets,
  pendingFirst,
} from "./lib/orders";

function Separator() {
  return <View className="h-3" />;
}

/** The DRS id, areas or pincodes containing the search. */
function matchesDrsSearch(sheet: DrsSheet, search: string) {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [sheet.id, ...drsAreas(sheet), ...drsPincodes(sheet)].some((value) =>
    value.toLowerCase().includes(needle),
  );
}

/**
 * The Orders tab, for any role with order edit: their orders and their delivery run sheets (DRS) on one page,
 * Orders first. Both work from the sheets issued on the day picked on Home, or a range picked
 * here; the counts on top, the status chips and the search follow the tab. Tapping a DRS shows
 * its orders, and the Orders tab narrows to one DRS with the picker under the search.
 */
export function OrdersScreen() {
  const { token } = useAuthSession();
  const viewer = useViewer();
  // Deliveries are confirmed with the phone's location, so its state shows here as on Home.
  const location = useLiveLocation(viewer.canUpdateOrders);
  const tracking = useTrackingStatus().running;
  const { resetToToday, selectedDate, today } = useDateFilter();
  const [tab, setTab] = useState<PageTab>("orders");
  const [range, setRange] = useState<DateRange | null>(null);
  const [query, setQuery] = useState("");
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const [drsFilter, setDrsFilter] = useState<DrsFilter>("all");
  const [drsId, setDrsId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const listRef = useRef<FlatList<DrsOrder | DrsSheet>>(null);

  // A day picked on Home takes over from a range picked here.
  useEffect(() => {
    setRange(null);
  }, [selectedDate]);

  const from = range?.from ?? selectedDate;
  const to = range?.to ?? selectedDate;
  // Starts with the role still loading, rather than after it: the screen leaves for Home if the
  // role turns out not to have order edit.
  const data = useDrsSheets(token, { from, to });
  const { load, replace, sheets } = data;

  const updated = useCallback(
    (sheet: DrsSheet) => {
      replace(sheet);
      void load(true);
    },
    [load, replace],
  );
  const printer = useDrsPrint();
  const scan = useDrsScan(updated);
  const orderMap = useOrderMap();
  const toast = useToast();
  const dialog = useDialog();
  // The sheet whose status update (the card's bottom block) is being saved.
  const [advancing, setAdvancing] = useState<string | null>(null);

  /**
   * Moves a sheet on to `status` after the delivery boy confirms; resolves true once saved. The
   * server notes where it was done, when the phone knows.
   */
  const advance = async (sheet: DrsSheet, status: DrsStatus) => {
    if (!token || advancing) return false;
    const resolving = status === "RESOLVED";
    const sure = await dialog.confirm({
      cancelLabel: "Not now",
      confirmLabel: resolving ? "Resolve" : "Start delivering",
      description: resolving
        ? "It can't be updated once resolved."
        : "Its orders can then be scanned and delivered.",
      details: [
        { label: "DRS ID", value: sheet.id },
        {
          highlight: true,
          label: "New status",
          value: resolving ? "Resolved" : "Out for delivery",
        },
      ],
      title: "Update DRS",
    });
    if (!sure) return false;
    setAdvancing(sheet.id);
    try {
      updated(await patchDrs(token, sheet.id, { status, ...(await lastPosition()) }));
      // Out for delivery opens its live trip (when tracking is on): Home's blocks and this
      // phone's location duty start without waiting for the socket.
      void reloadLiveTrips(token);
      haptic("success");
      toast.success("DRS updated", `${sheet.id} is now ${status.toLowerCase()}.`);
      return true;
    } catch (error) {
      haptic("error");
      toast.error("Couldn't update the DRS", errorMessage(error, "Please try again."));
      return false;
    } finally {
      setAdvancing(null);
    }
  };

  const scanOrder = (order: DrsOrder) => {
    rememberOrder(order);
    router.push({
      params: { orderId: order.orderId },
      pathname: "/orders/scan",
    });
  };

  // Tapping an order scans its parcel, then updates it. A DRS still issued is set out for
  // delivery first; an order already delivered, returned or cancelled opens its details.
  const openOrder = (order: DrsOrder) => {
    // A finished order has nothing to scan for: its details open straight away.
    if (!isPending(order)) {
      rememberOrder(order);
      router.push({
        params: { orderId: order.orderId },
        pathname: "/orders/update",
      });
      return;
    }
    if (drsOnTheRoad(order)) {
      scanOrder(order);
      return;
    }
    // Its DRS is still issued: set it out for delivery first, then scan.
    const sheet = sheets.find((item) => item.id === order.drsId);
    if (!sheet) return;
    void advance(sheet, "OUT FOR DELIVERY").then((started) => {
      if (started) scanOrder({ ...order, drsStatus: "OUT FOR DELIVERY" });
    });
  };

  // Coming back to the tab picks up deliveries made meanwhile, without a spinner.
  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!focusedBefore.current) {
        focusedBefore.current = true;
        return;
      }
      void load(true);
    }, [load]),
  );

  // The chosen DRS only narrows the orders while it is among the range's sheets.
  const activeDrsId = drsId && sheets.some((sheet) => sheet.id === drsId) ? drsId : null;

  const scopedOrders = useMemo(() => ordersFromSheets(sheets, activeDrsId), [activeDrsId, sheets]);
  // Orders still to deliver come first; delivered ones sink to the bottom.
  const orders = useMemo(
    () =>
      pendingFirst(
        scopedOrders.filter(
          (order) => matchesOrderFilter(order, orderFilter) && matchesOrderSearch(order, query),
        ),
      ),
    [orderFilter, query, scopedOrders],
  );
  const shownSheets = useMemo(
    () =>
      sheets
        .filter((sheet) => matchesDrsFilter(sheet, drsFilter) && matchesDrsSearch(sheet, query))
        // In Delivering, start with untouched runs; otherwise keep the full delivery work queue.
        .sort(drsFilter === "DELIVERING ORDERS" ? compareDeliveringDrs : compareDrsForDelivery),
    [drsFilter, query, sheets],
  );

  const openDrs = (sheet: DrsSheet) => {
    setDrsId(sheet.id);
    setOrderFilter("all");
    setQuery("");
    setTab("orders");
    listRef.current?.scrollToOffset({ animated: false, offset: 0 });
  };

  // A stat card applies the filter for what it counts; tapping it again shows everything.
  const toggleOrderFilter = (filter: OrderFilter) =>
    setOrderFilter((current) => (current === filter ? "all" : filter));
  const toggleDrsFilter = (filter: DrsFilter) =>
    setDrsFilter((current) => (current === filter ? "all" : filter));

  const changeTab = (next: PageTab) => {
    setTab(next);
    setQuery("");
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([load(true), viewer.reload()]);
    } finally {
      setRefreshing(false);
    }
  };

  if (!viewer.isLoaded)
    return (
      <TabScreen>
        <ListPageSkeleton tabs />
      </TabScreen>
    );
  if (!viewer.canUpdateOrders) return <Redirect href="/" />;

  const onOrders = tab === "orders";
  const day = range
    ? rangeLabel(range)
    : selectedDate === today
      ? "today"
      : formatDayLabel(selectedDate);
  const period = range || selectedDate !== today ? `for ${day}` : "for today";

  const header = (
    <View className="pb-3">
      <View className="flex-row items-start gap-3">
        <View className="flex-1">
          <Text className="text-2xl font-semibold leading-8 text-foreground">
            Manage Orders & DRS
          </Text>
          <Text className="mt-0.5 text-sm text-muted-foreground">
            Manage all your orders {period} at one place
          </Text>
        </View>
        {/* Home's location button: whether location is on, and a tap to fix it. */}
        {/* A little room above: the active ripple reaches 2pt past the circle, and the list's top
            edge would clip it. */}
        <View className="mt-1">
          <LocationIndicator
            onPress={location.resolve}
            state={locationIndicatorState(location, tracking)}
          />
        </View>
      </View>
      <PageTabs onChange={changeTab} value={tab} />
      <View className="mt-2 flex-row gap-3">
        {data.loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : onOrders ? (
          <>
            <StatCard
              active={orderFilter === "pending"}
              label="Pending Orders"
              onPress={() => toggleOrderFilter("pending")}
              value={String(scopedOrders.filter(isPending).length)}
            />
            <StatCard
              active={orderFilter === "delivered"}
              label="Orders Delivered"
              onPress={() => toggleOrderFilter("delivered")}
              value={String(scopedOrders.filter(isDelivered).length)}
            />
          </>
        ) : (
          <>
            <StatCard
              active={drsFilter === "ongoing"}
              label="Ongoing DRS"
              onPress={() => toggleDrsFilter("ongoing")}
              value={String(sheets.filter(isDrsOngoing).length)}
            />
            <StatCard
              active={drsFilter === "RESOLVED"}
              label="Completed DRS"
              onPress={() => toggleDrsFilter("RESOLVED")}
              value={String(sheets.filter((sheet) => !isDrsOngoing(sheet)).length)}
            />
          </>
        )}
      </View>
      {onOrders ? (
        <FilterChips
          className="mt-3"
          onChange={toggleOrderFilter}
          options={ORDER_FILTERS}
          value={orderFilter}
        />
      ) : (
        <FilterChips
          className="mt-3"
          onChange={toggleDrsFilter}
          options={DRS_FILTERS}
          value={drsFilter}
        />
      )}
      <View className="mt-3">
        <SearchRangeToolbar
          // Sheets and pickups can be issued ahead, so upcoming days can be picked.
          allowFuture
          autoCapitalize={onOrders ? "words" : "characters"}
          onQueryChange={setQuery}
          onSelectedDateClear={resetToToday}
          onRangeChange={setRange}
          query={query}
          range={range}
          searchLabel={onOrders ? "Search orders" : "Search DRS"}
          selectedDate={selectedDate === today ? null : selectedDate}
          today={today}
        />
      </View>
      {/* The DRS picker's place is held while the sheets load, so the list doesn't jump down. */}
      {!onOrders ? null : data.loading ? (
        <Skeleton className="mt-3" height={48} />
      ) : sheets.length ? (
        <DrsPicker onChange={setDrsId} sheets={sheets} value={activeDrsId} />
      ) : null}
    </View>
  );

  const searching = query.trim();
  const empty = data.loading ? (
    <CardListSkeleton />
  ) : data.failed ? (
    <EmptyBlock
      action={{ label: "Try again", onPress: () => void load() }}
      description="Check your connection and try again."
      title={onOrders ? "Couldn't load orders" : "Couldn't load DRS"}
    />
  ) : onOrders ? (
    !scopedOrders.length ? (
      <EmptyBlock
        description={
          activeDrsId
            ? `There are no orders on ${activeDrsId}.`
            : "There are no orders yet.\nGenerate a DRS to see active orders here."
        }
        title={activeDrsId ? "No orders on this DRS" : `No orders ${period}`}
      />
    ) : (
      <EmptyBlock
        description={
          searching
            ? `No order matches "${searching}".`
            : "Try another filter to see the rest of your orders."
        }
        title="No orders found"
      />
    )
  ) : !sheets.length ? (
    <EmptyBlock
      description={"There are no DRS yet.\nDRS issued to you will show here."}
      title={`No DRS ${period}`}
    />
  ) : (
    <EmptyBlock
      description={
        searching
          ? `No DRS matches "${searching}".`
          : drsFilter === "all-not-delivered"
            ? "Every delivering DRS has at least one order delivered."
            : drsFilter === "all-delivered"
              ? "No DRS has every order delivered yet."
              : "Try another filter to see the rest of your DRS."
      }
      title={
        drsFilter === "all-delivered"
          ? "No fully delivered DRS"
          : drsFilter === "all-not-delivered"
            ? "No untouched DRS"
            : "No DRS found"
      }
    />
  );

  return (
    <TabScreen>
      <FlatList<DrsOrder | DrsSheet>
        className="flex-1"
        contentContainerClassName="px-5 pb-8 pt-2"
        contentContainerStyle={{ flexGrow: 1 }}
        data={data.loading ? [] : onOrders ? orders : shownSheets}
        ItemSeparatorComponent={Separator}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => ("orderId" in item ? `order-${item.orderId}` : `drs-${item.id}`)}
        ListEmptyComponent={empty}
        ListHeaderComponent={header}
        ref={listRef}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={() => void refresh()}
            refreshing={refreshing}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) =>
          "orderId" in item ? (
            <OrderCard
              locating={orderMap.locating === item.orderId}
              onPress={() => openOrder(item)}
              onViewMap={() => void orderMap.open(item)}
              order={item}
            />
          ) : (
            <DrsCard
              advancing={advancing === item.id}
              onAdvance={(status) => void advance(item, status)}
              onOpen={() => openDrs(item)}
              onPrint={() => void printer.print(item.id)}
              onScan={() => scan.open(item)}
              printing={printer.printing === item.id}
              sheet={item}
            />
          )
        }
      />
      {scan.element}
      {orderMap.element}
    </TabScreen>
  );
}
