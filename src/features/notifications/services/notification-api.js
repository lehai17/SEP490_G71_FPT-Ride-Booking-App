import { apiRequest } from "@/services/api-client";

function getAuthHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

export function getMyNotifications(accessToken) {
  return apiRequest("/notifications/me", {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });
}

export function markNotificationAsRead(notificationId, accessToken) {
  return apiRequest(`/notifications/${notificationId}/read`, {
    method: "PUT",
    headers: getAuthHeaders(accessToken),
  });
}
