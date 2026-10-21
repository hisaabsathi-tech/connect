import type { PropsWithChildren } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { DialogProvider } from "@/components/modules/dialog";
import { NetworkProvider } from "@/components/modules/network";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { ToastProvider } from "@/components/ui/toast";
import { AuthSessionProvider } from "@/lib/auth/session";
import { DateFilterProvider } from "@/lib/date";

/** App-wide state and UI providers, in dependency order. */
export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <AuthSessionProvider>
        <DateFilterProvider>
          <GluestackUIProvider mode="light">
            <ToastProvider>
              <DialogProvider>
                {/* Connection state, the offline sheet and sending what was saved offline. */}
                <NetworkProvider>{children}</NetworkProvider>
              </DialogProvider>
            </ToastProvider>
          </GluestackUIProvider>
        </DateFilterProvider>
      </AuthSessionProvider>
    </SafeAreaProvider>
  );
}
