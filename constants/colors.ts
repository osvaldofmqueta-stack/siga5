const PRIMARY = "#1A2B5F";
const ACCENT = "#CC1A1A";
const GOLD = "#F0A500";

export const Colors = {
  primary: PRIMARY,
  primaryLight: "#2D4A8A",
  primaryDark: "#0D1B3E",
  accent: ACCENT,
  accentLight: "#E53935",
  gold: GOLD,
  goldLight: "#FFD166",
  background: "#0D1B3E",
  backgroundCard: "#132145",
  backgroundElevated: "#1C3060",
  surface: "#1A2B5F",
  surfaceLight: "#243A78",
  border: "rgba(255,255,255,0.1)",
  borderLight: "rgba(255,255,255,0.2)",
  text: "#FFFFFF",
  textSecondary: "rgba(255,255,255,0.65)",
  textMuted: "rgba(255,255,255,0.35)",
  success: "#2ECC71",
  warning: "#F39C12",
  danger: "#E74C3C",
  info: "#3498DB",
  approved: "#27AE60",
  failed: "#E74C3C",
  pending: "#F39C12",
};

export default {
  light: {
    text: Colors.text,
    background: Colors.background,
    tint: Colors.accent,
    tabIconDefault: Colors.textMuted,
    tabIconSelected: Colors.accent,
  },
};
