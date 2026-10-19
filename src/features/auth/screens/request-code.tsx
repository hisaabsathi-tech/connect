import { ActionButton } from "@/components/modules/button";
import { TextField } from "@/components/modules/form";
import { OrDivider } from "@/components/modules/layout";

import { AuthCard } from "../components/auth-card";
import type { AuthStepProps } from "../lib/types";

/** Emails a sign-in code (`code` step) or a password-reset code (`forgot` step). */
export function RequestCodeStep({ flow, onFocusField }: AuthStepProps) {
  const reset = flow.step === "forgot";
  return (
    <AuthCard
      title={reset ? "Reset your password" : "Sign in with a code"}
      description={
        reset
          ? "We’ll email a verification code to reset your password."
          : "We’ll email you a six-digit sign-in code."
      }
    >
      <TextField
        complete="email"
        label="Email"
        onChangeText={flow.setEmail}
        onFocusField={onFocusField}
        type="email-address"
        value={flow.email}
      />
      <ActionButton
        disabled={flow.pending}
        label={reset ? "Send reset code" : "Send sign-in code"}
        loading={flow.pending}
        onPress={() => flow.sendCode(reset ? "reset" : "sign-in")}
      />
      <OrDivider />
      <ActionButton
        disabled={flow.pending}
        label={reset ? "Back to sign in" : "Use password instead"}
        onPress={() => flow.setStep("sign-in")}
        outline
      />
    </AuthCard>
  );
}
