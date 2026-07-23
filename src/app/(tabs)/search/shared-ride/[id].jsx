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
import { ThemedView } from "@/components/themed-view";
import {
  BottomTabInset,
  MaxContentWidth,
  ScreenHeaderTop,
  ScreenTitleStyle,
  Spacing,
} from "@/constants/theme";
import { getRideGroupById } from "@/constants/ride-data";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/hooks/use-theme";

const BRAND = "#FF7A00";
const CARD_BORDER = "#ECECEC";
const MUTED = "#70757E";

function getDefaultJoinDestination(ride) {
  const route = ride?.route ?? "";
  const [, to = "Đại học FPT"] = route.split(/\s*(?:→|â†’)\s*/);
  const isToFpt = to.includes("FPT");

  return isToFpt ? to : "Đại học FPT";
}

export default function SharedRideDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const rideId = Array.isArray(params.id) ? params.id[0] : params.id;
  const ride = getRideGroupById(rideId);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [pickupConfirmVisible, setPickupConfirmVisible] = useState(false);
  const [pickupPoint, setPickupPoint] = useState("");
  const [joinNote, setJoinNote] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinDraft, setJoinDraft] = useState(null);
  const [pendingRequest, setPendingRequest] = useState(null);
  const defaultDestination = getDefaultJoinDestination(ride);

  function requireLogin() {
    if (isAuthenticated) {
      return true;
    }

    router.push("/profile");
    return false;
  }

  function closeJoinModal() {
    setJoinModalVisible(false);
    setJoinError("");
  }

  function handleSubmitJoinRequest() {
    if (!requireLogin()) {
      return;
    }

    if (!pickupPoint.trim()) {
      setJoinError("Vui lòng nhập điểm đón");
      return;
    }

    setJoinDraft({
      pickupPoint: pickupPoint.trim(),
      destination: defaultDestination,
      note: joinNote.trim(),
    });
    setJoinModalVisible(false);
    setPickupConfirmVisible(true);
    setJoinError("");
  }

  function confirmPickupPoint() {
    if (!requireLogin()) {
      return;
    }

    if (!joinDraft) {
      return;
    }

    setPendingRequest({
      ...joinDraft,
      status: "pending",
    });
    setPickupConfirmVisible(false);
  }

  return (
    <>
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
                  <ThemedText type="small" style={styles.perPersonText}>
                    Số người: {ride.participantCount}/{ride.capacity}
                  </ThemedText>
                  <ThemedText type="small" style={styles.noteText}>
                    {`"${ride.note}"`}
                  </ThemedText>
                </View>
              </ThemedView>

              {pendingRequest && (
                <ThemedView
                  style={[
                    styles.pendingCard,
                    { backgroundColor: theme.backgroundElement },
                  ]}
                >
                  <View style={styles.pendingTopRow}>
                    <ThemedText type="smallBold" style={styles.pendingTitle}>
                      Đang chờ duyệt
                    </ThemedText>
                    <View style={styles.pendingBadge}>
                      <ThemedText type="smallBold" style={styles.pendingBadgeText}>
                        Pending
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText type="small" style={styles.pendingText}>
                    Điểm đón: {pendingRequest.pickupPoint}
                  </ThemedText>
                  <ThemedText type="small" style={styles.pendingText}>
                    Điểm đến: {pendingRequest.destination}
                  </ThemedText>
                </ThemedView>
              )}

              <Pressable
                style={[
                  styles.primaryButton,
                  pendingRequest && styles.pendingButton,
                ]}
                onPress={() => {
                  if (!pendingRequest) {
                    if (requireLogin()) {
                      setJoinModalVisible(true);
                    }
                  }
                }}
              >
                <ThemedText type="default" style={styles.primaryButtonText}>
                  {pendingRequest ? "Đang chờ duyệt" : "Gửi yêu cầu tham gia"}
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

      <Modal
        visible={joinModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeJoinModal}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.joinCard,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            <View style={styles.joinHeader}>
              <ThemedText type="default" style={styles.joinTitle}>
                Thông tin tham gia
              </ThemedText>
              <Pressable style={styles.joinCloseButton} onPress={closeJoinModal}>
                <ThemedText type="default" style={styles.joinCloseText}>
                  ×
                </ThemedText>
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="smallBold" style={styles.formLabel}>
                Điểm đón
                <ThemedText type="smallBold" style={styles.requiredMark}>*</ThemedText>
              </ThemedText>
              <TextInput
                placeholder="VD: Cổng chính, trạm xe, đường XYZ..."
                placeholderTextColor="#9CA3AF"
                style={[
                  styles.formInput,
                  { color: theme.text, backgroundColor: theme.background },
                ]}
                value={pickupPoint}
                onChangeText={(value) => {
                  setPickupPoint(value);
                  setJoinError("");
                }}
              />
            </View>

            <View style={styles.readonlyDestination}>
              <ThemedText type="small" style={styles.readonlyLabel}>
                Điểm đến mặc định
              </ThemedText>
              <ThemedText type="smallBold" style={styles.readonlyValue}>
                {defaultDestination}
              </ThemedText>
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="smallBold" style={styles.formLabel}>
                Ghi chú
              </ThemedText>
              <TextInput
                placeholder="VD: Mình đứng gần cổng, mặc áo xanh..."
                placeholderTextColor="#9CA3AF"
                style={[
                  styles.formInput,
                  styles.noteInput,
                  { color: theme.text, backgroundColor: theme.background },
                ]}
                value={joinNote}
                onChangeText={setJoinNote}
                multiline
              />
            </View>

            {Boolean(joinError) && (
              <ThemedText type="smallBold" style={styles.errorText}>
                {joinError}
              </ThemedText>
            )}

            <View style={styles.modalButtonRow}>
              <Pressable
                style={[styles.modalSecondaryButton, { backgroundColor: theme.background }]}
                onPress={closeJoinModal}
              >
                <ThemedText type="smallBold">Đóng</ThemedText>
              </Pressable>
              <Pressable style={styles.modalPrimaryButton} onPress={handleSubmitJoinRequest}>
                <ThemedText type="smallBold" style={styles.primaryButtonText}>
                  Gửi yêu cầu
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={pickupConfirmVisible}
        animationType="slide"
        onRequestClose={() => setPickupConfirmVisible(false)}
      >
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
              <Pressable
                onPress={() => setPickupConfirmVisible(false)}
                style={styles.backButton}
              >
                <ThemedText type="subtitle" style={styles.backIcon}>
                  ←
                </ThemedText>
              </Pressable>
              <ThemedText type="default" style={styles.headerTitle}>
                Xác nhận điểm đón
              </ThemedText>
            </View>

            <View style={styles.mapCard}>
              <View style={styles.pinWrap}>
                <ThemedText type="default" style={styles.pinIcon}>
                  📍
                </ThemedText>
              </View>
              <ThemedText type="default" style={styles.mapLabel}>
                {joinDraft?.pickupPoint}
              </ThemedText>
            </View>

            <ThemedView
              style={[
                styles.pickupSummaryCard,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              <ThemedText type="default" style={styles.summaryText}>
                Điểm đón:{" "}
                <ThemedText type="default" style={styles.summaryStrong}>
                  {joinDraft?.pickupPoint}
                </ThemedText>
              </ThemedText>
              <ThemedText type="default" style={styles.summaryText}>
                Điểm đến:{" "}
                <ThemedText type="default" style={styles.summaryStrong}>
                  {joinDraft?.destination}
                </ThemedText>
              </ThemedText>
            </ThemedView>

            <Pressable style={styles.primaryButton} onPress={confirmPickupPoint}>
              <ThemedText type="default" style={styles.primaryButtonText}>
                Xác nhận điểm đón
              </ThemedText>
            </Pressable>

            <Pressable
              style={[styles.secondaryButton, { backgroundColor: theme.backgroundElement }]}
              onPress={() => {
                setPickupConfirmVisible(false);
                setJoinModalVisible(true);
              }}
            >
              <ThemedText type="default" style={styles.secondaryButtonText}>
                Sửa điểm đón
              </ThemedText>
            </Pressable>
          </View>
        </ScrollView>
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
  detailCard: {
    borderRadius: 18,
    padding: Spacing.three,
    gap: Spacing.three,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  mapCard: {
    minHeight: 240,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    padding: Spacing.four,
    backgroundColor: "#FFF3C9",
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
    fontSize: 28,
  },
  mapLabel: {
    color: "#4B5563",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
  },
  pickupSummaryCard: {
    borderRadius: 18,
    padding: Spacing.three,
    gap: 6,
  },
  summaryText: {
    color: "#111827",
  },
  summaryStrong: {
    color: "#111827",
    fontWeight: "800",
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
  pendingButton: {
    backgroundColor: "#F59E0B",
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
  pendingCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FED7AA",
    padding: Spacing.three,
    gap: Spacing.one,
  },
  pendingTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  pendingTitle: {
    color: "#92400E",
    fontSize: 16,
  },
  pendingBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#FEF3C7",
  },
  pendingBadgeText: {
    color: "#B45309",
  },
  pendingText: {
    color: "#4B5563",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.45)",
    justifyContent: "center",
    paddingHorizontal: Spacing.three,
  },
  joinCard: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  joinHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  joinTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
  },
  joinCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  joinCloseText: {
    color: "#6B7280",
    fontSize: 28,
    lineHeight: 30,
  },
  formGroup: {
    gap: Spacing.one,
  },
  formLabel: {
    color: "#374151",
  },
  requiredMark: {
    color: "#EF4444",
  },
  formInput: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: Spacing.three,
  },
  noteInput: {
    minHeight: 88,
    paddingVertical: Spacing.two,
    textAlignVertical: "top",
  },
  readonlyDestination: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FED7AA",
    backgroundColor: "#FFF7ED",
    padding: Spacing.three,
    gap: 4,
  },
  readonlyLabel: {
    color: "#9A3412",
  },
  readonlyValue: {
    color: "#C2410C",
  },
  errorText: {
    color: "#DC2626",
  },
  modalButtonRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  modalSecondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D9DDE3",
    alignItems: "center",
    justifyContent: "center",
  },
  modalPrimaryButton: {
    flex: 1.3,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
  },
});
