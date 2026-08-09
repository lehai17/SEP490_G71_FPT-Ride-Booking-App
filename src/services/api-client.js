import { API_BASE_URL } from "@/config/env";

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

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    throw new Error(
      `Không kết nối được BE ${API_BASE_URL}${path}: ${
        error?.message || "Request failed"
      }`
    );
  }

  const rawText = await response.text();
  let payload = null;

  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const fallbackMessage =
      rawText?.trim() || `HTTP ${response.status} ${path}: Request failed`;
    const message = getErrorMessage(payload, fallbackMessage);
    const error = new Error(`HTTP ${response.status} ${path}: ${message}`);
    error.status = response.status;
    error.path = path;
    error.payload = payload;
    error.rawText = rawText;
    throw error;
  }

  return payload;
}
