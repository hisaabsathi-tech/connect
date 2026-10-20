import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { View } from "react-native";

import { HapticButton } from "@/components/modules/button";
import { BottomSheet } from "@/components/modules/sheet";
import { Text } from "@/components/modules/typography";

type DialogTone = "brand" | "danger";

interface DialogOptions {
  title: string;
  description?: string;
  tone?: DialogTone;
}

export interface ConfirmOptions extends DialogOptions {
  confirmLabel: string;
  cancelLabel?: string;
}

export interface AlertOptions extends DialogOptions {
  actionLabel?: string;
}

interface DialogApi {
  /** Resolves true when confirmed; false on cancel, back button, a tap outside or a swipe down. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** A message with a single dismiss button; resolves once it closes. */
  alert: (options: AlertOptions) => Promise<void>;
}

interface OpenDialog extends DialogOptions {
  confirmLabel: string;
  cancelLabel?: string;
}

const DialogContext = createContext<DialogApi | null>(null);

/**
 * App-styled replacement for the system `Alert`, opened through `useDialog()`: a bottom sheet that
 * slides up over a dimmed backdrop. It resolves once it has slid away, so whatever follows (like
 * signing out) happens after the sheet is gone.
 */
export function DialogProvider({ children }: PropsWithChildren) {
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const [visible, setVisible] = useState(false);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);
  const choice = useRef(false);

  const close = useCallback((confirmed: boolean) => {
    choice.current = confirmed;
    setVisible(false);
  }, []);

  const open = useCallback((next: OpenDialog) => {
    // A newer dialog replaces one still showing, which counts as cancelled.
    resolver.current?.(false);
    choice.current = false;
    setDialog(next);
    setVisible(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const onClosed = useCallback(() => {
    const resolve = resolver.current;
    resolver.current = null;
    resolve?.(choice.current);
  }, []);

  const api = useMemo<DialogApi>(
    () => ({
      alert: async ({ actionLabel = "OK", ...options }) => {
        await open({ ...options, confirmLabel: actionLabel });
      },
      confirm: ({ cancelLabel = "Cancel", ...options }) => open({ ...options, cancelLabel }),
    }),
    [open],
  );

  return (
    <DialogContext.Provider value={api}>
      {children}
      <BottomSheet onClose={() => close(false)} onClosed={onClosed} visible={visible}>
        {dialog ? (
          <View accessibilityRole="alert">
            <Text className="mt-5 text-xl font-semibold text-foreground">{dialog.title}</Text>
            {dialog.description ? (
              <Text className="mt-2 text-base leading-6 text-muted-foreground">
                {dialog.description}
              </Text>
            ) : null}
            <View className="mt-7 flex-row gap-3">
              {dialog.cancelLabel ? (
                <HapticButton
                  kind="light"
                  label={dialog.cancelLabel}
                  onPress={() => close(false)}
                />
              ) : null}
              <HapticButton
                kind={dialog.tone === "danger" ? "heavy" : "medium"}
                label={dialog.confirmLabel}
                onPress={() => close(true)}
                tone={dialog.tone === "danger" ? "danger" : "brand"}
              />
            </View>
          </View>
        ) : null}
      </BottomSheet>
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const api = useContext(DialogContext);
  if (!api) throw new Error("useDialog must be used inside DialogProvider");
  return api;
}
