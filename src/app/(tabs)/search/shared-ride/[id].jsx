import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
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
import {
  getRideSharingGroup,
  joinRideSharingGroup,
} from "@/features/ride-sharing/services/ride-sharing-api";
import { useTheme } from "@/hooks/use-theme";

const BRAND = "#FF7A00";
const CARD_BORDER = "#ECECEC";
const MUTED = "#70757E";

function getRideDestinationLabel(ride) {
  const route = ride?.route ?? "";
  const [, to = "\u0110\u1ea1i h\u1ecdc FPT"] = route.split(/\s*(?:\u2192|->)\s*/);

  return to.includes("FPT") ? to : "\u0110\u1ea1i h\u1ecdc FPT";
}

function getJoinButtonLabel(isJoiningGroup, pendingRequest) {
  if (isJoiningGroup) {
    return "\u0110ang tham gia...";
  }

  if (pendingRequest) {
    return pendingRequest.status === "joined"
      ? "\u0110\u00e3 tham gia nh\u00f3m"
      : "\u0110ang ch\u1edd duy\u1ec7t";
  }

  return "G\u1eedi y\u00eau c\u1ea7u tham gia";
}

function getDefaultJoinDestination(ride) {
  const route = ride?.route ?? "";
  const [, to = "Đại học FPT"] = route.split(/\s*(?:→|â†’)\s*/);
  const isToFpt = to.includes("FPT");

  return isToFpt ? to : "Đại học FPT";
}

function formatCurrencyVnd(value) {
  const numberValue = Number(value ?? 0);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return "--";
  }

  return `${Math.round(numberValue).toLocaleString("vi-VN")}\u0111`;
}

