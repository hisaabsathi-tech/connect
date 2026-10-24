import { Redirect, Stack } from "expo-router";

import { NoPermission } from "@/components/modules/empty-state";
import { useViewer } from "@/lib/auth/viewer";

// The app background (`--background` in global.css).
const SCREEN_BACKGROUND = "#f9fbff";

/**
 * The Sheet tab, for a role granted the app's Sheet menu: the sheets, then choosing a client for
 * a new one, stacked so back returns to the list. The bottom navigation stays in view throughout.
 */
export default function SheetLayout() {
  const { canViewSheets, isLoaded, tabs } = useViewer();
  if (isLoaded && !tabs.sheet) return <Redirect href="/" />;
  if (isLoaded && !canViewSheets)
    return (
      <NoPermission description="Your role needs Orders view access (all orders) to open Smart Sheets." />
    );
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
