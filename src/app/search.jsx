import { useSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export default function SearchScreen() {
  const theme = useTheme();
  // `useSearchParams` may not be available in some runtime setups — guard the call
  const params = typeof useSearchParams === "function" ? useSearchParams() : {};
  const mode = params.mode ?? "single";
  const when = params.when ?? "now";

  return (
    <ThemedView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.content}>
        <ThemedText type="subtitle">Tìm xe</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Chế độ: {mode} — Loại đặt: {when}
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