function formatGroupDateTime(value) {
  if (!value) {
    return "Ch\u01b0a c\u00f3 th\u1eddi gian";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Ch\u01b0a c\u00f3 th\u1eddi gian";
  }

  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function normalizeGroupStatusLabel(status) {
  const normalized = String(status ?? "").toLowerCase();

  if (normalized === "readyforbroadcast") {
    return "S\u1eb5n s\u00e0ng t\u00ecm t\u00e0i x\u1ebf";
  }

  if (normalized === "driveraccepted") {
    return "T\u00e0i x\u1ebf \u0111\u00e3 nh\u1eadn";
  }

  if (normalized === "waitingdeparture") {
    return "\u0110ang ch\u1edd xu\u1ea5t ph\u00e1t";
  }

  if (normalized === "completed") {
    return "Ho\u00e0n th\u00e0nh";
  }

  if (normalized === "cancelled") {
    return "\u0110\u00e3 h\u1ee7y";
  }

  return status || "\u0110ang ch\u1edd gh\u00e9p";
}

function mapApiGroupToRide(group) {
  if (!group?.id) {
    return null;
  }

  const members = Array.isArray(group.members) ? group.members : [];
  const firstMember = members[0];
  const finalFare = firstMember?.finalFare ?? 0;

  return {
    id: group.id,
    route: `Nh\u00f3m xe gh\u00e9p \u2022 ${formatGroupDateTime(group.scheduledDepartureTime)}`,
    vehicle: "Xe gh\u00e9p",
    price: formatCurrencyVnd(finalFare),
    perPersonPrice: formatCurrencyVnd(finalFare),
    status: normalizeGroupStatusLabel(group.status),
    driver: group.driverName || "Ch\u01b0a c\u00f3 t\u00e0i x\u1ebf",
    destination: `Kh\u1edfi h\u00e0nh: ${formatGroupDateTime(group.scheduledDepartureTime)}`,
    participantCount: group.currentPassengers ?? members.length ?? 0,
    capacity: group.maxPassengers ?? 3,
    note: group.isLocked
      ? "Nh\u00f3m \u0111\u00e3 kh\u00f3a"
      : "Nh\u00f3m c\u00f2n c\u00f3 th\u1ec3 tham gia",
    members,
  };
}

export default function SharedRideDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { isAuthenticated, session } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const rideId = Array.isArray(params.id) ? params.id[0] : params.id;
  const mockRide = getRideGroupById(rideId);
  const [apiRide, setApiRide] = useState(null);
  const [isLoadingRide, setIsLoadingRide] = useState(false);
  const [loadError, setLoadError] = useState("");
  const ride = apiRide ?? mockRide;
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [pickupConfirmVisible, setPickupConfirmVisible] = useState(false);
  const [pickupPoint, setPickupPoint] = useState("");
  const [joinNote, setJoinNote] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isJoiningGroup, setIsJoiningGroup] = useState(false);
  const [joinDraft, setJoinDraft] = useState(null);
  const [pendingRequest, setPendingRequest] = useState(null);
  const defaultDestination = getRideDestinationLabel(ride);
  const joinButtonLabel = getJoinButtonLabel(isJoiningGroup, pendingRequest);
  void getDefaultJoinDestination;
  void joinButtonLabel;

  useEffect(() => {
    if (!rideId || mockRide || !session?.accessToken) {
      return undefined;
    }

    let isActive = true;

    const loadGroup = async () => {
      setIsLoadingRide(true);
      setLoadError("");

      try {
        const group = await getRideSharingGroup(rideId, session.accessToken);

        if (isActive) {
          setApiRide(mapApiGroupToRide(group));
        }
      } catch (error) {
        if (isActive) {
          setLoadError(
            error.message || "Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c nh\u00f3m xe gh\u00e9p."
          );
        }
      } finally {
        if (isActive) {
          setIsLoadingRide(false);
        }
      }
    };

    loadGroup();

    return () => {
      isActive = false;
    };
  }, [mockRide, rideId, session?.accessToken]);

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

  async function confirmPickupPoint() {
    if (!requireLogin()) {
      return;
    }

    if (!joinDraft) {
      return;
    }

    if (mockRide) {
      setPendingRequest({
        ...joinDraft,
        status: "pending",
      });
      setPickupConfirmVisible(false);
      return;
    }

    setIsJoiningGroup(true);
    setJoinError("");

    try {
      const joinedGroup = await joinRideSharingGroup(rideId, session.accessToken);
      setApiRide(mapApiGroupToRide(joinedGroup));
      setPendingRequest({
        ...joinDraft,
        status: "joined",
      });
      setPickupConfirmVisible(false);
    } catch (error) {
      setJoinError(error.message || "Kh\u00f4ng th\u1ec3 tham gia nh\u00f3m xe gh\u00e9p.");
    } finally {
      setIsJoiningGroup(false);
    }
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

          {isLoadingRide ? (
            <ThemedView
              style={[styles.detailCard, { backgroundColor: theme.backgroundElement }]}
            >
              <ThemedText type="default" style={styles.headerTitle}>
                {"\u0110ang t\u1ea3i nh\u00f3m xe gh\u00e9p..."}
              </ThemedText>
            </ThemedView>
          ) : loadError ? (
            <ThemedView
              style={[styles.detailCard, { backgroundColor: theme.backgroundElement }]}
            >
              <ThemedText type="default" style={styles.headerTitle}>
                {"Không tải được nhóm xe ghép"}
              </ThemedText>
              <ThemedText type="small" style={styles.errorText}>
                {loadError}
              </ThemedText>
              <Pressable
                style={[styles.secondaryButton, styles.notFoundButton]}
                onPress={() => router.back()}
              >
                <ThemedText type="default" style={styles.secondaryButtonText}>
                  {"Quay lại"}
                </ThemedText>
              </Pressable>
            </ThemedView>
          ) : ride ? (
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
                  {Array.isArray(ride.members) && ride.members.length > 0 && (
                    <View style={styles.memberList}>
                      <ThemedText type="smallBold" style={styles.memberTitle}>
                        {"Th\u00e0nh vi\u00ean trong nh\u00f3m"}
                      </ThemedText>
                      {ride.members.map((member) => (
                        <ThemedText
                          key={`${member.passengerId}-${member.joinedAt ?? ""}`}
                          type="small"
                          style={styles.metaText}
                        >
                          {member.passengerName || "H\u00e0nh kh\u00e1ch"}{" \u2022 "}
                          {formatCurrencyVnd(member.finalFare)}
                        </ThemedText>
                      ))}
                    </View>
                  )}
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
                  (pendingRequest || isJoiningGroup) && styles.pendingButton,
                ]}
                onPress={() => {
                  if (!pendingRequest && !isJoiningGroup) {
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

            {Boolean(joinError) && (
              <ThemedText type="smallBold" style={styles.errorText}>
                {joinError}
              </ThemedText>
            )}

            <Pressable
              style={[styles.primaryButton, isJoiningGroup && styles.pendingButton]}
              onPress={confirmPickupPoint}
              disabled={isJoiningGroup}
            >
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
  memberList: {
    gap: 4,
    paddingTop: Spacing.one,
  },
  memberTitle: {
    color: "#111827",
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
