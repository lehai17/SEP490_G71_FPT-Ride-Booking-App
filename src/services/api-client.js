// API CLIENT - Wrapper fetch dùng chung cho toàn app khách
// ================================================================
// Comment tiếng Việt được đặt phía trên từng khối để giải thích vai trò code.
// Logic hiện tại được giữ nguyên, chỉ bổ sung mô tả cho dễ đọc/bảo trì.
// ================================================================

import { API_BASE_URL } from "@/config/env";

// getErrorMessage: Nhận payload lỗi từ BE và rút ra message dễ hiểu để screen hiển thị.
// BE có thể trả lỗi dạng array, object errors, message/detail/title/error nên phải gom về 1 chuỗi.
function getErrorMessage(payload, fallbackMessage) {
  if (Array.isArray(payload)) {
    const messages = payload
      .map((item) => item?.errorMessage || item?.ErrorMessage || item?.message)
      .filter(Boolean);

    if (messages.length > 0) {
      return messages.join("\n");
    }
  }

  if (payload?.errors && typeof payload.errors === "object") {
    const messages = Object.entries(payload.errors).flatMap(
      ([fieldName, fieldErrors]) => {
        if (Array.isArray(fieldErrors)) {
          return fieldErrors.map((message) => `${fieldName}: ${message}`);
        }

        return fieldErrors ? [`${fieldName}: ${fieldErrors}`] : [];
      }
    );

    if (messages.length > 0) {
      return messages.join("\n");
    }
  }

  return (
    payload?.message ||
    payload?.detail ||
    payload?.title ||
    payload?.error ||
    fallbackMessage
  );
}

// apiRequest: CỔNG GỬI/NHẬN DỮ LIỆU CHUNG CỦA FE KHÁCH
// ================================================================
// INPUT:
// - path: endpoint tương đối, ví dụ "/trips" hoặc "/auth/login"
// - options: method, headers, body JSON.stringify(payload)
//
// XỬ LÝ GỬI:
// - Ghép API_BASE_URL + path thành URL đầy đủ
// - Tự thêm Accept: application/json
// - Nếu có body thì thêm Content-Type: application/json
// - Giữ Authorization Bearer token nếu service truyền vào headers
//
// XỬ LÝ NHẬN:
// - Đọc response.text() trước để tránh lỗi khi BE trả body rỗng
// - Nếu text là JSON thì parse thành payload
// - Nếu HTTP không ok thì ném Error có status/path/payload/rawText
// - Nếu ok thì trả payload cho screen/service phía trên dùng tiếp
// ================================================================
export async function apiRequest(path, options = {}) {
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers ?? {}),
  };

  let response;

  try {
    // Gửi request thật sang BE: mọi service đều đi qua nhánh này.
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    throw new Error(
      `Không kết nối được BE ${API_BASE_URL}${path}: ${
        error?.message || "Request failed"
      }`
    );
  }

  // Nhận raw text từ BE trước, sau đó mới parse JSON nếu có nội dung.
  const rawText = await response.text();
  let payload = null;

  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = null;
    }
  }

  // Nếu BE trả 4xx/5xx: chuẩn hóa lỗi để UI chỉ cần đọc error.message.
  if (!response.ok) {
    const fallbackMessage =
      rawText?.trim() || `HTTP ${response.status} ${path}: Request failed`;
    const message = getErrorMessage(payload, fallbackMessage);
    const error = new Error(`HTTP ${response.status} ${path}: ${message}`);
    error.status = response.status;
    error.path = path;
    error.payload = payload;
    error.rawText = rawText;
    throw error;
  }

  // Nếu thành công: trả object/array/null đúng theo body BE trả về.
  return payload;
}
