import { apiRequest } from "@/services/api-client";

function getAuthHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

export function createRideSharingRequest(payload, accessToken) {
  return apiRequest("/ride-sharing/requests", {
    method: "POST",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export function getMyRideSharingRequest(accessToken) {
  return apiRequest("/ride-sharing/requests/my", {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });
}

export function getRideSharingRequest(requestId, accessToken) {
  return apiRequest(`/ride-sharing/requests/${requestId}`, {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });
}

export function cancelRideSharingRequest(requestId, payload, accessToken) {
  return apiRequest(`/ride-sharing/requests/${requestId}/cancel`, {
    method: "POST",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export function getMyRideSharingGroup(accessToken) {
  return apiRequest("/ride-sharing/groups/my", {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });
}

export function getRideSharingGroup(groupId, accessToken) {
  return apiRequest(`/ride-sharing/groups/${groupId}`, {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });
}

export function getAvailableRideSharingGroups(direction, accessToken) {
  const searchParams = new URLSearchParams();

  if (direction != null && direction !== "") {
    searchParams.set("direction", String(direction));
  }

  const queryString = searchParams.toString();
  const path = queryString
    ? `/ride-sharing/groups/available?${queryString}`
    : "/ride-sharing/groups/available";

  return apiRequest(path, {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });
}

export function joinRideSharingGroup(groupId, payload, accessToken) {
  return apiRequest(`/ride-sharing/groups/${groupId}/join`, {
    method: "POST",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export function leaveRideSharingGroup(groupId, payload, accessToken) {
  return apiRequest(`/ride-sharing/groups/${groupId}/leave`, {
    method: "POST",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}
