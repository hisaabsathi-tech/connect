import { type PropsWithChildren, useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  type LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  View,
} from "react-native";
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

const ENTER = { duration: 320, easing: Easing.out(Easing.cubic) };
const EXIT = { duration: 220, easing: Easing.in(Easing.cubic) };
// Dragged past this share of its height (or flicked down this fast), the sheet dismisses.
const DISMISS_SHARE = 0.3;
const DISMISS_VELOCITY = 900;

interface BottomSheetProps {
  visible: boolean;
  /** Asked to close: backdrop tap, back button or a swipe down. */
  onClose: () => void;
  /** Called once the sheet has fully slid away. */
  onClosed?: () => void;
  /** False while work is running (e.g. an upload), so nothing dismisses it mid-way. */
  dismissible?: boolean;
  /**
   * Only the handle at the top drags the sheet down, so content that scrolls (a long list)
   * keeps its own vertical drags.
   */
  dragHandleOnly?: boolean;
}

/**
 * A card that slides up from the bottom over a dimmed backdrop and can be dragged down to close.
 * It stays mounted while sliding away, so its content doesn't vanish mid-animation.
 */
export function BottomSheet({
  children,
  dismissible = true,
  dragHandleOnly = false,
  onClose,
  onClosed,
  visible,
}: PropsWithChildren<BottomSheetProps>) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const shown = useRef(false);
  // Gesture and modal callbacks read the latest props through this ref.
  const latest = useRef({ dismissible, onClose, onClosed });
  useEffect(() => {
    latest.current = { dismissible, onClose, onClosed };
  }, [dismissible, onClose, onClosed]);

  // 0 = off screen, 1 = fully up. `drag` adds the finger's pull on top.
  const progress = useSharedValue(0);
  const drag = useSharedValue(0);
  // Off screen until the sheet has measured itself.
  const height = useSharedValue(1000);

  const finish = useCallback(() => {
    shown.current = false;
    setMounted(false);
    latest.current.onClosed?.();
  }, []);

  useEffect(() => {
    if (visible) {
      drag.value = 0;
      setMounted(true);
      // Already on screen (or sliding away): bring it back up.
      if (shown.current) progress.value = withTiming(1, ENTER);
    } else if (shown.current) {
      progress.value = withTiming(0, EXIT, (finished) => {
        if (finished) scheduleOnRN(finish);
      });
    } else setMounted(false);
  }, [drag, finish, progress, visible]);

  const requestClose = useCallback(() => {
    if (latest.current.dismissible) latest.current.onClose();
  }, []);
  const pull = Gesture.Pan()
    .activeOffsetY(8)
    .failOffsetX([-20, 20])
    .onUpdate((event) => {
      drag.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY > height.value * DISMISS_SHARE || event.velocityY > DISMISS_VELOCITY)
        scheduleOnRN(requestClose);
      drag.value = withSpring(0, { damping: 20, stiffness: 240 });
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

  const handle = <View className="h-1 w-10 self-center bg-border" />;
  const sheet = (
    <Animated.View onLayout={onSheetLayout} style={sheetStyle}>
      <View
        className="border-border border-t bg-card px-5 pt-3"
        style={{ elevation: 12, paddingBottom: insets.bottom + 20 }}
      >
        {dragHandleOnly ? (
          <GestureDetector gesture={pull}>
            {/* A strip wider and taller than the pill itself, so it is easy to grab. */}
            <View className="-mx-5 -mt-3 pt-3 pb-2">{handle}</View>
          </GestureDetector>
        ) : (
          handle
        )}
        {children}
      </View>
    </Animated.View>
  );

  return (
    <Modal
      animationType="none"
      navigationBarTranslucent
      onRequestClose={requestClose}
      onShow={() => {
        shown.current = true;
        progress.value = withTiming(1, ENTER);
      }}
      statusBarTranslucent
      transparent
      visible={mounted}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <Animated.View
            style={[{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }, backdropStyle]}
          >
            <Pressable
              accessibilityLabel="Close"
              className="flex-1 bg-[#161950]/50"
              onPress={requestClose}
            />
          </Animated.View>
          {dragHandleOnly ? sheet : <GestureDetector gesture={pull}>{sheet}</GestureDetector>}
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}
