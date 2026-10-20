import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { type LayoutChangeEvent, Modal, Pressable, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { HapticButton } from "@/components/modules/button";
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

const ENTER = { duration: 320, easing: Easing.out(Easing.cubic) };
const EXIT = { duration: 220, easing: Easing.in(Easing.cubic) };
// Dragged past this share of its height (or flicked down this fast), the sheet dismisses.
const DISMISS_SHARE = 0.3;
const DISMISS_VELOCITY = 900;

const DialogContext = createContext<DialogApi | null>(null);

/**
 * App-styled replacement for the system `Alert`, opened through `useDialog()`: a bottom sheet that
 * slides up over a dimmed backdrop. It resolves once it has slid away, so whatever follows (like
 * signing out) happens after the sheet is gone.
 */
export function DialogProvider({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const [mounted, setMounted] = useState(false);
  const shown = useRef(false);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);
  const closing = useRef(false);
  const choice = useRef(false);

  // 0 = off screen, 1 = fully up. `drag` adds the finger's pull on top.
  const progress = useSharedValue(0);
  const drag = useSharedValue(0);
  // Off screen until the sheet has measured itself.
  const height = useSharedValue(1000);

  const finish = useCallback(() => {
    shown.current = false;
    closing.current = false;
    setMounted(false);
    const resolve = resolver.current;
    resolver.current = null;
    resolve?.(choice.current);
  }, []);

  const close = useCallback(
    (confirmed: boolean) => {
      if (closing.current || !resolver.current) return;
      closing.current = true;
      choice.current = confirmed;
      progress.value = withTiming(0, EXIT, (finished) => {
        if (finished) scheduleOnRN(finish);
      });
    },
    [finish, progress],
  );

  const open = useCallback(
    (next: OpenDialog) => {
      // A newer dialog replaces one still showing, which counts as cancelled.
      resolver.current?.(closing.current ? choice.current : false);
      closing.current = false;
      drag.value = 0;
      setDialog(next);
      setMounted(true);
      // Already on screen (or sliding away): bring it back up with the new content.
      if (shown.current) progress.value = withTiming(1, ENTER);
      return new Promise<boolean>((resolve) => {
        resolver.current = resolve;
      });
    },
    [drag, progress],
  );

  const api = useMemo<DialogApi>(
    () => ({
      alert: async ({ actionLabel = "OK", ...options }) => {
        await open({ ...options, confirmLabel: actionLabel });
      },
      confirm: ({ cancelLabel = "Cancel", ...options }) => open({ ...options, cancelLabel }),
    }),
    [open],
  );

  const dismissOnPull = useCallback(() => close(false), [close]);
  const pull = Gesture.Pan()
    .activeOffsetY(8)
    .failOffsetX([-20, 20])
    .onUpdate((event) => {
      drag.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY > height.value * DISMISS_SHARE || event.velocityY > DISMISS_VELOCITY)
        scheduleOnRN(dismissOnPull);
      else drag.value = withSpring(0, { damping: 20, stiffness: 240 });
    });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * Math.max(0, 1 - drag.value / height.value),
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * height.value + drag.value }],
  }));

  const onSheetLayout = (event: LayoutChangeEvent) => {
    height.value = event.nativeEvent.layout.height;
  };

  return (
    <DialogContext.Provider value={api}>
      {children}
      <Modal
        animationType="none"
        navigationBarTranslucent
        onRequestClose={() => close(false)}
        onShow={() => {
          shown.current = true;
          progress.value = withTiming(1, ENTER);
        }}
        statusBarTranslucent
        transparent
        visible={mounted}
      >
        <GestureHandlerRootView style={{ flex: 1, justifyContent: "flex-end" }}>
          <Animated.View
            style={[{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }, backdropStyle]}
          >
            <Pressable
              accessibilityLabel="Close"
              className="flex-1 bg-[#161950]/50"
              onPress={() => close(false)}
            />
          </Animated.View>
          {dialog ? (
            <GestureDetector gesture={pull}>
              <Animated.View onLayout={onSheetLayout} style={sheetStyle}>
                <View
                  accessibilityRole="alert"
                  className="border-border border-t bg-card px-5 pt-3"
                  style={{ elevation: 12, paddingBottom: insets.bottom + 20 }}
                >
                  <View className="h-1 w-10 self-center bg-border" />
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
              </Animated.View>
            </GestureDetector>
          ) : null}
        </GestureHandlerRootView>
      </Modal>
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const api = useContext(DialogContext);
  if (!api) throw new Error("useDialog must be used inside DialogProvider");
  return api;
}
