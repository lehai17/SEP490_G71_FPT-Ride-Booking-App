// SHARED RIDE DETAIL SCREEN - Chi tiết nhóm đi ghép và thao tác tham gia
// ================================================================
// Comment tiếng Việt được đặt phía trên từng khối để giải thích vai trò code.
// Logic hiện tại được giữ nguyên, chỉ bổ sung mô tả cho dễ đọc/bảo trì.
// ================================================================

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
  extendRideSharingSearch,
  getMyRideSharingRequest,
  getRideSharingGroup,
  joinRideSharingGroup,
  leaveRideSharingGroup,
} from "@/features/ride-sharing/services/ride-sharing-api";
import {
  getVietMapPlaceDetails,
  getVietMapPlaceSuggestions,
  isVietMapConfigured,
} from "@/features/booking/services/vietmap-api";
import { useTheme } from "@/hooks/use-theme";

// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const BRAND = "#FF7A00";
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const CARD_BORDER = "#ECECEC";
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const MUTED = "#70757E";
// Hằng số cấu hình: Thời gian (ms) chờ tối đa trước khi hiển thị prompt cho passenger đang chờ ghép.
const NO_DRIVER_PROMPT_DELAY_MS = 5 * 60 * 1000;

// getRideDestinationLabel: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getRideDestinationLabel(ride) {
  const route = ride?.route ?? "";
  const [, to = "Đại học FPT"] = route.split(/\s*(?:→|->)\s*/);

  return to.includes("FPT") ? to : "Đại học FPT";
}

// getGroupJoinDestination: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getGroupJoinDestination(...groups) {
  for (const group of groups) {
    const members = Array.isArray(group?.members) ? group.members : [];
    const memberWithDestination = members.find(
      (member) =>
        Number.isFinite(Number(member?.destinationLatitude)) &&
        Number.isFinite(Number(member?.destinationLongitude))
    );

    if (memberWithDestination) {
      return {
        address:
          memberWithDestination.destinationAddress ||
          group?.destinationAddress ||
          getRideDestinationLabel(group),
        latitude: Number(memberWithDestination.destinationLatitude),
        longitude: Number(memberWithDestination.destinationLongitude),
      };
    }

    if (
      Number.isFinite(Number(group?.destinationLatitude)) &&
      Number.isFinite(Number(group?.destinationLongitude))
    ) {
      return {
        address: group.destinationAddress || getRideDestinationLabel(group),
        latitude: Number(group.destinationLatitude),
        longitude: Number(group.destinationLongitude),
      };
    }
  }

  return null;
}

// formatDistanceKm: Định dạng khoảng cách theo km
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

// toRadians: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

// calculateDistanceKmBetweenPoints: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
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

// getMemberDistanceKm: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
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

// calculateAverageGroupFare: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
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

// calculateProjectedJoinFare: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
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

// getReadableApiErrorMessage: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getReadableApiErrorMessage(error, fallbackMessage) {
  const rawMessage = String(
    error?.payload?.message ??
      error?.payload?.detail ??
      error?.payload?.title ??
      error?.payload?.error ??
      error?.message ??
      ""
  ).trim();

  if (!rawMessage) {
    return fallbackMessage;
  }

  const cleanedMessage = rawMessage.replace(
    /^HTTP\s+\d+\s+[^:]+:\s*/i,
    ""
  );

  return cleanedMessage || fallbackMessage;
}

// normalizePlaceCompareText: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
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

// isRecentRequest: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
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

// parseApiDateTime: Chuẩn hoá chuỗi ISO/UTC về Date hợp lệ.
function parseApiDateTime(value) {
  if (!value) {
    return null;
  }

  const rawValue = String(value).trim();

  if (!rawValue) {
    return null;
  }

  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(rawValue);
  const normalized = hasZone ? rawValue : `${rawValue}Z`;

  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}

// hasWaitedLongerThanPromptDelay: Kiểm tra đã qua thời gian chờ prompt hay chưa.
function hasWaitedLongerThanPromptDelay(createdAt, nowMs, lastExtendedAt) {
  const referenceTime = parseApiDateTime(lastExtendedAt) ?? parseApiDateTime(createdAt);

  if (!referenceTime) {
    return false;
  }

  return nowMs - referenceTime.getTime() >= NO_DRIVER_PROMPT_DELAY_MS;
}

