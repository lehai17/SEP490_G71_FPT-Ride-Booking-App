import { apiRequest } from "@/services/api-client";

export function register(payload) {
  return apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function login(payload) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function refreshToken(refreshTokenValue) {
  return apiRequest("/auth/refresh-token", {
    method: "POST",
    body: JSON.stringify({ refreshToken: refreshTokenValue }),
  });
}

export function logout(accessToken) {
  return apiRequest("/auth/logout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function sendVerifyEmailOtp(payload) {
  return apiRequest("/auth/verify-email/send", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function verifyEmailOtp(payload) {
  return apiRequest("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function forgotPassword(payload) {
  return apiRequest("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function resetPassword(payload) {
  return apiRequest("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function changePassword(payload, accessToken) {
  return apiRequest("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function getProfile(userId, accessToken) {
  return apiRequest(`/auth/profile/${userId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function updateProfile(userId, payload, accessToken) {
  return apiRequest(`/auth/profile/${userId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
