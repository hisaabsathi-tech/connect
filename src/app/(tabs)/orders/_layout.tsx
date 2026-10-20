import { Redirect, Stack } from "expo-router";

import { useViewer } from "@/lib/auth/viewer";

// The app background (`--background` in global.css).
const SCREEN_BACKGROUND = "#f9fbff";

/**
 * The delivery boy's Orders tab: the list, then an order's barcode scan and its update, stacked
 * so back returns along the way. The bottom navigation stays in view throughout.
 */
export default function OrdersLayout() {
  const { isDeliveryBoy, isLoaded } = useViewer();
  if (isLoaded && !isDeliveryBoy) return <Redirect href="/" />;
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
