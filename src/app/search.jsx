import { useRouter, useSearchParams } from "expo-router";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useState } from "react";

export default function SearchScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = typeof useSearchParams === "function" ? useSearchParams() : {};
  // Normalize incoming mode values so different callers map to our internal values
  const rawMode = params.mode ?? "now";
  const initialMode =
    rawMode === "shared" ? "shared" : rawMode === "later" ? "later" : "now";

  const [mode, setMode] = useState(initialMode);
  const [when, setWhen] = useState(
    params.when ?? (initialMode === "now" ? "now" : "later"),
  );
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  return (
    <ThemedView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.content}>
        <ThemedText type="subtitle">Đặt xe</ThemedText>

        <View style={styles.segmentRow}>
          <Pressable
            style={[styles.segment, mode === "now" && styles.segmentActive]}
            onPress={() => setMode("now")}
          >
            <ThemedText type="smallBold">Xe lẻ</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.segment, mode === "shared" && styles.segmentActive]}
            onPress={() => setMode("shared")}
          >
            <ThemedText type="smallBold">Xe ghép</ThemedText>
          </Pressable>
        </View>

        <TextInput
          placeholder="Điểm đón (Vị trí hiện tại)"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text }]}
          value={from}
          onChangeText={setFrom}
        />
        <TextInput
          placeholder="Điểm đến"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text }]}
          value={to}
          onChangeText={setTo}
        />

        <View style={styles.savedList}>
          <ThemedText type="smallBold">Địa chỉ đã lưu</ThemedText>
          <Pressable style={styles.savedItem}>
            <ThemedText>Đại học FPT, Thạch Hòa</ThemedText>
          </Pressable>
          <Pressable style={styles.savedItem}>
            <ThemedText>Bến xe Mỹ Đình</ThemedText>
          </Pressable>
        </View>

        <View style={styles.buttonRow}>
          <Pressable
            style={styles.henButton}
            onPress={() =>
              router.push(
                `/search/results?mode=${mode}&when=later&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
              )
            }
          >
            <ThemedText type="smallBold">Hẹn lịch</ThemedText>
          </Pressable>

          <Pressable
            style={styles.continueButton}
            onPress={() =>
              router.push(
                `/search/results?mode=${mode}&when=${when}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
              )
            }
          >
            <ThemedText type="smallBold" style={{ color: "#fff" }}>
              Tiếp tục
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    padding: Spacing.four,
    maxWidth: MaxContentWidth,
    width: "100%",
  },
  segmentRow: {
    flexDirection: "row",
    gap: Spacing.three,
    marginTop: Spacing.two,
    marginBottom: Spacing.four,
  },
  segment: {
    flex: 1,
    padding: Spacing.two,
    borderRadius: Spacing.five,
    backgroundColor: "#fff",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EEE",
  },
  segmentActive: { backgroundColor: "#FF7A00" },
  input: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: "#EEE",
    marginBottom: Spacing.two,
  },
  savedList: { marginTop: Spacing.four },
  savedItem: { paddingVertical: Spacing.two },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  henButton: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Spacing.five,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EEE",
  },
  continueButton: {
    flex: 3,
    backgroundColor: "#FF7A00",
    padding: Spacing.three,
    borderRadius: Spacing.five,
    alignItems: "center",
    justifyContent: "center",
  },
});
