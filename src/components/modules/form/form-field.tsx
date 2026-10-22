import { CheckmarkCircle02Icon, CircleXIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { type ReactNode, useRef, useState } from "react";
import { ActivityIndicator, TextInput, type TextInputProps, View } from "react-native";

import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";

export type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  /** Adds the red asterisk after the label. */
  required?: boolean;
  keyboardType?: TextInputProps["keyboardType"];
  autoCapitalize?: TextInputProps["autoCapitalize"];
  maxLength?: number;
  /** A taller box that wraps, for an address. */
  multiline?: boolean;
  /** Shown in its own box at the start, such as "+91" before a mobile number. */
  prefix?: string;
  /** A unit shown in its own box at the end, such as "kg". */
  suffix?: string;
  /** Shown under the field in red, with a red border. */
  error?: string | null;
  /** Hands the input to the page's keyboard handling (`useKeyboardReveal().focusField`). */
  onFocusField?: (input: TextInput | null) => void;
  onBlur?: () => void;
  /**
   * A check of the value, as the web's lookup fields show it at the input's end: a spinner while
   * checking, then a green check or a red x circle.
   */
  status?: "checking" | "valid" | "invalid" | null;
  /** A muted line under the field, e.g. the pincode's city and state. */
  hint?: string | null;
  /** Shown right under the input, e.g. address suggestions. */
  children?: ReactNode;
};

function StatusIcon({ status }: { status: NonNullable<FormFieldProps["status"]> }) {
  return (
    <View
      accessibilityLabel={
        status === "checking" ? "Checking" : status === "valid" ? "Valid" : "Not found"
      }
      className="w-11 items-center justify-center"
    >
      {status === "checking" ? (
        <ActivityIndicator color={colors.primary} size="small" />
      ) : (
        <HugeiconsIcon
          color={status === "valid" ? colors.success : colors.destructive}
          icon={status === "valid" ? CheckmarkCircle02Icon : CircleXIcon}
          size={20}
        />
      )}
    </View>
  );
}

/**
 * A labelled form input for data entry: an optional red asterisk for a required field, a
 * placeholder, a box before (e.g. "+91") or after (e.g. "kg") the input, a check mark at the end,
 * a hint and an error line. Unlike `TextField`
 * (sign-in), it takes any keyboard and length, and can wrap over several lines.
 */
export function FormField({
  autoCapitalize = "sentences",
  children,
  error,
  hint,
  keyboardType = "default",
  label,
  maxLength,
  multiline = false,
  onBlur,
  onChangeText,
  onFocusField,
  placeholder,
  prefix,
  required = false,
  status,
  suffix,
  value,
}: FormFieldProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const border = error ? "border-destructive" : focused ? "border-primary" : "border-border";
  return (
    <View>
      <Text className="mb-2 text-base text-foreground" numberOfLines={1}>
        {label}
        {required ? <Text className="text-destructive">*</Text> : null}
      </Text>
      <View
        className={`flex-row overflow-hidden border bg-card ${multiline ? "min-h-24" : "h-12"} ${border}`}
      >
        {prefix ? (
          <View className="min-w-[60px] items-center justify-center border-border border-r bg-muted px-3">
            <Text className="text-base font-medium text-foreground">{prefix}</Text>
          </View>
        ) : null}
        <TextInput
          accessibilityLabel={label}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          className="flex-1 text-base text-foreground"
          cursorColor={colors.primary}
          importantForAutofill="no"
          keyboardType={keyboardType}
          maxLength={maxLength}
          multiline={multiline}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          onChangeText={onChangeText}
          onFocus={() => {
            setFocused(true);
            onFocusField?.(inputRef.current);
          }}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          ref={inputRef}
          returnKeyType={multiline ? "default" : "done"}
          selectionColor={colors.primary}
          style={{
            fontFamily: "Satoshi",
            paddingHorizontal: 14,
            paddingVertical: multiline ? 12 : 0,
            textAlignVertical: multiline ? "top" : "center",
          }}
          value={value}
        />
        {status ? <StatusIcon status={status} /> : null}
        {suffix ? (
          <View className="items-center justify-center border-border border-l bg-muted px-3.5">
            <Text className="text-base text-foreground">{suffix}</Text>
          </View>
        ) : null}
      </View>
      {children}
      {error ? (
        <Text className="mt-1.5 text-sm text-destructive">{error}</Text>
      ) : hint ? (
        <Text className="mt-1.5 text-sm text-muted-foreground">{hint}</Text>
      ) : null}
    </View>
  );
}
