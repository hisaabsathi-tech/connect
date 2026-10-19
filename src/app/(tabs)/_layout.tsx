import { Redirect, Tabs } from "expo-router";
import { View } from "react-native";

import { BottomNavigation } from "@/components/modules/layout";
import { Loader, useStartupReady } from "@/components/modules/system";
import { useAuthSession } from "@/lib/auth/session";

/**
 * Signed-in destinations. `history` makes the system back button retrace the tabs the user
 * actually visited (Attendance → back → Home) instead of leaving the app.
 */
export default function TabsLayout() {
  const markStartupReady = useStartupReady();
  const { isReady, token } = useAuthSession();

  if (!isReady) return <Loader fullPage />;
  if (!token)
    return (
      <>
        <Loader fullPage />
        <Redirect href="/auth" />
      </>
    );
  return (
    <View className="flex-1 bg-background" onLayout={markStartupReady}>
      <Tabs
        backBehavior="history"
        // `shift` preserves a horizontal, directional-feeling transition between tabs.
        screenOptions={{ animation: "shift", headerShown: false }}
        tabBar={(props) => <BottomNavigation {...props} />}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="attendance" />
        <Tabs.Screen name="profile" />
      </Tabs>
    </View>
  );
}
