import { OverlayProvider } from "@gluestack-ui/core/overlay/creator";
import { ToastProvider } from "@gluestack-ui/core/toast/creator";
import type React from "react";
import { useEffect } from "react";
import { Appearance, View, type ViewProps } from "react-native";

export type ModeType = "light" | "dark" | "system";

/**
 * Hosts gluestack-ui overlays (modal, popover, actionsheet…) and toasts.
 * Connector only ships light tokens in global.css, so "light" is the default.
 */
export function GluestackUIProvider({
  mode = "light",
  ...props
}: {
  mode?: ModeType;
  children?: React.ReactNode;
  style?: ViewProps["style"];
}) {
  useEffect(() => {
    Appearance.setColorScheme(mode === "system" ? "unspecified" : mode);
  }, [mode]);

  return (
    <View style={[{ flex: 1, height: "100%", width: "100%" }, props.style]}>
      <OverlayProvider>
        <ToastProvider>{props.children}</ToastProvider>
      </OverlayProvider>
    </View>
  );
}
