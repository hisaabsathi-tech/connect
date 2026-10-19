import { Switch, View } from "react-native";

import { ActionButton, TextButton } from "@/components/modules/button";
import { TextField } from "@/components/modules/form";
import { Text } from "@/components/modules/typography";

import { AuthCard } from "../components/auth-card";
import type { AuthStepProps } from "../lib/types";

export function TwoFactorStep({ flow, onFocusField }: AuthStepProps) {
  return (
    <AuthCard
      title="Two-factor authentication"
      description="Enter your authenticator code, or receive one by email."
    >
      <TextField
        complete="one-time-code"
        label="Authenticator code"
        onChangeText={flow.setCode}
        onFocusField={onFocusField}
        type="number-pad"
        value={flow.code}
      />
      <View className="flex-row items-center justify-between">
        <Text className="text-sm text-foreground">Trust this device</Text>
        <Switch onValueChange={flow.setTrustDevice} value={flow.trustDevice} />
      </View>
      <ActionButton
        disabled={flow.pending}
        label="Verify authenticator code"
        loading={flow.pending}
        onPress={flow.verifyAuthenticator}
      />
      <ActionButton
        disabled={flow.pending}
        label="Email me a code"
        onPress={() => flow.sendCode("two-fa")}
        outline
      />
      <TextButton align="center" label="Back to sign in" onPress={() => flow.setStep("sign-in")} />
    </AuthCard>
  );
}
