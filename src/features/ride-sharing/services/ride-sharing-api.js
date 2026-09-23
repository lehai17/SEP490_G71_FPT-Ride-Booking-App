// RIDE SHARING API - Gọi BE cho luồng đi ghép
// ================================================================
// Comment tiếng Việt được đặt phía trên từng khối để giải thích vai trò code.
// Logic hiện tại được giữ nguyên, chỉ bổ sung mô tả cho dễ đọc/bảo trì.
// ================================================================

import { apiRequest } from "@/services/api-client";

// getAuthHeaders: Đóng gói accessToken thành Authorization header cho các API đi ghép.
// Mọi request có dữ liệu cá nhân/nhóm của user đều cần Bearer token này.
function getAuthHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

// createRideSharingRequest: GỬI yêu cầu tạo chuyến xe ghép.
// Payload gửi: direction, pickup/destination, tọa độ, slot/date, distance/duration/fare...
// Response nhận: request mới; SearchScreen map response thành pending card và lưu cache local.
export function createRideSharingRequest(payload, accessToken) {
  return apiRequest("/ride-sharing/requests", {
    method: "POST",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

// getMyRideSharingRequest: LẤY yêu cầu đi ghép hiện tại của khách.
// Response nhận: request đang pending/matched/cancelled; screen dùng để tránh tạo trùng request.
export function getMyRideSharingRequest(accessToken) {
  return apiRequest("/ride-sharing/requests/my", {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });
}

// getRideSharingRequest: LẤY chi tiết một request đi ghép theo requestId.
// Dùng sau khi tạo/hủy để đồng bộ lại status mới nhất từ BE.
export function getRideSharingRequest(requestId, accessToken) {
  return apiRequest(`/ride-sharing/requests/${requestId}`, {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });
}

// cancelRideSharingRequest: GỬI yêu cầu hủy request đi ghép.
// Payload gửi: lý do hủy/note nếu có.
// Response nhận: request đã cập nhật status; screen chuyển card sang tab đã hủy.
export function cancelRideSharingRequest(requestId, payload, accessToken) {
  return apiRequest(`/ride-sharing/requests/${requestId}/cancel`, {
    method: "POST",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

// getMyRideSharingGroup: LẤY nhóm đi ghép mà khách đang tham gia.
// Response nhận: group, members, driver, status; screen hiển thị trạng thái ghép nhóm hiện tại.
export function getMyRideSharingGroup(accessToken) {
  return apiRequest("/ride-sharing/groups/my", {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });
}

// getRideSharingGroup: LẤY chi tiết nhóm đi ghép theo groupId.
// Dùng ở màn chi tiết để nhận members/currentPassengers/fare/status mới nhất.
export function getRideSharingGroup(groupId, accessToken) {
  return apiRequest(`/ride-sharing/groups/${groupId}`, {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });
}

// getAvailableRideSharingGroups: LẤY các nhóm đi ghép còn có thể tham gia.
// Query gửi: direction nếu người dùng chọn chiều đi/về.
// Response nhận: array groups; Search/Home map thành card đề xuất xe ghép.
export function getAvailableRideSharingGroups(direction, accessToken) {
  const searchParams = new URLSearchParams();

  if (direction != null && direction !== "") {
    searchParams.set("direction", String(direction));
  }

  const queryString = searchParams.toString();
  const path = queryString
    ? `/ride-sharing/groups/available?${queryString}`
    : "/ride-sharing/groups/available";

  return apiRequest(path, {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });
}

// joinRideSharingGroup: GỬI thông tin điểm đón của khách để tham gia group.
// Input URL: groupId
// Payload gửi: pickupAddress, pickupLatitude, pickupLongitude, note/distance/fare nếu có.
// Response nhận: group/request sau khi join; screen cập nhật pending group và xóa khỏi list available.
export function joinRideSharingGroup(groupId, payload, accessToken) {
  return apiRequest(`/ride-sharing/groups/${groupId}/join`, {
    method: "POST",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

// leaveRideSharingGroup: GỬI yêu cầu rời khỏi nhóm đi ghép.
// Payload gửi: lý do/note nếu có; response nhận là trạng thái group sau khi rời.
export function leaveRideSharingGroup(groupId, payload, accessToken) {
  return apiRequest(`/ride-sharing/groups/${groupId}/leave`, {
    method: "POST",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

// pickupRideSharingPassenger: GỬI trạng thái tài xế đã đón khách trong nhóm đi ghép.
// FE khách hiện ít dùng, giữ để đồng bộ nếu có màn theo dõi driver/group.
export function pickupRideSharingPassenger(groupId, payload, accessToken) {
  return apiRequest(`/ride-sharing/groups/${groupId}/pickup`, {
    method: "POST",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

// dropoffRideSharingPassenger: GỬI trạng thái tài xế đã trả khách trong nhóm đi ghép.
// Response dùng để cập nhật tiến độ group/member nếu màn khách cần theo dõi.
export function dropoffRideSharingPassenger(groupId, payload, accessToken) {
  return apiRequest(`/ride-sharing/groups/${groupId}/dropoff`, {
    method: "POST",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}
