import { Image } from "expo-image";
import { Redirect, router } from "expo-router";
import { ArrowRight01Icon, CancelCircleIcon, ViewIcon, ViewOffIcon } from "hugeicons-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Loader, useStartupReady } from "@/components/modules/system";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { AuthApiError, authApi, type SignInResult } from "@/lib/api/auth";
import { useAuthSession } from "@/lib/auth/session";

type Screen =
  | "sign-in"
  | "code"
  | "forgot"
  | "verify-sign-in"
  | "verify-reset"
  | "reset"
  | "two-fa"
  | "verify-two-fa";
const EMAIL = /^\S+@\S+\.\S+$/;
const OTP = /^\d{6}$/;
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])\S{8,}$/;

function ArrowRightIcon({ color }: { color: string }) {
  return <ArrowRight01Icon color={color} size={20} strokeWidth={2} />;
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  const Icon = hidden ? ViewOffIcon : ViewIcon;
  return <Icon color="#5F6470" size={21} strokeWidth={1.8} />;
}

function ClearIcon() {
  return <CancelCircleIcon color="#DC2626" size={22} strokeWidth={2} />;
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <View className="w-full max-w-sm">
      <Text className="text-2xl font-semibold tracking-tight text-foreground">{title}</Text>
      <Text className="mt-2 max-w-sm text-sm leading-5 text-muted-foreground">{description}</Text>
      <View className="mt-7 gap-5">{children}</View>
    </View>
  );
}
function Field({
  label,
  value,
  onChangeText,
  secure,
  type = "default",
  complete,
  onFocusField,
  onSubmitEditing,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secure?: boolean;
  type?: "default" | "email-address" | "number-pad";
  complete?: "email" | "password" | "one-time-code";
  onFocusField?: (input: TextInput | null) => void;
  onSubmitEditing?: () => void;
}) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const [showValue, setShowValue] = useState(false);
  const numeric = type === "number-pad";
  const hasClearButton = type === "email-address" && Boolean(value);
  return (
    <View>
      <Text className="mb-2 text-sm font-medium text-foreground">{label}</Text>
      <View
        className={`h-12 overflow-hidden border bg-background ${focused ? "border-primary" : "border-input"}`}
      >
        <TextInput
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect={false}
          className="h-full flex-1 px-3 text-base text-foreground"
          clearButtonMode="never"
          // Android paints its own yellow autofill overlay across an input. Keep
          // the field surface app-controlled; paste still works normally.
          importantForAutofill="no"
          keyboardType={type}
          maxLength={numeric ? 6 : undefined}
          onChangeText={onChangeText}
          onFocus={() => {
            setFocused(true);
            onFocusField?.(inputRef.current);
          }}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmitEditing}
          ref={inputRef}
          returnKeyType={numeric ? "done" : complete === "email" ? "next" : "done"}
          cursorColor="#465FFF"
          secureTextEntry={secure && !showValue}
          selectionColor="#465FFF"
          style={{
            fontFamily: "Satoshi",
            paddingLeft: 14,
            paddingRight: hasClearButton || secure ? 48 : 14,
          }}
          textContentType={
            complete === "email"
              ? "emailAddress"
              : complete === "one-time-code"
                ? "oneTimeCode"
                : complete === "password"
                  ? "password"
                  : "none"
          }
          value={value}
        />
        {hasClearButton ? (
          <Pressable
            accessibilityLabel="Clear email address"
            className="absolute right-0 top-0 h-12 w-12 items-center justify-center"
            hitSlop={8}
            onPress={() => {
              onChangeText("");
              inputRef.current?.focus();
            }}
          >
            <ClearIcon />
          </Pressable>
        ) : secure ? (
          <Pressable
            accessibilityLabel={showValue ? "Hide password" : "Show password"}
            className="absolute right-0 top-0 h-12 w-12 items-center justify-center"
            hitSlop={8}
            onPress={() => setShowValue((current) => !current)}
          >
            <EyeIcon hidden={!showValue} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
function Action({
  label,
  onPress,
  outline = false,
  disabled = false,
  arrow = true,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  outline?: boolean;
  disabled?: boolean;
  arrow?: boolean;
  loading?: boolean;
}) {
  return (
    <Button
      className="h-12 w-full"
      disabled={disabled || loading}
      onPress={onPress}
      variant={outline ? "outline" : "default"}
    >
      <View className="flex-row items-center gap-2">
        <ButtonText className="text-base font-semibold">{label}</ButtonText>
        {loading ? (
          <ButtonSpinner color={outline ? "#161950" : "#F9FBFF"} size="small" />
        ) : arrow ? (
          <ArrowRightIcon color={outline ? "#161950" : "#F9FBFF"} />
        ) : null}
      </View>
    </Button>
  );
}
function errorMessage(error: unknown) {
  return error instanceof AuthApiError || error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

export default function AuthScreen() {
  const markStartupReady = useStartupReady();
  const insets = useSafeAreaInsets();
  const { completeSignIn, isReady, token: sessionToken } = useAuthSession();
  const toast = useToast();
  const [screen, setScreen] = useState<Screen>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const focusedInput = useRef<TextInput | null>(null);
  const focusField = useCallback((input: TextInput | null) => {
    if (!input) return;
    focusedInput.current = input;
    setKeyboardVisible(true);
    // Wait for the OS keyboard animation/resize, then put the active field
    // safely above it. This is the native equivalent of Connector v1's field lift.
    setTimeout(() => {
      input.measureInWindow((_x, y) => {
        const target = Math.max(0, scrollOffset.current + y - 112);
        scrollRef.current?.scrollTo({ animated: true, y: target });
      });
    }, 220);
  }, []);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (event) => {
      setKeyboardHeight(event.endCoordinates.height);
      setKeyboardVisible(true);
      setTimeout(() => focusField(focusedInput.current), 80);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0);
      setKeyboardVisible(false);
      focusedInput.current = null;
      scrollRef.current?.scrollTo({ animated: true, y: 0 });
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [focusField]);
  useEffect(() => {
    if (!resendAt) return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [resendAt]);
  const resendSeconds = Math.max(0, Math.ceil((resendAt - now) / 1000));
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
  const perform = async (work: () => Promise<void>) => {
    setPending(true);
    try {
      await work();
    } catch (error) {
      toast.error("Unable to continue", errorMessage(error));
    } finally {
      setPending(false);
    }
  };
  const finish = async (result: { data: SignInResult; token: string | null }) => {
    const nextToken = result.token ?? result.data.token;
    if (result.data.twoFactorRedirect) {
      setChallengeToken(nextToken ?? null);
      setCode("");
      setScreen("two-fa");
      return;
    }
    await completeSignIn(nextToken);
    toast.success("Signed in successfully");
    router.replace("/");
  };
  const sendCode = (purpose: "sign-in" | "reset" | "two-fa") =>
    void perform(async () => {
      if (purpose !== "two-fa" && !validEmail()) return;
      if (purpose === "sign-in") await authApi.sendSignInCode(email.trim());
      else if (purpose === "reset") await authApi.requestPasswordReset(email.trim());
      else {
        if (!challengeToken)
          throw new Error("Your sign-in challenge expired. Please sign in again.");
        await authApi.sendTwoFactorCode(trustDevice, challengeToken);
      }
      setCode("");
      setResendAt(Date.now() + 60_000);
      toast.success(
        purpose === "reset" ? "Reset code sent" : "Verification code sent",
        "Check your email for the six-digit code.",
      );
      setScreen(
        purpose === "sign-in"
          ? "verify-sign-in"
          : purpose === "reset"
            ? "verify-reset"
            : "verify-two-fa",
      );
    });
  // Don't mark startup ready yet: the root loader stays up until real content lays out.
  if (!isReady) return <Loader fullPage />;
  if (sessionToken)
    return (
      <>
        <Loader fullPage />
        <Redirect href="/" />
      </>
    );
  let content: React.ReactNode;
  if (screen === "sign-in")
    content = (
      <Card
        title="Welcome to Hisaab Sathi Connect"
        description="Continue with your company provided account."
      >
        <Field
          complete="email"
          label="Email"
          onChangeText={setEmail}
          onFocusField={focusField}
          type="email-address"
          value={email}
        />
        <Field
          complete="password"
          label="Password"
          onChangeText={setPassword}
          onFocusField={focusField}
          secure
          value={password}
        />
        <Pressable onPress={() => setScreen("forgot")}>
          <Text className="text-right text-sm font-medium text-primary">Forgot password?</Text>
        </Pressable>
        <Action
          disabled={pending}
          label="Sign in"
          loading={pending}
          onPress={() =>
            void perform(async () => {
              if (!validEmail()) return;
              if (password.length < 8)
                throw new Error("Password must be at least 8 characters long.");
              await finish(await authApi.signIn(email.trim(), password));
            })
          }
        />
        <View className="flex-row items-center gap-4">
          <View className="h-px flex-1 bg-border" />
          <Text className="text-sm text-muted-foreground">or</Text>
          <View className="h-px flex-1 bg-border" />
        </View>
        <Action
          disabled={pending}
          label="Sign in with a code"
          onPress={() => setScreen("code")}
          outline
        />
      </Card>
    );
  else if (screen === "code" || screen === "forgot") {
    const reset = screen === "forgot";
    content = (
      <Card
        title={reset ? "Reset your password" : "Sign in with a code"}
        description={
          reset
            ? "We’ll email a verification code to reset your password."
            : "We’ll email you a six-digit sign-in code."
        }
      >
        <Field
          complete="email"
          label="Email"
          onChangeText={setEmail}
          onFocusField={focusField}
          type="email-address"
          value={email}
        />
        <Action
          disabled={pending}
          label={reset ? "Send reset code" : "Send sign-in code"}
          loading={pending}
          onPress={() => sendCode(reset ? "reset" : "sign-in")}
        />
        <Action
          disabled={pending}
          label="Back to sign in"
          onPress={() => setScreen("sign-in")}
          outline
        />
      </Card>
    );
  } else if (
    screen === "verify-sign-in" ||
    screen === "verify-reset" ||
    screen === "verify-two-fa"
  ) {
    const reset = screen === "verify-reset";
    const twoFa = screen === "verify-two-fa";
    content = (
      <Card
        title="Verify your code"
        description={`Enter the six-digit code${twoFa ? "" : ` sent to ${email.trim()}`}.`}
      >
        <Field
          complete="one-time-code"
          label="Verification code"
          onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
          onFocusField={focusField}
          type="number-pad"
          value={code}
        />
        <Action
          disabled={pending}
          label="Verify code"
          loading={pending}
          onPress={() =>
            void perform(async () => {
              if (!validCode()) return;
              if (reset) {
                await authApi.checkPasswordResetCode(email.trim(), code);
                setScreen("reset");
              } else if (twoFa) {
                if (!challengeToken)
                  throw new Error("Your sign-in challenge expired. Please sign in again.");
                await finish(await authApi.verifyTwoFactorCode(code, trustDevice, challengeToken));
              } else await finish(await authApi.signInWithCode(email.trim(), code));
            })
          }
        />
        <Action
          disabled={pending || resendSeconds > 0}
          label={resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend code"}
          onPress={() => sendCode(reset ? "reset" : twoFa ? "two-fa" : "sign-in")}
          outline
        />
        <Pressable onPress={() => setScreen(reset ? "forgot" : twoFa ? "two-fa" : "sign-in")}>
          <Text className="text-center text-sm font-medium text-primary">
            Use another sign-in method
          </Text>
        </Pressable>
      </Card>
    );
  } else if (screen === "reset")
    content = (
      <Card
        title="Choose a new password"
        description="Use 8+ characters with upper and lower case letters, a number, and a special character."
      >
        <Field
          complete="password"
          label="New password"
          onChangeText={setPassword}
          onFocusField={focusField}
          secure
          value={password}
        />
        <Field
          complete="password"
          label="Confirm password"
          onChangeText={setConfirmPassword}
          onFocusField={focusField}
          secure
          value={confirmPassword}
        />
        <Action
          disabled={pending}
          label="Update password"
          loading={pending}
          onPress={() =>
            void perform(async () => {
              if (!STRONG_PASSWORD.test(password))
                throw new Error("Your password does not meet the requirements.");
              if (password !== confirmPassword) throw new Error("Passwords do not match.");
              await authApi.resetPassword(email.trim(), code, password);
              await finish(await authApi.signIn(email.trim(), password));
            })
          }
        />
      </Card>
    );
  else
    content = (
      <Card
        title="Two-factor authentication"
        description="Enter your authenticator code, or receive one by email."
      >
        <Field
          complete="one-time-code"
          label="Authenticator code"
          onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
          onFocusField={focusField}
          type="number-pad"
          value={code}
        />
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-foreground">Trust this device</Text>
          <Switch onValueChange={setTrustDevice} value={trustDevice} />
        </View>
        <Action
          disabled={pending}
          label="Verify authenticator code"
          loading={pending}
          onPress={() =>
            void perform(async () => {
              if (!validCode()) return;
              if (!challengeToken)
                throw new Error("Your sign-in challenge expired. Please sign in again.");
              await finish(await authApi.verifyTotp(code, trustDevice, challengeToken));
            })
          }
        />
        <Action
          disabled={pending}
          label="Email me a code"
          onPress={() => sendCode("two-fa")}
          outline
        />
        <Pressable onPress={() => setScreen("sign-in")}>
          <Text className="text-center text-sm font-medium text-primary">Back to sign in</Text>
        </Pressable>
      </Card>
    );
  return (
    <View className="flex-1 bg-background" onLayout={markStartupReady}>
      <View
        className="flex-row items-center px-5"
        style={{ height: insets.top + 58, paddingTop: insets.top }}
      >
        <Image
          accessibilityLabel="Hisaab Sathi"
          contentFit="contain"
          source={require("@/assets/logo/splash/dark.svg")}
          style={{ height: 34, width: 158 }}
        />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName={
            keyboardVisible
              ? "items-center px-6 pt-4"
              : "min-h-full items-center justify-center px-6 pb-10 pt-4"
          }
          contentContainerStyle={{ paddingBottom: keyboardVisible ? keyboardHeight + 32 : 40 }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onScroll={(event) => {
            scrollOffset.current = event.nativeEvent.contentOffset.y;
          }}
          ref={scrollRef}
          scrollEventThrottle={16}
        >
          {screen === "sign-in" && !keyboardVisible ? (
            <Image
              accessibilityLabel="Hisaab Sathi Connect"
              contentFit="contain"
              source={require("@/assets/illustrations/auth.svg")}
              style={{ height: 170, marginBottom: 24, maxWidth: 241, width: "100%" }}
            />
          ) : null}
          {content}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
