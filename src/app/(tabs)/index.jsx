// HOME SCREEN - Màn trang chủ khách, liệt kê tất cả các chuyến đã đi ở "Chuyến gần đây"
// ================================================================
// Comment tiếng Việt được đặt phía trên từng khối để giải thích vai trò code.
// Logic hiện tại được giữ nguyên, chỉ bổ sung mô tả cho dễ đọc/bảo trì.
// ================================================================

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
import { useTheme } from "@/hooks/use-theme";

// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const BRAND = "#FF7A00";
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const BRAND_DARK = "#F56A00";
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const BRAND_LIGHT = "#FFF4EA";
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const CARD_BORDER = "#ECEFF3";
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const INK = "#111827";
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
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

// getDisplayRole: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getDisplayRole(role) {
  return role === "Customer" ? "Khách hàng" : role;
}

// getTripField: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getTripField(source, camelKey, pascalKey) {
  return source?.[camelKey] ?? source?.[pascalKey];
}

// formatCurrencyVnd: Định dạng số tiền sang VND để hiển thị
function formatCurrencyVnd(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "--";
  }

  return `${Math.round(numberValue).toLocaleString("vi-VN")}đ`;
}

// formatTripDateTime: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
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

// getTripSortTime: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
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

// getTripFare: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
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

// getVehicleLabel: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
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

// getTripAddress: NHẬN trip từ BE/local và lấy địa chỉ đón/đến.
// BE camelCase (pickupAddress/destinationAddress), PascalCase (PickupAddress/DestinationAddress),
// và cache local có thể dùng pickup/destination hoặc pickupText/destinationText.
// Trả về chuỗi rỗng nếu tất cả các key đều không có dữ liệu hợp lệ.
function getTripAddress(trip, kind) {
  const candidateKeys = {
    pickup: [
      "pickupAddress",
      "PickupAddress",
      "pickup",
      "Pickup",
      "pickupLocation",
      "PickupLocation",
      "pickupText",
      "PickupText",
      "pickupName",
      "PickupName",
    ],
    destination: [
      "destinationAddress",
      "DestinationAddress",
      "destination",
      "Destination",
      "destinationLocation",
      "DestinationLocation",
      "destinationText",
      "DestinationText",
      "destinationName",
      "DestinationName",
    ],
  };
  const keys = candidateKeys[kind] ?? [];
  for (const key of keys) {
    const value = trip?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

// getTripIcon: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getTripIcon(trip) {
  return getVehicleLabel(trip) === "Xe máy" ? "🛵" : "🚗";
}

// isCancelledStatus: Chuẩn hóa status chuyến về dạng thống nhất rồi kiểm tra đã hủy chưa.
// Chấp nhận cả status dạng số (7 = cancelled) hoặc text ("cancelled", "Cancelled", ...).
function isCancelledStatus(status) {
  const rawStatus = String(status ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!rawStatus) return false;
  if (rawStatus === "7") return true;
  return rawStatus === "cancelled";
}

// isCancelledTrip: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function isCancelledTrip(trip) {
  return isCancelledStatus(getTripField(trip, "status", "Status"));
}

// mapTripToRecentCard: NHẬN trip thô từ BE/local và chuyển thành card "Chuyến gần đây".
// Dữ liệu lấy: id, địa chỉ đón/đến, completedAt/cancelledAt/createdAt, fare.
// Output card chỉ chứa field UI cần render: id/icon/route/meta.
function mapTripToRecentCard(trip) {
  const pickup = getTripAddress(trip, "pickup");
  const destination = getTripAddress(trip, "destination");

  return {
    id: getTripField(trip, "id", "Id"),
    icon: getTripIcon(trip),
    route: `${pickup || "Điểm đón"} → ${destination || "Điểm đến"}`,
    meta: `${formatTripDateTime(
      getTripField(trip, "completedAt", "CompletedAt") ??
        getTripField(trip, "cancelledAt", "CancelledAt") ??
        getTripField(trip, "createdAt", "CreatedAt")
    )} · ${formatCurrencyVnd(getTripFare(trip))}`,
  };
}

