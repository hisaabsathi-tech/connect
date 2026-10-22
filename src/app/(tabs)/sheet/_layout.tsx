import { Redirect, Stack } from "expo-router";

import { useViewer } from "@/lib/auth/viewer";

// The app background (`--background` in global.css).
const SCREEN_BACKGROUND = "#f9fbff";

/**
 * The Sheet tab, for a role granted the Smart Sheet menu: the sheets, then choosing a client for
 * a new one, stacked so back returns to the list. The bottom navigation stays in view throughout.
 */
export default function SheetLayout() {
  const { canViewSheets, isLoaded } = useViewer();
  if (isLoaded && !canViewSheets) return <Redirect href="/" />;
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
