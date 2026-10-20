import {
  Building03Icon,
  CallIcon,
  DeliveryTruck01Icon,
  FloppyDiskIcon,
  Location01Icon,
  Mail01Icon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { type ReactNode, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";

import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import { type AddressSuggestion, autocompleteAddress } from "@/lib/api/maps";
import type { Profile } from "@/lib/api/profile";

import { OrganizationSwitch } from "./organization-switch";

function DetailRow({
  border = true,
  icon,
  value,
}: {
  border?: boolean;
  icon: typeof Mail01Icon;
  value: string | null;
}) {
  return (
    <View className={`flex-row items-center gap-3 py-5 ${border ? "border-border border-b" : ""}`}>
      <HugeiconsIcon color={colors.primary} icon={icon} size={22} strokeWidth={1.8} />
      <Text className="flex-1 text-sm leading-5 text-foreground" numberOfLines={3}>
        {value?.trim() || "—"}
      </Text>
    </View>
  );
}

/** Keeps an optional Indian country prefix while limiting the local number to ten digits. */
function formatPhoneNumber(value: string) {
  if (value.trimStart().startsWith("+")) {
    const digits = value.replace(/\D/g, "");
    const localNumber = (digits.startsWith("91") ? digits.slice(2) : digits).slice(0, 10);
    return `+91${localNumber}`;
  }

  return value.replace(/\D/g, "").slice(0, 10);
}

function EditField({
  icon,
  label,
  multiline = false,
  border = true,
  children,
  keyboardType,
  maxLength,
  onChangeText,
  value,
}: {
  icon: typeof Mail01Icon;
  label: string;
  multiline?: boolean;
  border?: boolean;
  children?: ReactNode;
  keyboardType?: "default" | "phone-pad";
  maxLength?: number;
  onChangeText: (value: string) => void;
  value: string;
}) {
  return (
    <View
      className={`flex-row items-start gap-3 py-3 ${border ? "border-border border-b" : ""} ${children ? "z-20" : ""}`}
      style={children ? { elevation: 8 } : undefined}
    >
      <HugeiconsIcon color={colors.primary} icon={icon} size={22} strokeWidth={1.8} />
      <View className="relative flex-1">
        <Text className="mb-1 text-xs text-muted-foreground">{label}</Text>
        <TextInput
          className={`border border-input bg-background px-2.5 text-sm text-foreground ${multiline ? "min-h-16" : "h-10"}`}
          keyboardType={keyboardType}
          maxLength={maxLength}
          multiline={multiline}
          onChangeText={onChangeText}
          style={{
            fontFamily: "Satoshi",
            height: multiline ? 64 : 40,
            includeFontPadding: false,
            lineHeight: 20,
            paddingVertical: multiline ? 8 : 0,
            textAlignVertical: multiline ? "top" : "center",
          }}
          value={value}
        />
        {children}
      </View>
    </View>
  );
}

interface ProfileDetailsProps {
  profile: Profile | null;
  saving: boolean;
  token: string | null;
  onSave: (input: Pick<Profile, "address" | "phoneNumber">) => Promise<boolean>;
}

/** Contact details with an in-place edit mode for phone number and address. */
export function ProfileDetails({ onSave, profile, saving, token }: ProfileDetailsProps) {
  const [editing, setEditing] = useState(false);
  const [address, setAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressEdited, setAddressEdited] = useState(false);

  useEffect(() => {
    if (!editing) {
      setAddress(profile?.address ?? "");
      setPhoneNumber(profile?.phoneNumber ?? "");
    }
  }, [editing, profile?.address, profile?.phoneNumber]);

  useEffect(() => {
    if (!(editing && addressEdited && token && address.trim().length >= 3)) {
      setSuggestions([]);
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      void autocompleteAddress(address, token)
        .then((items) => {
          if (active) setSuggestions(items);
        })
        .catch(() => {
          if (active) setSuggestions([]);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [address, addressEdited, editing, token]);

  const discard = () => {
    setAddress(profile?.address ?? "");
    setPhoneNumber(profile?.phoneNumber ?? "");
    setAddressEdited(false);
    setSuggestions([]);
    setEditing(false);
  };

  const save = async () => {
    const saved = await onSave({
      address: address.trim() || null,
      phoneNumber: phoneNumber.trim() || null,
    });
    if (saved) {
      setAddressEdited(false);
      setSuggestions([]);
      setEditing(false);
    }
  };

  return (
    <View className="mt-3 border border-border bg-[#FAFBFF] px-3">
      <View className="flex-row items-center gap-3 border-border border-b py-5">
        <HugeiconsIcon color={colors.primary} icon={Building03Icon} size={22} strokeWidth={1.8} />
        <View className="flex-1">
          <Text className="text-xs text-muted-foreground">Organization</Text>
          <Text className="mt-0.5 text-sm font-medium text-foreground" numberOfLines={1}>
            {profile?.organizationName?.trim() || "—"}
          </Text>
        </View>
        <OrganizationSwitch activeId={profile?.organizationId} />
      </View>
      {profile?.vehicleNo ? (
        <View className="flex-row items-center gap-3 border-border border-b py-5">
          <HugeiconsIcon
            color={colors.primary}
            icon={DeliveryTruck01Icon}
            size={22}
            strokeWidth={1.8}
          />
          <View className="flex-1">
            <Text className="text-xs text-muted-foreground">Vehicle Number</Text>
            <Text className="mt-0.5 text-sm font-medium text-foreground" numberOfLines={1}>
              {profile.vehicleNo}
            </Text>
          </View>
        </View>
      ) : null}
      <DetailRow icon={Mail01Icon} value={profile?.email ?? null} />
      {editing ? (
        <EditField
          icon={CallIcon}
          keyboardType="phone-pad"
          label="Phone"
          maxLength={13}
          onChangeText={(value) => setPhoneNumber(formatPhoneNumber(value))}
          value={phoneNumber}
        />
      ) : (
        <DetailRow icon={CallIcon} value={profile?.phoneNumber ?? null} />
      )}
      {editing ? (
        <EditField
          border={false}
          icon={Location01Icon}
          label="Address"
          multiline
          onChangeText={(value) => {
            setAddressEdited(true);
            setAddress(value);
          }}
          value={address}
        >
          {suggestions.length ? (
            <View
              className="absolute left-0 right-0 top-full border border-border bg-background"
              style={{ elevation: 12, zIndex: 30 }}
            >
              {suggestions.slice(0, 3).map((suggestion) => (
                <Pressable
                  className="border-border border-b px-3 py-2 last:border-b-0"
                  key={suggestion.placeId}
                  onPress={() => {
                    setAddressEdited(false);
                    setAddress(suggestion.description);
                    setSuggestions([]);
                  }}
                >
                  <Text className="text-sm leading-5 text-foreground">
                    {suggestion.description}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </EditField>
      ) : (
        <DetailRow border={false} icon={Location01Icon} value={profile?.address ?? null} />
      )}
      {editing ? (
        <View className="flex-row justify-end gap-2 py-3">
          <Pressable
            accessibilityRole="button"
            className={`border border-border px-3 py-2 ${saving ? "opacity-60" : ""}`}
            disabled={saving}
            onPress={discard}
          >
            <Text className="text-sm font-medium text-foreground">Discard</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            className={`flex-row items-center gap-1.5 bg-primary px-3 py-2 ${saving ? "opacity-60" : ""}`}
            disabled={saving}
            onPress={() => void save()}
          >
            <Text className="text-sm font-medium text-primary-foreground">
              {saving ? "Saving" : "Save"}
            </Text>
            {saving ? (
              <ActivityIndicator color={colors.primaryForeground} size="small" />
            ) : (
              <HugeiconsIcon color={colors.primaryForeground} icon={FloppyDiskIcon} size={17} />
            )}
          </Pressable>
        </View>
      ) : (
        <View className="items-end py-3">
          <Pressable
            accessibilityRole="button"
            className="flex-row items-center gap-1.5 border border-primary px-3 py-2"
            onPress={() => {
              setAddress(profile?.address ?? "");
              setPhoneNumber(profile?.phoneNumber ?? "");
              setAddressEdited(false);
              setSuggestions([]);
              setEditing(true);
            }}
          >
            <Text className="text-sm font-medium text-primary">Update Details</Text>
            <HugeiconsIcon color={colors.primary} icon={PencilEdit02Icon} size={17} />
          </Pressable>
        </View>
      )}
    </View>
  );
}