// EmptyState: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function EmptyState({ title, description }) {
  return (
    /* Khối empty card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */
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

// HomeScreen: Component chính của tab Trang chủ
export default function HomeScreen() {
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const router = useRouter();
  const { session, isAuthenticated } = useAuth();
  const [selectedMode, setSelectedMode] = useState("now");
  const [visibleRecentTrips, setVisibleRecentTrips] = useState([]);
  const accessToken = session?.accessToken;

  const displayName = session?.fullName ?? "Bạn";
  const displayInitial = displayName.charAt(0)?.toUpperCase() ?? "B";
  const displayRole = getDisplayRole(session?.role) ?? "Khách";

  // loadHomeTrips: LUỒNG NHẬN DỮ LIỆU CHO TRANG CHỦ
  // ================================================================
  // 1. Lấy accessToken từ AuthContext; không có token thì không gọi BE và clear state.
  // 2. Gọi song song:
  //    - getPassengerTrips(accessToken): nhận danh sách chuyến từ BE.
  //    - loadBookedTrips(): nhận chuyến local đã cache sau khi đặt xe.
  // 3. Gộp BE + local, bỏ trùng theo trip id để tránh hiển thị lặp.
  // 4. Lọc bỏ chuyến đã hủy, sort mới nhất, lấy 3 chuyến gần nhất rồi map thành card
  //    "Chuyến gần đây" cho mọi loại chuyến còn lại.
  // 5. setVisibleRecentTrips đẩy dữ liệu vào UI render.
  // ================================================================
  const loadHomeTrips = useCallback(async () => {
    if (!accessToken) {
      // Không có session đăng nhập: xóa dữ liệu cá nhân khỏi trang chủ.
      setVisibleRecentTrips([]);
      return;
    }

    try {
      // Nhận dữ liệu chuyến từ 2 nguồn: BE là dữ liệu chuẩn, local là cache để UI không bị trống.
      const [apiTrips, localTrips] = await Promise.all([
        getPassengerTrips(accessToken).catch(() => []),
        loadBookedTrips().catch(() => []),
      ]);

      // Gộp dữ liệu rồi dedupe theo id; nếu cùng id thì bản local phía sau có thể bổ sung field UI đã lưu.
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

      // Lọc bỏ chuyến đã hủy, sort mới nhất, lấy 3 chuyến gần nhất để hiển thị ở "Chuyến gần đây".
      const recentTrips = dedupedTrips
        .filter((trip) => !isCancelledTrip(trip))
        .sort((first, second) => getTripSortTime(second) - getTripSortTime(first))
        .slice(0, 3)
        .map(mapTripToRecentCard);

      // Đưa dữ liệu đã map vào state; JSX phía dưới chỉ render theo state này.
      setVisibleRecentTrips(recentTrips);
    } catch {
      // Nếu API lỗi/mạng lỗi: không crash màn hình, chỉ đưa section về trạng thái rỗng.
      setVisibleRecentTrips([]);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      loadHomeTrips();
    }, [loadHomeTrips])
  );

  return (
    /* ScrollView: Cho phép nội dung dài cuộn được trên màn hình nhỏ. */
    <ScrollView
      style={[styles.scrollView, { backgroundColor: "#F5F6FA" }]}
      contentContainerStyle={{
        alignItems: "center",
        paddingTop: 0,
        paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Khối wrapper: Bố cục bao ngoài, canh lề và giới hạn chiều rộng nội dung. */}
      <View style={styles.wrapper}>
        {/* Khối hero card: Khu vực hero đầu màn hình hiển thị lời chào/trạng thái nổi bật. */}
        <View style={styles.heroCard}>
          {/* Khối hero pattern top: Khu vực hero đầu màn hình hiển thị lời chào/trạng thái nổi bật. */}
          <View style={styles.heroPatternTop} />
          {/* Khối hero pattern bottom: Khu vực hero đầu màn hình hiển thị lời chào/trạng thái nổi bật. */}
          <View style={styles.heroPatternBottom} />

          {/* Khối hero top row: Khu vực hero đầu màn hình hiển thị lời chào/trạng thái nổi bật. */}
          <View style={styles.heroTopRow}>
            {/* Khối hero identity: Khu vực hero đầu màn hình hiển thị lời chào/trạng thái nổi bật. */}
            <View style={styles.heroIdentity}>
              {/* Khối avatar: Hiển thị avatar/chữ cái đại diện của người dùng. */}
              <View style={styles.avatar}>
                <ThemedText type="smallBold" style={styles.avatarText}>
                  {displayInitial}
                </ThemedText>
              </View>

              {/* Khối hero text: Khu vực hero đầu màn hình hiển thị lời chào/trạng thái nổi bật. */}
              <View style={styles.heroText}>
                <ThemedText type="small" style={styles.heroMeta}>
                  Xin chào,
                </ThemedText>
                <ThemedText type="default" style={styles.heroName}>
                  {displayName}
                </ThemedText>
              </View>
            </View>

            {/* Khối status badge: Nhãn trạng thái nhỏ giúp người dùng quét thông tin nhanh. */}
            <View style={styles.statusBadge}>
              <ThemedText type="smallBold" style={styles.statusText}>
                {isAuthenticated ? displayRole : "KHÁCH"}
              </ThemedText>
            </View>
          </View>

          {/* Khối hero message: Khu vực hero đầu màn hình hiển thị lời chào/trạng thái nổi bật. */}
          <View style={styles.heroMessage}>
            <ThemedText type="subtitle" style={styles.heroTitle}>
              FPT Ride
            </ThemedText>
            <ThemedText type="small" style={styles.heroSubtitle}>
              Đặt xe nhanh trong khuôn viên và các điểm quen thuộc của sinh viên FPTU.
            </ThemedText>
          </View>

          {/* Khối hero info row: Khu vực hero đầu màn hình hiển thị lời chào/trạng thái nổi bật. */}
          <View style={styles.heroInfoRow}>
            {/* Khối hero info pill: Khu vực hero đầu màn hình hiển thị lời chào/trạng thái nổi bật. */}
            <View style={styles.heroInfoPill}>
              <ThemedText type="smallBold" style={styles.heroInfoIcon}>
                ⚡
              </ThemedText>
              <ThemedText type="smallBold" style={styles.heroInfoText}>
                Nhanh chóng
              </ThemedText>
            </View>
            {/* Khối hero info pill: Khu vực hero đầu màn hình hiển thị lời chào/trạng thái nổi bật. */}
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
            /* Khối auth actions: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */
            <View style={styles.authActions}>
              {/* Điều hướng đăng nhập: bấm nút này chuyển sang tab /profile, không truyền params; ProfileScreen tự hiển thị form login khi chưa có session. */}
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

              {/* Điều hướng đăng ký: cũng chuyển sang /profile; người dùng chọn tab đăng ký trong ProfileScreen. */}
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

        {/* Khối primary card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
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

          {/* Khối toggle row: Nhóm lựa chọn dạng tab/segment để đổi chế độ hiển thị. */}
          <View style={styles.toggleRow}>
            {/* Chọn chế độ xe lẻ: chỉ đổi state selectedMode tại Home, chưa điều hướng và chưa gửi dữ liệu sang màn khác. */}
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
              {/* Khối mode content: Bố cục bao ngoài, canh lề và giới hạn chiều rộng nội dung. */}
              <View style={styles.modeContent}>
                {/* Khối mode icon badge: Gom icon và text của một lựa chọn chế độ đặt xe. */}
                <View style={styles.modeIconBadge}>
                  <ThemedText type="default" style={styles.modeIcon}>
                    🚕
                  </ThemedText>
                </View>
                {/* Khối mode copy: Gom icon và text của một lựa chọn chế độ đặt xe. */}
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

            {/* Chọn chế độ xe ghép: set selectedMode để active UI, rồi điều hướng sang /search với query mode=shared&when=any. */}
            {/* SearchScreen đọc query này bằng useLocalSearchParams để mở đúng tab xe ghép ngay khi vào màn. */}
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
              {/* Khối mode content: Bố cục bao ngoài, canh lề và giới hạn chiều rộng nội dung. */}
              <View style={styles.modeContent}>
                {/* Khối mode icon badge: Gom icon và text của một lựa chọn chế độ đặt xe. */}
                <View style={styles.modeIconBadge}>
                  <ThemedText type="default" style={styles.modeIcon}>
                    👥
                  </ThemedText>
                </View>
                {/* Khối mode copy: Gom icon và text của một lựa chọn chế độ đặt xe. */}
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
            /* Khối home vehicle block: Hiển thị lựa chọn loại xe và mô tả cho người dùng. */
            <View style={styles.homeVehicleBlock}>
              <ThemedText type="smallBold" style={styles.homeVehicleLabel}>
                Chọn loại xe
              </ThemedText>
              {/* Khối home vehicle row: Hiển thị lựa chọn loại xe và mô tả cho người dùng. */}
              <View testID="home-vehicle-selector" style={styles.homeVehicleRow}>
                {homeRideOptions.map((option) => (
                  /* Điều hướng chọn loại xe: gửi mode=now, when=now, source=home và vehicle=option.id qua URL query. */
                  /* SearchScreen nhận các params này để preselect loại xe và biết flow bắt đầu từ Home. */
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
                    {/* Khối vehicle icon badge: Hiển thị lựa chọn loại xe và mô tả cho người dùng. */}
                    <View style={styles.vehicleIconBadge}>
                      <ThemedText type="default" style={styles.homeVehicleIcon}>
                        {option.icon}
                      </ThemedText>
                    </View>
                    {/* Khối vehicle copy: Hiển thị lựa chọn loại xe và mô tả cho người dùng. */}
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

        {/* Header section: Tiêu đề cho một nhóm nội dung trong màn hình. */}
        <View style={styles.sectionHeader}>
          <ThemedText type="default" style={styles.sectionTitle}>
            Chuyến gần đây
          </ThemedText>
        </View>

        {visibleRecentTrips.length > 0 ? (
          visibleRecentTrips.map((trip) => (
            /* Khối recent card: Card/chỉ mục chuyến gần đây để người dùng xem nhanh. */
            <ThemedView
              key={trip.id}
              style={[
                styles.recentCard,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              {/* Khối recent icon wrap: Card/chỉ mục chuyến gần đây để người dùng xem nhanh. */}
              <View style={styles.recentIconWrap}>
                <ThemedText type="smallBold">{trip.icon}</ThemedText>
              </View>
              {/* Khối recent content: Bố cục bao ngoài, canh lề và giới hạn chiều rộng nội dung. */}
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
            title="Chưa có chuyến nào"
            description={
              isAuthenticated
                ? "Khi bạn đặt hoặc hoàn thành chuyến đầu tiên, lịch sử sẽ hiện ở đây."
                : "Đăng nhập để xem lịch sử di chuyển của bạn."
            }
          />
        )}
      </View>
    </ScrollView>
  );
}

// styles: Gom toàn bộ style của màn hình/component ở cuối file
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
  pressedButton: {
    opacity: 0.75,
  },
});
