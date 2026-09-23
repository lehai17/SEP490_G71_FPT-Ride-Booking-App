// TRIP HISTORY MAPPER - Chuẩn hóa dữ liệu chuyến thành item lịch sử
// ================================================================
// Comment tiếng Việt được đặt phía trên từng khối để giải thích vai trò code.
// Logic hiện tại được giữ nguyên, chỉ bổ sung mô tả cho dễ đọc/bảo trì.
// ================================================================

function formatCurrencyVnd(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "--";
  }

  return `${Math.round(numberValue).toLocaleString("vi-VN")}đ`;
}

// formatTripDate: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
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

// formatDistanceKm: Định dạng khoảng cách theo km
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

// getTripTime: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getTripTime(value) {
  const date = new Date(value ?? "");

  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

// getTripFare: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
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

// getTripField: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getTripField(source, camelKey, pascalKey) {
  return source?.[camelKey] ?? source?.[pascalKey] ?? null;
}

// getTripDistance: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getTripDistance(trip) {
  return (
    trip?.estimatedDistanceKm ??
    trip?.EstimatedDistanceKm ??
    trip?.distanceKm ??
    trip?.DistanceKm ??
    null
  );
}

// getLocalDistanceText: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getLocalDistanceText(trip) {
  return trip?.tripDistance ?? trip?.distanceText ?? "";
}

// isTripOlderThanThreeDays: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
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

// getTripIcon: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getTripIcon(vehicleType) {
  const normalizedType = String(vehicleType ?? "").toLowerCase();

  if (normalizedType.includes("bike") || normalizedType === "1") {
    return "🛵";
  }

  return "🚗";
}

// mapTripToHistoryItem: Map dữ liệu BE/local sang card lịch sử chuyến
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
    driverId: getTripField(trip, "driverId", "DriverId"),
    driverName: getTripField(trip, "driverName", "DriverName"),
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
