import { Platform } from "react-native";

const DEFAULT_API_URL = Platform.select({
  android: "http://10.0.2.2:5228/api",
  default: "http://localhost:5228/api",
});

function trimTrailingSlash(value) {
  return value?.replace(/\/+$/, "");
}

export const API_BASE_URL =
  trimTrailingSlash(process.env.EXPO_PUBLIC_API_URL) ?? DEFAULT_API_URL;

