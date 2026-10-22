/** biome-ignore-all lint/correctness/useExhaustiveDependencies: <forced> */
import {
  Call02Icon,
  Cancel01Icon,
  CancelCircleIcon,
  CirclePlusIcon,
  Image01Icon,
  Location01Icon,
  PencilEdit02Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  TextInput,
  View,
} from "react-native";

import { useDialog } from "@/components/modules/dialog";
import { EmptyBlock } from "@/components/modules/empty-state";
import { TabScreen } from "@/components/modules/layout";
import { useNetwork } from "@/components/modules/network";
import { Skeleton } from "@/components/modules/skeleton";
import { Text } from "@/components/modules/typography";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/config/colors";
import { ApiError } from "@/lib/api/client";
import {
  deleteSheetLabelScan,
  listSheetLabelScans,
  type SheetLabelScan,
} from "@/lib/api/label-scan";
import { isNetworkError } from "@/lib/api/network";
import {
  type Client,
  fetchOrganizationClients,
  fetchSheetRows,
  removeSheetRow,
  type SheetOrderRow,
  type SheetOrderRows,
} from "@/lib/api/smart-sheets";
import { useAuthSession } from "@/lib/auth/session";
import { errorMessage } from "@/lib/errors";
import { haptic } from "@/lib/haptics";
import { readCache, writeCache } from "@/lib/offline/cache";

import { SheetImages } from "./components/sheet-images";
import { useSheetOrganizations } from "./hooks/use-sheet-organizations";

// The same saved lists as the client picker's, per organization.
const CLIENTS_CACHE = "sheet-clients";

/**
 * The organization's client with this client ID: from the list saved by the client picker, else
 * (or when it isn't there, a client added since) from a fresh one, saved for next time.
 */
async function findClient(token: string, organizationId: string, code: string) {
  const wanted = code.trim().toUpperCase();
  const match = (clients: Client[] | undefined) =>
    clients?.find((client) => client.orgGivenId.trim().toUpperCase() === wanted);
  const saved = match(readCache<Client[]>(CLIENTS_CACHE, organizationId)?.data);
  if (saved) return saved;
  const fresh = await fetchOrganizationClients(token, organizationId);
  writeCache(CLIENTS_CACHE, organizationId, fresh, 10);
  return match(fresh);
}

/** The client ID of the sheet's latest order that names one. */
function latestClientCode(rows: SheetOrderRow[]) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const code = rows[index]?.clientCode;
    if (code) return code;
  }
  return null;
}

// The table's narrow columns; the AWB column fits its numbers and the receiver takes the rest.
const SERIAL_WIDTH = 40;
const ACTIONS_WIDTH = 72;
const AWB_MIN_WIDTH = 84;
const AWB_MAX_WIDTH = 132;
// About one character of an AWB number at text-sm, plus the cell's padding.
const AWB_CHAR_WIDTH = 7.6;
const AWB_PADDING = 12;

/** Wide enough for the sheet's longest AWB number on one line, within limits. */
function awbColumnWidth(rows: SheetOrderRow[]) {
  const longest = rows.reduce((max, row) => Math.max(max, row.awbNo.length), 0);
  return Math.min(
    AWB_MAX_WIDTH,
    Math.max(AWB_MIN_WIDTH, Math.ceil(longest * AWB_CHAR_WIDTH) + AWB_PADDING),
  );
}

function HeaderCell({ children, className = "" }: { children: string; className?: string }) {
  return (
    <Text className={`text-sm font-medium text-foreground ${className}`} numberOfLines={1}>
      {children}
    </Text>
  );
}

function TableHeader({ actions, awbWidth }: { actions: boolean; awbWidth: number }) {
  return (
    <View className="h-12 flex-row items-center border border-[#E4E6EE] bg-[#F7F8FA] pl-1 pr-1">
      <View style={{ width: SERIAL_WIDTH }}>
        <HeaderCell className="text-center">Sl No.</HeaderCell>
      </View>
      <View className="px-1.5" style={{ width: awbWidth }}>
        <HeaderCell>AWB No.</HeaderCell>
      </View>
      <View className="min-w-0 flex-1 px-1.5">
        <HeaderCell>Receiver</HeaderCell>
      </View>
      {actions ? (
        <View style={{ width: ACTIONS_WIDTH }}>
          <HeaderCell className="text-center">Actions</HeaderCell>
        </View>
      ) : null}
    </View>
  );
}

