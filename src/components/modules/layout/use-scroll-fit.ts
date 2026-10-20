import { useState } from "react";
import type { LayoutChangeEvent } from "react-native";

/**
 * Props for a vertical ScrollView or FlatList that only scrolls when its content is taller than
 * the space it has: content that fits shows no scrollbar and no overscroll stretch. Pull to
 * refresh still works either way.
 */
export function useScrollFit() {
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  // Until both are measured, behave as usual. A pixel of slack absorbs rounding.
  const scrollable = !(viewport && content) || content > viewport + 1;
  return {
    onContentSizeChange: (_width: number, height: number) => setContent(height),
    onLayout: (event: LayoutChangeEvent) => setViewport(event.nativeEvent.layout.height),
    overScrollMode: scrollable ? ("auto" as const) : ("never" as const),
    scrollEnabled: scrollable,
    showsVerticalScrollIndicator: scrollable,
  };
}
