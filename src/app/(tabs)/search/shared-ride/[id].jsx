import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
  cancelRideSharingRequest,
  getMyRideSharingRequest,
  getRideSharingGroup,
  joinRideSharingGroup,
} from "@/features/ride-sharing/services/ride-sharing-api";
import {
  getVietMapPlaceDetails,
  getVietMapPlaceSuggestions,
  isVietMapConfigured,
} from "@/features/booking/services/vietmap-api";
import { useTheme } from "@/hooks/use-theme";

const BRAND = "#FF7A00";
const CARD_BORDER = "#ECECEC";
const MUTED = "#70757E";

function getRideDestinationLabel(ride) {
  const route = ride?.route ?? "";
  const [, to = "Đại học FPT"] = route.split(/\s*(?:→|->)\s*/);

  return to.includes("FPT") ? to : "Đại học FPT";
}

function formatDistanceKm(value) {
  const distanceKm = Number(value ?? 0);

  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    return "--";
  }

  if (distanceKm >= 10) {
    return `${distanceKm.toFixed(0)} km`;
  }

  return `${distanceKm.toFixed(1)} km`;
}

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function calculateDistanceKmBetweenPoints(origin, destination) {
  const originLat = Number(origin?.lat);
  const originLng = Number(origin?.lng);
  const destinationLat = Number(destination?.lat);
  const destinationLng = Number(destination?.lng);

  if (
    !Number.isFinite(originLat) ||
    !Number.isFinite(originLng) ||
    !Number.isFinite(destinationLat) ||
    !Number.isFinite(destinationLng)
  ) {
    return 0;
  }

  const earthRadiusKm = 6371;
  const deltaLat = toRadians(destinationLat - originLat);
  const deltaLng = toRadians(destinationLng - originLng);
  const haversine =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(originLat)) *
      Math.cos(toRadians(destinationLat)) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);
  const angle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return earthRadiusKm * angle;
}

function getMemberDistanceKm(member) {
  const estimatedDistanceKm = Number(member?.estimatedDistanceKm ?? 0);

  if (Number.isFinite(estimatedDistanceKm) && estimatedDistanceKm > 0) {
    return estimatedDistanceKm;
  }

  return calculateDistanceKmBetweenPoints(
    {
      lat: member?.pickupLatitude,
      lng: member?.pickupLongitude,
    },
    {
      lat: member?.destinationLatitude,
      lng: member?.destinationLongitude,
    }
  );
}

function calculateAverageGroupFare(members) {
  const normalizedFares = (Array.isArray(members) ? members : [])
    .map((member) => Number(member?.finalFare ?? 0))
    .filter((fare) => Number.isFinite(fare) && fare > 0);

  if (normalizedFares.length === 0) {
    return 0;
  }

  const totalFare = normalizedFares.reduce((sum, fare) => sum + fare, 0);
  return totalFare / normalizedFares.length;
}

function calculateProjectedJoinFare(members, currentPassengers) {
  const memberCount = Array.isArray(members) ? members.length : 0;
  const currentCount = Math.max(Number(currentPassengers) || 0, memberCount);
  const averageCurrentFare = calculateAverageGroupFare(members);

  if (!Number.isFinite(averageCurrentFare) || averageCurrentFare <= 0) {
    return 0;
  }

  if (currentCount <= 0) {
    return averageCurrentFare;
  }

  return (averageCurrentFare * currentCount) / (currentCount + 1);
}

function getReadableApiErrorMessage(error, fallbackMessage) {
  const rawMessage = String(error?.message ?? "").trim();

  if (!rawMessage) {
    return fallbackMessage;
  }

  const cleanedMessage = rawMessage.replace(
    /^HTTP\s+\d+\s+[^:]+:\s*/i,
    ""
  );

  return cleanedMessage || fallbackMessage;
}

function normalizePlaceCompareText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^Tài xế\s+/i, "")
    .replace(/\s+đã nhận chuyến$/i, "")
    .replace(/\s+đang chờ đến giờ đón$/i, "")
    .replace(/\s+đang đến điểm đón$/i, "")
    .replace(/\s+đã đến điểm đón$/i, "")
    .replace(/\s+đang di chuyển$/i, "")
    .replace(/\s+đã hoàn thành chuyến$/i, "")
    .trim();
}

