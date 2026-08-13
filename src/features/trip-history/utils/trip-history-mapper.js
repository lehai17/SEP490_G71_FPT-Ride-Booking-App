function formatCurrencyVnd(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "--";
  }

  return `${Math.round(numberValue).toLocaleString("vi-VN")}đ`;
}

function formatTripDate(value) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatDistanceKm(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "";
  }

  const roundedValue =
    numberValue >= 10
      ? Math.round(numberValue)
      : Math.round(numberValue * 10) / 10;

  return `${roundedValue.toLocaleString("vi-VN")} km`;
}

function getTripTime(value) {
  const date = new Date(value ?? "");

  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getTripFare(trip) {
  return (
    trip?.pricing?.estimatedFare ??
    trip?.Pricing?.EstimatedFare ??
    trip?.tripPricing?.estimatedFare ??
    trip?.TripPricing?.EstimatedFare ??
    trip?.estimatedFare ??
    trip?.EstimatedFare ??
    trip?.fareAmount ??
    trip?.FareAmount ??
    trip?.fare ??
    trip?.Fare ??
    null
  );
}

function getTripDistance(trip) {
  return (
    trip?.estimatedDistanceKm ??
    trip?.EstimatedDistanceKm ??
    trip?.distanceKm ??
    trip?.DistanceKm ??
    null
  );
}

function getLocalDistanceText(trip) {
  return trip?.tripDistance ?? trip?.distanceText ?? "";
}

function isTripOlderThanThreeDays(value) {
  if (!value) {
    return false;
  }

  const tripDate = new Date(value);

  if (Number.isNaN(tripDate.getTime())) {
    return false;
  }

  const diffMs = Date.now() - tripDate.getTime();
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

  return diffMs > threeDaysMs;
}

function getTripIcon(vehicleType) {
  const normalizedType = String(vehicleType ?? "").toLowerCase();

  if (normalizedType.includes("bike") || normalizedType === "1") {
    return "\uD83D\uDEF5";
  }

  return "\uD83D\uDE97";
}

export function mapTripToHistoryItem(trip, localTrip = null) {
  const date =
    trip?.completedAt ?? trip?.cancelledAt ?? trip?.acceptedAt ?? trip?.createdAt;
  const fare = getTripFare(localTrip) ?? getTripFare(trip);
  const distanceText =
    formatDistanceKm(getTripDistance(trip)) ||
    formatDistanceKm(getTripDistance(localTrip)) ||
    getLocalDistanceText(localTrip);
  const actionPrimary = isTripOlderThanThreeDays(date)
    ? "Chi tiết"
    : "Đánh giá";
  const metaParts = [
    formatTripDate(date),
    distanceText,
    formatCurrencyVnd(fare),
  ].filter((item) => item && item !== "--");

  return {
    id: trip.id,
    icon: getTripIcon(trip.vehicleType),
    route: `${trip.pickupAddress || "Điểm đón"} → ${
      trip.destinationAddress || "Điểm đến"
    }`,
    meta: metaParts.join(" · "),
    actionPrimary,
    actionSecondary: "Báo cáo",
    rating: null,
    sortTimestamp: getTripTime(date),
  };
}
