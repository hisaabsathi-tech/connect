import { Text as NativeText, type TextProps } from "react-native";

/**
 * App text, set in Satoshi unless a className picks another family. Satoshi is embedded natively
 * with Regular at 400 and Medium at 500+, so `font-medium`/`font-semibold` use the real Medium face.
 */
export function Text({ className, ...props }: TextProps) {
  return <NativeText className={className ? `font-sans ${className}` : "font-sans"} {...props} />;
}
