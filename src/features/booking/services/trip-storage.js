import * as SecureStore from "expo-secure-store";

const BOOKED_TRIPS_STORAGE_KEY = "fpt-ride.booked-trips";

function getField(source, camelKey, pascalKey) {
  return source?.[camelKey] ?? source?.[pascalKey];
}

function parseBackendDateTime(value) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) {
    return null;
  }

  const normalizedValue = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(rawValue)
    ? rawValue
    : `${rawValue}Z`;
  const date = new Date(normalizedValue);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatVietnamDateTime(value) {
  const utcDate = parseBackendDateTime(value);

  if (!utcDate) {
    return "";
  }

  const vietnamDate = new Date(utcDate.getTime() + 7 * 60 * 60 * 1000);
  return `${String(vietnamDate.getUTCDate()).padStart(2, "0")}/${String(
    vietnamDate.getUTCMonth() + 1
  ).padStart(2, "0")} ${String(vietnamDate.getUTCHours()).padStart(
    2,
    "0"
  )}:${String(vietnamDate.getUTCMinutes()).padStart(2, "0")}`;
}

async function readBookedTrips() {
  const rawTrips = await SecureStore.getItemAsync(BOOKED_TRIPS_STORAGE_KEY);

  if (!rawTrips) {
    return [];
  }

  try {
    const parsedTrips = JSON.parse(rawTrips);
    return Array.isArray(parsedTrips) ? parsedTrips : [];
  } catch {
    return [];
  }
}

async function writeBookedTrips(trips) {
  await SecureStore.setItemAsync(
    BOOKED_TRIPS_STORAGE_KEY,
    JSON.stringify(trips ?? [])
  );
}

export async function persistBookedTrip(trip) {
  const currentTrips = await readBookedTrips();
  const nextTrip = {
    ...trip,
    id: trip.id || `trip-${Date.now()}`,
    createdAt: trip.createdAt || new Date().toISOString(),
  };

  const dedupedTrips = currentTrips.filter((item) => item.id !== nextTrip.id);
  const nextTrips = [nextTrip, ...dedupedTrips].slice(0, 30);

  await writeBookedTrips(nextTrips);

  return nextTrip;
}

export async function loadBookedTrips() {
  return readBookedTrips();
}

export async function removeBookedTrip(tripId) {
  const currentTrips = await readBookedTrips();
  await writeBookedTrips(currentTrips.filter((trip) => trip.id !== tripId));
}

export function toActiveTripSectionItem(trip) {
  const route =
    trip.route || `${trip.pickup || ""} → ${trip.destination || ""}`.trim();
  const price = trip.price || trip.estimatedFare || "--";
  const meta = trip.statusLabel || `Đang tìm tài xế · ${price}`;

  return {
    id: trip.id,
    icon: trip.icon || "🚗",
    route,
    meta,
    actionPrimary: "Liên hệ",
    actionSecondary: "Hủy",
    rating: null,
  };
}

export function toScheduledTripSectionItem(trip) {
  const route =
    trip.route || `${trip.pickup || ""} → ${trip.destination || ""}`.trim();
  const price = trip.price || trip.estimatedFare || "--";
  const scheduledAtValue = getField(trip, "scheduledAt", "ScheduledAt");
  const scheduledAt = parseBackendDateTime(scheduledAtValue);
  const scheduleText =
    formatVietnamDateTime(scheduledAtValue) || trip.scheduledRideTime || "";

  return {
    id: trip.id,
    icon: trip.icon || "🚗",
    route,
    meta: `${scheduleText} · ${price}`,
    actionPrimary: "Sửa",
    actionSecondary: "Hủy",
    rating: null,
    scheduledAt: scheduledAtValue || "",
    scheduledPickupText: trip.scheduledPickupText || scheduleText,
    status: getField(trip, "status", "Status") ?? "",
    statusLabel: trip.statusLabel || "",
    createdAt: getField(trip, "createdAt", "CreatedAt") || "",
    distanceText: trip.tripDistance || trip.distanceText || "",
    durationText: trip.tripDuration || trip.durationText || "",
    sortTimestamp:
      scheduledAt && !Number.isNaN(scheduledAt.getTime())
        ? scheduledAt.getTime()
        : 0,
  };
}
