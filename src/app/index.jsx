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

const rideGroups = [
  {
    vehicle: "XE 7 CHỖ",
    route: "Cổng Chính Trống Đồng → Ngã tư Thạch Hòa",
    distance: "~3.5km",
    price: "18.000 đ",
    seats: "2/6 thành viên",
    note: "Xe ghép từ cổng chính ra ngã tư bắt xe khách cho rẻ nhé, xe có điều hòa.",
  },
  {
    vehicle: "XE 5 CHỖ",
    route: "Cổng Phụ Ký Túc Xá → Hồ Tân Xã",
    distance: "~1.8km",
    price: "12.000 đ",
    seats: "4/5 thành viên",
    note: "Đi ra hồ trà đá hóng mát nhóm ở, mệt mỏi bài tập.",
  },
];

const singleActions = [
  { label: "Xe lẻ ngay", emoji: "⚡", when: "now" },
  { label: "Đặt trước", emoji: "🕒", when: "later" },
];

export default function HomeScreen() {
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState(null); // 'single' | 'shared' | null

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
                styles.toggleButton,
                selectedMode === "single" && styles.toggleActive,
                pressed && styles.pressedButton,
              ]}
              onPress={() =>
                setSelectedMode((v) => (v === "single" ? null : "single"))
              }
            >
              <ThemedText type="smallBold">Xe lẻ</ThemedText>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.toggleButton,
                pressed && styles.pressedButton,
              ]}
              onPress={() => router.push(`/search?mode=shared&when=any`)}
            >
              <ThemedText type="smallBold">Xe ghép</ThemedText>
            </Pressable>
          </View>

          {selectedMode === "single" && (
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
                    router.push(`/search?mode=single&when=${action.when}`)
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
  contentContainer: { alignItems: "center", paddingTop: Spacing.four },
  wrapper: {
    width: "100%",
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  headerText: { flex: 1, marginLeft: Spacing.four, gap: Spacing.one },
  statusBadge: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
    justifyContent: "center",
    alignItems: "center",
  },
  statusText: { textTransform: "uppercase", letterSpacing: 0.5 },
  primaryCard: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.four,
  },
  searchInput: {
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
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
  toggleRow: { flexDirection: "row", gap: Spacing.three },
  toggleButton: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.five,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#DDE1E7",
    borderWidth: 1,
  },
  toggleActive: { borderColor: "#1D4ED8", backgroundColor: "#E6F0FF" },
  quickActionsList: { gap: Spacing.three, marginTop: Spacing.four },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    minHeight: 72,
    borderRadius: Spacing.four,
    padding: Spacing.three,
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
    marginRight: Spacing.four,
  },
  actionLabel: { flex: 1 },
  sectionHeader: { gap: Spacing.one },
  rideCard: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  rideTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  vehicleLabel: { color: "#1D4ED8" },
  rideRouteRow: { gap: Spacing.one },
  rideInfoRow: { flexDirection: "row", justifyContent: "space-between" },
  noteText: { fontStyle: "italic" },
  joinButton: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.five,
    backgroundColor: "#1D4ED8",
    alignItems: "center",
  },
  pressedButton: { opacity: 0.75 },
});
