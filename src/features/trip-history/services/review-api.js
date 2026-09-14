import { apiRequest } from "@/services/api-client";

function getAuthHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

export function createReview(payload, accessToken) {
  return apiRequest("/reviews", {
    method: "POST",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export function getMyReviews(accessToken) {
  return apiRequest("/reviews/my", {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });
}

export function getTripReviews(tripId, accessToken) {
  return apiRequest(`/reviews/trip/${tripId}`, {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });
}

export function getDriverReviews(driverId, accessToken) {
  return apiRequest(`/reviews/driver/${driverId}`, {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });
}

export function getDriverRatingSummary(driverId, accessToken) {
  return apiRequest(`/reviews/driver/${driverId}/summary`, {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });
}
