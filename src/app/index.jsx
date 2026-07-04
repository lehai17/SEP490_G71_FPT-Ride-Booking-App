import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  BottomTabInset,
  Colors,
  MaxContentWidth,
  Spacing,
} from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

const BRAND = "#FF7A00";

export default function HomeScreen() {
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState("now");

  const singleActions = [
    { label: "Xe lẻ ngay", when: "now", emoji: "🚕" },
    { label: "Xe lẻ đặt trước", when: "later", emoji: "🕒" },
  ];

  const rideGroups = [
    {
      route: "Hà Nội → Sân bay Nội Bài",
      vehicle: "Xe ghép",
      price: "35.000đ",
      distance: "25 km",
      seats: "3 ghế còn trống",
      note: "Vui lòng đi đúng giờ",
    },
    {
      route: "Hà Nội → FPT City",
      vehicle: "Xe ghép",
      price: "30.000đ",
      distance: "18 km",
      seats: "2 ghế còn trống",
      note: "Khởi hành 17:30",
    },
  ];

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={{
        alignItems: "center",
        paddingTop: Spacing.four,
        paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.wrapper}>
        <ThemedView
          style={[
            styles.headerCard,
            { backgroundColor: theme.backgroundElement },
          ]}
        >
          <View
            style={[
              styles.avatar,
              { backgroundColor: Colors.light.backgroundSelected },
            ]}
          >
            <ThemedText type="subtitle">L</ThemedText>
          </View>
          <View style={styles.headerText}>
            <ThemedText type="smallBold">CHÀO MỪNG SINH VIÊN FPTU</ThemedText>
            <ThemedText type="subtitle">Lê Nguyễn Đại Hải</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              HE182237 · Hola Goer
            </ThemedText>
          </View>
          <ThemedView
            style={[styles.statusBadge, { backgroundColor: "#D4F7E7" }]}
          >
            <ThemedText
              type="smallBold"
              style={styles.statusText}
              themeColor="textSecondary"
            >
              ONLINE
            </ThemedText>
          </ThemedView>
        </ThemedView>
        <View style={styles.weatherRow}>
          <ThemedText type="default" style={{ color: "#333" }}>
            32°C · Nắng nhẹ
          </ThemedText>
          <ThemedText type="small" style={{ color: "#666" }}>
            Thạch Thất, Hà Nội
          </ThemedText>
        </View>

        <ThemedView
          style={[
            styles.primaryCard,
            { backgroundColor: theme.backgroundElement },
          ]}
        >
          <View style={styles.headerRow}>
            <ThemedText type="subtitle">Bạn muốn di chuyển thế nào?</ThemedText>
            <Pressable style={styles.settingsButton}>
              <SymbolView
                name={{ ios: "gear", android: "settings", web: "settings" }}
                size={18}
              />
            </Pressable>
          </View>

          {/* input removed — mode buttons navigate to search directly */}

          <View style={styles.toggleRow}>
            <Pressable
              style={({ pressed }) => [
                styles.modeBtn,
                selectedMode === "now" && styles.modeBtnActive,
                pressed && styles.pressedButton,
              ]}
              onPress={() => {
                setSelectedMode("now");
                router.push("/search?mode=now&when=now");
              }}
            >
              <ThemedText
                type="smallBold"
                style={{ color: selectedMode === "now" ? "#fff" : BRAND }}
              >
                Xe lẻ
              </ThemedText>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.modeBtn,
                selectedMode === "shared" && styles.modeBtnActive,
                pressed && styles.pressedButton,
              ]}
              onPress={() => {
                setSelectedMode("shared");
                router.push("/search?mode=shared&when=any");
              }}
            >
              <ThemedText
                type="smallBold"
                style={{ color: selectedMode === "shared" ? "#fff" : BRAND }}
              >
                Xe ghép
              </ThemedText>
            </Pressable>
          </View>

          {selectedMode === "now" && (
            <View style={styles.quickActionsList}>
              {singleActions.map((action) => (
                <Pressable
                  key={action.label}
                  style={({ pressed }) => [
                    styles.actionCard,
                    { backgroundColor: theme.background },
                    pressed && styles.pressedCard,
                  ]}
                  onPress={() =>
                    router.push(`/search?mode=now&when=${action.when}`)
                  }
                >
                  <View style={styles.actionIcon}>
                    <ThemedText type="smallBold">{action.emoji}</ThemedText>
                  </View>
                  <ThemedText type="default" style={styles.actionLabel}>
                    {action.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          )}
        </ThemedView>

        <View style={styles.sectionHeader}>
          <ThemedText type="subtitle">Nhóm xe ghép sẵn có</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Chọn chuyến và tham gia cùng bạn bè FPTU
          </ThemedText>
        </View>

        {rideGroups.map((ride) => (
          <ThemedView
            key={ride.route}
            style={[
              styles.rideCard,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            <View style={styles.rideTitleRow}>
              <ThemedText type="smallBold" style={styles.vehicleLabel}>
                {ride.vehicle}
              </ThemedText>
              <ThemedText type="smallBold">{ride.price}</ThemedText>
            </View>
            <View style={styles.rideRouteRow}>
              <ThemedText type="smallBold">{ride.route}</ThemedText>
            </View>
            <View style={styles.rideInfoRow}>
              <ThemedText type="small" themeColor="textSecondary">
                {ride.distance}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {ride.seats}
              </ThemedText>
            </View>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.noteText}
            >
              "{ride.note}"
            </ThemedText>
            <Pressable
              style={({ pressed }) => [
                styles.joinButton,
                pressed && styles.pressedButton,
              ]}
            >
              <ThemedText type="smallBold">Tham gia ghép</ThemedText>
            </Pressable>
          </ThemedView>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  contentContainer: { alignItems: "center", paddingTop: 24 },
  wrapper: {
    width: "100%",
    maxWidth: MaxContentWidth,
    gap: 24,
    paddingHorizontal: 24,
  },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 24,
    borderRadius: 24,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  headerText: { flex: 1, marginLeft: 24, gap: 4 },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  statusText: { textTransform: "uppercase", letterSpacing: 0.5 },
  primaryCard: {
    borderRadius: 24,
    padding: 24,
    gap: 24,
  },
  searchInput: {
    borderRadius: 32,
    paddingHorizontal: 24,
    paddingVertical: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E3E6EA",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  toggleRow: { flexDirection: "row", gap: 16 },
  toggleButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#DDE1E7",
    borderWidth: 1,
  },
  toggleActive: { borderColor: "#1D4ED8", backgroundColor: "#E6F0FF" },
  quickActionsList: { gap: 16, marginTop: 24 },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    minHeight: 72,
    borderRadius: 24,
    padding: 16,
    justifyContent: "flex-start",
    borderWidth: 1,
    borderColor: "#E3E6EA",
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#F5F7FA",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 24,
  },
  actionLabel: { flex: 1 },
  sectionHeader: { gap: 4 },
  rideCard: {
    borderRadius: 24,
    padding: 24,
    gap: 16,
  },
  rideTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  vehicleLabel: { color: BRAND },
  rideRouteRow: { gap: Spacing.one },
  rideInfoRow: { flexDirection: "row", justifyContent: "space-between" },
  noteText: { fontStyle: "italic" },
  joinButton: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 32,
    backgroundColor: BRAND,
    alignItems: "center",
  },
  weatherRow: {
    paddingHorizontal: 24,
    marginTop: 8,
    marginBottom: 8,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BRAND,
  },
  modeBtnActive: { backgroundColor: BRAND },
  pressedButton: { opacity: 0.75 },
  pressedCard: { opacity: 0.75 },
});