function isRecentRequest(createdAt, maxMinutes = 3) {
  if (!createdAt) {
    return false;
  }

  const createdTime = new Date(createdAt).getTime();
  if (Number.isNaN(createdTime)) {
    return false;
  }

  return Date.now() - createdTime <= maxMinutes * 60 * 1000;
}

function isLikelyStrayJoinRequest(request, expectedPickupAddress, expectedDestinationAddress) {
  if (!request?.id || request?.groupId) {
    return false;
  }

  const normalizedPickup = normalizePlaceCompareText(request.pickupAddress);
  const normalizedExpectedPickup = normalizePlaceCompareText(expectedPickupAddress);
  const normalizedDestination = normalizePlaceCompareText(
    request.destinationAddress
  );
  const normalizedExpectedDestination = normalizePlaceCompareText(
    expectedDestinationAddress
  );
  const normalizedStatus = String(request?.status ?? "")
    .replace(/\s+/g, "")
    .toLowerCase();
  const statusLooksLikeFreshRequest =
    normalizedStatus === "waiting" ||
    normalizedStatus === "matched" ||
    normalizedStatus === "ingroup";
  const pickupMatches =
    normalizedPickup &&
    normalizedExpectedPickup &&
    normalizedPickup === normalizedExpectedPickup;
  const destinationMatches =
    normalizedDestination &&
    normalizedExpectedDestination &&
    normalizedDestination === normalizedExpectedDestination;

  return (
    pickupMatches &&
    statusLooksLikeFreshRequest &&
    isRecentRequest(request.createdAt) &&
    (!normalizedExpectedDestination || destinationMatches)
  );
}

function getJoinButtonLabel(isJoiningGroup, pendingRequest) {
  if (isJoiningGroup) {
    return "Đang tham gia...";
  }

  if (pendingRequest) {
    return pendingRequest.status === "joined"
      ? "Đã tham gia nhóm"
      : "Đang chờ duyệt";
  }

  return "Tham gia nhóm";
}

function getDefaultJoinDestination(ride) {
  const route = ride?.route ?? "";
  const [, to = "Đại học FPT"] = route.split(/\s*(?:→|->)\s*/);
  const isToFpt = to.includes("FPT");

  return isToFpt ? to : "Đại học FPT";
}

function formatCurrencyVnd(value) {
  const numberValue = Number(value ?? 0);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return "--";
  }

  return `${Math.round(numberValue).toLocaleString("vi-VN")}đ`;
}

