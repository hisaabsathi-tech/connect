import "../../global.css";

import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Loader, StartupReadyProvider } from "@/components/modules/system";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";

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
    <View className="flex-1 bg-background" onLayout={handleLayout}>
      <StartupReadyProvider onReady={handleContentReady}>
        <SafeAreaProvider>
          <GluestackUIProvider mode="light">
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }} />
          </GluestackUIProvider>
        </SafeAreaProvider>
      </StartupReadyProvider>
      {!isContentReady && <Loader fullPage />}
    </View>
  );
}
