import { Redirect, Stack } from "expo-router";

import { NoPermission } from "@/components/modules/empty-state";
import { useViewer } from "@/lib/auth/viewer";

// The app background (`--background` in global.css).
const SCREEN_BACKGROUND = "#f9fbff";

/**
 * The Orders tab, for delivery work (the Orders menu; its screens need order edit): the list, then an order's
 * barcode scan and its update, stacked
 * so back returns along the way. The bottom navigation stays in view throughout.
 */
export default function OrdersLayout() {
  const { canUpdateOrders, isLoaded, tabs } = useViewer();
  if (isLoaded && !tabs.orders) return <Redirect href="/" />;
  if (isLoaded && !canUpdateOrders)
    return <NoPermission description="Your role needs Orders edit access to deliver orders." />;
  // Opaque screens, so nothing behind shows through while one slides in.
  return (
    <Stack
      screenOptions={{
        animation: "slide_from_right",
        contentStyle: { backgroundColor: SCREEN_BACKGROUND },
        headerShown: false,
      }}
    />
  );
}
