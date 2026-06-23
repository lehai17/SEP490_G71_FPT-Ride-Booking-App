import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export default function TripsScreen() {
  const theme = useTheme();

  return (
    <ThemedView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.content}>
        <ThemedText type="subtitle">Hành trình</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Lịch sử chuyến đi và đặt xe của bạn sẽ xuất hiện ở đây.
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