/** One line of the receiver cell: an icon and a value that never wraps. */
function ReceiverLine({ icon, value }: { icon: typeof Call02Icon; value: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <HugeiconsIcon color={colors.mutedForeground} icon={icon} size={12} />
      <Text className="shrink text-xs text-muted-foreground" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function OrderRow({
  awbWidth,
  busy,
  canUpdate,
  onEdit,
  onRemove,
  order,
  position,
}: {
  awbWidth: number;
  busy: boolean;
  canUpdate: boolean;
  onEdit: () => void;
  onRemove: () => void;
  order: SheetOrderRow;
  position: number;
}) {
  const hasReceiver = Boolean(order.receiverName || order.receiverPhone || order.pincode);
  return (
    <View className="min-h-[68px] flex-row items-center border border-[#E4E6EE] border-t-0 bg-card py-3 pl-1 pr-1">
      <View style={{ width: SERIAL_WIDTH }}>
        <Text className="text-center text-base text-foreground">{order.serial ?? position}</Text>
      </View>
      <View className="px-1.5" style={{ width: awbWidth }}>
        {order.awbNo ? (
          <Text
            adjustsFontSizeToFit
            className="text-sm text-foreground"
            minimumFontScale={0.8}
            numberOfLines={1}
          >
            {order.awbNo}
          </Text>
        ) : (
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            —
          </Text>
        )}
      </View>
      <View className="min-w-0 flex-1 gap-1 px-1.5">
        {order.receiverName ? (
          <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
            {order.receiverName}
          </Text>
        ) : null}
        {order.receiverPhone ? (
          <ReceiverLine icon={Call02Icon} value={`91 ${order.receiverPhone}`} />
        ) : null}
        {order.pincode ? <ReceiverLine icon={Location01Icon} value={order.pincode} /> : null}
        {hasReceiver ? null : <Text className="text-sm text-muted-foreground">—</Text>}
      </View>
      {canUpdate ? (
        <View className="flex-row items-center justify-end" style={{ width: ACTIONS_WIDTH }}>
          {busy ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <>
              <Pressable
                accessibilityLabel={`Edit the order for ${order.receiverName || "this receiver"}`}
                accessibilityRole="button"
                className="h-10 w-9 items-center justify-center active:bg-accent"
                onPress={onEdit}
                onPressIn={() => haptic("light")}
              >
                <HugeiconsIcon color={colors.primary} icon={PencilEdit02Icon} size={22} />
              </Pressable>
              <Pressable
                accessibilityLabel={`Remove the order for ${order.receiverName || "this receiver"}`}
                accessibilityRole="button"
                className="h-10 w-9 items-center justify-center active:bg-[#FFF1F2]"
                onPress={onRemove}
                onPressIn={() => haptic("light")}
              >
                <HugeiconsIcon color={colors.destructive} icon={CancelCircleIcon} size={22} />
              </Pressable>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

function RowsSkeleton() {
  return (
    <View>
      {["one", "two", "three", "four"].map((key) => (
        <View
          className="min-h-[76px] flex-row items-center gap-3 border border-[#E4E6EE] border-t-0 bg-card px-4 py-3"
          key={key}
        >
          <Skeleton height={14} width={20} />
          <Skeleton height={14} width={96} />
          <View className="flex-1 gap-2">
            <Skeleton height={14} width={110} />
            <Skeleton height={10} width={90} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * One sheet's orders as a table — serial number, AWB number, receiver (name, phone, pincode) —
 * searchable by AWB number, receiver, phone or pincode. With order update in the sheet's
 * organization, each order can be edited (the Add Order form, filled in) or removed after a
 * confirmation. Coming back from an edit loads the table again.
 */
export function SheetRowsScreen() {
  const params = useLocalSearchParams<{ name: string; organizationId: string; sheetId: string }>();
  const { token } = useAuthSession();
  const { requireOnline } = useNetwork();
  const dialog = useDialog();
  const toast = useToast();
  const sheet = { id: params.sheetId, organizationId: params.organizationId };
  const [data, setData] = useState<SheetOrderRows | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [removing, setRemoving] = useState<number | null>(null);
  const [findingClient, setFindingClient] = useState(false);
  const { organizations } = useSheetOrganizations();
  // The label photos scanned for this sheet's orders, under the table as Images.
  const [scans, setScans] = useState<SheetLabelScan[]>([]);
  const [imagesOpen, setImagesOpen] = useState(false);

  const loadScans = async () => {
    if (!token) return;
    try {
      setScans(await listSheetLabelScans(token, sheet.organizationId, sheet.id));
    } catch {
      // The orders still show; Images comes back with the next load.
    }
  };

  const load = async () => {
    if (!token) return;
    void loadScans();
    setFailure(null);
    try {
      setData(await fetchSheetRows(token, sheet));
    } catch (error) {
      setFailure(
        isNetworkError(error)
          ? "Check your connection and try again."
          : errorMessage(error, "Please try again."),
      );
    }
  };
  // On opening, and again on coming back from editing an order.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [token, params.sheetId, params.organizationId]),
  );

  const shown = useMemo(() => {
    const rows = data?.rows ?? [];
    const words = query.trim().toLowerCase();
    if (!words) return rows;
    return rows.filter((order) =>
      [order.awbNo, order.receiverName, order.receiverPhone, order.pincode]
        .join(" ")
        .toLowerCase()
        .includes(words),
    );
  }, [data, query]);

  const edit = (order: SheetOrderRow) => {
    if (!data) return;
    router.push({
      params: {
        clientCode: order.clientCode,
        clientName: order.clientName,
        awbNo: order.awbNo,
        refNo: order.refNo,
        courierPartner: order.courierPartner,
        packageType: order.packageType,
        serviceType: order.serviceType,
        travelMode: order.travelMode,
        mode: "edit",
        orderDate: order.orderDate ?? "",
        organizationId: data.organizationId,
        organizationName: data.organizationName,
        pincode: order.pincode,
        receiverAddress: order.receiverAddress,
        receiverName: order.receiverName,
        receiverPhone: order.receiverPhone,
        row: String(order.row),
        sheetId: data.id,
        sheetName: data.name,
        version: String(data.version),
        volumetricWeight: order.volumetricWeight === null ? "" : String(order.volumetricWeight),
        weight: order.weight === null ? "" : String(order.weight),
      },
      pathname: "/sheet/add-order",
    });
  };

  const remove = async (order: SheetOrderRow) => {
    if (!(token && data) || removing !== null) return;
    const accepted = await dialog.confirm({
      cancelLabel: "Keep",
      confirmLabel: "Remove",
      description: `The order for ${order.receiverName || "this receiver"} will be removed from ${data.name}.`,
      details: [
        { label: "AWB Number", value: order.awbNo || "—" },
        { label: "Pincode", value: order.pincode || "—" },
      ],
      title: "Remove this order?",
      tone: "danger",
    });
    if (!(accepted && requireOnline("Removing an order"))) return;
    setRemoving(order.row);
    try {
      await removeSheetRow(token, sheet, { row: order.row, version: data.version });
      haptic("success");
      toast.success("Order removed", `It is no longer in ${data.name}.`);
    } catch (error) {
      haptic("error");
      toast.error(
        "Couldn't remove the order",
        error instanceof ApiError && error.status === 409
          ? "The sheet changed meanwhile. It has been reloaded; please try again."
          : errorMessage(error, "Please try again."),
      );
    } finally {
      setRemoving(null);
      await load();
    }
  };

  const canUpdate = data?.canUpdate ?? false;
  // Adding needs order create and the clients of the sheet's organization, as a new sheet does.
  const organization = organizations.find((item) => item.id === data?.organizationId);
  const canAdd = Boolean(data && organization?.canCreate && organization.canListClients);

  /**
   * More orders for this sheet: straight to the Add Order form for the sheet's client (the latest
   * row's), else to choosing one. Either way the orders go into this sheet.
   */
  const addNew = async () => {
    if (!(token && data) || findingClient) return;
    const sheetParams = {
      dataRows: String(data.rows.length),
      organizationId: data.organizationId,
      organizationName: data.organizationName,
      sheetId: data.id,
      sheetName: data.name,
    };
    const code = latestClientCode(data.rows);
    let client: Client | undefined;
    if (code) {
      setFindingClient(true);
      try {
        client = await findClient(token, data.organizationId, code);
      } catch {
        // Unknown here: the client list lets them pick.
      } finally {
        setFindingClient(false);
      }
    }
    if (!client) {
      router.push({ params: sheetParams, pathname: "/sheet/client" });
      return;
    }
    router.push({
      params: {
        ...sheetParams,
        clientCode: client.orgGivenId,
        clientId: client.id,
        clientName: client.name,
        mode: "append",
      },
      pathname: "/sheet/add-order",
    });
  };
  const awbWidth = useMemo(() => awbColumnWidth(data?.rows ?? []), [data]);
  const header = (
    <View>
      <Text className="text-2xl font-semibold text-foreground" numberOfLines={2}>
        {data?.name ?? params.name}
      </Text>
      <Text className="mt-0.5 text-sm text-muted-foreground">
        {data
          ? `${data.rows.length} ${data.rows.length === 1 ? "order" : "orders"} in this sheet`
          : "Orders in this sheet"}
      </Text>
      <View className="mt-5 h-12 flex-row items-center border border-border bg-card">
        <View className="pl-3">
          <HugeiconsIcon color={colors.mutedForeground} icon={Search01Icon} size={20} />
        </View>
        <TextInput
          accessibilityLabel="Search orders"
          autoCapitalize="none"
          autoCorrect={false}
          className="h-full flex-1 px-3 font-sans text-base text-foreground"
          onChangeText={setQuery}
          placeholder="Search AWB number or receiver"
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
      <View className="mt-5">
        <TableHeader actions={canUpdate} awbWidth={awbWidth} />
      </View>
    </View>
  );

  return (
    <TabScreen>
      <FlatList
        contentContainerClassName="px-5 pb-8 pt-2"
        contentContainerStyle={{ flexGrow: 1 }}
        data={shown}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(order) => String(order.row)}
        ListEmptyComponent={
          !(data || failure) ? (
            <RowsSkeleton />
          ) : (
            <View className="grow border border-[#E4E6EE] border-t-0 bg-card">
              <EmptyBlock
                action={failure ? { label: "Try again", onPress: () => void load() } : undefined}
                description={
                  failure ??
                  (query
                    ? `No order matches "${query}".`
                    : "Orders added to this sheet will show up here.")
                }
                title={failure ? "Couldn't load the orders" : "No orders yet"}
              />
            </View>
          )
        }
        ListHeaderComponent={header}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={() => {
              setRefreshing(true);
              void load().finally(() => setRefreshing(false));
            }}
            refreshing={refreshing}
            tintColor={colors.primary}
          />
        }
        renderItem={({ index, item }) => (
          <OrderRow
            awbWidth={awbWidth}
            busy={removing === item.row}
            canUpdate={canUpdate}
            onEdit={() => edit(item)}
            onRemove={() => void remove(item)}
            order={item}
            position={index + 1}
          />
        )}
      />
      {canAdd || scans.length ? (
        <View className="gap-3 px-5 pb-4 pt-2">
          {/* The sheet's label photos, just above Add New. */}
          {scans.length ? (
            <Pressable
              accessibilityLabel={`Images, ${scans.length} label photos in this sheet`}
              accessibilityRole="button"
              className="h-12 flex-row items-center justify-center gap-2 border border-primary bg-card active:bg-accent"
              onPress={() => setImagesOpen(true)}
              onPressIn={() => haptic("light")}
            >
              <Text className="text-base font-medium text-primary">Images ({scans.length})</Text>
              <HugeiconsIcon color={colors.primary} icon={Image01Icon} size={20} />
            </Pressable>
          ) : null}
          {canAdd ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: findingClient, disabled: findingClient }}
              className="h-12 flex-row items-center justify-center gap-2 bg-primary active:bg-primary-hover"
              disabled={findingClient}
              onPress={() => void addNew()}
              onPressIn={() => haptic("light")}
            >
              {findingClient ? (
                <ActivityIndicator color={colors.primaryForeground} size="small" />
              ) : (
                <>
                  <Text className="text-base font-medium text-primary-foreground">Add New</Text>
                  <HugeiconsIcon color={colors.primaryForeground} icon={CirclePlusIcon} size={20} />
                </>
              )}
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <SheetImages
        onClose={() => setImagesOpen(false)}
        onDelete={
          organization?.canDelete
            ? async (scan) => {
                if (!token) return;
                await deleteSheetLabelScan(token, sheet.organizationId, scan.id);
                const left = scans.filter((item) => item.id !== scan.id);
                setScans(left);
                // The last photo gone, the empty Images screen closes too.
                if (!left.length) setImagesOpen(false);
              }
            : undefined
        }
        scans={scans}
        sheetName={data?.name ?? params.name ?? ""}
        visible={imagesOpen}
      />
    </TabScreen>
  );
}
