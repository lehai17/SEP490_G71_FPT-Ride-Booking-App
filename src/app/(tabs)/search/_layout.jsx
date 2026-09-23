// SEARCH LAYOUT - Stack layout cho luồng tìm kiếm/đặt xe
// ================================================================
// Comment tiếng Việt được đặt phía trên từng khối để giải thích vai trò code.
// Logic hiện tại được giữ nguyên, chỉ bổ sung mô tả cho dễ đọc/bảo trì.
// ================================================================

import { Stack } from "expo-router";

// SearchLayout: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
export default function SearchLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
