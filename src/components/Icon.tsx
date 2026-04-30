import type { ImageSourcePropType } from "react-native";
import { Image } from "react-native";

export type IconName =
  | "training-sessions"
  | "top-system"
  | "top-technique"
  | "14-day-focus"
  | "gi-vs-nogi"
  | "competition"
  | "insight";

const ICON_MAP: Record<IconName, ImageSourcePropType> = {
  "training-sessions": require("../../assets/icons/training.png"),
  "top-system": require("../../assets/icons/system.png"),
  "top-technique": require("../../assets/icons/technique.png"),
  "14-day-focus": require("../../assets/icons/focus.png"),
  "gi-vs-nogi": require("../../assets/icons/gi.png"),
  competition: require("../../assets/icons/competition.png"),
  insight: require("../../assets/icons/insight.png"),
};

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
};

export default function Icon({ name, size = 20, color = "#FFFFFF" }: IconProps) {
  const source = ICON_MAP[name];

  if (!source) {
    console.warn("Icon missing:", name);
    return null;
  }

  return (
    <Image
      source={source}
      resizeMode="contain"
      style={{ width: size, height: size, tintColor: color }}
    />
  );
}
