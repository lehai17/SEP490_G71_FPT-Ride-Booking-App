import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import {
  Colors,
  MaxContentWidth,
  ScreenHeaderTop,
  ScreenTitleStyle,
  Spacing,
} from "@/constants/theme";
import { rideGroups } from "@/constants/ride-data";
import { useTheme } from "@/hooks/use-theme";

const BRAND = "#FF7A00";
const SHARED_CARD = "#FFF5EA";

export default function SearchScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const rawMode = params.mode ?? "now";
  const normalizedMode = rawMode === "shared" ? "shared" : "now";
  const normalizedWhen =
    params.when === "later" ? "later" : normalizedMode === "shared" ? "any" : "now";

  const [mode, setMode] = useState(normalizedMode);
  const [when, setWhen] = useState(normalizedWhen);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const selectSingleRide = () => {
    setMode("now");
    setWhen("now");
  };

  const selectScheduledRide = () => {
    setMode("now");
    setWhen("later");
  };

  const selectSharedRide = () => {
    setMode("shared");
    setWhen("any");
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: ScreenHeaderTop,
          paddingBottom: insets.bottom + Spacing.five,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ThemedText type="subtitle" style={styles.backIcon}>
              ←
            </ThemedText>
          </Pressable>
          <ThemedText type="default" style={styles.headerTitle}>
            Đặt xe
          </ThemedText>
        </View>

        <View style={styles.segmentRow}>
          <Pressable
            style={[styles.segment, mode === "now" && styles.segmentActive]}
            onPress={selectSingleRide}
          >
            <ThemedText
              type="smallBold"
              style={[
                styles.segmentText,
                mode === "now" && styles.segmentTextActive,
              ]}
            >
              Xe lẻ
            </ThemedText>
          </Pressable>
          <Pressable
            style={[styles.segment, mode === "shared" && styles.segmentActive]}
            onPress={selectSharedRide}
          >
            <ThemedText
              type="smallBold"
              style={[
                styles.segmentText,
                mode === "shared" && styles.segmentTextActive,
              ]}
            >
              Xe ghép
            </ThemedText>
          </Pressable>
        </View>

        {mode !== "shared" ? (
          <>
            <TextInput
              placeholder="Điểm đón (Vị trí hiện tại)"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundElement,
                },
              ]}
              value={from}
              onChangeText={setFrom}
            />
            <TextInput
              placeholder="Điểm đến"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundElement,
                },
              ]}
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
                style={styles.secondaryButton}
                onPress={() =>
                  router.push(
                    `/search/results?mode=${mode}&when=later&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
                  )
                }
              >
                <ThemedText type="smallBold">Hẹn lịch</ThemedText>
              </Pressable>

              <Pressable
                style={styles.primaryButton}
                onPress={() =>
                  router.push(
                    `/search/results?mode=${mode}&when=${when}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
                  )
                }
              >
                <ThemedText type="smallBold" style={styles.primaryButtonText}>
                  Tiếp tục
                </ThemedText>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.sharedSection}>
            <View style={styles.sharedHeader}>
              <ThemedText type="default" style={styles.sharedTitle}>
                Xe ghép sẵn có
              </ThemedText>
              <Pressable>
                <ThemedText type="smallBold" style={styles.createButtonText}>
                  + Tạo
                </ThemedText>
              </Pressable>
            </View>

            {rideGroups.map((ride) => (
              <View key={ride.id} style={styles.sharedCard}>
                <View style={styles.sharedCardHeader}>
                  <View style={styles.vehiclePill}>
                    <ThemedText type="smallBold" style={styles.vehiclePillText}>
                      {ride.vehicle}
                    </ThemedText>
                  </View>
                  <ThemedText type="default" style={styles.priceText}>
                    {ride.price}
                  </ThemedText>
                </View>

                <View style={styles.sharedRow}>
                  <ThemedText type="smallBold" style={styles.driverText}>
                    {ride.driver}
                  </ThemedText>
                  <ThemedText type="smallBold" style={styles.statusText}>
                    {ride.status}
                  </ThemedText>
                </View>

                <ThemedText type="default" style={styles.routeText}>
                  {ride.route}
                </ThemedText>
                <ThemedText type="small" style={styles.seatsText}>
                  {ride.seats}
                </ThemedText>
                <ThemedText type="small" style={styles.noteText}>
                  {`"${ride.note}"`}
                </ThemedText>

                <Pressable
                  style={styles.detailsButton}
                  onPress={() => router.push(`/shared-ride/${ride.id}`)}
                >
                  <ThemedText type="smallBold" style={styles.detailsButtonText}>
                    Xem chi tiết
                  </ThemedText>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    alignItems: "center",
  },
  content: {
    width: "100%",
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  backIcon: {
    fontSize: 24,
    lineHeight: 28,
  },
  headerTitle: {
    ...ScreenTitleStyle,
  },
  segmentRow: {
    flexDirection: "row",
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  segment: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: Colors.light.backgroundElement,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: {
    backgroundColor: BRAND,
    borderColor: BRAND,
  },
  segmentText: {
    color: "#52525B",
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
  input: {
    minHeight: 54,
    borderRadius: 18,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  savedList: {
    marginTop: Spacing.one,
    gap: Spacing.one,
  },
  savedItem: {
    paddingVertical: 10,
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: Colors.light.backgroundElement,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    flex: 3,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
  },
  sharedSection: {
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  sharedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sharedTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  createButtonText: {
    color: BRAND,
    fontSize: 18,
  },
  sharedCard: {
    backgroundColor: SHARED_CARD,
    borderRadius: 22,
    padding: Spacing.three,
    gap: 10,
    borderLeftWidth: 4,
    borderLeftColor: BRAND,
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sharedCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  vehiclePill: {
    backgroundColor: "#1F2937",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  vehiclePillText: {
    color: "#FFFFFF",
  },
  priceText: {
    color: BRAND,
    fontSize: 24,
    fontWeight: "800",
  },
  sharedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.two,
  },
  driverText: {
    color: "#3F3F46",
  },
  statusText: {
    color: "#6B7280",
  },
  routeText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#18181B",
  },
  seatsText: {
    color: "#52525B",
  },
  noteText: {
    color: "#71717A",
    fontStyle: "italic",
  },
  detailsButton: {
    marginTop: Spacing.one,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
  },
  detailsButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
  },
});
