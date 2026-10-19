import { ActionButton, TextButton } from "@/components/modules/button";
import { TextField } from "@/components/modules/form";
import { OrDivider } from "@/components/modules/layout";

import { AuthCard } from "../components/auth-card";
import type { AuthStepProps } from "../lib/types";

export function SignInStep({ flow, onFocusField }: AuthStepProps) {
  return (
    <AuthCard
      title="Welcome to Hisaab Sathi Connect"
      description="Continue with your company provided account."
    >
      <TextField
        complete="email"
        label="Email"
        onChangeText={flow.setEmail}
        onFocusField={onFocusField}
        type="email-address"
        value={flow.email}
      />
      <TextField
        complete="password"
        label="Password"
        onChangeText={flow.setPassword}
        onFocusField={onFocusField}
        secure
        value={flow.password}
      />
      <TextButton align="right" label="Forgot password?" onPress={() => flow.setStep("forgot")} />
      <ActionButton
        disabled={flow.pending}
        label="Sign in"
        loading={flow.pending}
        onPress={flow.signIn}
      />
      <OrDivider />
      <ActionButton
        disabled={flow.pending}
        label="Sign in with a code"
        onPress={() => flow.setStep("code")}
        outline
      />
    </AuthCard>
  );
}
