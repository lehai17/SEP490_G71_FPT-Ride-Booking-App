import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  BottomTabInset,
  MaxContentWidth,
  Spacing,
} from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/hooks/use-theme";

const BRAND = "#FF7A00";
const BRAND_DARK = "#F56A00";
const CARD_BORDER = "#F2F2F2";
const SOFT_TEXT = "#8A8F98";

function EmptyState({ title, description }) {
  return (
    <ThemedView style={styles.emptyCard}>
      <ThemedText type="smallBold" style={styles.emptyTitle}>
        {title}
      </ThemedText>
      <ThemedText type="small" style={styles.emptyDescription}>
        {description}
      </ThemedText>
    </ThemedView>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const router = useRouter();
  const { session, isAuthenticated } = useAuth();
  const [selectedMode, setSelectedMode] = useState("now");

  const displayName = session?.fullName ?? "Ban";
  const displayInitial = displayName.charAt(0)?.toUpperCase() ?? "B";
  const displayRole = session?.role ?? "Khach";

  const visibleRecentTrips = [];
  const visibleScheduledTrips = [];
  const visibleRideGroups = [];

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: "#F8F8F8" }]}
      contentContainerStyle={{
        alignItems: "center",
        paddingTop: Spacing.two,
        paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.wrapper}>
        <View style={styles.heroCard}>
          <ThemedText type="smallBold" style={styles.heroEyebrow}>
            CHAO MUNG SINH VIEN FPTU
          </ThemedText>

          <View style={styles.heroContent}>
            <View style={styles.avatar}>
              <ThemedText type="smallBold" style={styles.avatarText}>
                {displayInitial}
              </ThemedText>
            </View>

            <View style={styles.heroText}>
              <ThemedText type="default" style={styles.heroName}>
                {displayName}
              </ThemedText>
              <ThemedText type="small" style={styles.heroMeta}>
                {isAuthenticated
                  ? `${displayRole} - Ride Booker`
                  : "Hay dang nhap de dong bo tai khoan"}
              </ThemedText>
            </View>

            <View style={styles.statusBadge}>
              <ThemedText type="smallBold" style={styles.statusText}>
                {isAuthenticated ? "ONLINE" : "GUEST"}
              </ThemedText>
            </View>
          </View>

          {!isAuthenticated ? (
            <View style={styles.authActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.authButton,
                  pressed && styles.pressedButton,
                ]}
                onPress={() => router.push("/profile")}
              >
                <ThemedText type="smallBold" style={styles.authButtonText}>
                  Dang nhap
                </ThemedText>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.authButtonSecondary,
                  pressed && styles.pressedButton,
                ]}
                onPress={() => router.push("/profile")}
              >
                <ThemedText
                  type="smallBold"
                  style={styles.authButtonSecondaryText}
                >
                  Dang ky
                </ThemedText>
              </Pressable>
            </View>
          ) : null}
        </View>

        <ThemedView
          style={[
            styles.primaryCard,
            { backgroundColor: theme.backgroundElement },
          ]}
        >
          <ThemedText type="default" style={styles.primaryTitle}>
            Ban muon di chuyen the nao?
          </ThemedText>

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
                style={[
                  styles.modeText,
                  selectedMode === "now" && styles.modeTextActive,
                ]}
              >
                Xe le
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
                style={[
                  styles.modeText,
                  selectedMode === "shared" && styles.modeTextActive,
                ]}
              >
                Xe ghep
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>

        <View style={styles.sectionHeader}>
          <ThemedText type="default" style={styles.sectionTitle}>
            Chuyen gan day
          </ThemedText>
        </View>

        {visibleRecentTrips.length > 0 ? (
          visibleRecentTrips.map((trip) => (
            <ThemedView
              key={trip.route}
              style={[
                styles.recentCard,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              <View style={styles.recentIconWrap}>
                <ThemedText type="smallBold">{trip.icon}</ThemedText>
              </View>
              <View style={styles.recentContent}>
                <ThemedText type="smallBold" style={styles.recentRoute}>
                  {trip.route}
                </ThemedText>
                <ThemedText type="small" style={styles.mutedText}>
                  {trip.meta}
                </ThemedText>
              </View>
            </ThemedView>
          ))
        ) : (
          <EmptyState
            title="Chua co chuyen gan day"
            description={
              isAuthenticated
                ? "Khi ban hoan thanh chuyen dau tien, lich su se hien o day."
                : "Dang nhap de xem lich su di chuyen cua ban."
            }
          />
        )}

        <View style={styles.sectionHeader}>
          <ThemedText type="default" style={styles.sectionTitle}>
            Chuyen da dat truoc
          </ThemedText>
        </View>

        {visibleScheduledTrips.length > 0 ? (
          visibleScheduledTrips.map((trip) => (
            <ThemedView
              key={trip.id}
              style={[
                styles.scheduledCard,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              <View style={styles.scheduledTopRow}>
                <View style={styles.waitingBadge}>
                  <ThemedText type="smallBold" style={styles.waitingText}>
                    {trip.status}
                  </ThemedText>
                </View>
                <ThemedText type="default" style={styles.scheduledPrice}>
                  {trip.price}
                </ThemedText>
              </View>

              <View style={styles.scheduledBody}>
                <ThemedText type="default" style={styles.scheduledFrom}>
                  {trip.from}
                </ThemedText>
                <ThemedText type="small" style={styles.mutedText}>
                  {trip.to}
                </ThemedText>
                <View style={styles.scheduledBottomRow}>
                  <ThemedText type="small" style={styles.mutedText}>
                    {trip.vehicle}
                  </ThemedText>
                  <ThemedText type="small" style={styles.mutedText}>
                    {trip.time}
                  </ThemedText>
                </View>
              </View>
            </ThemedView>
          ))
        ) : (
          <EmptyState
            title="Chua co chuyen dat truoc"
            description={
              isAuthenticated
                ? "Nhung chuyen ban dat truoc se duoc cap nhat tai day."
                : "Dang nhap hoac dang ky de dat va quan ly chuyen di."
            }
          />
        )}

        <View style={styles.sectionHeader}>
          <ThemedText type="default" style={styles.sectionTitle}>
            Nhom xe ghep san co
          </ThemedText>
          <ThemedText type="small" style={styles.mutedText}>
            Chon chuyen va tham gia cung ban be FPTU
          </ThemedText>
        </View>

        {visibleRideGroups.length > 0 ? (
          visibleRideGroups.map((ride) => (
            <ThemedView
              key={ride.id}
              style={[
                styles.rideCard,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              <View style={styles.rideTitleRow}>
                <ThemedText type="smallBold" style={styles.vehiclePill}>
                  {ride.vehicle.toUpperCase()}
                </ThemedText>
                <ThemedText type="default" style={styles.ridePrice}>
                  {ride.price}
                </ThemedText>
              </View>

              <View style={styles.rideRouteRow}>
                <ThemedText type="default" style={styles.rideRoute}>
                  {ride.route}
                </ThemedText>
              </View>

              <View style={styles.rideDriverRow}>
                <ThemedText type="small" style={styles.mutedText}>
                  {ride.driver}
                </ThemedText>
                <ThemedText type="small" style={styles.mutedText}>
                  {ride.seats}
                </ThemedText>
              </View>

              <ThemedText type="small" style={styles.noteText}>
                {`"${ride.note}"`}
              </ThemedText>

              <Pressable
                style={({ pressed }) => [
                  styles.joinButton,
                  pressed && styles.pressedButton,
                ]}
                onPress={() => router.push(`/search/shared-ride/${ride.id}`)}
              >
                <ThemedText type="smallBold" style={styles.joinButtonText}>
                  Xem chi tiet
                </ThemedText>
              </Pressable>
            </ThemedView>
          ))
        ) : (
          <EmptyState
            title="Chua co nhom xe ghep"
            description="Khi co nhom xe ghep phu hop, danh sach se hien tai day."
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  wrapper: {
    width: "100%",
    maxWidth: MaxContentWidth,
    gap: 12,
    paddingHorizontal: 16,
  },
  heroCard: {
    backgroundColor: BRAND,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  heroEyebrow: {
    color: "#FFFFFF",
    textAlign: "center",
    fontSize: 13,
  },
  heroContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: BRAND_DARK,
  },
  heroText: {
    flex: 1,
    marginLeft: 10,
    gap: 2,
  },
  heroName: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  heroMeta: {
    color: "#FFE7D1",
  },
  statusBadge: {
    backgroundColor: "#FFB97B",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 11,
  },
  authActions: {
    flexDirection: "row",
    gap: 10,
  },
  authButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  authButtonText: {
    color: BRAND_DARK,
  },
  authButtonSecondary: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  authButtonSecondaryText: {
    color: "#FFFFFF",
  },
  primaryCard: {
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  primaryTitle: {
    textAlign: "center",
    color: "#374151",
    fontSize: 18,
    fontWeight: "600",
  },
  toggleRow: {
    flexDirection: "row",
    gap: 10,
  },
  modeBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BRAND,
  },
  modeBtnActive: {
    backgroundColor: "#FFF3E8",
  },
  modeText: {
    color: BRAND,
  },
  modeTextActive: {
    color: BRAND_DARK,
  },
  sectionHeader: {
    gap: 2,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  emptyCard: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#D8DDE6",
    backgroundColor: "#FFFFFF",
    gap: 4,
  },
  emptyTitle: {
    color: "#374151",
  },
  emptyDescription: {
    color: SOFT_TEXT,
  },
  recentCard: {
    minHeight: 50,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  recentIconWrap: {
    width: 22,
    alignItems: "center",
  },
  recentContent: {
    flex: 1,
    gap: 2,
  },
  recentRoute: {
    color: "#111827",
  },
  mutedText: {
    color: SOFT_TEXT,
  },
  scheduledCard: {
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderLeftWidth: 3,
    borderLeftColor: BRAND,
  },
  scheduledTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  waitingBadge: {
    backgroundColor: "#FFF0E3",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  waitingText: {
    color: BRAND_DARK,
    fontSize: 12,
  },
  scheduledPrice: {
    color: BRAND,
    fontWeight: "800",
    fontSize: 18,
  },
  scheduledBody: {
    gap: 4,
  },
  scheduledFrom: {
    color: "#111827",
    fontWeight: "700",
  },
  scheduledBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
    gap: 10,
  },
  rideCard: {
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderLeftWidth: 3,
    borderLeftColor: BRAND,
  },
  rideTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  vehiclePill: {
    color: "#FFFFFF",
    backgroundColor: "#1F2937",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ridePrice: {
    color: BRAND,
    fontWeight: "800",
    fontSize: 18,
  },
  rideRouteRow: {
    gap: 4,
  },
  rideRoute: {
    color: "#111827",
    fontWeight: "700",
  },
  rideDriverRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  noteText: {
    color: SOFT_TEXT,
    fontStyle: "italic",
  },
  joinButton: {
    marginTop: 4,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
  },
  joinButtonText: {
    color: "#FFFFFF",
  },
  pressedButton: {
    opacity: 0.75,
  },
});
