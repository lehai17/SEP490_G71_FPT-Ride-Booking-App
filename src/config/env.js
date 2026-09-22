import { Platform } from "react-native";

const DEFAULT_API_URL = Platform.select({
  android: "http://10.0.2.2:5228/api",
  default: "http://localhost:5228/api",
});

function trimTrailingSlash(value) {
  return value?.replace(/\/+$/, "");
}

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

export const API_BASE_URL = getPlatformApiUrl();
