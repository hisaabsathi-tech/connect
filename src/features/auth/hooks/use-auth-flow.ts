import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { useToast } from "@/components/ui/toast";
import { useCountdown } from "@/hooks/use-countdown";
import { type AuthOrganization, authApi, type SignInResult } from "@/lib/api/auth";
import { useAuthSession } from "@/lib/auth/session";
import { errorMessage } from "@/lib/errors";

import {
  CHALLENGE_EXPIRED_MESSAGE,
  EMAIL,
  MIN_PASSWORD_LENGTH,
  NO_ORGANIZATION_MESSAGE,
  OTP,
  OTP_LENGTH,
  RESEND_COOLDOWN_MS,
  STRONG_PASSWORD,
} from "../lib/constants";
import { clearAuthFlow, loadAuthFlow, saveAuthFlow } from "../lib/flow-storage";
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
  // Signed in but no organisation active yet: the token waits here until one is picked.
  const [orgToken, setOrgToken] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<AuthOrganization[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  // False until a sign-in left half-way (app closed or killed) has been put back.
  const [restored, setRestored] = useState(false);
  const signedIn = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const saved = await loadAuthFlow();
      if (!(active && saved)) return;
      setStep(saved.step);
      setEmail(saved.email);
      setRawCode(saved.code);
      setTrustDevice(saved.trustDevice);
      setChallengeToken(saved.challengeToken);
      if (saved.step !== "select-org") return;
      // Logo URLs expire, so the list is fetched again; a dead session starts sign-in over.
      try {
        if (!saved.orgToken) throw new Error("No pending session");
        const list = await authApi.listOrganizations(saved.orgToken);
        if (!active) return;
        setOrgToken(saved.orgToken);
        setOrganizations(list);
        // Keep the earlier pick; a list down to one organisation (one client) is pre-selected.
        const kept = list.some((org) => org.id === saved.organizationId);
        setOrganizationId(kept ? saved.organizationId : list.length === 1 ? list[0].id : null);
      } catch {
        if (active) setStep("sign-in");
      }
    })().finally(() => {
      if (active) setRestored(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!restored || signedIn.current) return;
    void saveAuthFlow({ challengeToken, code, email, orgToken, organizationId, step, trustDevice });
  }, [challengeToken, code, email, orgToken, organizationId, restored, step, trustDevice]);

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
    if (!nextToken) throw new Error("The server did not return an authentication token.");
    await enterOrganization(nextToken);
  };

  const enter = async (token: string) => {
    signedIn.current = true;
    await clearAuthFlow();
    await completeSignIn(token);
    toast.success("Signed in successfully");
    router.replace("/");
  };

  /**
   * The app works inside one organisation. The server activates it on its own when the user has
   * only one; with several the user picks, and with none sign-in can't continue.
   */
  const enterOrganization = async (token: string) => {
    const session = await authApi.getSession(token);
    const current = session.token ?? token;
    if (session.data?.session?.activeOrganizationId) return enter(current);
    const list = await authApi.listOrganizations(current);
    if (!list.length) {
      await authApi.signOut(current).catch(() => undefined);
      throw new Error(NO_ORGANIZATION_MESSAGE);
    }
    if (list.length === 1) {
      const activated = await authApi.setActiveOrganization(list[0].id, current);
      return enter(activated.token ?? current);
    }
    setOrgToken(current);
    setOrganizations(list);
    setOrganizationId(null);
    setStep("select-org");
  };

  const selectOrganization = () =>
    perform(async () => {
      if (!(orgToken && organizationId)) throw new Error("Choose an organization to continue.");
      const activated = await authApi.setActiveOrganization(organizationId, orgToken);
      await enter(activated.token ?? orgToken);
    });

  /** Leaves the organisation picker, ending the half-finished session on the server too. */
  const cancelOrganization = () => {
    if (orgToken) void authApi.signOut(orgToken).catch(() => undefined);
    setOrgToken(null);
    setOrganizations([]);
    setOrganizationId(null);
    setStep("sign-in");
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
    cancelOrganization,
    code,
    confirmPassword,
    email,
    organizationId,
    organizations,
    password,
    pending,
    resendSeconds: resend.seconds,
    restored,
    selectOrganization,
    sendCode,
    setCode,
    setConfirmPassword,
    setEmail,
    setOrganizationId,
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
