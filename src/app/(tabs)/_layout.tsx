import { Redirect, Tabs } from "expo-router";
import { View } from "react-native";

import { BottomNavigation } from "@/components/modules/layout";
import { Loader, useStartupReady } from "@/components/modules/system";
import { useAuthSession } from "@/lib/auth/session";
import { ViewerProvider } from "@/lib/auth/viewer";

type TabNavigation = {
  dispatch: (action: { payload: object; target: string; type: "RESET" }) => void;
  getState: () => {
    routes: { name: string; state?: { key?: string; routes: { name: string }[] } }[];
  };
};

/**
 * Leaving Orders puts its stack back to just the list. An order opened from a trip card starts
 * the stack on its scan page, and without this the Orders tab kept reopening that scan.
 */
function resetOrdersOnBlur({ navigation }: { navigation: TabNavigation }) {
  return {
    blur: () => {
      const stack = navigation.getState().routes.find((route) => route.name === "orders")?.state;
      if (!stack?.key || (stack.routes.length === 1 && stack.routes[0].name === "index")) return;
      navigation.dispatch({
        payload: { index: 0, routes: [{ name: "index" }] },
        target: stack.key,
        type: "RESET",
      });
    },
  };
}

/**
 * Signed-in destinations. `history` makes the system back button retrace the tabs the user
 * actually visited (Attendance → back → Home) instead of leaving the app.
 */
export default function TabsLayout() {
  const markStartupReady = useStartupReady();
  const { isReady, organizationKey, token } = useAuthSession();

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
      {/* Keyed with the tabs, so a new organisation loads the member's role there afresh. */}
      <ViewerProvider key={organizationKey}>
        <Tabs
          backBehavior="history"
          // A new active organisation starts every tab over with its data.
          key={organizationKey}
          // `shift` preserves a horizontal, directional-feeling transition between tabs.
          screenOptions={{ animation: "shift", headerShown: false }}
          tabBar={(props) => <BottomNavigation {...props} />}
        >
          <Tabs.Screen name="index" />
          <Tabs.Screen listeners={resetOrdersOnBlur} name="orders" />
          <Tabs.Screen name="pickups" />
          <Tabs.Screen name="attendance" />
          <Tabs.Screen name="profile" />
        </Tabs>
      </ViewerProvider>
    </View>
  );
}
