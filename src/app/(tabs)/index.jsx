import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
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
import { getPassengerTrips } from "@/features/booking/services/trip-api";
import { loadBookedTrips } from "@/features/booking/services/trip-storage";
import {
  getAvailableRideSharingGroups,
  getRideSharingGroup,
} from "@/features/ride-sharing/services/ride-sharing-api";
import { useTheme } from "@/hooks/use-theme";

const BRAND = "#FF7A00";
const BRAND_DARK = "#F56A00";
const CARD_BORDER = "#F2F2F2";
const SOFT_TEXT = "#8A8F98";

function getDisplayRole(role) {
  return role === "Customer" ? "Khách hàng" : role;
}

function getTripField(source, camelKey, pascalKey) {
  return source?.[camelKey] ?? source?.[pascalKey];
}

function normalizeTripStatus(status) {
  const rawStatus = String(status ?? "").trim().toLowerCase();

  if (!rawStatus) {
    return "";
  }

  const statusByNumber = {
    1: "pending",
    2: "pendingdriverassignment",
    3: "accepted",
    4: "driverarrived",
    5: "inprogress",
    6: "completed",
    7: "cancelled",
    8: "nodriverfound",
  };

  return statusByNumber[rawStatus] ?? rawStatus.replace(/\s+/g, "");
}

function isScheduledTrip(trip) {
  const tripType = String(
    getTripField(trip, "tripType", "TripType") ?? ""
  ).toLowerCase();

  return (
    tripType === "scheduled" ||
    tripType === "2" ||
    Boolean(getTripField(trip, "scheduledAt", "ScheduledAt"))
  );
}

function isImmediateTrip(trip) {
  return !isScheduledTrip(trip);
}

function isTerminalStatus(status) {
  return ["completed", "cancelled", "nodriverfound"].includes(
    normalizeTripStatus(status)
  );
}

function normalizeRideSharingGroupStatus(status) {
  const rawStatus = String(status ?? "").trim().toLowerCase();

  const statusByNumber = {
    1: "forming",
    2: "readyforbroadcast",
    3: "broadcasting",
    4: "driveraccepted",
    5: "driverarrived",
    6: "inprogress",
    7: "completed",
    8: "cancelled",
    9: "expired",
  };

  return statusByNumber[rawStatus] ?? rawStatus.replace(/\s+/g, "");
}

function isAvailableRideSharingGroup(group) {
  const status = normalizeRideSharingGroupStatus(
    getTripField(group, "status", "Status")
  );

  return !["completed", "cancelled", "expired", "nodriverfound"].includes(status);
}

function formatCurrencyVnd(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "--";
  }

  return `${Math.round(numberValue).toLocaleString("vi-VN")}đ`;
}

function formatTripDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTripSortTime(trip) {
  const rawValue =
    getTripField(trip, "completedAt", "CompletedAt") ??
    getTripField(trip, "cancelledAt", "CancelledAt") ??
    getTripField(trip, "acceptedAt", "AcceptedAt") ??
    getTripField(trip, "createdAt", "CreatedAt") ??
    getTripField(trip, "scheduledAt", "ScheduledAt");

  const date = rawValue ? new Date(rawValue) : null;

  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

function getTripFare(trip) {
  return (
    trip?.pricing?.estimatedFare ??
    trip?.Pricing?.EstimatedFare ??
    trip?.estimatedFare ??
    trip?.EstimatedFare ??
    trip?.fareAmount ??
    trip?.FareAmount ??
    trip?.fare ??
    trip?.Fare ??
    null
  );
}

function getVehicleLabel(trip) {
  const vehicleType = String(
    getTripField(trip, "vehicleType", "VehicleType") ?? ""
  ).toLowerCase();

  if (vehicleType.includes("bike") || vehicleType === "1") {
    return "Xe máy";
  }

  if (vehicleType.includes("7") || vehicleType === "3") {
    return "Xe 7 chỗ";
  }

  return "Xe 4 chỗ";
}

function getTripIcon(trip) {
  return getVehicleLabel(trip) === "Xe máy" ? "🛵" : "🚗";
}

function getScheduledStatusLabel(status) {
  switch (normalizeTripStatus(status)) {
    case "pending":
      return "Đang chờ";
    case "pendingdriverassignment":
      return "Chờ tài xế";
    case "accepted":
      return "Tài xế đã nhận";
    case "driverarrived":
      return "Tài xế đã đến";
    case "inprogress":
      return "Đang di chuyển";
    case "completed":
      return "Hoàn thành";
    case "cancelled":
      return "Đã hủy";
    case "nodriverfound":
      return "Không có tài xế";
    default:
      return "Chờ tài xế";
  }
}

function mapTripToRecentCard(trip) {
  return {
    id: getTripField(trip, "id", "Id"),
    icon: getTripIcon(trip),
    route: `${getTripField(trip, "pickupAddress", "PickupAddress") || "Điểm đón"} → ${
      getTripField(trip, "destinationAddress", "DestinationAddress") || "Điểm đến"
    }`,
    meta: `${formatTripDateTime(
      getTripField(trip, "completedAt", "CompletedAt") ??
        getTripField(trip, "cancelledAt", "CancelledAt") ??
        getTripField(trip, "createdAt", "CreatedAt")
    )} · ${formatCurrencyVnd(getTripFare(trip))}`,
  };
}

function mapTripToScheduledCard(trip) {
  return {
    id: getTripField(trip, "id", "Id"),
    status: getScheduledStatusLabel(getTripField(trip, "status", "Status")),
    price: formatCurrencyVnd(getTripFare(trip)),
    from: getTripField(trip, "pickupAddress", "PickupAddress") || "Điểm đón",
    to:
      getTripField(trip, "destinationAddress", "DestinationAddress") ||
      "Điểm đến",
    vehicle: getVehicleLabel(trip),
    time: formatTripDateTime(getTripField(trip, "scheduledAt", "ScheduledAt")),
  };
}

function mapRideSharingGroupToHomeCard(group) {
  const members = Array.isArray(group?.members) ? group.members : [];
  const firstMember = members[0] ?? {};
  const groupId = getTripField(group, "id", "Id");
  const price =
    firstMember.finalFare ??
    firstMember.FinalFare ??
    group?.finalFare ??
    group?.FinalFare ??
    0;
  const pickup =
    firstMember.pickupAddress ??
    firstMember.PickupAddress ??
    group?.pickupAddress ??
    group?.PickupAddress ??
    "Điểm đón";
  const destination =
    firstMember.destinationAddress ??
    firstMember.DestinationAddress ??
    group?.destinationAddress ??
    group?.DestinationAddress ??
    "Điểm đến";
  const currentPassengers =
    group?.currentPassengers ?? group?.CurrentPassengers ?? members.length;
  const maxPassengers = group?.maxPassengers ?? group?.MaxPassengers ?? 3;

  return {
    id: groupId,
    vehicle: "Xe ghép",
    price: formatCurrencyVnd(price),
    route: `${pickup} → ${destination}`,
    driver: group?.driverName || group?.DriverName || "Chưa có tài xế",
    seats: `${currentPassengers}/${maxPassengers} người`,
    note: "Nhóm còn có thể tham gia",
  };
}

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
  const [visibleRecentTrips, setVisibleRecentTrips] = useState([]);
  const [visibleScheduledTrips, setVisibleScheduledTrips] = useState([]);
  const [visibleRideGroups, setVisibleRideGroups] = useState([]);
  const accessToken = session?.accessToken;

  const displayName = session?.fullName ?? "Bạn";
  const displayInitial = displayName.charAt(0)?.toUpperCase() ?? "B";
  const displayRole = getDisplayRole(session?.role) ?? "Khách";

  const loadHomeTrips = useCallback(async () => {
    if (!accessToken) {
      setVisibleRecentTrips([]);
      setVisibleScheduledTrips([]);
      setVisibleRideGroups([]);
      return;
    }

    try {
      const [apiTrips, localTrips] = await Promise.all([
        getPassengerTrips(accessToken).catch(() => []),
        loadBookedTrips().catch(() => []),
      ]);

      const mergedTrips = [
        ...(Array.isArray(apiTrips) ? apiTrips : []),
        ...(Array.isArray(localTrips) ? localTrips : []),
      ];

      const dedupedTrips = Array.from(
        new Map(
          mergedTrips
            .filter((trip) => getTripField(trip, "id", "Id"))
            .map((trip) => [getTripField(trip, "id", "Id"), trip])
        ).values()
      );

      const recentTrips = dedupedTrips
        .filter((trip) =>
          isImmediateTrip(trip) &&
          isTerminalStatus(getTripField(trip, "status", "Status"))
        )
        .sort((first, second) => getTripSortTime(second) - getTripSortTime(first))
        .slice(0, 3)
        .map(mapTripToRecentCard);

      const scheduledTrips = dedupedTrips
        .filter(
          (trip) =>
            isScheduledTrip(trip) &&
            !isTerminalStatus(getTripField(trip, "status", "Status"))
        )
        .sort((first, second) => {
          const firstTime = new Date(
            getTripField(first, "scheduledAt", "ScheduledAt") ??
              getTripField(first, "createdAt", "CreatedAt") ??
              0
          ).getTime();
          const secondTime = new Date(
            getTripField(second, "scheduledAt", "ScheduledAt") ??
              getTripField(second, "createdAt", "CreatedAt") ??
              0
          ).getTime();

          return firstTime - secondTime;
        })
        .slice(0, 3)
        .map(mapTripToScheduledCard);

      setVisibleRecentTrips(recentTrips);
      setVisibleScheduledTrips(scheduledTrips);

      const availableGroups = await getAvailableRideSharingGroups(
        "",
        accessToken
      ).catch(() => []);
      const detailedGroups = await Promise.allSettled(
        (Array.isArray(availableGroups) ? availableGroups : [])
          .slice(0, 6)
          .map((group) =>
            getRideSharingGroup(getTripField(group, "id", "Id"), accessToken)
          )
      );
      const groups = (Array.isArray(availableGroups) ? availableGroups : [])
        .map((group, index) =>
          detailedGroups[index]?.status === "fulfilled"
            ? detailedGroups[index].value
            : group
        )
        .filter(
          (group) =>
            getTripField(group, "id", "Id") && isAvailableRideSharingGroup(group)
        )
        .slice(0, 3)
        .map(mapRideSharingGroupToHomeCard);

      setVisibleRideGroups(groups);
    } catch {
      setVisibleRecentTrips([]);
      setVisibleScheduledTrips([]);
      setVisibleRideGroups([]);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      loadHomeTrips();
    }, [loadHomeTrips])
  );

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
            CHÀO MỪNG SINH VIÊN FPTU
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
                  ? `${displayRole} - Người đặt xe`
                  : "Hãy đăng nhập để đồng bộ tài khoản"}
              </ThemedText>
            </View>

            {!isAuthenticated ? (
              <View style={styles.statusBadge}>
                <ThemedText type="smallBold" style={styles.statusText}>
                  KHÁCH
                </ThemedText>
              </View>
            ) : null}
          </View>

          {!session?.accessToken ? (
            <View style={styles.authActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.authButton,
                  pressed && styles.pressedButton,
                ]}
                onPress={() => router.push("/profile")}
              >
                <ThemedText type="smallBold" style={styles.authButtonText}>
                  Đăng nhập
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
                  Đăng ký
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
            Bạn muốn di chuyển thế nào?
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
                style={[
                  styles.modeText,
                  selectedMode === "shared" && styles.modeTextActive,
                ]}
              >
                Xe ghép
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>

        <View style={styles.sectionHeader}>
          <ThemedText type="default" style={styles.sectionTitle}>
            Chuyến gần đây
          </ThemedText>
        </View>

        {visibleRecentTrips.length > 0 ? (
          visibleRecentTrips.map((trip) => (
            <ThemedView
              key={trip.id}
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
            title="Chưa có chuyến gần đây"
            description={
              isAuthenticated
                ? "Khi bạn hoàn thành chuyến đầu tiên, lịch sử sẽ hiện ở đây."
                : "Đăng nhập để xem lịch sử di chuyển của bạn."
            }
          />
        )}

        <View style={styles.sectionHeader}>
          <ThemedText type="default" style={styles.sectionTitle}>
            Chuyến đã đặt trước
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
            title="Chưa có chuyến đặt trước"
            description={
              isAuthenticated
                ? "Những chuyến bạn đặt trước sẽ được cập nhật tại đây."
                : "Đăng nhập hoặc đăng ký để đặt và quản lý chuyến đi."
            }
          />
        )}

        <View style={styles.sectionHeader}>
          <ThemedText type="default" style={styles.sectionTitle}>
            Nhóm xe ghép sẵn có
          </ThemedText>
          <ThemedText type="small" style={styles.mutedText}>
            Chọn chuyến và tham gia cùng bạn bè FPTU
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
                  Xem chi tiết
                </ThemedText>
              </Pressable>
            </ThemedView>
          ))
        ) : (
          <EmptyState
            title="Chưa có nhóm xe ghép"
            description="Khi có nhóm xe ghép phù hợp, danh sách sẽ hiện tại đây."
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
