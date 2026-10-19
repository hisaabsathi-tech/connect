import "../../global.css";

import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Loader, StartupReadyProvider } from "@/components/modules/system";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { ToastProvider } from "@/components/ui/toast";
import { AuthSessionProvider } from "@/lib/auth/session";

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 300, fade: true });

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Satoshi: require("@/assets/fonts/Satoshi-Regular.otf"),
    "Satoshi-Medium": require("@/assets/fonts/Satoshi-Medium.otf"),
  });
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

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View className="flex-1 bg-background" onLayout={handleLayout}>
        <StartupReadyProvider onReady={handleContentReady}>
          <SafeAreaProvider>
            <AuthSessionProvider>
              <GluestackUIProvider mode="light">
                <ToastProvider>
                  <StatusBar style="dark" />
                  <Stack screenOptions={{ headerShown: false }} />
                </ToastProvider>
              </GluestackUIProvider>
            </AuthSessionProvider>
          </SafeAreaProvider>
        </StartupReadyProvider>
        {!isContentReady && <Loader fullPage />}
      </View>
    </GestureHandlerRootView>
  );
}
