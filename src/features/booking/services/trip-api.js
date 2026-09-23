// TRIP API - Gọi BE để tạo, lấy và hủy chuyến
// ================================================================
// Comment tiếng Việt được đặt phía trên từng khối để giải thích vai trò code.
// Logic hiện tại được giữ nguyên, chỉ bổ sung mô tả cho dễ đọc/bảo trì.
// ================================================================

import { apiRequest } from "@/services/api-client";

// createTrip: GỬI payload đặt xe lên BE để tạo chuyến mới.
// Payload gửi thường gồm:
// - pickupAddress/destinationAddress
// - pickupLatitude/pickupLongitude, destinationLatitude/destinationLongitude
// - vehicleType, estimatedDistanceKm, estimatedDurationMinute, estimatedFare
// - scheduledAt nếu là chuyến đặt trước
// Response nhận: trip BE tạo ra, có id/status/driverId/pricing... để FE lưu cache và hiển thị.
export function createTrip(payload, accessToken) {
  return apiRequest("/trips", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

// getTrip: LẤY chi tiết mới nhất của một chuyến từ BE.
// Input gửi trên URL: tripId
// Response nhận: status hiện tại, tài xế, giá, quãng đường, thời gian... để merge vào card local.
export function getTrip(tripId, accessToken) {
  return apiRequest(`/trips/${tripId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

// cancelTrip: GỬI yêu cầu hủy chuyến từ phía khách.
// Input gửi trên URL: tripId
// Payload gửi: lý do hủy/note theo form
// Response nhận: trip đã đổi status hoặc kết quả hủy; screen dùng để bỏ card/đổi trạng thái.
export function cancelTrip(tripId, payload, accessToken) {
  return apiRequest(`/trips/${tripId}/cancel/passenger`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

// getPassengerTrips: LẤY toàn bộ chuyến của khách đang đăng nhập.
// Header gửi: Authorization Bearer accessToken
// Response nhận: array trips; Home/Trips screen lọc ra chuyến gần đây, chuyến đặt trước, lịch sử.
export function getPassengerTrips(accessToken) {
  return apiRequest("/passengers/trips", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

// getDriverTrips: LẤY danh sách chuyến của tài xế.
// File FE khách ít dùng hàm này, nhưng giữ để tái sử dụng nếu cần hiển thị dữ liệu tài xế.
export function getDriverTrips(accessToken) {
  return apiRequest("/drivers/trips", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
