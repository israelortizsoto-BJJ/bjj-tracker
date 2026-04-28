import type { TextStyle, ViewStyle } from "react-native";

/**
 * Minimal token subset for compile stability — only shapes needed by
 * `app/(tabs)/this-week/index.tsx`. Not a full design system.
 */
const type = {
  display: { fontSize: 28, fontWeight: "800" as const, lineHeight: 34 },
  h1: { fontSize: 28, fontWeight: "800" as const, lineHeight: 34 },
  h2: { fontSize: 20, fontWeight: "800" as const, lineHeight: 26 },
  title: { fontSize: 16, fontWeight: "800" as const, lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: "700" as const, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: "400" as const, lineHeight: 22 },
  label: { fontSize: 12, fontWeight: "800" as const, letterSpacing: 0.6, lineHeight: 16 },
  caption: { fontSize: 12, fontWeight: "500" as const, lineHeight: 16 },
} satisfies Record<string, TextStyle>;

const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  8: 32,
} as const;

const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

const layout = {
  screenPaddingX: 20,
  cardPadding: 16,
  sectionGap: 20,
} as const;

const colors = {
  brand: {
    500: "#6366f1",
    600: "#4f46e5",
  },
  surface: {
    app: "#f3f2f8",
    card: "#fefdff",
    cardMuted: "#f4f2fb",
    accent: "#e8e4ff",
  },
  text: {
    primary: "#111827",
    secondary: "#4b5563",
    muted: "#6b7280",
    onBrand: "#ffffff",
  },
  border: {
    default: "#e5e7eb",
    accent: "#e8d4ec",
  },
  semantic: {
    successBg: "#ecfdf3",
    successText: "#047857",
    warningBg: "#fff7ed",
    warningText: "#c2410c",
    infoBg: "#eff6ff",
    infoText: "#1d4ed8",
  },
} as const;

const elevation: { card: ViewStyle } = {
  card: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
};

export const tokens = {
  type,
  space,
  radius,
  layout,
  colors,
  elevation,
} as const;
