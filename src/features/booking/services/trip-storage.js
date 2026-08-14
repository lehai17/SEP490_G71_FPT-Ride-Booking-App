import * as SecureStore from "expo-secure-store";

const BOOKED_TRIPS_STORAGE_KEY = "fpt-ride.booked-trips";

function getField(source, camelKey, pascalKey) {
  return source?.[camelKey] ?? source?.[pascalKey];
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
  const scheduledAt = scheduledAtValue ? new Date(scheduledAtValue) : null;
  const scheduleText =
    scheduledAt && !Number.isNaN(scheduledAt.getTime())
      ? `${String(scheduledAt.getDate()).padStart(2, "0")}/${String(
          scheduledAt.getMonth() + 1
        ).padStart(2, "0")} ${String(scheduledAt.getHours()).padStart(
          2,
          "0"
        )}:${String(scheduledAt.getMinutes()).padStart(2, "0")}`
      : trip.scheduledRideTime || "";

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
