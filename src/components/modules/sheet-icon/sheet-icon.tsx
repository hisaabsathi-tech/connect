import Svg, { Path, Rect } from "react-native-svg";

/**
 * The Smart Sheet mark (`assets/mobile/nav/sheet.svg`): the bottom navigation's Sheet icon and
 * each sheet card's. Drawn as native SVG nodes, like the other navigation icons, so release
 * builds don't depend on reading a bundled SVG file. The artwork's soft drop shadows are left
 * out; react-native-svg doesn't render its filter chain reliably on Android.
 */
export function SheetIcon({ size = 26 }: { size?: number }) {
  return (
    <Svg fill="none" height={size} viewBox="0 0 24 24" width={size}>
      <Rect fill="#465FFF" height={24} rx={3.5} width={23.2277} />
      <Path
        d="M18.9611 5.26514C18.9611 5.26514 16.539 6.33567 16.2525 6.52908L16.2528 17.3995L18.9611 18.2372V5.26514Z"
        fill="#CCD3FF"
      />
      <Path
        d="M16.5138 5.26514C16.5138 5.26514 13.1228 6.33567 12.7218 6.52908L12.7222 17.3995L16.5138 18.2372V5.26514Z"
        fill="#F0F2FF"
      />
      <Path
        d="M4.27189 17.7376L13.2494 19.7333V4.2666L4.27049 7.50961H4.2698L4.26967 11.1598C4.27482 13.0428 4.25892 15.854 4.27189 17.7376Z"
        fill="#FFFFFF"
      />
    </Svg>
  );
}
