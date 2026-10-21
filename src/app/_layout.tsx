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

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 300, fade: true });

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
          </AppProviders>
        </StartupReadyProvider>
        {!isContentReady && <Loader fullPage />}
      </View>
    </GestureHandlerRootView>
  );
}
