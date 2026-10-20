import { useSafeAreaInsets } from "react-native-safe-area-context";

// Breathing room between the status bar and a screen's first row.
const TOP_GAP = 8;

/**
 * Where every screen's content starts: just below the status bar. Screens and headers use this
 * instead of their own top padding, so auth and the tabs all begin at the same height.
 */
export function useScreenTop() {
  return useSafeAreaInsets().top + TOP_GAP;
}
