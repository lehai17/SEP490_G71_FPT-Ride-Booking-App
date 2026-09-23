// PRICING API - Gọi BE để ước tính giá chuyến đi
// ================================================================
// Comment tiếng Việt được đặt phía trên từng khối để giải thích vai trò code.
// Logic hiện tại được giữ nguyên, chỉ bổ sung mô tả cho dễ đọc/bảo trì.
// ================================================================

import { apiRequest } from "@/services/api-client";

// estimateFare: GỬI thông tin tuyến đường để BE chạy pricing pipeline và trả giá ước tính.
// Payload gửi thường gồm: vehicleType, distanceKm, durationMinute.
// Response nhận: estimatedFare và các phần giá chi tiết; SearchScreen đưa vào màn xác nhận đặt xe.
export function estimateFare(payload) {
  return apiRequest("/pricing/estimate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
