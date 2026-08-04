import { apiRequest } from "@/services/api-client";

export function createTrip(payload, accessToken) {
  return apiRequest("/trips", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export function getTrip(tripId, accessToken) {
  return apiRequest(`/trips/${tripId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function getPassengerTrips(accessToken) {
  return apiRequest("/passengers/trips", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function getDriverTrips(accessToken) {
  return apiRequest("/drivers/trips", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
