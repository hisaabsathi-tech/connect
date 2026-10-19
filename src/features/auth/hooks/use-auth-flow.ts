import { router } from "expo-router";
import { useState } from "react";

import { useToast } from "@/components/ui/toast";
import { useCountdown } from "@/hooks/use-countdown";
import { authApi, type SignInResult } from "@/lib/api/auth";
import { useAuthSession } from "@/lib/auth/session";
import { errorMessage } from "@/lib/errors";

import {
  CHALLENGE_EXPIRED_MESSAGE,
  EMAIL,
  MIN_PASSWORD_LENGTH,
  OTP,
  OTP_LENGTH,
  RESEND_COOLDOWN_MS,
  STRONG_PASSWORD,
} from "../lib/constants";
import type { AuthStep, CodePurpose } from "../lib/types";

const NON_DIGIT = /\D/g;

const verifyStepFor: Record<CodePurpose, AuthStep> = {
  reset: "verify-reset",
  "sign-in": "verify-sign-in",
  "two-fa": "verify-two-fa",
};

export type AuthFlow = ReturnType<typeof useAuthFlow>;

/** Form state and server calls for every sign-in, code, reset and two-factor step. */
export function useAuthFlow() {
  const { completeSignIn } = useAuthSession();
  const toast = useToast();
  const resend = useCountdown();
  const [step, setStep] = useState<AuthStep>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setRawCode] = useState("");
  const [pending, setPending] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);

  const setCode = (value: string) => setRawCode(value.replace(NON_DIGIT, "").slice(0, OTP_LENGTH));

  const validEmail = () => {
    if (EMAIL.test(email.trim())) return true;
    toast.error("Check your email", "Enter a valid email address.");
    return false;
  };
  const validCode = () => {
    if (OTP.test(code)) return true;
    toast.error("Check your code", "Enter the six-digit code we sent you.");
    return false;
  };
  const requireChallenge = () => {
    if (!challengeToken) throw new Error(CHALLENGE_EXPIRED_MESSAGE);
    return challengeToken;
  };

  const perform = (work: () => Promise<void>) =>
    void (async () => {
      setPending(true);
      try {
        await work();
      } catch (error) {
        toast.error("Unable to continue", errorMessage(error));
      } finally {
        setPending(false);
      }
    })();

  const finish = async (result: { data: SignInResult; token: string | null }) => {
    const nextToken = result.token ?? result.data.token;
    if (result.data.twoFactorRedirect) {
      setChallengeToken(nextToken ?? null);
      setRawCode("");
      setStep("two-fa");
      return;
    }
    await completeSignIn(nextToken);
    toast.success("Signed in successfully");
    router.replace("/");
  };

  const signIn = () =>
    perform(async () => {
      if (!validEmail()) return;
      if (password.length < MIN_PASSWORD_LENGTH)
        throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
      await finish(await authApi.signIn(email.trim(), password));
    });

  const sendCode = (purpose: CodePurpose) =>
    perform(async () => {
      if (purpose !== "two-fa" && !validEmail()) return;
      if (purpose === "sign-in") await authApi.sendSignInCode(email.trim());
      else if (purpose === "reset") await authApi.requestPasswordReset(email.trim());
      else await authApi.sendTwoFactorCode(trustDevice, requireChallenge());
      setRawCode("");
      resend.start(RESEND_COOLDOWN_MS);
      toast.success(
        purpose === "reset" ? "Reset code sent" : "Verification code sent",
        "Check your email for the six-digit code.",
      );
      setStep(verifyStepFor[purpose]);
    });

  /** Checks the emailed code for whichever verify step is showing. */
  const verifyCode = () =>
    perform(async () => {
      if (!validCode()) return;
      if (step === "verify-reset") {
        await authApi.checkPasswordResetCode(email.trim(), code);
        setStep("reset");
      } else if (step === "verify-two-fa") {
        await finish(await authApi.verifyTwoFactorCode(code, trustDevice, requireChallenge()));
      } else await finish(await authApi.signInWithCode(email.trim(), code));
    });

  const updatePassword = () =>
    perform(async () => {
      if (!STRONG_PASSWORD.test(password))
        throw new Error("Your password does not meet the requirements.");
      if (password !== confirmPassword) throw new Error("Passwords do not match.");
      await authApi.resetPassword(email.trim(), code, password);
      await finish(await authApi.signIn(email.trim(), password));
    });

  const verifyAuthenticator = () =>
    perform(async () => {
      if (!validCode()) return;
      await finish(await authApi.verifyTotp(code, trustDevice, requireChallenge()));
    });

  return {
    code,
    confirmPassword,
    email,
    password,
    pending,
    resendSeconds: resend.seconds,
    sendCode,
    setCode,
    setConfirmPassword,
    setEmail,
    setPassword,
    setStep,
    setTrustDevice,
    signIn,
    step,
    trustDevice,
    updatePassword,
    verifyAuthenticator,
    verifyCode,
  };
}