// isLikelyStrayJoinRequest: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
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

// getJoinButtonLabel: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
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

// getDefaultJoinDestination: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getDefaultJoinDestination(ride) {
  const route = ride?.route ?? "";
  const [, to = "Đại học FPT"] = route.split(/\s*(?:→|->)\s*/);
  const isToFpt = to.includes("FPT");

  return isToFpt ? to : "Đại học FPT";
}

// formatCurrencyVnd: Định dạng số tiền sang VND để hiển thị
function formatCurrencyVnd(value) {
  const numberValue = Number(value ?? 0);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return "--";
  }

  return `${Math.round(numberValue).toLocaleString("vi-VN")}đ`;
}

// formatGroupDateTime: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
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

// normalizeGroupStatusKey: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
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

// normalizeGroupStatusLabel: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
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

// getGroupDriverDisplay: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
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

// getGroupDestinationDisplay: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
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

// normalizeRequestStatusKey: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
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

// getCurrentUserRequest: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
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

// getPassengerStatusNotice: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
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

// mapApiGroupToRide: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
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
  // Tính trạng thái full ngay từ FE để note/UI đồng bộ, không phụ thuộc vào isLocked từ BE
  // (BE đôi khi không set isLocked khi nhóm đạt maxPassengers).
  const currentCount = Number(group.currentPassengers ?? members.length) || 0;
  const maxCount = Number(group.maxPassengers ?? 3) || 3;
  const isGroupFull = currentCount >= maxCount && maxCount > 0;

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
      : isGroupFull
        ? "Nhóm đã đủ người"
        : "Nhóm còn có thể tham gia",
    priceDescription: hasJoined
      ? "Giá của bạn trong nhóm"
      : "Giá khi tham gia",
    members,
    isFull: isGroupFull,
  };
}

// isCurrentUserGroupMember: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
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

