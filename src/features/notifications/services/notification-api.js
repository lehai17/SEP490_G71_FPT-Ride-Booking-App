// NOTIFICATION API - Gọi BE lấy và cập nhật thông báo
// ================================================================
// Comment tiếng Việt được đặt phía trên từng khối để giải thích vai trò code.
// Logic hiện tại được giữ nguyên, chỉ bổ sung mô tả cho dễ đọc/bảo trì.
// ================================================================

import { apiRequest } from "@/services/api-client";

// getAuthHeaders: Đóng gói accessToken vào Authorization header cho notification API.
function getAuthHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

// getMyNotifications: LẤY thông báo của tài khoản đang đăng nhập.
// Header gửi: Authorization Bearer accessToken
// Response nhận: array notifications; NotificationContext normalize rồi setNotifications.
export function getMyNotifications(accessToken) {
  return apiRequest("/notifications/me", {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });
}

// markNotificationAsRead: GỬI notificationId lên BE để đánh dấu đã đọc.
// Response không cần dữ liệu nhiều; NotificationContext đã optimistic update và chỉ rollback nếu API lỗi.
export function markNotificationAsRead(notificationId, accessToken) {
  return apiRequest(`/notifications/${notificationId}/read`, {
    method: "PUT",
    headers: getAuthHeaders(accessToken),
  });
}
