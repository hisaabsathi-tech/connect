import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Keyboard,
  LayoutAnimation,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
  type TextInput,
  type View,
} from "react-native";

// Space kept between the focused field and the keyboard.
export const KEYBOARD_GAP = 12;
// Room above a field for its label, and below it for the next action.
const FIELD_LABEL_SPACE = 40;
const NEXT_ACTION_SPACE = 72;

/**
 * Keeps the focused field of a form scroll view above the keyboard. Attach `viewportRef` and
 * `onViewportLayout` to the view wrapping the ScrollView, `scrollRef` and `onScroll` to the
 * ScrollView, and pass `focusField` to every input's focus handler.
 */
export function useKeyboardReveal() {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  // Part of the scroll view the keyboard covers. ~0 when the window resizes for
  // the keyboard (Android adjustResize / iOS KeyboardAvoidingView), else its height.
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const viewportRef = useRef<View>(null);
  const scrollOffset = useRef(0);
  const focusedInput = useRef<TextInput | null>(null);
  // Window y of the keyboard's top edge; 0 while it is hidden.
  const keyboardTop = useRef(0);

  const measureKeyboardInset = useCallback(() => {
    if (!keyboardTop.current) return;
    viewportRef.current?.measureInWindow((_x, y, _width, height) => {
      setKeyboardInset(Math.max(0, Math.round(y + height - keyboardTop.current)));
    });
  }, []);

  // Scroll only by what is needed to show the focused field (with its label)
  // and the action under it above the keyboard. Fields already visible stay put.
  const revealField = useCallback((input: TextInput | null) => {
    const scroll = scrollRef.current;
    const viewport = viewportRef.current;
    if (!input || !scroll || !viewport) return;
    viewport.measureInWindow((_sx, viewTop, _sw, viewHeight) => {
      const visibleTop = viewTop + FIELD_LABEL_SPACE;
      const visibleBottom =
        Math.min(viewTop + viewHeight, keyboardTop.current || Number.POSITIVE_INFINITY) -
        KEYBOARD_GAP;
      input.measureInWindow((_x, top, _width, height) => {
        const bottom = top + height + NEXT_ACTION_SPACE;
        let delta = 0;
        // Never push the field's label above the visible area to reveal the action.
        if (bottom > visibleBottom) delta = Math.min(bottom - visibleBottom, top - visibleTop);
        else if (top < visibleTop) delta = top - visibleTop;
        if (Math.abs(delta) < 4) return;
        scroll.scrollTo({ animated: true, y: Math.max(0, scrollOffset.current + delta) });
      });
    });
  }, []);

  const focusField = useCallback(
    (input: TextInput | null) => {
      if (!input) return;
      focusedInput.current = input;
      // Opening keyboard: keyboardDidShow reveals it once the layout settles.
      if (keyboardTop.current) setTimeout(() => revealField(input), 60);
    },
    [revealField],
  );

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (event) => {
      const { height, screenY } = event.endCoordinates;
      keyboardTop.current = screenY || Dimensions.get("window").height - height;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardVisible(true);
      measureKeyboardInset();
      setTimeout(() => revealField(focusedInput.current), 140);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      keyboardTop.current = 0;
      focusedInput.current = null;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardVisible(false);
      setKeyboardInset(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [measureKeyboardInset, revealField]);

  const onViewportLayout = useCallback(
    (event: LayoutChangeEvent) => {
      setViewportHeight(event.nativeEvent.layout.height);
      measureKeyboardInset();
    },
    [measureKeyboardInset],
  );

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffset.current = event.nativeEvent.contentOffset.y;
  }, []);

  return {
    focusField,
    keyboardInset,
    keyboardVisible,
    onScroll,
    onViewportLayout,
    scrollRef,
    viewportHeight,
    viewportRef,
  };
}
