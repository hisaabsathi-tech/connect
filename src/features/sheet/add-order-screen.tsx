import {
  Calendar03Icon,
  CheckmarkCircle02Icon,
  CirclePlusIcon,
  Location01Icon,
  Package04Icon,
  PlusSignIcon,
  RefreshIcon,
  ShuffleIcon,
  User03Icon,
  UserIcon,
  WeightScaleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { router, useLocalSearchParams } from "expo-router";
import { type PropsWithChildren, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";

import { DateRangeSheet } from "@/components/modules/date-range";
import { FormField } from "@/components/modules/form";
import { TabScreen } from "@/components/modules/layout";
import { useNetwork } from "@/components/modules/network";
import { Text } from "@/components/modules/typography";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/config/colors";
import { KEYBOARD_GAP, useKeyboardReveal } from "@/hooks/use-keyboard-reveal";
import { ApiError } from "@/lib/api/client";
import type { AddressSuggestion } from "@/lib/api/maps";
import {
  appendSheetRow,
  createClientSheet,
  editSheetRow,
  type SheetOrderInput,
} from "@/lib/api/smart-sheets";
import { useAuthSession } from "@/lib/auth/session";
import { useDateFilter } from "@/lib/date";
import { errorMessage } from "@/lib/errors";
import { haptic } from "@/lib/haptics";
import { newActionId } from "@/lib/offline/outbox";

import { useAddressSuggestions } from "./hooks/use-address-suggestions";
import {
  clashMessage,
  type IdentifierCheck,
  useIdentifierCheck,
} from "./hooks/use-identifier-check";
import { type PincodeCheck, usePincodeCheck } from "./hooks/use-pincode-check";
import { useSheetOrganizations } from "./hooks/use-sheet-organizations";
import { formatOrderDay } from "./lib/format";

type Form = {
  /** Optional: the web fills it in otherwise. */
  awbNo: string;
  /** Optional, likewise. */
  refNo: string;
  pincode: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  weight: string;
  /** Optional: an empty one is sent as 0. */
  volumetricWeight: string;
  // Optional, and not sent: all three fill in the volumetric weight.
  length: string;
  height: string;
  width: string;
};

type Field = keyof Form;

const EMPTY_FORM: Form = {
  awbNo: "",
  height: "",
  length: "",
  pincode: "",
  refNo: "",
  receiverAddress: "",
  receiverName: "",
  receiverPhone: "",
  volumetricWeight: "",
  weight: "",
  width: "",
};

const DIMENSIONS = ["length", "height", "width"] as const;
// Rows of equal columns, split by percentage so a column's label or value can't widen it; each
// column pads half the gap and the row pulls out by as much.
const COLUMNS_GAP = 12;
const COLUMNS_ROW = { flexDirection: "row", marginHorizontal: -COLUMNS_GAP / 2 } as const;
const HALF = { paddingHorizontal: COLUMNS_GAP / 2, width: "50%" } as const;
const THIRD = { paddingHorizontal: COLUMNS_GAP / 2, width: "33.3333%" } as const;
const WEIGHT = /^\d{1,6}(\.\d{1,3})?$/;
// Letters, digits and dashes, up to 64: what the server and the web's duplicate check accept.
const AWB = /^[A-Za-z0-9-]{1,64}$/;
// Cubic cm per kg of volumetric weight, as the web works it out.
const VOLUMETRIC_DIVISOR = 5000;
// The most the server takes for either weight, in kg.
const WEIGHT_MAX = 100_000;
const AWB_MAX_LENGTH = 64;
// What the server and the web's duplicate check accept for a reference number.
const REF_MAX_LENGTH = 120;

/** An edited order's AWB and reference numbers as the sheet has them (null when adding). */
type Kept = { awbNo: string | null; refNo: string | null };

/** The live checks of the AWB and reference numbers. */
type Checks = { awbNo: IdentifierCheck; refNo: IdentifierCheck };

/** The 10 digits of an Indian mobile number, without spaces or a +91 / 0 prefix. */
function mobileDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

/** What is wrong with a weight as typed, if anything; an optional one may be left empty. */
function weightError(value: string, required: boolean) {
  if (!(value || required)) return undefined;
  if (Number(value) > WEIGHT_MAX) return `Can't be more than ${WEIGHT_MAX} kg`;
  return WEIGHT.test(value) ? undefined : "Enter the weight in kg";
}

/** `value` rounded to `scale` steps (100 for 0.01), as the web rounds it. */
function roundTo(value: number, scale: number) {
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

/**
 * The volumetric weight the three sides give, once all are entered: length × height × width in cm
 * (each to 0.01 cm) over 5000, in kg to the gram, as the web works it out. Null till then.
 */
function volumetricFrom(form: Form) {
  const sides = DIMENSIONS.map((side) => form[side].trim());
  if (!sides.every((side) => WEIGHT.test(side))) return null;
  const volume = sides.reduce((product, side) => product * roundTo(Number(side), 100), 1);
  return volume ? String(roundTo(volume / VOLUMETRIC_DIVISOR, 1000)) : null;
}

/**
 * The form after a side changed from `before`: its volumetric weight filled in from the sides, or
 * cleared once they no longer give one if they had filled it in. One typed in stays.
 */
function withVolumetric(form: Form, before: Form): Form {
  const volumetric = volumetricFrom(form);
  if (volumetric !== null) return { ...form, volumetricWeight: volumetric };
  return form.volumetricWeight === volumetricFrom(before)
    ? { ...form, volumetricWeight: "" }
    : form;
}

/** A well-formed AWB number, or one kept as the sheet has it (which isn't checked again). */
function awbFormatError(awbNo: string, kept: string | null) {
  const value = awbNo.trim();
  if (!value || value === kept || AWB.test(value)) return null;
  return "Use only letters, digits and dashes";
}

/**
 * What is wrong with each field, if anything. `pincode` is the postal check of the pincode,
 * `checks` the duplicate checks of the AWB and reference numbers, and `kept` an edited order's
 * numbers as the sheet has them, which aren't checked again.
 */
function validate(
  form: Form,
  pincode: PincodeCheck,
  kept: Kept,
  checks: Checks,
): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  const awbFormat = awbFormatError(form.awbNo, kept.awbNo);
  if (awbFormat) errors.awbNo = awbFormat;
  else if (checks.awbNo.status === "invalid")
    errors.awbNo = clashMessage("awbNo", checks.awbNo.clash) ?? undefined;
  if (checks.refNo.status === "invalid")
    errors.refNo = clashMessage("refNo", checks.refNo.clash) ?? undefined;
  if (!/^\d{6}$/.test(form.pincode.trim())) errors.pincode = "Enter a 6 digit pincode";
  else if (pincode.status === "invalid") errors.pincode = "This pincode doesn't exist";
  if (!form.receiverName.trim()) errors.receiverName = "Enter the receiver's name";
  if (!/^\d{10}$/.test(mobileDigits(form.receiverPhone)))
    errors.receiverPhone = "Enter a 10 digit mobile number";
  if (!form.receiverAddress.trim()) errors.receiverAddress = "Enter the delivery address";
  const weight = form.weight.trim();
  const volumetric = form.volumetricWeight.trim();
  errors.weight = weightError(weight, true);
  errors.volumetricWeight = weightError(volumetric, false);
  // An empty volumetric weight counts as 0.
  if (!(errors.weight || errors.volumetricWeight) && Number(weight) + Number(volumetric) === 0)
    errors.weight = "Both weights can't be 0";
  for (const side of DIMENSIONS) {
    const value = form[side].trim();
    if (value && !WEIGHT.test(value)) errors[side] = "Enter a number";
  }
  return errors;
}

/** A bordered group of the form, headed by an icon tile and a title. */
function Section({
  children,
  icon,
  title,
}: PropsWithChildren<{ icon: typeof Package04Icon; title: string }>) {
  return (
    <View className="mt-5 border border-[#E4E6EE] bg-card p-4">
      <View className="flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center bg-accent">
          <HugeiconsIcon color={colors.primary} icon={icon} size={18} strokeWidth={1.8} />
        </View>
        <Text className="text-lg text-foreground">{title}</Text>
      </View>
      <View className="mt-5 gap-5">{children}</View>
    </View>
  );
}

type Params = {
  clientCode: string;
  clientId: string;
  clientName: string;
  organizationId: string;
  organizationName: string;
  /**
   * "edit": change one order of a sheet (`sheetId`, `row`, `version`) instead of adding.
   * "append": add orders to an existing sheet (`sheetId`, `sheetName`, its `dataRows`) instead of
   * starting one.
   */
  mode?: string;
  sheetId?: string;
  sheetName?: string;
  dataRows?: string;
  row?: string;
  version?: string;
  // The order being edited, as its table read it.
  awbNo?: string;
  refNo?: string;
  orderDate?: string;
  pincode?: string;
  receiverName?: string;
  receiverPhone?: string;
  receiverAddress?: string;
  weight?: string;
  volumetricWeight?: string;
};

/** The order being edited, from the table's params. */
function formFrom(params: Params): Form {
  return {
    awbNo: params.awbNo ?? "",
    height: "",
    length: "",
    pincode: params.pincode ?? "",
    refNo: params.refNo ?? "",
    receiverAddress: params.receiverAddress ?? "",
    receiverName: params.receiverName ?? "",
    receiverPhone: mobileDigits(params.receiverPhone ?? "").slice(0, 10),
    volumetricWeight: params.volumetricWeight ?? "",
    weight: params.weight ?? "",
    width: "",
  };
}

/**
 * Adding orders for one client to a new Smart Sheet, one at a time. The first save starts the
 * sheet in the client's organization, named after the client and today; each save writes the
 * order as a row of that sheet, which anyone with it open on the web sees at once, then clears
 * the form for the next. The chip counts the sheet's shipments. Change goes back to pick another
 * client, which starts another sheet.
 *
 * Opened from a sheet's table to edit one order, the form comes filled in and Update & Save
 * changes that row; the page stays on the saved details, and back returns to the table. Opened
 * from its Add New, the orders go into that sheet instead of a new one, and Change picks another
 * client for the same sheet.
 */
export function AddOrderScreen() {
  const params = useLocalSearchParams<Params>();
  const editing = params.mode === "edit" && Boolean(params.sheetId && params.row);
  const appending = params.mode === "append" && Boolean(params.sheetId);
  const { token } = useAuthSession();
  const { requireOnline } = useNetwork();
  const toast = useToast();
  const keyboard = useKeyboardReveal();
  const { today } = useDateFilter();
  const { organizations } = useSheetOrganizations();
  const [orderDate, setOrderDate] = useState(() => (editing && params.orderDate) || today);
  const [dateOpen, setDateOpen] = useState(false);
  const [form, setForm] = useState<Form>(() => (editing ? formFrom(params) : EMPTY_FORM));
  // What Reset (or a pull to refresh) goes back to: an empty form, or an edited order as last
  // saved, with its date.
  const resetTo = useRef({ form, orderDate });
  // The sheet version an edit is made on; each saved edit moves it on.
  const [version, setVersion] = useState(() => Number(params.version ?? 0));
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [saving, setSaving] = useState(false);
  // The sheet this visit fills: the one opened from its table, else the one the first order
  // starts.
  const [sheet, setSheet] = useState<{ id: string; name: string } | null>(() =>
    appending ? { id: params.sheetId ?? "", name: params.sheetName ?? "" } : null,
  );
  const [shipments, setShipments] = useState(() =>
    appending ? Number(params.dataRows ?? 0) || 0 : 0,
  );

  // Another client: for a sheet opened from its table, picked for that same sheet; else back to
  // the client list, which starts a new sheet.
  const changeClient = () => {
    if (!(appending && sheet)) {
      router.back();
      return;
    }
    router.replace({
      params: {
        dataRows: String(shipments),
        organizationId: params.organizationId,
        sheetId: sheet.id,
        sheetName: sheet.name,
      },
      pathname: "/sheet/client",
    });
  };
  // The id of an order whose save didn't come back: resending it can't add it twice.
  const pendingActionId = useRef<string | null>(null);
  const pincode = usePincodeCheck(token, form.pincode);
  // An edited order's numbers as the sheet has them; kept as they are, they aren't sent or
  // checked again.
  const kept: Kept = {
    awbNo: editing ? (params.awbNo ?? "").trim() : null,
    refNo: editing ? (params.refNo ?? "").trim() : null,
  };
  // Checked against the orders and this sheet: the one opened or started, else none yet.
  const checkIn = {
    organizationId: params.organizationId,
    row: editing ? Number(params.row) : undefined,
    sheetId: sheet?.id ?? params.sheetId,
    token,
  };
  const checks: Checks = {
    awbNo: useIdentifierCheck({
      ...checkIn,
      field: "awbNo",
      skip: form.awbNo.trim() === kept.awbNo || awbFormatError(form.awbNo, kept.awbNo) !== null,
      value: form.awbNo,
    }),
    refNo: useIdentifierCheck({
      ...checkIn,
      field: "refNo",
      skip: form.refNo.trim() === kept.refNo,
      value: form.refNo,
    }),
  };
  // Suggestions follow typing in the address; a pick (or leaving the field) puts them away.
  const [addressTyped, setAddressTyped] = useState(false);
  const suggestions = useAddressSuggestions(token, form.receiverAddress, addressTyped);

  const update = (field: Field) => (value: string) => {
    // Changed details are a different order from the one that may have been saved.
    pendingActionId.current = null;
    setForm((current) => {
      const next = { ...current, [field]: value };
      return (DIMENSIONS as readonly Field[]).includes(field)
        ? withVolumetric(next, current)
        : next;
    });
    // A filled-in volumetric weight is a new one, so its old error goes too.
    const cleared: Field[] = (DIMENSIONS as readonly Field[]).includes(field)
      ? [field, "volumetricWeight"]
      : [field];
    if (cleared.some((name) => errors[name]))
      setErrors((current) => ({
        ...current,
        ...Object.fromEntries(cleared.map((name) => [name, undefined])),
      }));
  };

  const reset = () => {
    pendingActionId.current = null;
    setForm(resetTo.current.form);
    if (editing) setOrderDate(resetTo.current.orderDate);
    setErrors({});
    setAddressTyped(false);
  };

  const pickSuggestion = (suggestion: AddressSuggestion) => {
    haptic("selection");
    setAddressTyped(false);
    update("receiverAddress")(suggestion.description);
    // The place's pincode fills an empty pincode, as the web's address field does.
    const placePincode = suggestion.description.match(/\b\d{6}\b/)?.[0];
    if (placePincode && !form.pincode.trim()) update("pincode")(placePincode);
  };

  const save = async () => {
    if (saving || !token) return;
    const found = validate(form, pincode, kept, checks);
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      haptic("error");
      return;
    }
    if (!requireOnline(editing ? "Updating the order" : "Saving an order")) return;
    const awbNo = form.awbNo.trim().toUpperCase();
    const refNo = form.refNo.trim();
    // A new order sends a number only when entered. An edit sends a changed one, empty to clear
    // it, and leaves out one kept as it was, so the sheet's cell stays exactly as the web wrote
    // it.
    const send = (value: string, keptValue: string | null) =>
      editing ? value !== keptValue : Boolean(value);
    const order: SheetOrderInput = {
      ...(send(form.awbNo.trim(), kept.awbNo) ? { awbNo } : {}),
      ...(send(refNo, kept.refNo) ? { refNo } : {}),
      clientId: params.clientId,
      orderDate,
      pincode: form.pincode.trim(),
      receiverAddress: form.receiverAddress.trim(),
      receiverName: form.receiverName.trim(),
      receiverPhone: mobileDigits(form.receiverPhone),
      volumetricWeight: Number(form.volumetricWeight.trim() || 0),
      weight: Number(form.weight),
    };
    setSaving(true);
    if (editing) {
      try {
        const { clientId: _client, ...details } = order;
        const saved = await editSheetRow(
          token,
          { id: params.sheetId ?? "", organizationId: params.organizationId },
          { row: Number(params.row), version },
          details,
        );
        // Further edits here are made on the version this one saved, and Reset comes back to it.
        setVersion(saved.version);
        resetTo.current = { form, orderDate };
        setAddressTyped(false);
        haptic("success");
        toast.success("Order updated", "The sheet shows the new details.");
      } catch (error) {
        haptic("error");
        toast.error(
          "Couldn't update the order",
          error instanceof ApiError && error.status === 409
            ? "The sheet changed meanwhile. Go back and open the order again."
            : errorMessage(error, "Please try again."),
        );
      } finally {
        setSaving(false);
      }
      return;
    }
    try {
      let target = sheet;
      if (!target) {
        const created = await createClientSheet(token, params.organizationId, params.clientId);
        target = { id: created.id, name: created.name };
        setSheet(target);
      }
      const actionId = pendingActionId.current ?? newActionId();
      pendingActionId.current = actionId;
      const saved = await appendSheetRow(
        token,
        { id: target.id, organizationId: params.organizationId },
        actionId,
        order,
      );
      pendingActionId.current = null;
      setShipments(saved.dataRows);
      setForm(EMPTY_FORM);
      setAddressTyped(false);
      haptic("success");
      toast.success("Order saved", `Added to ${saved.name}. Fill in the next one.`);
      keyboard.scrollRef.current?.scrollTo({ animated: true, y: 0 });
    } catch (error) {
      haptic("error");
      toast.error("Couldn't save the order", errorMessage(error, "Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const field = (name: Field) => ({
    error: errors[name],
    onChangeText: update(name),
    onFocusField: keyboard.focusField,
    value: form[name],
  });

  return (
    <TabScreen>
      <View className="flex-1" onLayout={keyboard.onViewportLayout} ref={keyboard.viewportRef}>
        <ScrollView
          contentContainerClassName="px-5 pt-2"
          contentContainerStyle={{
            paddingBottom: keyboard.keyboardVisible
              ? keyboard.keyboardInset + KEYBOARD_GAP * 2
              : 32,
          }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onScroll={keyboard.onScroll}
          ref={keyboard.scrollRef}
          refreshControl={
            <RefreshControl
              colors={[colors.primary]}
              onRefresh={() => {
                if (saving) return;
                haptic("light");
                reset();
              }}
              refreshing={false}
              tintColor={colors.primary}
            />
          }
          scrollEventThrottle={16}
        >
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-2xl font-semibold text-foreground">
                {editing ? "Update Order" : "Add Order"}
              </Text>
              <Text className="mt-0.5 text-sm text-muted-foreground">
                {editing ? "Change the details below" : "Fill the details below"}
              </Text>
            </View>
            {editing ? null : (
              <View
                accessibilityLabel={`${shipments} shipments in this sheet`}
                className="mt-1 h-9 justify-center border border-primary bg-accent px-3"
              >
                <Text className="text-sm font-semibold text-primary">
                  {shipments} {shipments === 1 ? "Shipment" : "Shipments"}
                </Text>
              </View>
            )}
          </View>

          <View className="mt-5 flex-row items-center gap-3 border border-[#EEF0F6] bg-white p-4">
            <View className="flex-1">
              <Text className="text-lg text-foreground" numberOfLines={2}>
                {params.clientName}
              </Text>
              <Text className="mt-1 text-sm text-muted-foreground" numberOfLines={1}>
                Client ID: {params.clientCode}
              </Text>
              {organizations.length > 1 ? (
                <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
                  {params.organizationName}
                </Text>
              ) : null}
            </View>
            {/* An edited order keeps its client. */}
            {editing ? null : (
              <Pressable
                accessibilityLabel="Change client"
                accessibilityRole="button"
                className="h-10 flex-row items-center gap-2 bg-primary px-4 active:bg-primary-hover"
                disabled={saving}
                onPress={changeClient}
                onPressIn={() => haptic("light")}
              >
                <Text className="text-sm font-medium text-primary-foreground">Change</Text>
                <HugeiconsIcon color={colors.primaryForeground} icon={ShuffleIcon} size={16} />
              </Pressable>
            )}
          </View>

          <Section icon={Package04Icon} title="Shipment Details">
            <View>
              <Text className="mb-2 text-base text-foreground">
                Order Date<Text className="text-destructive">*</Text>
              </Text>
              <Pressable
                accessibilityLabel={`Order date, ${formatOrderDay(orderDate)}. Change date`}
                accessibilityRole="button"
                className="h-12 flex-row items-center border border-border bg-card px-3.5"
                onPress={() => setDateOpen(true)}
                onPressIn={() => haptic("light")}
              >
                <Text className="flex-1 text-base text-foreground">
                  {formatOrderDay(orderDate)}
                </Text>
                <HugeiconsIcon
                  color={colors.mutedForeground}
                  icon={Calendar03Icon}
                  size={22}
                  strokeWidth={1.6}
                />
              </Pressable>
            </View>
            <FormField
              {...field("awbNo")}
              autoCapitalize="characters"
              // Wrong as typed, or already taken: said at once, as the pincode is.
              error={
                errors.awbNo ??
                awbFormatError(form.awbNo, kept.awbNo) ??
                clashMessage("awbNo", checks.awbNo.clash)
              }
              label="AWB No"
              maxLength={AWB_MAX_LENGTH}
              // Upper case and no spaces, as AWB numbers are written; the scanner's paste too.
              onChangeText={(value) => update("awbNo")(value.replace(/\s+/g, "").toUpperCase())}
              placeholder="Enter AWB number"
              status={checks.awbNo.status}
            />
            <FormField
              {...field("refNo")}
              autoCapitalize="none"
              error={errors.refNo ?? clashMessage("refNo", checks.refNo.clash)}
              label="Reference No"
              maxLength={REF_MAX_LENGTH}
              placeholder="Enter reference number"
              status={checks.refNo.status}
            />
            <FormField
              {...field("pincode")}
              hint={
                pincode.place
                  ? [pincode.place.city, pincode.place.state].filter(Boolean).join(", ")
                  : pincode.status === "invalid"
                    ? "No post office has this pincode"
                    : null
              }
              keyboardType="number-pad"
              label="Destination Pincode"
              maxLength={6}
              placeholder="Enter 6 digit pincode"
              required
              status={pincode.status}
            />
          </Section>

          <Section icon={UserIcon} title="Receiver Details">
            <FormField
              {...field("receiverName")}
              autoCapitalize="words"
              label="Receiver Name"
              maxLength={120}
              placeholder="Enter receiver's name"
              required
            />
            <FormField
              {...field("receiverPhone")}
              keyboardType="number-pad"
              label="Phone Number"
              // Only the 10 digits after +91: a pasted "+91 98765 43210" or "098765…" is trimmed.
              onChangeText={(value) => update("receiverPhone")(mobileDigits(value).slice(0, 10))}
              placeholder="Enter 10 digit mobile number"
              prefix="+91"
              required
            />
            <FormField
              {...field("receiverAddress")}
              label="Delivery Address"
              maxLength={500}
              multiline
              // A moment's grace, so tapping a suggestion lands before the list goes.
              onBlur={() => setTimeout(() => setAddressTyped(false), 200)}
              onChangeText={(value) => {
                setAddressTyped(true);
                update("receiverAddress")(value);
              }}
              placeholder="Enter complete delivery address"
              required
            >
              {suggestions.length ? (
                <View className="border border-border border-t-0 bg-card">
                  {suggestions.slice(0, 4).map((suggestion) => (
                    <Pressable
                      accessibilityRole="button"
                      className="flex-row items-start gap-2.5 border-border border-b px-3 py-2.5 active:bg-accent"
                      key={suggestion.placeId}
                      onPress={() => pickSuggestion(suggestion)}
                    >
                      <View className="pt-0.5">
                        <HugeiconsIcon color={colors.primary} icon={Location01Icon} size={16} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
                          {suggestion.primary ?? suggestion.description}
                        </Text>
                        {suggestion.secondary ? (
                          <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={2}>
                            {suggestion.secondary}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </FormField>
          </Section>

          <Section icon={WeightScaleIcon} title="Package">
            <View style={COLUMNS_ROW}>
              {DIMENSIONS.map((side) => (
                <View key={side} style={THIRD}>
                  <FormField
                    {...field(side)}
                    keyboardType="decimal-pad"
                    label={`${side[0].toUpperCase()}${side.slice(1)} (cm)`}
                    maxLength={10}
                    placeholder="0"
                  />
                </View>
              ))}
            </View>
            <View style={COLUMNS_ROW}>
              <View style={HALF}>
                <FormField
                  {...field("weight")}
                  keyboardType="decimal-pad"
                  label="Actual Weight"
                  maxLength={10}
                  placeholder="0.00"
                  required
                  suffix="kg"
                />
              </View>
              <View style={HALF}>
                <FormField
                  {...field("volumetricWeight")}
                  keyboardType="decimal-pad"
                  label="Volumetric Weight"
                  maxLength={10}
                  placeholder="0.00"
                  suffix="kg"
                />
              </View>
            </View>
          </Section>

          <View className="mt-6 flex-row gap-3">
            <Pressable
              accessibilityLabel="Reset the form"
              accessibilityRole="button"
              accessibilityState={{ disabled: saving }}
              className="h-12 flex-row items-center justify-center gap-1.5 border border-primary bg-card px-4 active:bg-accent"
              disabled={saving}
              onPress={reset}
              onPressIn={() => haptic("light")}
            >
              <HugeiconsIcon color={colors.primary} icon={RefreshIcon} size={18} />
              <Text className="text-base font-medium text-primary">Reset</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: saving, disabled: saving }}
              className="h-12 flex-1 flex-row items-center justify-center gap-2 bg-primary active:bg-primary-hover"
              disabled={saving}
              onPress={() => void save()}
            >
              {saving ? (
                <ActivityIndicator color={colors.primaryForeground} size="small" />
              ) : (
                <>
                  <Text className="text-base font-medium text-primary-foreground" numberOfLines={1}>
                    {editing ? "Update & Save" : "Save & Add another order"}
                  </Text>
                  <HugeiconsIcon
                    color={colors.primaryForeground}
                    icon={editing ? CheckmarkCircle02Icon : CirclePlusIcon}
                    size={20}
                  />
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </View>
      <DateRangeSheet
        allowFuture
        onApply={(range) => {
          setDateOpen(false);
          setOrderDate(range.from);
        }}
        onClose={() => setDateOpen(false)}
        range={{ from: orderDate, to: orderDate }}
        single
        today={today}
        visible={dateOpen}
      />
    </TabScreen>
  );
}
