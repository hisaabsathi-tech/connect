import { View } from "react-native";

import { ActionButton, TextButton } from "@/components/modules/button";
import { OtpField } from "@/components/modules/form";
import { OrDivider } from "@/components/modules/layout";
import { Text } from "@/components/modules/typography";

import { AuthCard } from "../components/auth-card";
import type { AuthStepProps } from "../lib/types";

/** Entry of an emailed code for sign-in, password reset or two-factor. */
export function VerifyCodeStep({ flow, onFocusField }: AuthStepProps) {
  const reset = flow.step === "verify-reset";
  const twoFa = flow.step === "verify-two-fa";
  const resendBlocked = flow.pending || flow.resendSeconds > 0;
  return (
    <AuthCard
      title={
        reset
          ? "Enter your reset code"
          : twoFa
            ? "Enter your two-factor code"
            : "Enter your sign-in code"
      }
      description={
        twoFa
          ? "Enter the code sent to your email to continue."
          : `Enter the one-time code sent to your email address. ${flow.email.trim()}`
      }
    >
      <OtpField onChangeText={flow.setCode} onFocusField={onFocusField} value={flow.code} />
      <ActionButton
        disabled={flow.pending}
        label="Verify code"
        loading={flow.pending}
        onPress={flow.verifyCode}
      />
      <View className="flex-row items-center justify-between gap-4">
        <Text className="text-sm text-foreground">Did not receive a code?</Text>
        <TextButton
          disabled={resendBlocked}
          label={flow.resendSeconds > 0 ? `Resend in ${flow.resendSeconds}s` : "Resend code"}
          onPress={() => flow.sendCode(reset ? "reset" : twoFa ? "two-fa" : "sign-in")}
        />
      </View>
      <OrDivider />
      <ActionButton
        disabled={flow.pending}
        label={
          reset ? "Change email" : twoFa ? "Use authenticator instead" : "Use password instead"
        }
        onPress={() => flow.setStep(reset ? "forgot" : twoFa ? "two-fa" : "sign-in")}
        outline
      />
    </AuthCard>
  );
}
