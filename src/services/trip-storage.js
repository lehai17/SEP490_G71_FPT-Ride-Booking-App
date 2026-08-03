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
  const route = trip.route || `${trip.pickup || ""} → ${trip.destination || ""}`.trim();
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
