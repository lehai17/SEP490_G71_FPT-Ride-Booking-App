// AUTH API - Gọi API xác thực tài khoản khách
// ================================================================
// Comment tiếng Việt được đặt phía trên từng khối để giải thích vai trò code.
// Logic hiện tại được giữ nguyên, chỉ bổ sung mô tả cho dễ đọc/bảo trì.
// ================================================================

import { apiRequest } from "@/services/api-client";

// register: GỬI form đăng ký lên BE.
// Payload gửi: { fullName, email, password, confirmPassword }
// Response nhận: kết quả đăng ký/verify tùy BE; ProfileScreen dùng để chuyển sang bước nhập OTP.
export function register(payload) {
  return apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// login: GỬI email + password lên BE để đăng nhập.
// Payload gửi: { email, password }
// Response nhận: accessToken, refreshToken, expiresAt, userId, fullName, email, role...
// AuthContext nhận response này để tạo session và lưu vào state/local storage nếu bật ghi nhớ.
export function login(payload) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// refreshToken: GỬI refreshToken cũ để xin accessToken/session mới.
// Payload gửi: { refreshToken }
// Response nhận: token mới; AuthContext dùng khi khôi phục phiên hoặc refresh phiên.
export function refreshToken(refreshTokenValue) {
  return apiRequest("/auth/refresh-token", {
    method: "POST",
    body: JSON.stringify({ refreshToken: refreshTokenValue }),
  });
}

// logout: GỬI request đăng xuất kèm accessToken.
// FE xóa session trước để UI thoát ngay, request này báo BE vô hiệu hóa token phía server.
export function logout(accessToken) {
  return apiRequest("/auth/logout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

// sendVerifyEmailOtp: GỬI email để BE gửi mã OTP xác minh tài khoản.
// Payload gửi: { email }
// Response nhận: thông báo gửi OTP thành công/thất bại.
export function sendVerifyEmailOtp(payload) {
  return apiRequest("/auth/verify-email/send", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// verifyEmailOtp: GỬI email + otp + password để xác minh email.
// Response nhận: kết quả xác minh; ProfileScreen có thể tự login lại sau khi verify thành công.
export function verifyEmailOtp(payload) {
  return apiRequest("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// forgotPassword: GỬI email để BE gửi OTP đặt lại mật khẩu.
// Payload gửi: { email }
export function forgotPassword(payload) {
  return apiRequest("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// resetPassword: GỬI email + otp + mật khẩu mới để BE đổi mật khẩu quên.
// Payload gửi: { email, otp, newPassword, confirmPassword }
export function resetPassword(payload) {
  return apiRequest("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// changePassword: GỬI mật khẩu hiện tại và mật khẩu mới khi người dùng đã đăng nhập.
// Header gửi: Authorization Bearer accessToken
// Payload gửi: { currentPassword, newPassword, confirmPassword }
export function changePassword(payload, accessToken) {
  return apiRequest("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

// getProfile: LẤY hồ sơ người dùng theo userId.
// Header gửi: Authorization Bearer accessToken
// Response nhận: fullName, email, phoneNumber, avatarUrl, role, createdAt...
// AuthContext merge response này vào session để UI profile/home hiển thị dữ liệu mới nhất.
export function getProfile(userId, accessToken) {
  return apiRequest(`/auth/profile/${userId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

// updateProfile: GỬI dữ liệu chỉnh sửa hồ sơ lên BE.
// Payload gửi: các field profile từ form edit
// Response nhận: profile đã cập nhật; AuthContext dùng để cập nhật session hiện tại.
export function updateProfile(userId, payload, accessToken) {
  return apiRequest(`/auth/profile/${userId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
