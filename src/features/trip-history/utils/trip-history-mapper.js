function formatCurrencyVnd(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "--";
  }

  return `${Math.round(numberValue).toLocaleString("vi-VN")}\u0111`;
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

function getTripTime(value) {
  const date = new Date(value ?? "");

  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getTripFare(trip) {
  return (
    trip?.pricing?.estimatedFare ??
    trip?.estimatedFare ??
    trip?.fareAmount ??
    trip?.fare ??
    null
  );
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
    return "\ud83d\udef5";
  }

  return "\ud83d\ude97";
}

export function mapTripToHistoryItem(trip, localTrip = null) {
  const date =
    trip?.completedAt ?? trip?.cancelledAt ?? trip?.acceptedAt ?? trip?.createdAt;
  const fare = getTripFare(localTrip) ?? getTripFare(trip);
  const actionPrimary = isTripOlderThanThreeDays(date)
    ? "Chi tiết"
    : "Đánh giá";

  return {
    id: trip.id,
    icon: getTripIcon(trip.vehicleType),
    route: `${trip.pickupAddress || "\u0110i\u1ec3m \u0111\u00f3n"} \u2192 ${
      trip.destinationAddress || "\u0110i\u1ec3m \u0111\u1ebfn"
    }`,
    meta: `${formatTripDate(date)} \u00b7 ${formatCurrencyVnd(fare)}`,
    actionPrimary,
    actionSecondary: "B\u00e1o c\u00e1o",
    rating: null,
    sortTimestamp: getTripTime(date),
  };
}
