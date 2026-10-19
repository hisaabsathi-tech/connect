import { useRef } from "react";
import { TextInput, View } from "react-native";

import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";

const NON_DIGIT = /\D/g;

export interface OtpFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  onFocusField?: (input: TextInput | null) => void;
  label?: string;
  length?: number;
}

/** One box per digit; typing advances, backspace steps back and a pasted code fills every box. */
export function OtpField({
  value,
  onChangeText,
  onFocusField,
  label = "Verification code",
  length = 6,
}: OtpFieldProps) {
  const inputs = useRef<Array<TextInput | null>>([]);
  const digits = Array.from({ length }, (_, index) => value[index] ?? "");

  const setDigit = (index: number, rawValue: string) => {
    const nextDigits = [...digits];
    const pasted = rawValue.replace(NON_DIGIT, "").slice(0, length - index);
    if (pasted.length > 1) {
      pasted.split("").forEach((digit, offset) => {
        nextDigits[index + offset] = digit;
      });
    } else {
      nextDigits[index] = pasted;
    }
    onChangeText(nextDigits.join(""));
    const nextIndex = Math.min(index + Math.max(pasted.length, 1), length - 1);
    if (pasted) inputs.current[nextIndex]?.focus();
  };

  return (
    <View>
      <Text className="mb-2 text-sm font-medium text-foreground">{label}</Text>
      <View className="flex-row justify-between gap-2">
        {digits.map((digit, index) => (
          <TextInput
            accessibilityLabel={`${label} digit ${index + 1}`}
            className="h-12 min-w-0 flex-1 border border-input bg-background text-center text-lg font-medium text-foreground"
            cursorColor={colors.primary}
            keyboardType="number-pad"
            key={index}
            maxLength={length}
            onChangeText={(nextValue) => setDigit(index, nextValue)}
            onFocus={() => onFocusField?.(inputs.current[index])}
            onKeyPress={({ nativeEvent }) => {
              if (nativeEvent.key === "Backspace" && !digit && index > 0) {
                inputs.current[index - 1]?.focus();
              }
            }}
            ref={(input) => {
              inputs.current[index] = input;
            }}
            returnKeyType="done"
            selectionColor={colors.primary}
            style={{ fontFamily: "Satoshi", paddingHorizontal: 0 }}
            textContentType="oneTimeCode"
            value={digit}
          />
        ))}
      </View>
    </View>
  );
}
