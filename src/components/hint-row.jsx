// HINT ROW - Dòng gợi ý ngắn dùng lại trong UI
// ================================================================
// Comment tiếng Việt được đặt phía trên từng khối để giải thích vai trò code.
// Logic hiện tại được giữ nguyên, chỉ bổ sung mô tả cho dễ đọc/bảo trì.
// ================================================================

import { StyleSheet, View } from "react-native";

import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";

import { Spacing } from "@/constants/theme";

// HintRow: Render một dòng icon/text gợi ý
export function HintRow({ title = "Try editing", hint = "app/index.tsx" }) {
  return (
    /* Khối step row: Dàn các phần tử trên cùng một hàng. */
    <View style={styles.stepRow}>
      <ThemedText type="small">{title}</ThemedText>
      {/* Khối code snippet: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
      <ThemedView type="backgroundSelected" style={styles.codeSnippet}>
        <ThemedText themeColor="textSecondary">{hint}</ThemedText>
      </ThemedView>
    </View>
  );
}

// styles: Gom toàn bộ style của màn hình/component ở cuối file
const styles = StyleSheet.create({
  stepRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  codeSnippet: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
});
