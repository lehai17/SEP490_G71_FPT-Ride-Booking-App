// REVIEW API - Gọi BE cho đánh giá và báo cáo chuyến
// ================================================================
// Comment tiếng Việt được đặt phía trên từng khối để giải thích vai trò code.
// Logic hiện tại được giữ nguyên, chỉ bổ sung mô tả cho dễ đọc/bảo trì.
// ================================================================

import { apiRequest } from "@/services/api-client";

// getAuthHeaders: Đóng gói accessToken vào Authorization header cho các API review/report.
function getAuthHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

// createReview: GỬI đánh giá chuyến đi lên BE.
// Payload gửi: { tripId, rating, comment }
// Response nhận: review đã tạo; Trips/Search cập nhật map ratingsByTripId/reviewedTripIds.
export function createReview(payload, accessToken) {
  return apiRequest("/reviews", {
    method: "POST",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

// getMyReviews: LẤY toàn bộ review do user hiện tại đã gửi.
// Response nhận: array reviews; TripsScreen chuyển thành map theo tripId để chặn đánh giá trùng.
export function getMyReviews(accessToken) {
  return apiRequest("/reviews/my", {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });
}

// getTripReviews: LẤY danh sách review của một chuyến.
// Input URL: tripId; response dùng cho modal chi tiết chuyến/lịch sử.
export function getTripReviews(tripId, accessToken) {
  return apiRequest(`/reviews/trip/${tripId}`, {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });
}

// getDriverReviews: LẤY danh sách review của tài xế.
// Input URL: driverId; response dùng để hiển thị feedback liên quan tài xế.
export function getDriverReviews(driverId, accessToken) {
  return apiRequest(`/reviews/driver/${driverId}`, {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });
}

// getDriverRatingSummary: LẤY tổng hợp rating của tài xế.
// Response thường gồm averageRating/totalReviews; TripsScreen normalize để hiển thị.
export function getDriverRatingSummary(driverId, accessToken) {
  return apiRequest(`/reviews/driver/${driverId}/summary`, {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });
}

// createTripReport: GỬI báo cáo sự cố chuyến đi lên BE.
// Payload gửi: { tripId, reason }
// Response nhận: report đã tạo; TripsScreen lưu vào reportsByTripId.
export function createTripReport(payload, accessToken) {
  return apiRequest("/reports", {
    method: "POST",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

// getMyTripReports: LẤY các report user đã gửi.
// Response nhận: array reports; TripsScreen map theo tripId để hiển thị trạng thái đã báo cáo.
export function getMyTripReports(accessToken) {
  return apiRequest("/reports/my", {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });
}
