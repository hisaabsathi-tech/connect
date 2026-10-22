import {
  Calendar03Icon,
  CirclePlusIcon,
  Location01Icon,
  Package04Icon,
  PlusSignIcon,
  ShuffleIcon,
  User03Icon,
  UserIcon,
  WeightScaleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { router, useLocalSearchParams } from "expo-router";
import { type PropsWithChildren, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";

import { DateRangeSheet } from "@/components/modules/date-range";
import { FormField } from "@/components/modules/form";
import { TabScreen } from "@/components/modules/layout";
import { useNetwork } from "@/components/modules/network";
import { Text } from "@/components/modules/typography";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/config/colors";
import { KEYBOARD_GAP, useKeyboardReveal } from "@/hooks/use-keyboard-reveal";
import type { AddressSuggestion } from "@/lib/api/maps";
import { appendSheetRow, createClientSheet, type SheetOrderInput } from "@/lib/api/smart-sheets";
import { useAuthSession } from "@/lib/auth/session";
import { useDateFilter } from "@/lib/date";
import { errorMessage } from "@/lib/errors";
import { haptic } from "@/lib/haptics";
import { newActionId } from "@/lib/offline/outbox";

import { useAddressSuggestions } from "./hooks/use-address-suggestions";
import { type PincodeCheck, usePincodeCheck } from "./hooks/use-pincode-check";
import { useSheetOrganizations } from "./hooks/use-sheet-organizations";
import { formatOrderDay } from "./lib/format";

type Form = {
  pincode: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  weight: string;
  volumetricWeight: string;
};

type Field = keyof Form;

const EMPTY_FORM: Form = {
  pincode: "",
  receiverAddress: "",
  receiverName: "",
  receiverPhone: "",
  volumetricWeight: "",
  weight: "",
};

const WEIGHT = /^\d{1,6}(\.\d{1,3})?$/;

/** The 10 digits of an Indian mobile number, without spaces or a +91 / 0 prefix. */
function mobileDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

/** What is wrong with each field, if anything. `pincode` is the postal check of the pincode. */
function validate(form: Form, pincode: PincodeCheck): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  if (!/^\d{6}$/.test(form.pincode.trim())) errors.pincode = "Enter a 6 digit pincode";
  else if (pincode.status === "invalid") errors.pincode = "This pincode doesn't exist";
  if (!form.receiverName.trim()) errors.receiverName = "Enter the receiver's name";
  if (!/^\d{10}$/.test(mobileDigits(form.receiverPhone)))
    errors.receiverPhone = "Enter a 10 digit mobile number";
  if (!form.receiverAddress.trim()) errors.receiverAddress = "Enter the delivery address";
  const weight = form.weight.trim();
  const volumetric = form.volumetricWeight.trim();
  if (!WEIGHT.test(weight)) errors.weight = "Enter the weight in kg";
  if (!WEIGHT.test(volumetric)) errors.volumetricWeight = "Enter the weight in kg";
  if (!(errors.weight || errors.volumetricWeight) && Number(weight) + Number(volumetric) === 0)
    errors.weight = "Both weights can't be 0";
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

/**
 * Adding orders for one client to a new Smart Sheet, one at a time. The first save starts the
 * sheet in the client's organization, named after the client and today; each save writes the
 * order as a row of that sheet, which anyone with it open on the web sees at once, then clears
 * the form for the next. The chip counts the sheet's shipments. Change goes back to pick another
 * client, which starts another sheet.
 */
export function AddOrderScreen() {
  const params = useLocalSearchParams<{
    clientCode: string;
    clientId: string;
    clientName: string;
    organizationId: string;
    organizationName: string;
  }>();
  const { token } = useAuthSession();
  const { requireOnline } = useNetwork();
  const toast = useToast();
  const keyboard = useKeyboardReveal();
  const { today } = useDateFilter();
  const { organizations } = useSheetOrganizations();
  const [orderDate, setOrderDate] = useState(today);
  const [dateOpen, setDateOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [saving, setSaving] = useState(false);
  // The sheet this visit fills, once the first order started it.
  const [sheet, setSheet] = useState<{ id: string; name: string } | null>(null);
  const [shipments, setShipments] = useState(0);
  // The id of an order whose save didn't come back: resending it can't add it twice.
  const pendingActionId = useRef<string | null>(null);
  const pincode = usePincodeCheck(token, form.pincode);
  // Suggestions follow typing in the address; a pick (or leaving the field) puts them away.
  const [addressTyped, setAddressTyped] = useState(false);
  const suggestions = useAddressSuggestions(token, form.receiverAddress, addressTyped);

  const update = (field: Field) => (value: string) => {
    // Changed details are a different order from the one that may have been saved.
    pendingActionId.current = null;
    setForm((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
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
    const found = validate(form, pincode);
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      haptic("error");
      return;
    }
    if (!requireOnline("Saving an order")) return;
    const order: SheetOrderInput = {
      clientId: params.clientId,
      orderDate,
      pincode: form.pincode.trim(),
      receiverAddress: form.receiverAddress.trim(),
      receiverName: form.receiverName.trim(),
      receiverPhone: mobileDigits(form.receiverPhone),
      volumetricWeight: Number(form.volumetricWeight),
      weight: Number(form.weight),
    };
    setSaving(true);
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
          scrollEventThrottle={16}
        >
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-2xl font-semibold text-foreground">Add Order</Text>
              <Text className="mt-0.5 text-sm text-muted-foreground">Fill the details below</Text>
            </View>
            <View
              accessibilityLabel={`${shipments} shipments in this sheet`}
              className="mt-1 h-9 justify-center border border-primary bg-accent px-3"
            >
              <Text className="text-sm font-semibold text-primary">
                {shipments} {shipments === 1 ? "Shipment" : "Shipments"}
              </Text>
            </View>
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
            <Pressable
              accessibilityLabel="Change client"
              accessibilityRole="button"
              className="h-10 flex-row items-center gap-2 bg-primary px-4 active:bg-primary-hover"
              disabled={saving}
              onPress={() => router.back()}
              onPressIn={() => haptic("light")}
            >
              <Text className="text-sm font-medium text-primary-foreground">Change</Text>
              <HugeiconsIcon color={colors.primaryForeground} icon={ShuffleIcon} size={16} />
            </Pressable>
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

          <Section icon={WeightScaleIcon} title="Package Weight">
            <View className="flex-row gap-4">
              <View className="flex-1">
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
              <View className="flex-1">
                <FormField
                  {...field("volumetricWeight")}
                  keyboardType="decimal-pad"
                  label="Volumetric Weight"
                  maxLength={10}
                  placeholder="0.00"
                  required
                  suffix="kg"
                />
              </View>
            </View>
          </Section>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: saving, disabled: saving }}
            className="mt-6 h-12 flex-row items-center justify-center gap-2 bg-primary active:bg-primary-hover"
            disabled={saving}
            onPress={() => void save()}
          >
            {saving ? (
              <ActivityIndicator color={colors.primaryForeground} size="small" />
            ) : (
              <>
                <Text className="text-base font-medium text-primary-foreground">
                  Save & Add another order
                </Text>
                <HugeiconsIcon color={colors.primaryForeground} icon={CirclePlusIcon} size={20} />
              </>
            )}
          </Pressable>
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
