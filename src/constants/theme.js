// THEME CONSTANTS - Màu sắc, font, spacing và kích thước dùng chung
// ================================================================
// Comment tiếng Việt được đặt phía trên từng khối để giải thích vai trò code.
// Logic hiện tại được giữ nguyên, chỉ bổ sung mô tả cho dễ đọc/bảo trì.
// ================================================================

/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import "@/global.css";

import { Platform } from "react-native";

// Colors: Hằng số export để các màn hình/service khác dùng chung
export const Colors = {
  light: {
    text: "#000000",
    background: "#ffffff",
    // Use white primary surfaces for the app — orange accents are applied elsewhere
    backgroundElement: "#ffffff",
    // subtle selected tint for buttons or badges
    backgroundSelected: "#FFF4EF",
    textSecondary: "#60646C",
  },
  dark: {
    text: "#ffffff",
    background: "#000000",
    backgroundElement: "#212225",
    backgroundSelected: "#2E3135",
    textSecondary: "#B0B4BA",
  },
};

// Fonts: Hằng số export để các màn hình/service khác dùng chung
export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    serif: "var(--font-serif)",
    rounded: "var(--font-rounded)",
    mono: "var(--font-mono)",
  },
});

// Spacing: Hằng số export để các màn hình/service khác dùng chung
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
};

// BottomTabInset: Hằng số export để các màn hình/service khác dùng chung
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
// MaxContentWidth: Hằng số export để các màn hình/service khác dùng chung
export const MaxContentWidth = 800;

// ScreenHeaderTop: Hằng số export để các màn hình/service khác dùng chung
export const ScreenHeaderTop = Spacing.four;
// ScreenTitleStyle: Hằng số export để các màn hình/service khác dùng chung
export const ScreenTitleStyle = {
  fontSize: 28,
  fontWeight: "700",
  color: "#111827",
};
