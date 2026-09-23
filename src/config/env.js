// ENV CONFIG - Chuẩn hóa API base URL theo nền tảng
// ================================================================
// Comment tiếng Việt được đặt phía trên từng khối để giải thích vai trò code.
// Logic hiện tại được giữ nguyên, chỉ bổ sung mô tả cho dễ đọc/bảo trì.
// ================================================================

import { Platform } from "react-native";

// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const DEFAULT_API_URL = Platform.select({
  android: "http://10.0.2.2:5228/api",
  default: "http://localhost:5228/api",
});

// trimTrailingSlash: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function trimTrailingSlash(value) {
  return value?.replace(/\/+$/, "");
}

// getPlatformApiUrl: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getPlatformApiUrl() {
  const platformSpecificUrl = Platform.select({
    android: process.env.EXPO_PUBLIC_API_URL_ANDROID,
    ios: process.env.EXPO_PUBLIC_API_URL_IOS,
    web: process.env.EXPO_PUBLIC_API_URL_WEB,
    default: undefined,
  });
  const configuredUrl = trimTrailingSlash(
    platformSpecificUrl || process.env.EXPO_PUBLIC_API_URL
  );

  if (!configuredUrl) {
    return DEFAULT_API_URL;
  }

  if (Platform.OS === "android") {
    return configuredUrl.replace(
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/api$/i,
      (_, __, port = ":5228") => `http://10.0.2.2${port}/api`
    );
  }

  return configuredUrl;
}

// API_BASE_URL: Hằng số export để các màn hình/service khác dùng chung
export const API_BASE_URL = getPlatformApiUrl();
