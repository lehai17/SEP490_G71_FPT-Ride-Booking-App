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
