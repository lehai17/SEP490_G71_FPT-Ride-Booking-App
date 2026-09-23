// TRIP STORAGE - Lưu cache chuyến đã đặt trên thiết bị
// ================================================================
// Comment tiếng Việt được đặt phía trên từng khối để giải thích vai trò code.
// Logic hiện tại được giữ nguyên, chỉ bổ sung mô tả cho dễ đọc/bảo trì.
// ================================================================

import {
  getPersistentItem,
  setPersistentItem,
} from "@/services/persistent-storage";

// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const BOOKED_TRIPS_STORAGE_KEY = "fpt-ride.booked-trips";

// getField: Đọc field từ dữ liệu BE bất kể BE trả camelCase hay PascalCase.
// Ví dụ status có thể là trip.status hoặc trip.Status.
function getField(source, camelKey, pascalKey) {
  return source?.[camelKey] ?? source?.[pascalKey];
}

// parseBackendDateTime: Nhận datetime từ BE/local và ép về Date.
// Nếu BE trả chuỗi chưa có timezone thì thêm "Z" để hiểu là UTC trước khi đổi sang giờ Việt Nam.
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

// formatVietnamDateTime: Nhận datetime BE, đổi sang giờ Việt Nam và format ngắn cho UI.
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
  // Đọc raw JSON từ persistent storage; nếu chưa có dữ liệu thì trả array rỗng.
  const rawTrips = await getPersistentItem(BOOKED_TRIPS_STORAGE_KEY);

  if (!rawTrips) {
    return [];
  }

  try {
    // Parse JSON local cache; luôn kiểm tra array để tránh dữ liệu hỏng làm crash màn Trips/Home.
    const parsedTrips = JSON.parse(rawTrips);
    return Array.isArray(parsedTrips) ? parsedTrips : [];
  } catch {
    return [];
  }
}

async function writeBookedTrips(trips) {
  // Ghi danh sách chuyến xuống storage để lần mở app sau vẫn có dữ liệu gần nhất.
  await setPersistentItem(
    BOOKED_TRIPS_STORAGE_KEY,
    JSON.stringify(trips ?? [])
  );
}

// persistBookedTrip: LƯU chuyến vừa đặt vào cache local sau khi BE tạo trip thành công.
// Input nhận: trip object đã được SearchScreen chuẩn hóa.
// Xử lý: thêm id/createdAt nếu thiếu, bỏ trùng theo id, chỉ giữ 30 chuyến mới nhất.
// Output trả: nextTrip để screen có thể dùng ngay nếu cần.
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

// loadBookedTrips: NHẬN danh sách chuyến đã cache từ storage.
// Home/Trips dùng dữ liệu này để bổ sung cho response BE hoặc hiển thị khi mạng lỗi.
export async function loadBookedTrips() {
  return readBookedTrips();
}

// removeBookedTrip: XÓA một trip khỏi cache local theo tripId, thường sau khi hủy chuyến.
export async function removeBookedTrip(tripId) {
  const currentTrips = await readBookedTrips();
  await writeBookedTrips(currentTrips.filter((trip) => trip.id !== tripId));
}

// toActiveTripSectionItem: MAP dữ liệu trip thô thành item UI cho section "đang hoạt động".
// Input nhận: trip từ BE/local.
// Output trả: { id, icon, route, meta, actionPrimary, actionSecondary, rating } để TripsScreen render.
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

// toScheduledTripSectionItem: MAP dữ liệu trip đặt trước thành item UI.
// Input nhận: trip từ BE/local có scheduledAt/status/price.
// Output trả: item có meta lịch hẹn, statusLabel, sortTimestamp để TripsScreen sort/render.
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
