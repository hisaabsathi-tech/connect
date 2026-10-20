import { ResetPasswordIcon, SendIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { ActionButton } from "@/components/modules/button";
import { OtpField, TextField } from "@/components/modules/form";
import { BottomSheet } from "@/components/modules/sheet";
import { Text } from "@/components/modules/typography";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/config/colors";
import { RESEND_COOLDOWN_MS, STRONG_PASSWORD } from "@/features/auth/lib/constants";
import { useCountdown } from "@/hooks/use-countdown";
import { authApi } from "@/lib/api/auth";
import { errorMessage } from "@/lib/errors";

import {
  clearChangePassword,
  loadChangePassword,
  saveChangePassword,
} from "./change-password-storage";

type PasswordStep = "request" | "code" | "password";

/** Password reset initiated from a signed-in person's profile. */
export function ChangePassword({ email }: { email: string | null | undefined }) {
  const toast = useToast();
  const { seconds: resendSeconds, start: startResend } = useCountdown();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<PasswordStep>("request");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [resendEndsAt, setResendEndsAt] = useState(0);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!email) return;
    let active = true;
    void loadChangePassword()
      .then((saved) => {
        if (!(active && saved?.email === email)) return;
        setStep(saved.step);
        setCode(saved.code);
        setResendEndsAt(saved.resendEndsAt);
        startResend(Math.max(0, saved.resendEndsAt - Date.now()));
        setVisible(true);
      })
      .finally(() => {
        if (active) setRestored(true);
      });
    return () => {
      active = false;
    };
  }, [email, startResend]);

  useEffect(() => {
    if (!(restored && email && (step === "code" || step === "password"))) return;
    void saveChangePassword({ code, email, resendEndsAt, step });
  }, [code, email, resendEndsAt, restored, step]);

  const requestCode = async () => {
    if (!email) {
      toast.error("Email unavailable", "We couldn't find an email address for your account.");
      return;
    }
    setPending(true);
    try {
      await authApi.requestPasswordReset(email);
      setCode("");
      const nextResendEndsAt = Date.now() + RESEND_COOLDOWN_MS;
      setResendEndsAt(nextResendEndsAt);
      startResend(RESEND_COOLDOWN_MS);
      setStep("code");
      toast.success("Verification code sent", "Check your email for the six-digit code.");
    } catch (error) {
      toast.error("Couldn't send code", errorMessage(error));
    } finally {
      setPending(false);
    }
  };

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(code)) {
      toast.error("Check your code", "Enter the six-digit code we sent you.");
      return;
    }
    if (!email) return;
    setPending(true);
    try {
      await authApi.checkPasswordResetCode(email, code);
      setStep("password");
    } catch (error) {
      toast.error("Code not verified", errorMessage(error));
    } finally {
      setPending(false);
    }
  };

  const updatePassword = async () => {
    if (!STRONG_PASSWORD.test(password)) {
      toast.error(
        "Choose a stronger password",
        "Use 8+ characters with upper and lower case letters, a number, and a special character.",
      );
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords don't match", "Make sure both password fields are the same.");
      return;
    }
    if (!email) return;
    setPending(true);
    try {
      await authApi.resetPassword(email, code, password);
      await clearChangePassword();
      toast.success("Password updated", "Your new password is ready to use.");
      setVisible(false);
    } catch (error) {
      toast.error("Couldn't update password", errorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <View className="mt-3 flex-row items-center justify-between border border-border bg-[#FAFBFF] px-4 py-4">
        <View className="flex-1 pr-3">
          <Text className="text-base font-semibold text-foreground">Change password</Text>
          <Text className="mt-0.5 text-sm text-muted-foreground">Manage your account security</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          className="flex-row items-center gap-1.5 bg-primary px-3 py-2.5"
          disabled={pending}
          onPress={() => setVisible(true)}
        >
          <Text className="text-sm font-semibold text-primary-foreground">Change</Text>
          {pending ? (
            <ActivityIndicator color={colors.primaryForeground} size="small" />
          ) : (
            <HugeiconsIcon color={colors.primaryForeground} icon={ResetPasswordIcon} size={18} />
          )}
        </Pressable>
      </View>

      <BottomSheet
        dismissible={!pending}
        onClose={() => setVisible(false)}
        visible={visible}
      >
        <View className="pt-5">
          <Text className="text-2xl font-semibold leading-8 text-foreground">Change password</Text>
          <Text className="mt-1 text-sm leading-5 text-muted-foreground">
            Update your password to keep your account secure.
          </Text>
        </View>

        {step === "request" ? (
          <View className="gap-6 pt-7">
            <View>
              <Text className="text-xl font-semibold leading-7 text-foreground">
                Verify your email
              </Text>
              <Text className="mt-1 text-base leading-6 text-muted-foreground">
                We’ll send a 6 digit code to {email}.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              className={`h-12 flex-row items-center justify-center gap-2 bg-primary ${pending ? "opacity-60" : ""}`}
              disabled={pending}
              onPress={() => void requestCode()}
            >
              <Text className="text-base font-semibold text-primary-foreground">
                Send verification OTP
              </Text>
              {pending ? (
                <ActivityIndicator color={colors.primaryForeground} size="small" />
              ) : (
                <HugeiconsIcon color={colors.primaryForeground} icon={SendIcon} size={20} />
              )}
            </Pressable>
          </View>
        ) : step === "code" ? (
          <View className="gap-5 pt-7">
            <View>
              <Text className="text-xl font-semibold leading-7 text-foreground">
                We’ve sent a verification code to
              </Text>
              <Text className="mt-1 text-base text-muted-foreground">{email}</Text>
            </View>
            <OtpField label="Verification code" onChangeText={setCode} value={code} />
            <View className="flex-row items-center justify-between gap-3">
              <Text className="flex-1 text-sm text-muted-foreground">Didn’t receive a code?</Text>
              <Pressable
                accessibilityRole="button"
                className={`border border-primary px-3 py-2 ${pending || resendSeconds > 0 ? "opacity-50" : ""}`}
                disabled={pending || resendSeconds > 0}
                onPress={() => void requestCode()}
              >
                <Text className="text-sm font-medium text-primary">
                  {resendSeconds ? `Resend in ${resendSeconds}s` : "Resend OTP"}
                </Text>
              </Pressable>
            </View>
            <ActionButton
              disabled={pending || code.length !== 6}
              label="Verify OTP"
              loading={pending}
              onPress={() => void verifyCode()}
            />
          </View>
        ) : (
          <View className="gap-5 pt-7">
            <View>
              <Text className="text-xl font-semibold leading-7 text-foreground">
                Set a new password
              </Text>
              <Text className="mt-1 text-sm leading-5 text-muted-foreground">
                Use 8+ characters with upper and lower case letters, a number, and a special
                character.
              </Text>
            </View>
            <TextField
              complete="password"
              label="New password"
              onChangeText={setPassword}
              secure
              value={password}
              visibleByDefault
            />
            <TextField
              complete="password"
              label="Confirm new password"
              onChangeText={setConfirmPassword}
              secure
              value={confirmPassword}
              visibleByDefault
            />
            <ActionButton
              disabled={pending || !password || !confirmPassword}
              label="Update password"
              loading={pending}
              onPress={() => void updatePassword()}
            />
          </View>
        )}
      </BottomSheet>
    </>
  );
}