// SharedRideDetailScreen: Component chi tiết nhóm đi ghép
export default function SharedRideDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { isAuthenticated, session } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  // NHẬN ID TỪ LINK /search/shared-ride/[id]
  // Nguồn id có thể đến từ:
  // - HomeScreen: router.push(`/search/shared-ride/${ride.id}`)
  // - SearchScreen: router.push(`/search/shared-ride/${request.groupId}`)
  // id này được dùng làm groupId để gọi BE lấy chi tiết nhóm xe ghép.
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
  const [noDriverPromptNowMs, setNoDriverPromptNowMs] = useState(() => Date.now());
  const [isExtendingSharedSearch, setIsExtendingSharedSearch] = useState(false);
  const [noDriverPromptDismissed, setNoDriverPromptDismissed] = useState(false);
  const [sharedExtendError, setSharedExtendError] = useState("");
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
  const isGroupFull = Boolean(ride?.isFull);
  const isGroupLocked = Boolean(ride?.note === "Nhóm đã khóa");
  const canJoinGroup = !isJoinedGroup && !isGroupFull && !isGroupLocked;
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const [leaveError, setLeaveError] = useState("");
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
        // loadGroup: LUỒNG NHẬN DỮ LIỆU CHI TIẾT NHÓM
        // Gửi groupId = rideId lên getRideSharingGroup để nhận group/members/driver/status mới nhất.
        // Đồng thời gọi getMyRideSharingRequest để biết user hiện tại đã join/pending/completed trong group này chưa.
        const [group, latestRequest] = await Promise.all([
          getRideSharingGroup(rideId, session.accessToken),
          getMyRideSharingRequest(session.accessToken).catch(() => null),
        ]);
        // Lọc request của chính user trong đúng groupId hiện tại; tránh lấy nhầm request group khác.
        const normalizedRequest = getCurrentUserRequest(
          latestRequest,
          session,
          rideId
        );

        if (isActive) {
          // Map response group BE sang object ride mà UI detail đang render.
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

    // Lần đầu vào màn: show loading; sau đó polling 5s/lần để status/member cập nhật gần realtime.
    loadGroup({ showLoading: true });
    const intervalId = setInterval(() => {
      loadGroup();
    }, 5000);

    return () => {
      isActive = false;
      clearInterval(intervalId);
    };
  }, [mockRide, rideId, session]);

  // Tick mỗi 30s để re-evaluate điều kiện hiển thị prompt "chưa tìm được nhóm/tài xế".
  useEffect(() => {
    const promptIntervalId = setInterval(() => {
      setNoDriverPromptNowMs(Date.now());
    }, 30000);

    return () => clearInterval(promptIntervalId);
  }, []);

  const isRequestWaitingForDriverOrGroup =
    stableRequestStatusKey === "waiting" ||
    stableRequestStatusKey === "matched" ||
    stableRequestStatusKey === "ingroup";
  const hasDriverAssignedForGroup =
    Boolean(ride?.driverNameRaw) ||
    stableGroupStatusKey === "driveraccepted" ||
    stableGroupStatusKey === "waitingdeparture" ||
    stableGroupStatusKey === "driverdriving" ||
    stableGroupStatusKey === "driverdrivingtopickup" ||
    stableGroupStatusKey === "passengerboarding" ||
    stableGroupStatusKey === "inprogress";
  const isImmediateSharedTrip = (() => {
    const tripType = String(myRideRequest?.tripType ?? "").toLowerCase();
    if (!tripType) {
      return true;
    }

    return tripType === "immediate" || tripType === "1";
  })();
  const shouldShowSharedNoDriverPrompt =
    !noDriverPromptDismissed &&
    Boolean(myRideRequest?.id) &&
    isImmediateSharedTrip &&
    isRequestWaitingForDriverOrGroup &&
    !hasDriverAssignedForGroup &&
    hasWaitedLongerThanPromptDelay(
      myRideRequest?.createdAt,
      noDriverPromptNowMs,
      myRideRequest?.lastSearchExtendedAt
    );

  async function handleExtendSharedSearch() {
    if (!myRideRequest?.id || !session?.accessToken) {
      return;
    }

    if (isExtendingSharedSearch) {
      return;
    }

    setIsExtendingSharedSearch(true);
    setSharedExtendError("");

    try {
      let updatedRequest;

      try {
        updatedRequest = await extendRideSharingSearch(
          myRideRequest.id,
          session.accessToken
        );
      } catch (error) {
        if (error?.status !== 401) {
          throw error;
        }

        const nextSession = await refreshSession();
        updatedRequest = await extendRideSharingSearch(
          myRideRequest.id,
          nextSession.accessToken
        );
      }

      if (updatedRequest) {
        setMyRideRequest((current) => ({
          ...(current ?? {}),
          ...updatedRequest,
          lastSearchExtendedAt:
            updatedRequest.lastSearchExtendedAt ?? new Date().toISOString(),
        }));
      } else {
        setMyRideRequest((current) =>
          current
            ? {
                ...current,
                lastSearchExtendedAt: new Date().toISOString(),
              }
            : current
        );
      }

      setNoDriverPromptDismissed(true);
    } catch (error) {
      setSharedExtendError(
        getReadableApiErrorMessage(error, "Không thể tiếp tục tìm chuyến ghép.")
      );
    } finally {
      setIsExtendingSharedSearch(false);
    }
  }

  async function handleCancelSharedSearch() {
    if (!myRideRequest?.id || !session?.accessToken) {
      return;
    }

    setIsExtendingSharedSearch(true);
    setSharedExtendError("");

    try {
      await cancelRideSharingRequest(
        myRideRequest.id,
        { cancelReason: 4 },
        session.accessToken
      );

      setMyRideRequest((current) =>
        current
          ? {
              ...current,
              status: "Cancelled",
              cancelledAt: new Date().toISOString(),
            }
          : current
      );
      setNoDriverPromptDismissed(true);
    } catch (error) {
      setSharedExtendError(
        getReadableApiErrorMessage(error, "Không thể hủy yêu cầu xe ghép.")
      );
    } finally {
      setIsExtendingSharedSearch(false);
    }
  }

  async function handleLeaveGroup() {
    if (!ride?.id || !session?.accessToken || isLeavingGroup) {
      return;
    }

    setIsLeavingGroup(true);
    setLeaveError("");

    try {
      await leaveRideSharingGroup(
        ride.id,
        { cancelReason: 4 },
        session.accessToken
      );

      // Reset trạng thái local về "chưa join" rồi reload data từ BE.
      setMyRideRequest(null);
      setHasCompletedThisRide(false);
      setPendingRequest(null);

      try {
        const refreshedGroup = await getRideSharingGroup(
          ride.id,
          session.accessToken
        );
        setApiRide(mapApiGroupToRide(refreshedGroup, session));
      } catch {
        // Bỏ qua lỗi refresh; người dùng có thể tự reload.
      }

      router.back();
    } catch (error) {
      setLeaveError(
        getReadableApiErrorMessage(error, "Không thể rời nhóm xe ghép.")
      );
    } finally {
      setIsLeavingGroup(false);
    }
  }

  function requireLogin() {
    if (isAuthenticated) {
      return true;
    }

    // Nếu user chưa login khi bấm tham gia, chuyển sang /profile; quay lại thì user bấm lại thao tác.
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
      Promise.resolve().then(() => {
        setPickupSuggestions([]);
        setPickupSuggestionError("");
        setIsLoadingPickupSuggestions(false);
      });
      return undefined;
    }

    if (!isVietMapConfigured()) {
      Promise.resolve().then(() => {
        setPickupSuggestions([]);
        setPickupSuggestionError("");
        setIsLoadingPickupSuggestions(false);
      });
      return undefined;
    }

    let isActive = true;
    const timeoutId = setTimeout(async () => {
      setIsLoadingPickupSuggestions(true);

      try {
        // Gửi text pickupPoint lên VietMap autocomplete để nhận danh sách gợi ý địa điểm.
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
      // Khi chọn gợi ý:
      // - Nếu suggestion đã có location thì dùng luôn.
      // - Nếu chỉ có refId/placeId thì gọi VietMap detail để lấy tọa độ chính xác.
      const resolvedPlace = suggestion.location
        ? suggestion
        : await getVietMapPlaceDetails(suggestion.refId || suggestion.placeId);
      const resolvedAddress =
        resolvedPlace.formattedAddress ||
        resolvedPlace.description ||
        resolvedPlace.mainText ||
        pickupPoint;

      selectedPickupAddressRef.current = resolvedAddress.trim();
      // Lưu địa điểm đã chọn vào state; handleSubmitJoinRequest sẽ lấy lat/lng/address từ đây để gửi BE.
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

    // handleSubmitJoinRequest: LUỒNG GỬI REQUEST THAM GIA GROUP
    // Input: rideId từ URL + selectedPickupPlace từ VietMap + destination của group.
    // Payload gửi lên /ride-sharing/groups/{rideId}/join gồm:
    // pickupLatitude/pickupLongitude/pickupAddress,
    // destinationLatitude/destinationLongitude/destinationAddress,
    // estimatedDistanceKm/estimatedDurationMinutes.
    // Response nhận: group sau khi join, dùng để cập nhật apiRide/myRideRequest/pendingRequest.
    setIsJoiningGroup(true);
    setJoinError("");

    try {
      const verifiedPickup = selectedPickupPlace;
      const joinDestination = getGroupJoinDestination(ride, apiRide);
      if (!joinDestination) {
        setJoinError(
          "Không xác định được điểm đến của nhóm xe ghép. Vui lòng tải lại nhóm và thử lại."
        );
        return;
      }

      // Destination lấy từ group/members BE; nếu thiếu thì fallback defaultDestination đang hiển thị.
      const expectedDestinationAddress =
        joinDestination?.address ||
        ride?.members?.[0]?.destinationAddress ||
        apiRide?.members?.[0]?.destinationAddress ||
        defaultDestination;
      const pickupLat = Number(verifiedPickup.location?.lat);
      const pickupLng = Number(verifiedPickup.location?.lng);
      const destinationLat = Number(joinDestination.latitude);
      const destinationLng = Number(joinDestination.longitude);
      // Tính tạm distance/duration ở FE để BE có metrics cho passenger mới join group.
      const estimatedDistanceKm = Math.max(
        calculateDistanceKmBetweenPoints(
          { lat: pickupLat, lng: pickupLng },
          { lat: destinationLat, lng: destinationLng }
        ),
        0.1
      );
      const estimatedDurationMinutes = Math.max(
        Math.round((estimatedDistanceKm / 30) * 60),
        1
      );
      // Gửi request join thật lên BE bằng groupId từ URL.
      const joinedGroup = await joinRideSharingGroup(
        rideId,
        {
          pickupLatitude: pickupLat,
          pickupLongitude: pickupLng,
          pickupAddress: verifiedPickup.formattedAddress || pickupPoint.trim(),
          destinationLatitude: destinationLat,
          destinationLongitude: destinationLng,
          destinationAddress: expectedDestinationAddress,
          estimatedDistanceKm,
          estimatedDurationMinutes,
        },
        session.accessToken
      );
      // Response BE được map lại vào apiRide để UI thấy member/status mới ngay.
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
          // Nếu join lỗi sau khi BE đã tạo request "lạc", thử đọc request mới nhất để cleanup.
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
      {/* ScrollView: Cho phép nội dung dài cuộn được trên màn hình nhỏ. */}
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
        {/* Khối content: Bố cục bao ngoài, canh lề và giới hạn chiều rộng nội dung. */}
        <View style={styles.content}>
          {/* Khối header row: Phần đầu của card/modal/màn hình, thường chứa tiêu đề và nút đóng. */}
          <View style={styles.headerRow}>
            {/* Điều hướng quay lại: không gửi dữ liệu, chỉ pop stack về màn đã push sang detail. */}
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
            /* Khối detail card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */
            <ThemedView
              style={[styles.detailCard, { backgroundColor: theme.backgroundElement }]}
            >
              <ThemedText type="default" style={styles.headerTitle}>
                {"Đang tải nhóm xe ghép..."}
              </ThemedText>
            </ThemedView>
          ) : loadError ? (
            /* Khối detail card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */
            <ThemedView
              style={[styles.detailCard, { backgroundColor: theme.backgroundElement }]}
            >
              <ThemedText type="default" style={styles.headerTitle}>
                {"Không tải được nhóm xe ghép"}
              </ThemedText>
              <ThemedText type="small" style={styles.errorText}>
                {loadError}
              </ThemedText>
              {/* Quay lại khi load group lỗi: không retry ở đây, chỉ đưa user về danh sách nhóm trước đó. */}
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
              {/* Khối detail card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
              <ThemedView
                style={[styles.detailCard, { backgroundColor: theme.backgroundElement }]}
              >
                {/* Khối detail top row: Dàn các phần tử trên cùng một hàng. */}
                <View style={styles.detailTopRow}>
                  {/* Khối vehicle pill: Hiển thị lựa chọn loại xe và mô tả cho người dùng. */}
                  <View style={styles.vehiclePill}>
                    <ThemedText type="smallBold" style={styles.vehiclePillText}>
                      🚙 {ride.vehicle.toUpperCase()}
                    </ThemedText>
                  </View>

                  {/* Khối price wrap: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
                  <View style={styles.priceWrap}>
                    <ThemedText type="default" style={styles.priceText}>
                      {ride.price}
                    </ThemedText>
                    <ThemedText type="small" style={styles.priceHintText}>
                      {ride.priceDescription}
                    </ThemedText>
                  </View>
                </View>

                {/* Khối info block: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
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
                    /* Khối member list: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */
                    <View style={styles.memberList}>
                      <ThemedText type="smallBold" style={styles.memberTitle}>
                        {"Thành viên trong nhóm"}
                      </ThemedText>
                      {ride.members.map((member) => (
                        /* Khối member item: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */
                        <View
                          key={`${member.passengerId}-${member.joinedAt ?? ""}`}
                          style={styles.memberItem}
                        >
                          {/* Khối member item top: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
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
                /* Khối pending card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */
                <ThemedView
                  style={[
                    styles.pendingCard,
                    { backgroundColor: theme.backgroundElement },
                  ]}
                >
                  {/* Khối pending top row: Dàn các phần tử trên cùng một hàng. */}
                  <View style={styles.pendingTopRow}>
                    <ThemedText type="smallBold" style={styles.pendingTitle}>
                      Đang chờ duyệt
                    </ThemedText>
                    {/* Khối pending badge: Nhãn trạng thái nhỏ giúp người dùng quét thông tin nhanh. */}
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

              {shouldShowSharedNoDriverPrompt ? (
                /* Khối shared no driver prompt: Hiển thị khi quá thời gian chờ ghép/tài xế. */
                <View
                  testID="shared-ride-no-driver-prompt"
                  style={[
                    styles.noDriverPromptCard,
                    { backgroundColor: "#FFF7ED", borderColor: "#FDBA74" },
                  ]}
                >
                  <ThemedText type="smallBold" style={styles.noDriverPromptTitle}>
                    {"Chưa tìm được nhóm/tài xế"}
                  </ThemedText>
                  <ThemedText type="small" style={styles.noDriverPromptSubtitle}>
                    {"Bạn muốn tiếp tục chờ hay hủy yêu cầu?"}
                  </ThemedText>
                  {Boolean(sharedExtendError) ? (
                    <ThemedText type="small" style={styles.errorText}>
                      {sharedExtendError}
                    </ThemedText>
                  ) : null}
                  <View style={styles.noDriverPromptActions}>
                    <Pressable
                      testID="shared-ride-no-driver-extend"
                      style={[
                        styles.noDriverPromptSecondaryButton,
                        isExtendingSharedSearch && styles.pendingButton,
                      ]}
                      disabled={isExtendingSharedSearch}
                      onPress={handleExtendSharedSearch}
                    >
                      <ThemedText
                        type="smallBold"
                        style={styles.noDriverPromptSecondaryText}
                      >
                        {isExtendingSharedSearch
                          ? "Đang xử lý..."
                          : "Tiếp tục tìm"}
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      testID="shared-ride-no-driver-cancel"
                      style={[
                        styles.noDriverPromptPrimaryButton,
                        isExtendingSharedSearch && styles.pendingButton,
                      ]}
                      disabled={isExtendingSharedSearch}
                      onPress={handleCancelSharedSearch}
                    >
                      <ThemedText
                        type="smallBold"
                        style={styles.noDriverPromptPrimaryText}
                      >
                        {isExtendingSharedSearch ? "Đang hủy..." : "Hủy yêu cầu"}
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {canJoinGroup && (
                /* Nút tham gia group: kiểm tra login rồi mở join modal; chưa gọi BE cho đến khi submit form. */
                <Pressable
                  testID="shared-ride-join-button"
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

              {!isJoinedGroup && isGroupFull ? (
                /* Nhóm đã đủ người: không cho tham gia, chỉ hiển thị thông báo. */
                <ThemedView
                  testID="shared-ride-full-notice"
                  style={[
                    styles.secondaryButton,
                    {
                      backgroundColor: "#F3F4F6",
                      borderColor: "#E5E7EB",
                      borderWidth: 1,
                    },
                  ]}
                >
                  <ThemedText type="default" style={styles.secondaryButtonText}>
                    {"Nhóm đã đủ người"}
                  </ThemedText>
                </ThemedView>
              ) : null}

              {isJoinedGroup && !hasCompletedThisRide && stableGroupStatusKey !== "driverdrivingtopickup" && stableGroupStatusKey !== "passengerboarding" && stableGroupStatusKey !== "inprogress" && stableGroupStatusKey !== "completed" ? (
                /* Nút rời nhóm cho passenger đã join nhưng nhóm chưa bắt đầu chạy. */
                <>
                  {Boolean(leaveError) ? (
                    <ThemedText type="smallBold" style={styles.errorText}>
                      {leaveError}
                    </ThemedText>
                  ) : null}
                  <Pressable
                    testID="shared-ride-leave-button"
                    style={[
                      styles.secondaryButton,
                      isLeavingGroup && styles.pendingButton,
                    ]}
                    onPress={handleLeaveGroup}
                    disabled={isLeavingGroup}
                  >
                    <ThemedText type="default" style={styles.secondaryButtonText}>
                      {isLeavingGroup ? "Đang rời nhóm..." : "Rời nhóm"}
                    </ThemedText>
                  </Pressable>
                </>
              ) : null}

              {/* Quay lại danh sách/route trước đó sau khi xem detail; không thay đổi request/group. */}
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
            /* Khối detail card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */
            <ThemedView
              style={[styles.detailCard, { backgroundColor: theme.backgroundElement }]}
            >
              <ThemedText type="default" style={styles.headerTitle}>
                Không tìm thấy chuyến xe ghép
              </ThemedText>
              {/* Không tìm thấy group: quay lại route trước đó, vì id trên URL không lấy được dữ liệu BE/mock. */}
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

      {/* Modal: Lớp giao diện nổi dùng để xác nhận, nhập form hoặc thông báo mà không rời màn hiện tại. */}
      <Modal
        visible={joinModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeJoinModal}
      >
        {/* Khối modal overlay: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
        <View style={styles.modalOverlay}>
          {/* Khối join card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
          <View
            testID="shared-ride-join-modal"
            style={[
              styles.joinCard,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            {/* Khối join header: Phần đầu của card/modal/màn hình, thường chứa tiêu đề và nút đóng. */}
            <View style={styles.joinHeader}>
              <ThemedText type="default" style={styles.joinTitle}>
                Thông tin tham gia
              </ThemedText>
              {/* Nút tham gia nhóm đi ghép hoặc mở form nhập thông tin tham gia. */}
              {/* Đóng join modal: clear lỗi/gợi ý pickup nhưng không gửi request lên BE. */}
              <Pressable style={styles.joinCloseButton} onPress={closeJoinModal}>
                <ThemedText type="default" style={styles.joinCloseText}>
                  ×
                </ThemedText>
              </Pressable>
            </View>

            {/* Khối form group: Nhóm label, input và lỗi validate của một trường form. */}
            <View style={styles.formGroup}>
              <ThemedText type="smallBold" style={styles.formLabel}>
                Điểm đón
                <ThemedText type="smallBold" style={styles.requiredMark}>*</ThemedText>
              </ThemedText>
              {/* Khối form input wrap: Nhóm label, input và lỗi validate của một trường form. */}
              <View
                style={[
                  styles.formInputWrap,
                  { backgroundColor: theme.background },
                ]}
              >
                {/* TextInput: Ô nhập dữ liệu người dùng, thường đi kèm validate và state form. */}
                <TextInput
                  testID="shared-ride-pickup-input"
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
                  /* Nút xóa nhanh nội dung ô nhập để người dùng chọn lại. */
                  /* Xóa input pickup và selectedPickupPlace để bắt user chọn lại gợi ý có tọa độ. */
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
                /* Khối pickup suggestion card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */
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
                        /* Nút chọn một gợi ý địa điểm từ danh sách autocomplete. */
                        /* Chọn suggestion: resolve VietMap detail nếu cần rồi lưu lat/lng vào selectedPickupPlace. */
                        <Pressable
                          testID={`shared-ride-pickup-suggestion-${index}`}
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

            {/* Khối readonly destination: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
            <View style={styles.readonlyDestination}>
              <ThemedText type="small" style={styles.readonlyLabel}>
                Điểm đến mặc định
              </ThemedText>
              <ThemedText type="smallBold" style={styles.readonlyValue}>
                {defaultDestination}
              </ThemedText>
            </View>

            {/* Khối form group: Nhóm label, input và lỗi validate của một trường form. */}
            <View style={styles.formGroup}>
              <ThemedText type="smallBold" style={styles.formLabel}>
                Ghi chú
              </ThemedText>
              {/* TextInput: Ô nhập dữ liệu người dùng, thường đi kèm validate và state form. */}
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

            {/* Khối modal button row: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
            <View style={styles.modalButtonRow}>
              {/* Nút tham gia nhóm đi ghép hoặc mở form nhập thông tin tham gia. */}
              {/* Nút đóng form: không gửi payload join, chỉ đóng modal. */}
              <Pressable
                style={[styles.modalSecondaryButton, { backgroundColor: theme.background }]}
                onPress={closeJoinModal}
              >
                <ThemedText type="smallBold">Đóng</ThemedText>
              </Pressable>
              {/* Nút tham gia nhóm đi ghép hoặc mở form nhập thông tin tham gia. */}
              {/* Submit join: lấy rideId từ URL + selectedPickupPlace rồi gọi joinRideSharingGroup. */}
              <Pressable
                testID="shared-ride-submit-join-button"
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

// styles: Gom toàn bộ style của màn hình/component ở cuối file
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
  noDriverPromptCard: {
    marginTop: Spacing.two,
    backgroundColor: "#FFF7ED",
    borderRadius: 14,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: "#FDBA74",
    gap: Spacing.two,
  },
  noDriverPromptTitle: {
    color: "#9A3412",
    fontSize: 15,
  },
  noDriverPromptSubtitle: {
    color: "#7C2D12",
  },
  noDriverPromptActions: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  noDriverPromptSecondaryButton: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FB923C",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  noDriverPromptSecondaryText: {
    color: "#C2410C",
  },
  noDriverPromptPrimaryButton: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: 12,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  noDriverPromptPrimaryText: {
    color: "#FFFFFF",
  },
  errorText: {
    color: "#B91C1C",
  },
});
