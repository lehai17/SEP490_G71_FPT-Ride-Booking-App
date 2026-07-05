import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  BottomTabInset,
  MaxContentWidth,
  ScreenHeaderTop,
  ScreenTitleStyle,
  Spacing,
} from "@/constants/theme";
import { getRideGroupById } from "@/constants/ride-data";
import { useTheme } from "@/hooks/use-theme";

const BRAND = "#FF7A00";
const CARD_BORDER = "#ECECEC";
const MUTED = "#70757E";

export default function SharedRideDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const rideId = Array.isArray(params.id) ? params.id[0] : params.id;
  const ride = getRideGroupById(rideId);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: "#F8F8F8" }]}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: ScreenHeaderTop,
          paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
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
            Chi tiết xe ghép
          </ThemedText>
        </View>

        {ride ? (
          <>
            <ThemedView
              style={[styles.detailCard, { backgroundColor: theme.backgroundElement }]}
            >
              <View style={styles.detailTopRow}>
                <View style={styles.vehiclePill}>
                  <ThemedText type="smallBold" style={styles.vehiclePillText}>
                    🚙 {ride.vehicle.toUpperCase()}
                  </ThemedText>
                </View>

                <View style={styles.priceWrap}>
                  <ThemedText type="default" style={styles.priceText}>
                    {ride.price}
                  </ThemedText>
                  <ThemedText type="small" style={styles.perPersonText}>
                    Khi tham gia: {ride.perPersonPrice}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.infoBlock}>
                <ThemedText type="default" style={styles.driverText}>
                  👤 {ride.driver}
                </ThemedText>
                <ThemedText type="default" style={styles.destinationText}>
                  Điểm đến: {ride.destination}
                </ThemedText>
                <ThemedText type="small" style={styles.metaText}>
                  Số người: {ride.participantCount}/{ride.capacity}
                </ThemedText>
                <ThemedText type="small" style={styles.noteText}>
                  {`"${ride.note}"`}
                </ThemedText>
              </View>
            </ThemedView>

            <Pressable style={styles.primaryButton}>
              <ThemedText type="default" style={styles.primaryButtonText}>
                Gửi yêu cầu tham gia
              </ThemedText>
            </Pressable>

            <Pressable
              style={[styles.secondaryButton, { backgroundColor: theme.backgroundElement }]}
              onPress={() => router.back()}
            >
              <ThemedText type="default" style={styles.secondaryButtonText}>
                Quay lại
              </ThemedText>
            </Pressable>
          </>
        ) : (
          <ThemedView
            style={[styles.detailCard, { backgroundColor: theme.backgroundElement }]}
          >
            <ThemedText type="default" style={styles.headerTitle}>
              Không tìm thấy chuyến xe ghép
            </ThemedText>
            <Pressable
              style={[styles.secondaryButton, styles.notFoundButton]}
              onPress={() => router.back()}
            >
              <ThemedText type="default" style={styles.secondaryButtonText}>
                Quay lại
              </ThemedText>
            </Pressable>
          </ThemedView>
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
  detailCard: {
    borderRadius: 18,
    padding: Spacing.three,
    gap: Spacing.three,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  detailTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: Spacing.two,
  },
  vehiclePill: {
    backgroundColor: "#1F2937",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
  },
  vehiclePillText: {
    color: "#FFFFFF",
  },
  priceWrap: {
    alignItems: "flex-end",
    gap: 2,
  },
  priceText: {
    color: BRAND,
    fontSize: 24,
    fontWeight: "800",
  },
  perPersonText: {
    color: MUTED,
    textAlign: "right",
  },
  infoBlock: {
    gap: Spacing.two,
  },
  driverText: {
    color: "#111827",
    fontWeight: "700",
  },
  destinationText: {
    color: "#111827",
    fontWeight: "700",
  },
  metaText: {
    color: MUTED,
  },
  noteText: {
    color: MUTED,
    fontStyle: "italic",
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  secondaryButton: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D9DDE3",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#1F2937",
    fontWeight: "700",
  },
  notFoundButton: {
    marginTop: Spacing.two,
  },
});
