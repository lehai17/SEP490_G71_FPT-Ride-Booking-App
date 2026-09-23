// THEMED VIEW - View component tự lấy màu nền theo theme
// ================================================================
// Comment tiếng Việt được đặt phía trên từng khối để giải thích vai trò code.
// Logic hiện tại được giữ nguyên, chỉ bổ sung mô tả cho dễ đọc/bảo trì.
// ================================================================

import { View } from "react-native";

import { useTheme } from "@/hooks/use-theme";

// ThemedView: View dùng background theo theme
export function ThemedView({ style, type, ...otherProps }) {
  const theme = useTheme();

  return (
    /* View: Khối layout nhóm các thành phần con trong màn hình. */
    <View
      style={[{ backgroundColor: theme[type ?? "background"] }, style]}
      {...otherProps}
    />
  );
}
