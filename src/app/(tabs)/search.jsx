import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
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
const MAP_BG = "#FFF3C9";
const rideOptions = [
  {
    id: "bike",
    icon: "🛵",
    name: "Xe máy",
    eta: "Đón trong 3 phút",
    price: "25.000đ",
  },
  {
    id: "car4",
    icon: "🚗",
    name: "Xe 4 chỗ",
    eta: "Đón trong 5 phút",
    price: "46.000đ",
  },
  {
    id: "car7",
    icon: "🚙",
    name: "Xe 7 chỗ",
    eta: "Đón trong 7 phút",
    price: "60.000đ",
  },
];

const vouchers = [
  {
    id: "fptu2024",
    code: "Mã FPTU2024",
    description: "Giảm 5.000đ cho chuyến này",
    discount: "-5.000đ",
  },
  {
    id: "student2024",
    code: "Mã STUDENT2024",
    description: "Giảm 3.000đ cho sinh viên",
    discount: "-3.000đ",
  },
];

export default function SearchScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const rawMode = params.mode ?? "now";
  const normalizedMode = rawMode === "shared" ? "shared" : "now";

  const [mode, setMode] = useState(normalizedMode);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [focusedField, setFocusedField] = useState("from");
  const [bookingStep, setBookingStep] = useState("form");
  const [alertMessage, setAlertMessage] = useState("");
  const [driverNote, setDriverNote] = useState("");
  const [selectedRideId, setSelectedRideId] = useState("bike");
  const [selectedVoucherId, setSelectedVoucherId] = useState("fptu2024");

  const savedAddresses = [
    { id: "saved-from", label: "Đại học FPT, Thạch Hòa", target: "from" },
    { id: "saved-to", label: "Bến xe Mỹ Đình", target: "to" },
  ];

  const selectSingleRide = () => {
    setMode("now");
    setBookingStep("form");
  };

  const selectSharedRide = () => {
    setMode("shared");
    setBookingStep("form");
    setAlertMessage("");
  };

  const fromLabel = from.trim() || "Vị trí hiện tại";
  const toLabel = to.trim() || "Đại học FPT, Thạch Hòa";

  const showConfirmationStep = () => {
    if (!from.trim()) {
      setAlertMessage("Vui lòng nhập điểm đón");
      setFocusedField("from");
      return;
    }

    if (!to.trim()) {
      setAlertMessage("Vui lòng nhập điểm đến");
      setFocusedField("to");
      return;
    }

    setAlertMessage("");
    setBookingStep("confirm");
  };

  return (
    <>
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
          <Pressable
            onPress={() => {
              if (bookingStep === "rideOptions") {
                setBookingStep("confirm");
                return;
              }

              if (bookingStep === "confirm") {
                setBookingStep("form");
                return;
              }

              router.back();
            }}
            style={styles.backButton}
          >
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

        {bookingStep === "rideOptions" && mode !== "shared" ? (
          <>
            <View style={styles.dotsRow}>
              <View style={styles.dotActive} />
              <View style={styles.dotActive} />
              <View style={styles.dotActive} />
            </View>

            <View style={styles.mapCardCompact}>
              <ThemedText type="default" style={styles.routeEtaText}>
                🛵 14 phút • 3.5km
              </ThemedText>
            </View>

            <View style={styles.noteGroup}>
              <ThemedText type="small" style={styles.noteLabel}>
                Ghi chú cho tài xế
              </ThemedText>
              <TextInput
                placeholder="VD: gần cổng, mặc áo xanh..."
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.noteInput,
                  {
                    color: theme.text,
                    backgroundColor: theme.backgroundElement,
                  },
                ]}
                value={driverNote}
                onChangeText={setDriverNote}
              />
            </View>

            <View style={styles.rideOptionsList}>
              {rideOptions.map((option) => {
                const isSelected = option.id === selectedRideId;

                return (
                  <Pressable
                    key={option.id}
                    style={[
                      styles.rideOption,
                      { backgroundColor: theme.backgroundElement },
                      isSelected && styles.rideOptionActive,
                    ]}
                    onPress={() => setSelectedRideId(option.id)}
                  >
                    <View>
                      <ThemedText type="smallBold" style={styles.rideOptionName}>
                        {option.icon} {option.name}
                      </ThemedText>
                      <ThemedText type="small" style={styles.rideOptionEta}>
                        {option.eta}
                      </ThemedText>
                    </View>
                    <ThemedText type="default" style={styles.rideOptionPrice}>
                      {option.price}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.paymentNotice}>
              <ThemedText type="small" style={styles.paymentNoticeText}>
                💵 Thanh toán tiền mặt trực tiếp cho tài xế
              </ThemedText>
            </View>

            <View style={styles.voucherSection}>
              <ThemedText type="smallBold" style={styles.voucherTitle}>
                Chọn khuyến mãi (tùy chọn)
              </ThemedText>
              {vouchers.map((voucher) => {
                const isSelected = voucher.id === selectedVoucherId;

                return (
                  <Pressable
                    key={voucher.id}
                    style={[
                      styles.voucherCard,
                      { backgroundColor: theme.backgroundElement },
                      isSelected && styles.voucherCardActive,
                    ]}
                    onPress={() => setSelectedVoucherId(voucher.id)}
                  >
                    <View style={styles.voucherInfo}>
                      <ThemedText type="smallBold" style={styles.voucherCode}>
                        {voucher.code}
                      </ThemedText>
                      <ThemedText type="small" style={styles.voucherDescription}>
                        {voucher.description}
                      </ThemedText>
                    </View>
                    <ThemedText type="default" style={styles.voucherDiscount}>
                      {voucher.discount}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <Pressable style={styles.bookButton}>
              <ThemedText type="smallBold" style={styles.bookButtonText}>
                Đặt xe
              </ThemedText>
            </Pressable>
          </>
        ) : bookingStep === "confirm" && mode !== "shared" ? (
          <>
            <View style={styles.dotsRow}>
              <View style={styles.dotActive} />
              <View style={styles.dotActive} />
              <View style={styles.dotInactive} />
            </View>

            <View style={styles.mapCard}>
              <View style={styles.pinWrap}>
                <ThemedText type="default" style={styles.pinIcon}>
                  📍
                </ThemedText>
              </View>
              <ThemedText type="default" style={styles.mapLabel}>
                {toLabel}
              </ThemedText>
            </View>

            <View
              style={[
                styles.summaryCard,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              <ThemedText type="default" style={styles.summaryText}>
                Điểm đón:{" "}
                <ThemedText type="default" style={styles.summaryStrong}>
                  {fromLabel}
                </ThemedText>
              </ThemedText>
              <ThemedText type="default" style={styles.summaryText}>
                Điểm đến:{" "}
                <ThemedText type="default" style={styles.summaryStrong}>
                  {toLabel}
                </ThemedText>
              </ThemedText>
            </View>

            <Pressable
              style={styles.confirmButton}
              onPress={() => setBookingStep("rideOptions")}
            >
              <ThemedText type="smallBold" style={styles.confirmButtonText}>
                Xác nhận điểm đến
              </ThemedText>
            </Pressable>
          </>
        ) : mode !== "shared" ? (
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
              onChangeText={(value) => {
                setFrom(value);
                if (alertMessage) {
                  setAlertMessage("");
                }
              }}
              onFocus={() => setFocusedField("from")}
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
              onChangeText={(value) => {
                setTo(value);
                if (alertMessage) {
                  setAlertMessage("");
                }
              }}
              onFocus={() => setFocusedField("to")}
            />

            <View style={styles.savedList}>
              <ThemedText type="smallBold">Địa chỉ đã lưu</ThemedText>
              {savedAddresses.map((item) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [
                    styles.savedItem,
                    pressed && styles.savedItemPressed,
                  ]}
                  onPress={() => {
                    if (item.target === "from") {
                      setFrom(item.label);
                      setFocusedField("from");
                      setAlertMessage("");
                      return;
                    }

                    setTo(item.label);
                    setFocusedField("to");
                    setAlertMessage("");
                  }}
                >
                  <ThemedText
                    style={[
                      styles.savedItemText,
                      focusedField === item.target && styles.savedItemTextActive,
                    ]}
                  >
                    {item.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <View style={styles.buttonRow}>
              <Pressable
                style={styles.secondaryButton}
                onPress={showConfirmationStep}
              >
                <ThemedText type="smallBold">Hẹn lịch</ThemedText>
              </Pressable>

              <Pressable
                style={styles.primaryButton}
                onPress={showConfirmationStep}
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

      <Modal
        visible={Boolean(alertMessage)}
        transparent
        animationType="fade"
        onRequestClose={() => setAlertMessage("")}
      >
        <Pressable
          style={styles.alertOverlay}
          onPress={() => setAlertMessage("")}
        >
          <Pressable style={styles.alertCard}>
            <View style={styles.alertIcon}>
              <ThemedText type="smallBold" style={styles.alertIconText}>
                !
              </ThemedText>
            </View>
            <ThemedText type="default" style={styles.alertTitle}>
              Thiếu thông tin
            </ThemedText>
            <ThemedText type="default" style={styles.alertMessage}>
              {alertMessage}
            </ThemedText>
            <Pressable
              style={styles.alertButton}
              onPress={() => setAlertMessage("")}
            >
              <ThemedText type="smallBold" style={styles.alertButtonText}>
                Đã hiểu
              </ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
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
    cursor: "text",
  },
  savedList: {
    marginTop: Spacing.one,
    gap: Spacing.one,
  },
  savedItem: {
    paddingVertical: 10,
  },
  savedItemPressed: {
    opacity: 0.75,
  },
  savedItemText: {
    color: "#111827",
  },
  savedItemTextActive: {
    color: BRAND,
    fontWeight: "700",
  },
  alertOverlay: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.42)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.three,
  },
  alertCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 22,
    padding: Spacing.four,
    alignItems: "center",
    gap: Spacing.two,
    backgroundColor: "#FFFFFF",
  },
  alertIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF3E8",
  },
  alertIconText: {
    color: BRAND,
    fontSize: 24,
  },
  alertTitle: {
    color: "#111827",
    fontWeight: "800",
    fontSize: 20,
  },
  alertMessage: {
    color: "#4B5563",
    textAlign: "center",
  },
  alertButton: {
    width: "100%",
    minHeight: 46,
    borderRadius: 14,
    marginTop: Spacing.one,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND,
  },
  alertButtonText: {
    color: "#FFFFFF",
  },
  dotsRow: {
    flexDirection: "row",
    gap: 6,
    alignSelf: "flex-start",
  },
  dotActive: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: BRAND,
  },
  dotInactive: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#D1D5DB",
  },
  mapCard: {
    minHeight: 220,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    padding: Spacing.four,
    backgroundColor: MAP_BG,
  },
  mapCardCompact: {
    minHeight: 200,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
    backgroundColor: MAP_BG,
  },
  routeEtaText: {
    color: "#111827",
    fontWeight: "700",
  },
  pinWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF7E6",
  },
  pinIcon: {
    fontSize: 26,
  },
  mapLabel: {
    color: "#4B5563",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },
  summaryCard: {
    borderRadius: 18,
    padding: Spacing.three,
    gap: 6,
  },
  summaryText: {
    color: "#111827",
  },
  summaryStrong: {
    fontWeight: "700",
    color: "#111827",
  },
  confirmButton: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
  },
  noteGroup: {
    gap: Spacing.two,
  },
  noteLabel: {
    color: "#6B7280",
  },
  noteInput: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    cursor: "text",
  },
  rideOptionsList: {
    gap: Spacing.two,
  },
  rideOption: {
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  rideOptionActive: {
    borderColor: BRAND,
    borderWidth: 2,
  },
  rideOptionName: {
    color: "#111827",
    fontSize: 16,
  },
  rideOptionEta: {
    color: "#6B7280",
  },
  rideOptionPrice: {
    color: "#111827",
    fontWeight: "800",
  },
  paymentNotice: {
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: "#FFF7ED",
  },
  paymentNoticeText: {
    color: "#B45309",
  },
  voucherSection: {
    gap: Spacing.two,
  },
  voucherTitle: {
    color: "#4B5563",
  },
  voucherCard: {
    minHeight: 70,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  voucherCardActive: {
    borderColor: BRAND,
    backgroundColor: "#FFF7ED",
  },
  voucherInfo: {
    flex: 1,
    gap: 2,
  },
  voucherCode: {
    color: "#111827",
    fontSize: 16,
  },
  voucherDescription: {
    color: "#6B7280",
  },
  voucherDiscount: {
    color: "#C2410C",
    fontWeight: "800",
  },
  bookButton: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
  },
  bookButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
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
