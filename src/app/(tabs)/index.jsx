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
const BRAND_LIGHT = "#FFF4EA";
const CARD_BORDER = "#ECEFF3";
const INK = "#111827";
const SOFT_TEXT = "#8A8F98";
const homeRideOptions = [
  {
    id: "bike",
    name: "Xe máy",
    icon: "🛵",
    description: "Linh hoạt, nhanh",
  },
  {
    id: "car4",
    name: "Ô tô",
    icon: "🚗",
    description: "Thoải mái, riêng tư",
  },
];

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

  return "Ô tô";
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

      // Tam thoi an du lieu chuyen dat truoc o trang chu cho den khi co API thong ke rieng.
      const scheduledTrips = [];

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
      style={[styles.scrollView, { backgroundColor: "#F5F6FA" }]}
      contentContainerStyle={{
        alignItems: "center",
        paddingTop: 0,
        paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.wrapper}>
        <View style={styles.heroCard}>
          <View style={styles.heroPatternTop} />
          <View style={styles.heroPatternBottom} />

          <View style={styles.heroTopRow}>
            <View style={styles.heroIdentity}>
              <View style={styles.avatar}>
                <ThemedText type="smallBold" style={styles.avatarText}>
                  {displayInitial}
                </ThemedText>
              </View>

              <View style={styles.heroText}>
                <ThemedText type="small" style={styles.heroMeta}>
                  Xin chào,
                </ThemedText>
                <ThemedText type="default" style={styles.heroName}>
                  {displayName}
                </ThemedText>
              </View>
            </View>

            <View style={styles.statusBadge}>
              <ThemedText type="smallBold" style={styles.statusText}>
                {isAuthenticated ? displayRole : "KHÁCH"}
              </ThemedText>
            </View>
          </View>

          <View style={styles.heroMessage}>
            <ThemedText type="subtitle" style={styles.heroTitle}>
              FPT Ride
            </ThemedText>
            <ThemedText type="small" style={styles.heroSubtitle}>
              Đặt xe nhanh trong khuôn viên và các điểm quen thuộc của sinh viên FPTU.
            </ThemedText>
          </View>

          <View style={styles.heroInfoRow}>
            <View style={styles.heroInfoPill}>
              <ThemedText type="smallBold" style={styles.heroInfoIcon}>
                ⚡
              </ThemedText>
              <ThemedText type="smallBold" style={styles.heroInfoText}>
                Nhanh chóng
              </ThemedText>
            </View>
            <View style={styles.heroInfoPill}>
              <ThemedText type="smallBold" style={styles.heroInfoIcon}>
                🎓
              </ThemedText>
              <ThemedText type="smallBold" style={styles.heroInfoText}>
                FPTU
              </ThemedText>
            </View>
          </View>

          {!session?.accessToken ? (
            <View style={styles.authActions}>
              <Pressable
                testID="home-login-button"
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
          <ThemedText type="small" style={styles.primarySubtitle}>
            Chọn hình thức phù hợp, sau đó chọn loại xe để tìm chuyến.
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
              }}
            >
              <View style={styles.modeContent}>
                <View style={styles.modeIconBadge}>
                  <ThemedText type="default" style={styles.modeIcon}>
                    🚕
                  </ThemedText>
                </View>
                <View style={styles.modeCopy}>
                  <ThemedText
                    type="smallBold"
                    style={[
                      styles.modeText,
                      selectedMode === "now" && styles.modeTextActive,
                    ]}
                  >
                    Xe lẻ
                  </ThemedText>
                  <ThemedText type="small" style={styles.modeDescription}>
                    Đi riêng ngay
                  </ThemedText>
                </View>
              </View>
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
              <View style={styles.modeContent}>
                <View style={styles.modeIconBadge}>
                  <ThemedText type="default" style={styles.modeIcon}>
                    👥
                  </ThemedText>
                </View>
                <View style={styles.modeCopy}>
                  <ThemedText
                    type="smallBold"
                    style={[
                      styles.modeText,
                      selectedMode === "shared" && styles.modeTextActive,
                    ]}
                  >
                    Xe ghép
                  </ThemedText>
                  <ThemedText type="small" style={styles.modeDescription}>
                    Chia chuyến rẻ hơn
                  </ThemedText>
                </View>
              </View>
            </Pressable>
          </View>

          {selectedMode === "now" ? (
            <View style={styles.homeVehicleBlock}>
              <ThemedText type="smallBold" style={styles.homeVehicleLabel}>
                Chọn loại xe
              </ThemedText>
              <View testID="home-vehicle-selector" style={styles.homeVehicleRow}>
                {homeRideOptions.map((option) => (
                  <Pressable
                    key={option.id}
                    testID={`home-vehicle-option-${option.id}`}
                    style={({ pressed }) => [
                      styles.homeVehicleOption,
                      pressed && styles.pressedButton,
                    ]}
                    onPress={() =>
                      router.push(
                        `/search?mode=now&when=now&source=home&vehicle=${option.id}`
                      )
                    }
                  >
                    <View style={styles.vehicleIconBadge}>
                      <ThemedText type="default" style={styles.homeVehicleIcon}>
                        {option.icon}
                      </ThemedText>
                    </View>
                    <View style={styles.vehicleCopy}>
                      <ThemedText
                        type="smallBold"
                        style={styles.homeVehicleName}
                      >
                        {option.name}
                      </ThemedText>
                      <ThemedText type="small" style={styles.vehicleDescription}>
                        {option.description}
                      </ThemedText>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
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
                ? "Mục này sẽ được cập nhật sau khi có API thống kê chuyến đặt trước."
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
    gap: 14,
    paddingHorizontal: 16,
  },
  heroCard: {
    backgroundColor: BRAND_DARK,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginHorizontal: -16,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 44,
    gap: 16,
    overflow: "hidden",
  },
  heroPatternTop: {
    position: "absolute",
    top: -42,
    right: -24,
    width: 150,
    height: 150,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.14)",
    transform: [{ rotate: "18deg" }],
  },
  heroPatternBottom: {
    position: "absolute",
    bottom: -48,
    left: -36,
    width: 150,
    height: 110,
    borderRadius: 26,
    backgroundColor: "rgba(17,24,39,0.12)",
    transform: [{ rotate: "-12deg" }],
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  heroIdentity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 3,
  },
  avatarText: {
    color: BRAND_DARK,
    fontSize: 16,
  },
  heroText: {
    flex: 1,
    marginLeft: 12,
  },
  heroName: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 18,
  },
  heroMeta: {
    color: "#FFE7D1",
  },
  heroMessage: {
    gap: 6,
    maxWidth: 520,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
  },
  heroSubtitle: {
    color: "#FFF1E4",
    maxWidth: 460,
  },
  heroInfoRow: {
    flexDirection: "row",
    gap: 10,
  },
  heroInfoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
  },
  heroInfoIcon: {
    fontSize: 13,
    lineHeight: 18,
  },
  heroInfoText: {
    color: "#FFFFFF",
    fontSize: 12,
  },
  statusBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 11,
  },
  authActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  authButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  authButtonText: {
    color: BRAND_DARK,
  },
  authButtonSecondary: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  authButtonSecondaryText: {
    color: "#FFFFFF",
  },
  primaryCard: {
    borderRadius: 22,
    marginTop: -28,
    padding: 18,
    gap: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.11,
    shadowRadius: 24,
    elevation: 4,
  },
  primaryTitle: {
    color: INK,
    fontSize: 20,
    fontWeight: "800",
  },
  primarySubtitle: {
    color: SOFT_TEXT,
    marginTop: -12,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 12,
  },
  modeBtn: {
    flex: 1,
    minHeight: 78,
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
  },
  modeBtnActive: {
    backgroundColor: BRAND_LIGHT,
    borderColor: BRAND,
  },
  modeContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modeIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  modeIcon: {
    fontSize: 20,
    lineHeight: 24,
  },
  modeCopy: {
    flex: 1,
    gap: 1,
  },
  modeText: {
    color: INK,
  },
  modeTextActive: {
    color: BRAND_DARK,
  },
  modeDescription: {
    color: SOFT_TEXT,
    fontSize: 12,
    lineHeight: 16,
  },
  homeVehicleBlock: {
    gap: 10,
  },
  homeVehicleLabel: {
    color: INK,
    fontSize: 15,
  },
  homeVehicleRow: {
    flexDirection: "row",
    gap: 12,
  },
  homeVehicleOption: {
    flex: 1,
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FBFCFE",
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  vehicleIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EEF0F4",
  },
  homeVehicleIcon: {
    fontSize: 22,
    lineHeight: 28,
  },
  vehicleCopy: {
    flex: 1,
  },
  homeVehicleName: {
    color: INK,
  },
  vehicleDescription: {
    color: SOFT_TEXT,
    fontSize: 12,
    lineHeight: 16,
  },
  sectionHeader: {
    gap: 3,
    marginTop: 6,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: INK,
  },
  emptyCard: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#D5DBE4",
    backgroundColor: "#FFFFFF",
    gap: 5,
  },
  emptyTitle: {
    color: INK,
  },
  emptyDescription: {
    color: SOFT_TEXT,
  },
  recentCard: {
    minHeight: 62,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  recentIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 15,
    backgroundColor: BRAND_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  recentContent: {
    flex: 1,
    gap: 2,
  },
  recentRoute: {
    color: INK,
  },
  mutedText: {
    color: SOFT_TEXT,
  },
  scheduledCard: {
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderLeftWidth: 4,
    borderLeftColor: BRAND,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  scheduledTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  waitingBadge: {
    backgroundColor: BRAND_LIGHT,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
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
    color: INK,
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
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderLeftWidth: 4,
    borderLeftColor: BRAND,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  rideTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  vehiclePill: {
    color: "#FFFFFF",
    backgroundColor: INK,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    fontSize: 12,
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
    color: INK,
    fontWeight: "700",
  },
  rideDriverRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  noteText: {
    color: "#64748B",
    fontStyle: "italic",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  joinButton: {
    marginTop: 2,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BRAND_DARK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 2,
  },
  joinButtonText: {
    color: "#FFFFFF",
  },
  pressedButton: {
    opacity: 0.75,
  },
});
