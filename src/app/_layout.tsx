import "../../global.css";
// Defines the live-trip location task at module scope: the OS may start the app in the
// background just to hand it readings, before any screen mounts.
import "@/lib/tracking/task";

import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AppProviders, Loader, StartupReadyProvider } from "@/components/modules/system";
import { LiveTripHost } from "@/features/live-trips";
import { useAuthSession } from "@/lib/auth/session";

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 300, fade: true });

/**
 * Tracking belongs to the signed-in app, not to one navigator. In particular, opening an order
 * from the root-level trip map enters the nested Orders stack; keeping the host here prevents
 * that navigation from clearing the trip and stopping its location duty. A new organisation
 * still gets a fresh host and therefore cannot inherit the previous organisation's trip.
 */
function SessionLiveTripHost() {
  const { organizationKey, token } = useAuthSession();
  return token ? <LiveTripHost key={organizationKey} /> : null;
}

export default function RootLayout() {
  const [isContentReady, setIsContentReady] = useState(false);
  const hasHiddenNativeSplash = useRef(false);

  const handleLayout = useCallback(() => {
    if (hasHiddenNativeSplash.current) {
      return;
    }

    hasHiddenNativeSplash.current = true;
    SplashScreen.hide();
  }, []);

  const handleContentReady = useCallback(() => {
    setIsContentReady(true);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View className="flex-1 bg-background" onLayout={handleLayout}>
        <StartupReadyProvider onReady={handleContentReady}>
          <AppProviders>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }} />
            <SessionLiveTripHost />
          </AppProviders>
        </StartupReadyProvider>
        {!isContentReady && <Loader fullPage />}
      </View>
    </GestureHandlerRootView>
  );
}
