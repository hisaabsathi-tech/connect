import { Image } from "expo-image";
import { Redirect } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";

import { Loader, useStartupReady } from "@/components/modules/system";
import { KEYBOARD_GAP, useKeyboardReveal } from "@/hooks/use-keyboard-reveal";
import { useAuthSession } from "@/lib/auth/session";

import { AuthHeader } from "./components/auth-header";
import { useAuthFlow } from "./hooks/use-auth-flow";
import type { AuthStepProps } from "./lib/types";
import { RequestCodeStep } from "./screens/request-code";
import { ResetPasswordStep } from "./screens/reset-password";
import { SelectOrgStep } from "./screens/select-org";
import { SignInStep } from "./screens/sign-in";
import { TwoFactorStep } from "./screens/two-factor";
import { VerifyCodeStep } from "./screens/verify-code";

const ILLUSTRATION_HEIGHT = 170;
const ILLUSTRATION_GAP = 24;

function AuthStepView(props: AuthStepProps) {
  switch (props.flow.step) {
    case "sign-in":
      return <SignInStep {...props} />;
    case "code":
    case "forgot":
      return <RequestCodeStep {...props} />;
    case "verify-sign-in":
    case "verify-reset":
    case "verify-two-fa":
      return <VerifyCodeStep {...props} />;
    case "reset":
      return <ResetPasswordStep {...props} />;
    case "two-fa":
      return <TwoFactorStep {...props} />;
    case "select-org":
      return <SelectOrgStep {...props} />;
  }
}

export function AuthScreen() {
  const markStartupReady = useStartupReady();
  const { isReady, token: sessionToken } = useAuthSession();
  const flow = useAuthFlow();
  const keyboard = useKeyboardReveal();
  const [formHeight, setFormHeight] = useState(0);

  // With the keyboard open, keep the illustration only if it still fits above it
  // alongside the whole form on this device.
  const visibleHeight = keyboard.viewportHeight - keyboard.keyboardInset - KEYBOARD_GAP * 2 - 16;
  const showIllustration =
    flow.step === "sign-in" &&
    (!keyboard.keyboardVisible ||
      formHeight + ILLUSTRATION_HEIGHT + ILLUSTRATION_GAP <= visibleHeight);

  // Don't mark startup ready yet: the root loader stays up until real content lays out.
  if (!(isReady && flow.restored)) return <Loader fullPage />;
  if (sessionToken)
    return (
      <>
        <Loader fullPage />
        <Redirect href="/" />
      </>
    );

  return (
    <View className="flex-1 bg-background" onLayout={markStartupReady}>
      <AuthHeader />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        {/* Content stays centred in whatever space is visible, so opening the
            keyboard only nudges it up as far as the device actually needs. */}
        <View className="flex-1" onLayout={keyboard.onViewportLayout} ref={keyboard.viewportRef}>
          <ScrollView
            contentContainerClassName="min-h-full items-center justify-center px-6 pt-4"
            contentContainerStyle={{
              paddingBottom: keyboard.keyboardVisible
                ? keyboard.keyboardInset + KEYBOARD_GAP * 2
                : 40,
            }}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            onScroll={keyboard.onScroll}
            ref={keyboard.scrollRef}
            scrollEventThrottle={16}
          >
            {showIllustration ? (
              <Image
                accessibilityLabel="Hisaab Sathi Connect"
                contentFit="contain"
                source={require("@/assets/illustrations/auth.webp")}
                style={{
                  height: ILLUSTRATION_HEIGHT,
                  marginBottom: ILLUSTRATION_GAP,
                  maxWidth: 241,
                  width: "100%",
                }}
              />
            ) : null}
            <View
              className="w-full items-center"
              onLayout={(event) => setFormHeight(event.nativeEvent.layout.height)}
            >
              <AuthStepView flow={flow} onFocusField={keyboard.focusField} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
