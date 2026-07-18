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

function getErrorMessage(payload, fallbackMessage) {
  if (Array.isArray(payload)) {
    const messages = payload
      .map((item) => item?.errorMessage || item?.ErrorMessage || item?.message)
      .filter(Boolean);

    if (messages.length > 0) {
      return messages.join("\n");
    }
  }

  if (payload?.errors && typeof payload.errors === "object") {
    const messages = Object.entries(payload.errors).flatMap(
      ([fieldName, fieldErrors]) => {
        if (Array.isArray(fieldErrors)) {
          return fieldErrors.map((message) => `${fieldName}: ${message}`);
        }

        return fieldErrors ? [`${fieldName}: ${fieldErrors}`] : [];
      }
    );

    if (messages.length > 0) {
      return messages.join("\n");
    }
  }

  return (
    payload?.message ||
    payload?.title ||
    payload?.error ||
    fallbackMessage
  );
}

export async function apiRequest(path, options = {}) {
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers ?? {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const rawText = await response.text();
  const payload = rawText ? JSON.parse(rawText) : null;

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, "Request failed"));
  }

  return payload;
}
