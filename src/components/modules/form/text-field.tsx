import { CancelCircleIcon, ViewIcon, ViewOffIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";

export interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secure?: boolean;
  /** Show a secure value initially; useful when users need to review a newly chosen password. */
  visibleByDefault?: boolean;
  type?: "default" | "email-address" | "number-pad";
  complete?: "email" | "password" | "one-time-code";
  onFocusField?: (input: TextInput | null) => void;
  onSubmitEditing?: () => void;
}

const contentTypes = {
  email: "emailAddress",
  "one-time-code": "oneTimeCode",
  password: "password",
} as const;

/**
 * Labelled input. Email fields get a clear button and secure fields a show/hide toggle;
 * `number-pad` fields are capped at six digits for one-time codes.
 */
export function TextField({
  label,
  value,
  onChangeText,
  secure,
  visibleByDefault = false,
  type = "default",
  complete,
  onFocusField,
  onSubmitEditing,
}: TextFieldProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const [showValue, setShowValue] = useState(visibleByDefault);
  const numeric = type === "number-pad";
  const hasClearButton = type === "email-address" && Boolean(value);
  return (
    <View>
      <Text className="mb-2 text-sm font-medium text-foreground">{label}</Text>
      <View
        className={`h-12 overflow-hidden border bg-background ${focused ? "border-primary" : "border-input"}`}
      >
        <TextInput
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect={false}
          className="h-full flex-1 px-3 text-base text-foreground"
          clearButtonMode="never"
          // Android paints its own yellow autofill overlay across an input. Keep
          // the field surface app-controlled; paste still works normally.
          importantForAutofill="no"
          keyboardType={type}
          maxLength={numeric ? 6 : undefined}
          onChangeText={onChangeText}
          onFocus={() => {
            setFocused(true);
            onFocusField?.(inputRef.current);
          }}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmitEditing}
          ref={inputRef}
          returnKeyType={numeric ? "done" : complete === "email" ? "next" : "done"}
          cursorColor={colors.primary}
          secureTextEntry={secure && !showValue}
          selectionColor={colors.primary}
          style={{
            fontFamily: "Satoshi",
            paddingLeft: 14,
            paddingRight: hasClearButton || secure ? 48 : 14,
          }}
          textContentType={complete ? contentTypes[complete] : "none"}
          value={value}
        />
        {hasClearButton ? (
          <Pressable
            accessibilityLabel="Clear email address"
            className="absolute right-0 top-0 h-12 w-12 items-center justify-center"
            hitSlop={8}
            onPress={() => {
              onChangeText("");
              inputRef.current?.focus();
            }}
          >
            <HugeiconsIcon
              color={colors.destructive}
              icon={CancelCircleIcon}
              size={19}
              strokeWidth={2}
            />
          </Pressable>
        ) : secure ? (
          <Pressable
            accessibilityLabel={showValue ? "Hide password" : "Show password"}
            className="absolute right-0 top-0 h-12 w-12 items-center justify-center"
            hitSlop={8}
            onPress={() => setShowValue((current) => !current)}
          >
            <HugeiconsIcon
              color={colors.mutedForeground}
              icon={showValue ? ViewIcon : ViewOffIcon}
              size={21}
              strokeWidth={1.8}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
