import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export default function NotificationsScreen() {
  const theme = useTheme();

  return (
    <ThemedView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.content}>
        <ThemedText type="subtitle">Thông báo</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Mọi thông tin khuyến mãi và cập nhật sẽ xuất hiện tại đây.
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: Spacing.four,
    maxWidth: MaxContentWidth,
    width: "100%",
  },
});
