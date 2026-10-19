import type { TextInput } from "react-native";

import type { AuthFlow } from "../hooks/use-auth-flow";

export type AuthStep =
  | "sign-in"
  | "code"
  | "forgot"
  | "verify-sign-in"
  | "verify-reset"
  | "reset"
  | "two-fa"
  | "verify-two-fa";

/** What a one-time code is being sent for. */
export type CodePurpose = "sign-in" | "reset" | "two-fa";

export interface AuthStepProps {
  flow: AuthFlow;
  onFocusField: (input: TextInput | null) => void;
}
