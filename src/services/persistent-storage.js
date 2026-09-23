// PERSISTENT STORAGE - Lớp lưu trữ dùng được cả native và web
// ================================================================
// Comment tiếng Việt được đặt phía trên từng khối để giải thích vai trò code.
// Logic hiện tại được giữ nguyên, chỉ bổ sung mô tả cho dễ đọc/bảo trì.
// ================================================================

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// getWebStorage: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getWebStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage ?? null;
}

// getPersistentItem: Đọc dữ liệu bền vững theo key
export async function getPersistentItem(key) {
  if (Platform.OS === "web") {
    return getWebStorage()?.getItem(key) ?? null;
  }

  return SecureStore.getItemAsync(key);
}

// setPersistentItem: Ghi dữ liệu bền vững theo key
export async function setPersistentItem(key, value) {
  if (Platform.OS === "web") {
    getWebStorage()?.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

// deletePersistentItem: Xóa dữ liệu bền vững theo key
export async function deletePersistentItem(key) {
  if (Platform.OS === "web") {
    getWebStorage()?.removeItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}
