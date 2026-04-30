/**
 * Legacy `IconSymbol` entry point — external SF Symbol / Material fallbacks disabled.
 * Use `import Icon from "src/components/Icon"` for SVG icons.
 */
import type { StyleProp, TextStyle } from "react-native";

export function IconSymbol(_props: {
  name?: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return null;
}
