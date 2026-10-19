import { ActionButton } from "@/components/modules/button";
import { TextField } from "@/components/modules/form";

import { AuthCard } from "../components/auth-card";
import type { AuthStepProps } from "../lib/types";

export function ResetPasswordStep({ flow, onFocusField }: AuthStepProps) {
  return (
    <AuthCard
      title="Choose a new password"
      description="Use 8+ characters with upper and lower case letters, a number, and a special character."
    >
      <TextField
        complete="password"
        label="New password"
        onChangeText={flow.setPassword}
        onFocusField={onFocusField}
        secure
        value={flow.password}
      />
      <TextField
        complete="password"
        label="Confirm password"
        onChangeText={flow.setConfirmPassword}
        onFocusField={onFocusField}
        secure
        value={flow.confirmPassword}
      />
      <ActionButton
        disabled={flow.pending}
        label="Update password"
        loading={flow.pending}
        onPress={flow.updatePassword}
      />
    </AuthCard>
  );
}