function formatGroupDateTime(value) {
  if (!value) {
    return "Chưa có thời gian";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Chưa có thời gian";
  }

  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function normalizeGroupStatusKey(status) {
  const normalized = String(status ?? "").replace(/\s+/g, "").toLowerCase();
  const numericStatusMap = {
    1: "waitingmatching",
    2: "readyforbroadcast",
    3: "driveraccepted",
    4: "waitingdeparture",
    5: "driverdrivingtopickup",
    6: "passengerboarding",
    7: "inprogress",
    8: "completed",
    9: "cancelled",
    10: "nodriverfound",
  };

  return numericStatusMap[normalized] || normalized;
}

function normalizeGroupStatusLabel(status) {
  const normalized = normalizeGroupStatusKey(status);
  const labels = {
    waitingmatching: "Đang chờ ghép nhóm",
    waitingdeparture: "Đang chờ xuất phát",
    readyforbroadcast: "Sẵn sàng tìm tài xế",
    driveraccepted: "Tài xế đã nhận",
    driverdriving: "Tài xế đang đến",
    driverdrivingtopickup: "Tài xế đã đến điểm đón",
    passengerboarding: "Đang đón khách",
    inprogress: "Đang di chuyển",
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
    nodriverfound: "Chưa tìm thấy tài xế",
  };

  return labels[normalized] || status || "Đang chờ ghép";
}

function getGroupDriverDisplay(driverName, status) {
  const normalizedStatus = normalizeGroupStatusKey(status);
  const safeDriverName = driverName || "Tài xế";

  switch (normalizedStatus) {
    case "driveraccepted":
      return `Tài xế ${safeDriverName} đã nhận chuyến`;
    case "waitingdeparture":
      return `Tài xế ${safeDriverName} đang chờ đến giờ đón`;
    case "driverdriving":
      return `Tài xế ${safeDriverName} đang đến điểm đón`;
    case "driverdrivingtopickup":
      return `Tài xế ${safeDriverName} đã đến điểm đón`;
    case "passengerboarding":
      return `Tài xế ${safeDriverName} đã đến điểm đón`;
    case "inprogress":
      return `Tài xế ${safeDriverName} đang di chuyển`;
    case "completed":
      return `Tài xế ${safeDriverName} đã hoàn thành chuyến`;
    case "cancelled":
      return driverName
        ? `Chuyến ghép với tài xế ${safeDriverName} đã bị hủy`
        : "Chuyến ghép đã bị hủy";
    case "nodriverfound":
      return "Chưa tìm thấy tài xế";
    default:
      return driverName ? safeDriverName : "Chưa có tài xế";
  }
}

function getGroupDestinationDisplay(group) {
  const members = Array.isArray(group?.members) ? group.members : [];
  const firstDestination = members.find((member) => member?.destinationAddress)
    ?.destinationAddress;

  return (
    firstDestination ||
    group?.destinationAddress ||
    "Đại học FPT"
  );
}

function normalizeRequestStatusKey(status) {
  const normalized = String(status ?? "").replace(/\s+/g, "").toLowerCase();
  const numericStatusMap = {
    1: "waiting",
    2: "matched",
    3: "ingroup",
    4: "driverassigned",
    5: "waitingdeparture",
    6: "driverdriving",
    7: "passengerboarding",
    8: "inprogress",
    9: "completed",
    10: "cancelled",
    11: "nodriverfound",
    12: "expired",
  };

  return numericStatusMap[normalized] || normalized;
}

function getCurrentUserRequest(maybeRequest, session, groupId = "") {
  if (!maybeRequest?.id || !session?.userId) {
    return null;
  }

  const normalizedPassengerId = String(maybeRequest.passengerId ?? "").toLowerCase();
  const normalizedUserId = String(session.userId ?? "").toLowerCase();
  const normalizedGroupId = String(groupId ?? "").toLowerCase();
  const requestGroupId = String(maybeRequest.groupId ?? "").toLowerCase();

  if (normalizedPassengerId && normalizedPassengerId !== normalizedUserId) {
    return null;
  }

  if (normalizedGroupId && requestGroupId && requestGroupId !== normalizedGroupId) {
    return null;
  }

  return maybeRequest;
}

function getPassengerStatusNotice({
  ride,
  myRequest,
  currentMember,
  isCompletedForCurrentUser = false,
}) {
  if (!ride) {
    return null;
  }

  const requestStatus = normalizeRequestStatusKey(myRequest?.status ?? "");
  const groupStatus = normalizeGroupStatusKey(ride.rawStatus ?? ride.status);
  const pickupTimeText = currentMember?.estimatedPickupTime
    ? formatGroupDateTime(currentMember.estimatedPickupTime)
    : "";
  const driverDisplay = String(ride.driver ?? "").replace(/^👤\s*/, "").trim();

  if (isCompletedForCurrentUser || requestStatus === "completed") {
    return {
      tone: "success",
      title: "Bạn đã xuống xe",
      message: "Chuyến đi của bạn đã hoàn thành tại điểm đến.",
    };
  }

  if (requestStatus === "passengerboarding") {
    return {
      tone: "success",
      title: "Bạn đã được đón",
      message:
        "Tài xế đã đón bạn. Xe đang tiếp tục đón các hành khách khác trong nhóm.",
    };
  }

  if (requestStatus === "inprogress" || groupStatus === "inprogress") {
    return {
      tone: "info",
      title: "Bạn đang ở trên xe",
      message: "Chuyến xe ghép đang di chuyển tới điểm đến của bạn.",
    };
  }

  if (groupStatus === "passengerboarding") {
    return {
      tone: "info",
      title: "Tài xế đang đón khách",
      message: "Tài xế đang đón các hành khách trong nhóm. Hãy chờ tại điểm đón.",
    };
  }

  if (
    requestStatus === "driverassigned" ||
    requestStatus === "waitingdeparture" ||
    groupStatus === "driveraccepted" ||
    groupStatus === "waitingdeparture"
  ) {
    return {
      tone: "info",
      title: driverDisplay
        ? `Tài xế ${driverDisplay} đã nhận chuyến`
        : "Tài xế đã nhận chuyến",
      message: pickupTimeText
        ? `Dự kiến đón bạn lúc ${pickupTimeText}. Hãy sẵn sàng tại điểm đón.`
        : "Tài xế đã nhận chuyến. Hãy sẵn sàng tại điểm đón.",
    };
  }

  if (
    requestStatus === "driverdriving" ||
    groupStatus === "driverdriving" ||
    groupStatus === "driverdrivingtopickup"
  ) {
    return {
      tone: "info",
      title: "Tài xế đang đến điểm đón",
      message: pickupTimeText
        ? `Dự kiến tài xế đón bạn lúc ${pickupTimeText}.`
        : "Tài xế đang di chuyển tới điểm đón của bạn.",
    };
  }

  if (requestStatus === "ingroup" || requestStatus === "matched") {
    return {
      tone: "info",
      title: "Bạn đã vào nhóm xe ghép",
      message: "Nhóm đang chờ đủ điều kiện để tài xế bắt đầu đón khách.",
    };
  }

  return null;
}

function mapApiGroupToRide(group, session = null) {
  if (!group?.id) {
    return null;
  }

  const groupStatus = normalizeGroupStatusKey(group.status);
  const members = Array.isArray(group.members) ? group.members : [];
  const currentUserId = String(session?.userId ?? "").toLowerCase();
  const currentUserEmail = String(session?.email ?? "").toLowerCase();
  const currentMember =
    members.find((member) => {
      const memberIds = [member.passengerId, member.userId, member.id].map((value) =>
        String(value ?? "").toLowerCase()
      );
      const memberEmail = String(
        member.email ?? member.passengerEmail ?? ""
      ).toLowerCase();

      return (
        (currentUserId && memberIds.includes(currentUserId)) ||
        (currentUserEmail && memberEmail === currentUserEmail)
      );
    }) ?? null;
  const joinPreviewFare = calculateProjectedJoinFare(
    members,
    group.currentPassengers ?? members.length
  );
  const priceValue = currentMember?.finalFare ?? joinPreviewFare ?? null;
  const hasJoined = Boolean(currentMember);

  return {
    id: group.id,
    route: `Nhóm xe ghép • ${formatGroupDateTime(group.scheduledDepartureTime)}`,
    vehicle: "Xe ghép",
    price: formatCurrencyVnd(priceValue),
    perPersonPrice: formatCurrencyVnd(priceValue),
    status: normalizeGroupStatusLabel(group.status),
    rawStatus: groupStatus,
    driver: getGroupDriverDisplay(group.driverName, group.status),
    driverNameRaw: group.driverName || "",
    destination: getGroupDestinationDisplay(group),
    participantCount: group.currentPassengers ?? members.length ?? 0,
    capacity: group.maxPassengers ?? 3,
    note: group.isLocked
      ? "Nhóm đã khóa"
      : "Nhóm còn có thể tham gia",
    priceDescription: hasJoined
      ? "Giá của bạn trong nhóm"
      : "Giá khi tham gia",
    members,
  };
}

function isCurrentUserGroupMember(members, session) {
  if (!Array.isArray(members) || !session) {
    return false;
  }

  const currentUserId = String(session.userId ?? "").toLowerCase();
  const currentEmail = String(session.email ?? "").toLowerCase();

  return members.some((member) => {
    const memberUserIds = [member.passengerId, member.userId, member.id].map(
      (value) => String(value ?? "").toLowerCase()
    );
    const memberEmail = String(
      member.email ?? member.passengerEmail ?? ""
    ).toLowerCase();

    return (
      (currentUserId && memberUserIds.includes(currentUserId)) ||
      (currentEmail && memberEmail === currentEmail)
    );
  });
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
  const [pickupPoint, setPickupPoint] = useState("");
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [isLoadingPickupSuggestions, setIsLoadingPickupSuggestions] = useState(false);
  const [pickupSuggestionError, setPickupSuggestionError] = useState("");
  const [selectedPickupPlace, setSelectedPickupPlace] = useState(null);
  const [joinNote, setJoinNote] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isJoiningGroup, setIsJoiningGroup] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [myRideRequest, setMyRideRequest] = useState(null);
  const [hasCompletedThisRide, setHasCompletedThisRide] = useState(false);
  const selectedPickupAddressRef = useRef("");
  const defaultDestination = getRideDestinationLabel(ride);
  const joinButtonLabel = getJoinButtonLabel(isJoiningGroup, pendingRequest);
  const currentMember = Array.isArray(ride?.members)
    ? ride.members.find((member) => {
        const memberUserIds = [member.passengerId, member.userId, member.id].map(
          (value) => String(value ?? "").toLowerCase()
        );
        const currentUserId = String(session?.userId ?? "").toLowerCase();

        return currentUserId && memberUserIds.includes(currentUserId);
      }) ?? null
    : null;
  const passengerStatusNotice = null;
  const normalizedDriverName = String(ride?.driver ?? "")
    .replace(/^Tài xế\s+/i, "")
    .trim();
  const driverStatusText =
    passengerStatusNotice?.title ||
    (ride?.driver
      ? `Tài xế ${ride.driver} đã nhận chuyến`
      : "Chưa có tài xế");
  const cleanDriverStatusText = hasCompletedThisRide
    ? "Bạn đã trả khách"
    : normalizeRequestStatusKey(myRideRequest?.status ?? "") === "completed"
      ? "Bạn đã trả khách"
      : normalizeRequestStatusKey(myRideRequest?.status ?? "") === "passengerboarding"
        ? "Bạn đã được đón"
        : normalizeRequestStatusKey(myRideRequest?.status ?? "") === "inprogress" ||
            normalizeGroupStatusKey(ride?.rawStatus ?? ride?.status) === "inprogress"
          ? "Bạn đang ở trên xe"
          : normalizeGroupStatusKey(ride?.rawStatus ?? ride?.status) === "passengerboarding"
            ? "Tài xế đang đón khách"
            : normalizeRequestStatusKey(myRideRequest?.status ?? "") ===
                  "driverdriving" ||
                normalizeGroupStatusKey(ride?.rawStatus ?? ride?.status) ===
                  "driverdriving" ||
                normalizeGroupStatusKey(ride?.rawStatus ?? ride?.status) ===
                  "driverdrivingtopickup"
              ? "Tài xế đang đến điểm đón"
              : ride?.driver
                ? `Tài xế ${ride.driver} đã nhận chuyến`
                : "Chưa có tài xế";
  const stableDriverName = String(ride?.driverNameRaw ?? ride?.driver ?? "")
    .replace(/^Tài xế\s+/i, "")
    .trim();
  const stableRequestStatusKey = normalizeRequestStatusKey(myRideRequest?.status ?? "");
  const stableGroupStatusKey = normalizeGroupStatusKey(ride?.rawStatus ?? ride?.status);
  const finalDriverStatusText = hasCompletedThisRide
    ? "Bạn đã trả khách"
    : stableRequestStatusKey === "completed"
      ? "Bạn đã trả khách"
      : stableRequestStatusKey === "passengerboarding"
        ? "Bạn đã được đón"
        : stableRequestStatusKey === "inprogress" || stableGroupStatusKey === "inprogress"
          ? "Bạn đang ở trên xe"
          : stableGroupStatusKey === "passengerboarding"
            ? "Tài xế đang đón khách"
            : stableRequestStatusKey === "driverdriving" ||
                stableGroupStatusKey === "driverdriving" ||
                stableGroupStatusKey === "driverdrivingtopickup"
              ? "Tài xế đang di chuyển đến điểm đón"
              : stableRequestStatusKey === "driverassigned" ||
                  stableRequestStatusKey === "waitingdeparture" ||
                  stableGroupStatusKey === "driveraccepted" ||
                  stableGroupStatusKey === "waitingdeparture"
                ? stableDriverName
                  ? `Tài xế ${stableDriverName} đã nhận chuyến`
                  : "Tài xế đã nhận chuyến"
              : stableDriverName
                ? `Tài xế ${stableDriverName} đang di chuyển đến điểm đón`
                : "Chưa có tài xế";
  const isJoinedGroup =
    pendingRequest?.status === "joined" ||
    Boolean(myRideRequest?.id) ||
    hasCompletedThisRide ||
    isCurrentUserGroupMember(ride?.members, session);
  void getDefaultJoinDestination;
  void joinButtonLabel;

  useEffect(() => {
    if (!rideId || mockRide || !session?.accessToken) {
      return undefined;
    }

    let isActive = true;

    const loadGroup = async ({ showLoading = false } = {}) => {
      if (showLoading) {
        setIsLoadingRide(true);
      }
      setLoadError("");

      try {
        const [group, latestRequest] = await Promise.all([
          getRideSharingGroup(rideId, session.accessToken),
          getMyRideSharingRequest(session.accessToken).catch(() => null),
        ]);
        const normalizedRequest = getCurrentUserRequest(
          latestRequest,
          session,
          rideId
        );

        if (isActive) {
          setApiRide(mapApiGroupToRide(group, session));
          setPendingRequest((current) => {
            if (!current) {
              return current;
            }

            if (current.status === "joined") {
              return null;
            }

            if (current.status === "pending" && !normalizedRequest) {
              return null;
            }

            return current;
          });
          setMyRideRequest((current) => {
            if (normalizedRequest) {
              const statusKey = normalizeRequestStatusKey(
                normalizedRequest.status
              );

              if (statusKey === "completed" || statusKey === "droppedoff") {
                setHasCompletedThisRide(true);
              }

              return normalizedRequest;
            }

            if (
              current?.id &&
              !isCurrentUserGroupMember(group?.members, session)
            ) {
              setHasCompletedThisRide(true);
            }

            return null;
          });
        }
      } catch (error) {
        if (isActive) {
          setLoadError(
            error.message || "Không tải được nhóm xe ghép."
          );
        }
      } finally {
        if (isActive && showLoading) {
          setIsLoadingRide(false);
        }
      }
    };

    loadGroup({ showLoading: true });
    const intervalId = setInterval(() => {
      loadGroup();
    }, 5000);

    return () => {
      isActive = false;
      clearInterval(intervalId);
    };
  }, [mockRide, rideId, session]);

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
    setPickupSuggestions([]);
    setPickupSuggestionError("");
    setIsLoadingPickupSuggestions(false);
    setSelectedPickupPlace(null);
    selectedPickupAddressRef.current = "";
  }

  function clearPickupPointInput() {
    setPickupPoint("");
    setSelectedPickupPlace(null);
    setPickupSuggestions([]);
    setPickupSuggestionError("");
    setJoinError("");
    selectedPickupAddressRef.current = "";
  }

  useEffect(() => {
    if (!joinModalVisible) {
      return undefined;
    }

    const query = pickupPoint.trim();

    if (query && query === selectedPickupAddressRef.current) {
      return undefined;
    }

    if (query.length < 2) {
      setPickupSuggestions([]);
      setPickupSuggestionError("");
      setIsLoadingPickupSuggestions(false);
      return undefined;
    }

    if (!isVietMapConfigured()) {
      setPickupSuggestions([]);
      setPickupSuggestionError("");
      setIsLoadingPickupSuggestions(false);
      return undefined;
    }

    let isActive = true;
    const timeoutId = setTimeout(async () => {
      setIsLoadingPickupSuggestions(true);

      try {
        const suggestions = await getVietMapPlaceSuggestions(query);

        if (isActive) {
          setPickupSuggestions(suggestions);
          setPickupSuggestionError(
            suggestions.length === 0
              ? "Chưa có gợi ý phù hợp, thử nhập rõ hơn tên đường hoặc quận."
              : ""
          );
        }
      } catch (error) {
        if (isActive) {
          setPickupSuggestions([]);
          setPickupSuggestionError(
            error.message || "Không tải được gợi ý điểm đón từ VietMap."
          );
        }
      } finally {
        if (isActive) {
          setIsLoadingPickupSuggestions(false);
        }
      }
    }, 350);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [joinModalVisible, pickupPoint]);

  async function handleSelectPickupSuggestion(suggestion) {
    try {
      const resolvedPlace = suggestion.location
        ? suggestion
        : await getVietMapPlaceDetails(suggestion.refId || suggestion.placeId);
      const resolvedAddress =
        resolvedPlace.formattedAddress ||
        resolvedPlace.description ||
        resolvedPlace.mainText ||
        pickupPoint;

      selectedPickupAddressRef.current = resolvedAddress.trim();
      setSelectedPickupPlace({
        ...resolvedPlace,
        formattedAddress: resolvedAddress,
      });
      setPickupPoint(resolvedAddress);
      setPickupSuggestions([]);
      setPickupSuggestionError("");
      setJoinError("");
    } catch (error) {
      setPickupSuggestionError(
        error.message || "Không lấy được tọa độ điểm đón từ VietMap."
      );
    }
  }

  async function handleSubmitJoinRequest() {
    if (!requireLogin()) {
      return;
    }

    if (!pickupPoint.trim()) {
      setJoinError("Vui lòng nhập điểm đón");
      return;
    }

    if (!selectedPickupPlace?.location) {
      setJoinError("Vui lòng chọn điểm đón từ danh sách gợi ý VietMap.");
      return;
    }

    if (mockRide) {
      setPendingRequest({
        pickupPoint: pickupPoint.trim(),
        destination: defaultDestination,
        note: joinNote.trim(),
        status: "pending",
      });
      setJoinModalVisible(false);
      return;
    }

    setIsJoiningGroup(true);
    setJoinError("");

    try {
      const verifiedPickup = selectedPickupPlace;
      const expectedDestinationAddress =
        ride?.members?.[0]?.destinationAddress ||
        apiRide?.members?.[0]?.destinationAddress ||
        defaultDestination;
      const destinationLat =
        Number(ride?.members?.[0]?.destinationLatitude) ||
        Number(apiRide?.members?.[0]?.destinationLatitude) ||
        Number(verifiedPickup.location?.lat);
      const pickupLat = Number(verifiedPickup.location?.lat);
      const pickupLng = Number(verifiedPickup.location?.lng);
      const estimatedDistanceKm = Math.max(
        Math.abs(destinationLat - pickupLat) * 111,
        0.1
      );
      const estimatedDurationMinutes = Math.max(
        Math.round((estimatedDistanceKm / 30) * 60),
        1
      );
      const joinedGroup = await joinRideSharingGroup(
        rideId,
        {
          pickupLatitude: pickupLat,
          pickupLongitude: pickupLng,
          pickupAddress: verifiedPickup.formattedAddress || pickupPoint.trim(),
          estimatedDistanceKm,
          estimatedDurationMinutes,
        },
        session.accessToken
      );
      setApiRide(mapApiGroupToRide(joinedGroup, session));
      setMyRideRequest({
        id: `joined-${rideId}`,
        groupId: rideId,
        status: "InGroup",
        passengerId: session?.userId,
      });
      setHasCompletedThisRide(false);
      setPendingRequest({
        pickupPoint: verifiedPickup.formattedAddress || pickupPoint.trim(),
        destination: defaultDestination,
        note: joinNote.trim(),
        status: "joined",
      });
      setJoinModalVisible(false);
    } catch (error) {
      if (session?.accessToken) {
        try {
          const latestRequest = await getMyRideSharingRequest(session.accessToken);

          if (
            isLikelyStrayJoinRequest(
              latestRequest,
              selectedPickupPlace?.formattedAddress || pickupPoint.trim(),
              ride?.members?.[0]?.destinationAddress ||
                apiRide?.members?.[0]?.destinationAddress ||
                defaultDestination
            )
          ) {
            await cancelRideSharingRequest(
              latestRequest.id,
              { cancelReason: 4 },
              session.accessToken
            );
          }
        } catch {
          // Ignore cleanup failures; the main join error below is still shown.
        }
      }

      setJoinError(
        getReadableApiErrorMessage(
          error,
          "Không thể tham gia nhóm xe ghép."
        )
      );
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
                {"Đang tải nhóm xe ghép..."}
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
                    <ThemedText type="small" style={styles.priceHintText}>
                      {ride.priceDescription}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.infoBlock}>
                  <ThemedText type="default" style={styles.driverText}>
                    {finalDriverStatusText}
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
                        {"Thành viên trong nhóm"}
                      </ThemedText>
                      {ride.members.map((member) => (
                        <View
                          key={`${member.passengerId}-${member.joinedAt ?? ""}`}
                          style={styles.memberItem}
                        >
                          <View style={styles.memberItemTop}>
                            <ThemedText type="smallBold" style={styles.memberName}>
                              {member.passengerName || "Hành khách"}
                            </ThemedText>
                            <ThemedText type="smallBold" style={styles.memberFare}>
                              {formatCurrencyVnd(member.finalFare)}
                            </ThemedText>
                          </View>
                          <ThemedText type="small" style={styles.metaText}>
                            {"Điểm đón: "}{member.pickupAddress || "--"}
                          </ThemedText>
                          <ThemedText type="small" style={styles.metaText}>
                            {"Quãng đường của khách: "}{formatDistanceKm(
                              getMemberDistanceKm(member)
                            )}
                          </ThemedText>
                        </View>
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

              {!isJoinedGroup && (
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
                    {pendingRequest ? "Đang chờ duyệt" : "Tham gia nhóm"}
                  </ThemedText>
                </Pressable>
              )}

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
              <View
                style={[
                  styles.formInputWrap,
                  { backgroundColor: theme.background },
                ]}
              >
                <TextInput
                  placeholder="VD: Cổng chính, trạm xe, đường XYZ..."
                  placeholderTextColor="#9CA3AF"
                  style={[
                    styles.formInput,
                    styles.formInputField,
                    { color: theme.text, backgroundColor: "transparent" },
                  ]}
                  value={pickupPoint}
                  onChangeText={(value) => {
                    setPickupPoint(value);
                    setSelectedPickupPlace(null);
                    setJoinError("");

                    if (value.trim() !== selectedPickupAddressRef.current) {
                      selectedPickupAddressRef.current = "";
                    }
                  }}
                />
                {Boolean(pickupPoint) && (
                  <Pressable
                    style={styles.clearInputButton}
                    onPress={clearPickupPointInput}
                  >
                    <ThemedText type="smallBold" style={styles.clearInputButtonText}>
                      {"×"}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
              {Boolean(pickupPoint.trim()) && (
                <View style={styles.pickupSuggestionCard}>
                  {isLoadingPickupSuggestions ? (
                    <ThemedText type="small" style={styles.pickupSuggestionMeta}>
                      {"Đang tải gợi ý điểm đón..."}
                    </ThemedText>
                  ) : pickupSuggestions.length > 0 ? (
                    pickupSuggestions.map((suggestion, index) => {
                      const suggestionLabel =
                        suggestion.formattedAddress ||
                        suggestion.description ||
                        suggestion.mainText ||
                        `Địa điểm ${index + 1}`;

                      return (
                        <Pressable
                          key={`${suggestion.refId || suggestion.placeId || suggestionLabel}-${index}`}
                          style={styles.pickupSuggestionItem}
                          onPress={() => handleSelectPickupSuggestion(suggestion)}
                        >
                          <ThemedText
                            type="smallBold"
                            style={styles.pickupSuggestionText}
                            numberOfLines={2}
                          >
                            {suggestionLabel}
                          </ThemedText>
                        </Pressable>
                      );
                    })
                  ) : Boolean(pickupSuggestionError) ? (
                    <ThemedText type="small" style={styles.pickupSuggestionMeta}>
                      {pickupSuggestionError}
                    </ThemedText>
                  ) : null}
                </View>
              )}
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
              <Pressable
                style={[
                  styles.modalPrimaryButton,
                  isJoiningGroup && styles.pendingButton,
                ]}
                onPress={handleSubmitJoinRequest}
                disabled={isJoiningGroup}
              >
                <ThemedText type="smallBold" style={styles.primaryButtonText}>
                  {isJoiningGroup ? "Đang tham gia..." : "Tham gia nhóm"}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
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
  priceHintText: {
    color: MUTED,
    textAlign: "right",
    maxWidth: 180,
  },
  perPersonText: {
    color: MUTED,
    textAlign: "right",
  },
  infoBlock: {
    gap: Spacing.two,
  },
  statusNoticeCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    gap: 4,
  },
  statusNoticeInfo: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  statusNoticeSuccess: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  statusNoticeTitle: {
    color: "#111827",
  },
  statusNoticeText: {
    color: "#4B5563",
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
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  memberTitle: {
    color: "#111827",
  },
  memberItem: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    padding: Spacing.two,
    gap: 4,
  },
  memberItemTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  memberName: {
    color: "#111827",
    flex: 1,
  },
  memberFare: {
    color: BRAND,
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
    flex: 1,
  },
  formInputWrap: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one,
    flexDirection: "row",
    alignItems: "center",
  },
  formInputField: {
    paddingHorizontal: 0,
  },
  clearInputButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  clearInputButtonText: {
    color: "#9CA3AF",
    fontSize: 20,
    lineHeight: 22,
  },
  pickupSuggestionCard: {
    marginTop: Spacing.one,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FED7AA",
    backgroundColor: "#FFF7ED",
    overflow: "hidden",
  },
  pickupSuggestionItem: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: "#FFE4CC",
  },
  pickupSuggestionText: {
    color: "#111827",
  },
  pickupSuggestionMeta: {
    color: "#9A3412",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
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
