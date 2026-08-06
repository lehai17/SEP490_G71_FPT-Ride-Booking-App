import * as SecureStore from "expo-secure-store";

const BOOKED_TRIPS_STORAGE_KEY = "fpt-ride.booked-trips";

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

export function toActiveTripSectionItem(trip) {
  const route =
    trip.route || `${trip.pickup || ""} \u2192 ${trip.destination || ""}`.trim();
  const price = trip.price || trip.estimatedFare || "--";
  const meta = trip.statusLabel || `\u0110ang t\u00ecm t\u00e0i x\u1ebf \u00b7 ${price}`;

  return {
    id: trip.id,
    icon: trip.icon || "\ud83d\ude97",
    route,
    meta,
    actionPrimary: "Li\u00ean h\u1ec7",
    actionSecondary: "H\u1ee7y",
    rating: null,
  };
}

export function toScheduledTripSectionItem(trip) {
  const route =
    trip.route || `${trip.pickup || ""} \u2192 ${trip.destination || ""}`.trim();
  const price = trip.price || trip.estimatedFare || "--";
  const scheduledAt = trip.scheduledAt ? new Date(trip.scheduledAt) : null;
  const scheduleText =
    scheduledAt && !Number.isNaN(scheduledAt.getTime())
      ? `${String(scheduledAt.getDate()).padStart(2, "0")}/${String(
          scheduledAt.getMonth() + 1
        ).padStart(2, "0")} ${String(scheduledAt.getHours()).padStart(
          2,
          "0"
        )}:${String(scheduledAt.getMinutes()).padStart(2, "0")}`
      : trip.scheduledRideTime || "\u0110\u00e3 h\u1eb9n l\u1ecbch";

  return {
    id: trip.id,
    icon: trip.icon || "\ud83d\ude97",
    route,
    meta: `${scheduleText} \u00b7 ${price}`,
    actionPrimary: "S\u1eeda",
    actionSecondary: "H\u1ee7y",
    rating: null,
    scheduledAt: trip.scheduledAt || "",
    createdAt: trip.createdAt || "",
    distanceText: trip.tripDistance || trip.distanceText || "",
    durationText: trip.tripDuration || trip.durationText || "",
    sortTimestamp:
      scheduledAt && !Number.isNaN(scheduledAt.getTime())
        ? scheduledAt.getTime()
        : 0,
  };
}
