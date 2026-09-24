// BOOKING SEARCH SCREEN - Luồng đặt xe, chọn địa điểm, tính giá và tạo chuyến
// ================================================================
// Comment tiếng Việt được đặt phía trên từng khối để giải thích vai trò code.
// Logic hiện tại được giữ nguyên, chỉ bổ sung mô tả cho dễ đọc/bảo trì.
// ================================================================

import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { ThemedText } from "@/components/themed-text";
import {
  BottomTabInset,
  Colors,
  MaxContentWidth,
  ScreenHeaderTop,
  ScreenTitleStyle,
  Spacing,
} from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/hooks/use-theme";
import {
  getVietMapDirections as getMapDirections,
  buildVietMapInteractiveMapHtml as buildMapInteractiveMapHtml,
  getVietMapPlaceDetails as getMapPlaceDetails,
  getVietMapPlaceSuggestions as getMapPlaceSuggestions,
  getVietMapPlaceMapUrl as getMapPlaceMapUrl,
  getVietMapStaticMapUrl as getMapStaticMapUrl,
  getVietMapVehicleProfile,
  reverseVietMapPlaceLocation as reverseMapPlaceLocation,
  isVietMapConfigured as isMapConfigured,
} from "@/features/booking/services/vietmap-api";
import { estimateFare } from "@/features/booking/services/pricing-api";
import {
  cancelTrip,
  createTrip,
  extendTripSearch,
  getTrip,
} from "@/features/booking/services/trip-api";
import {
  loadBookedTrips,
  persistBookedTrip,
} from "@/features/booking/services/trip-storage";
import { createReview } from "@/features/trip-history/services/review-api";
import {
  cancelRideSharingRequest,
  createRideSharingRequest,
  extendRideSharingSearch,
  getAvailableRideSharingGroups,
  getMyRideSharingGroup,
  getMyRideSharingRequest,
  getRideSharingGroup,
  getRideSharingRequest,
  joinRideSharingGroup,
} from "@/features/ride-sharing/services/ride-sharing-api";
import {
  loadStoredRideSharingCards,
  persistRideSharingCards,
  replaceRideSharingCards,
} from "@/features/ride-sharing/services/ride-sharing-storage";

// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const BRAND = "#FF7A00";
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const MAP_BG = "#FFF3C9";
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const PICKUP_BLUE = "#2563EB";
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const DESTINATION_GREEN = "#16A34A";
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const NO_DRIVER_PROMPT_DELAY_MS = 5 * 60 * 1000;
const API_DATE_TIME_ZONE_PATTERN = /(z|[+-]\d{2}:?\d{2})$/i;
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const MOCK_DRIVER_POINT = {
  placeId: "",
  formattedAddress: "Cổng chính Đại học FPT, Thạch Hòa, Hà Nội",
  location: {
    lat: 21.0137,
    lng: 105.5262,
  },
};
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const FPT_HOLA_PLACE = {
  placeId: "fpt-hola",
  formattedAddress:
    "Đại học FPT, Khu Công nghệ cao Hòa Lạc, Thạch Hòa, Thạch Thất, Hà Nội",
  location: {
    lat: 21.012845855,
    lng: 105.527637553,
  },
};
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const MOCK_DRIVER_LOCATION = "Cổng chính Đại học FPT, Thạch Hòa, Hà Nội";
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const SHARED_RIDE_MAX_DISTANCE_KM = 50;
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const MIN_BOOKING_DISTANCE_KM = 0.1;
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const MIN_BOOKING_DISTANCE_METERS = 100;
const vietnameseTextInputProps = {
  autoCapitalize: "none",
  autoCorrect: false,
  autoComplete: "off",
  spellCheck: false,
  keyboardType: "default",
  disableFullscreenUI: true,
};

// formatDeviceReverseAddress: Ghép các trường địa chỉ từ GPS thành một chuỗi dễ đọc
function formatDeviceReverseAddress(address) {
  if (!address) {
    return "";
  }

  return [
    address.name,
    address.street,
    address.district,
    address.city,
    address.region,
    address.country,
  ]
    .filter(Boolean)
    .filter((part, index, parts) => parts.indexOf(part) === index)
    .join(", ");
}

// formatCoordinateAddress: Tạo text tọa độ khi không lấy được địa chỉ đầy đủ
function formatCoordinateAddress(location) {
  if (!location) {
    return "";
  }

  const lat = Number(location.lat);
  const lng = Number(location.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return "";
  }

  return `Tọa độ hiện tại: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

// getSingleParam: Lấy một query param duy nhất từ Expo Router
function getSingleParam(value) {
  return Array.isArray(value) ? value[0] : value;
}

// getBookingAlertTitle: Map tiêu đề alert hợp lý dựa trên nội dung message.
// - Validation/nhập thiếu -> "Vui lòng kiểm tra lại"
// - Lỗi hệ thống/BE/mạng -> "Đặt chuyến thất bại"
// - Mặc định -> "Thông báo"
function getBookingAlertTitle(message) {
  const text = String(message ?? "").trim();
  if (!text) {
    return "Thông báo";
  }
  const lower = text.toLowerCase();
  const systemPrefixes = [
    "không thể",
    "be đang lỗi",
    "lỗi",
    "an error occurred",
    "http ",
    "network",
    "timeout",
  ];
  if (systemPrefixes.some((prefix) => lower.startsWith(prefix))) {
    return "Đặt chuyến thất bại";
  }
  return "Vui lòng kiểm tra lại";
}

const rideOptions = [
  {
    id: "bike",
    icon: "🛵",
    name: "Xe máy",
    vehicleType: 1,
  },
  {
    id: "car4",
    icon: "🚗",
    name: "Ô tô",
    vehicleType: 2,
  },
];
const availableRideOptions = rideOptions;

// getRideOptionDisplayLabel: Đảm bảo option name luôn hiển thị đầy đủ "Xe máy"/"Ô tô"
// trong modal chọn loại xe và mọi nơi render ride option.
// Nếu dữ liệu rơi vào nhánh rút gọn ("Xe", "OTO", ...) do cache/cũ, helper sẽ fallback
// về tên đầy đủ tương ứng với vehicleType hoặc id.
function getRideOptionDisplayLabel(option) {
  if (!option) {
    return "";
  }

  const fallbackByVehicleType = {
    1: "Xe máy",
    2: "Ô tô",
    3: "Xe 7 chỗ",
  };
  const fallbackById = {
    bike: "Xe máy",
    car4: "Ô tô",
    car7: "Xe 7 chỗ",
  };

  const rawName = String(option.name ?? "").trim();

  if (rawName && rawName.length >= 4) {
    return rawName;
  }

  const fallback =
    fallbackByVehicleType[option.vehicleType] ||
    fallbackById[option.id] ||
    rawName ||
    "Xe";

  return fallback;
}

const sharedTripTypes = [
  "Chuyến đi (Từ nơi khác đến FPT)",
  "Chuyến về (Từ FPT đi nơi khác)",
];

// Keep these slot numbers and times in sync with RideSharing settings on the BE.
const sharedSlotOptionsByDirection = {
  1: [
    { id: "slot-1", label: "Slot 1", time: "07:00" },
    { id: "slot-2", label: "Slot 2", time: "09:00" },
    { id: "slot-3", label: "Slot 3", time: "10:00" },
    { id: "slot-4", label: "Slot 4", time: "12:00" },
    { id: "slot-5", label: "Slot 5", time: "14:00" },
    { id: "slot-6", label: "Slot 6", time: "16:00" },
  ],
  2: [
    { id: "slot-1", label: "Slot 1", time: "09:00" },
    { id: "slot-2", label: "Slot 2", time: "10:50" },
    { id: "slot-3", label: "Slot 3", time: "12:30" },
    { id: "slot-4", label: "Slot 4", time: "14:30" },
    { id: "slot-5", label: "Slot 5", time: "16:10" },
    { id: "slot-6", label: "Slot 6", time: "17:50" },
  ],
};

const defaultSharedForm = {
  rideMode: "scheduled",
  tripType: sharedTripTypes[0],
  location: "",
  slotId: "",
  date: "",
};

const sharedDirectionByTripType = {
  [sharedTripTypes[0]]: 1,
  [sharedTripTypes[1]]: 2,
};

const defaultAddressForm = {
  label: "",
};

// formatCurrencyVnd: Định dạng số tiền sang VND để hiển thị
function formatCurrencyVnd(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return `${Math.round(value).toLocaleString("vi-VN")}đ`;
}

// formatDistanceKm: Định dạng khoảng cách theo km
function formatDistanceKm(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "--";
  }

  const roundedValue =
    numberValue >= 10
      ? Math.round(numberValue)
      : Math.round(numberValue * 10) / 10;

  return `${roundedValue.toLocaleString("vi-VN")} km`;
}

// formatDurationMinute: Định dạng thời gian di chuyển theo phút
function formatDurationMinute(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "--";
  }

  return `${Math.max(1, Math.round(numberValue))} phút`;
}

function parseApiDateTime(value) {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value !== "string") {
    return new Date(value);
  }

  const trimmedValue = value.trim();
  const normalizedValue = API_DATE_TIME_ZONE_PATTERN.test(trimmedValue)
    ? trimmedValue
    : `${trimmedValue}Z`;

  return new Date(normalizedValue);
}

function hasWaitedLongerThanPromptDelay(createdAt, nowMs) {
  if (!createdAt) {
    return false;
  }

  const createdDate = parseApiDateTime(createdAt);

  if (Number.isNaN(createdDate.getTime())) {
    return false;
  }

  return nowMs - createdDate.getTime() >= NO_DRIVER_PROMPT_DELAY_MS;
}

function isImmediateTripType(tripType) {
  if (tripType == null || tripType === "") {
    return true;
  }

  const normalizedTripType = String(tripType).replace(/\s+/g, "").toLowerCase();

  return normalizedTripType === "1" || normalizedTripType === "immediate";
}

// getTripEstimatedFare: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getTripEstimatedFare(trip) {
  return trip?.pricing?.estimatedFare ?? trip?.estimatedFare ?? null;
}

// getTripDistanceText: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getTripDistanceText(trip, fallbackText = "--") {
  return trip?.estimatedDistanceKm != null
    ? formatDistanceKm(trip.estimatedDistanceKm)
    : fallbackText;
}

// getTripDurationText: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getTripDurationText(trip, fallbackText = "--") {
  return trip?.estimatedDurationMinute != null
    ? formatDurationMinute(trip.estimatedDurationMinute)
    : fallbackText;
}

// mergeBookedRideWithTrip: Ghép dữ liệu local với dữ liệu mới nhất từ BE
function mergeBookedRideWithTrip(bookedRide, trip) {
  const dbEstimatedFare = getTripEstimatedFare(trip);
  const hasDriver = Boolean(trip?.driverId);

  return {
    ...(bookedRide ?? {}),
    id: trip?.id ?? bookedRide?.id,
    status: normalizeTripStatus(trip?.status ?? bookedRide?.status),
    statusLabel: getTripStatusView(trip?.status ?? bookedRide?.status, hasDriver).label,
    estimatedFare:
      bookedRide?.estimatedFare ??
      (dbEstimatedFare != null ? formatCurrencyVnd(Number(dbEstimatedFare)) : null),
    tripDistance: getTripDistanceText(trip, bookedRide?.tripDistance),
    tripDuration: getTripDurationText(trip, bookedRide?.tripDuration),
    pickup: trip?.pickupAddress ?? bookedRide?.pickup,
    destination: trip?.destinationAddress ?? bookedRide?.destination,
    route:
      bookedRide?.route ??
      `${trip?.pickupAddress ?? ""} → ${trip?.destinationAddress ?? ""}`.trim(),
    vehicleType: String(trip?.vehicleType ?? bookedRide?.vehicleType ?? ""),
    driverId: trip?.driverId ?? bookedRide?.driverId,
    driverName: trip?.driverName ?? bookedRide?.driverName,
    driverPhone: trip?.driverPhone ?? bookedRide?.driverPhone,
    driverLicensePlate:
      trip?.driverLicensePlate ?? bookedRide?.driverLicensePlate,
    driverVehicleInfo:
      trip?.driverVehicleInfo ?? bookedRide?.driverVehicleInfo,
    acceptedAt: trip?.acceptedAt ?? bookedRide?.acceptedAt,
    driverArrivedAt: trip?.driverArrivedAt ?? bookedRide?.driverArrivedAt,
    pickedUpAt: trip?.pickedUpAt ?? bookedRide?.pickedUpAt,
    completedAt: trip?.completedAt ?? bookedRide?.completedAt,
    cancelledAt: trip?.cancelledAt ?? bookedRide?.cancelledAt,
    createdAt: trip?.createdAt ?? bookedRide?.createdAt,
  };
}

// formatSharedSchedule: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function formatSharedSchedule(value) {
  if (!value) {
    return "Chưa có lịch đi";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Chưa có lịch đi";
  }

  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// normalizeSharedStatusLabel: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function normalizeSharedStatusLabel(status) {
  const normalizedStatus = String(status ?? "").replace(/\s+/g, "").toLowerCase();

  if (normalizedStatus === "waiting") {
    return "Đang chờ ghép nhóm";
  }

  if (normalizedStatus === "matched") {
    return "Đã tìm thấy nhóm phù hợp";
  }

  if (normalizedStatus === "ingroup") {
    return "Đã vào nhóm";
  }

  if (normalizedStatus === "driverassigned") {
    return "Đã có tài xế";
  }

  if (normalizedStatus === "waitingdeparture") {
    return "Chờ đến giờ khởi hành";
  }

  if (normalizedStatus === "driverdriving") {
    return "Tài xế đang đến";
  }

  if (normalizedStatus === "passengerboarding") {
    return "Đang đón khách";
  }

  if (normalizedStatus === "inprogress") {
    return "Đang di chuyển";
  }

  if (normalizedStatus === "completed") {
    return "Hoàn thành";
  }

  if (normalizedStatus === "cancelled") {
    return "Đã hủy";
  }

  if (normalizedStatus === "nodriverfound") {
    return "Chưa tìm thấy tài xế";
  }

  if (normalizedStatus === "expired") {
    return "Đã hết hạn";
  }

  return status || "Pending";
}

// mapRideSharingRequestToCard: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function mapRideSharingRequestToCard(request, group = null) {
  if (!request?.id) {
    return null;
  }

  const pickup = request.pickupAddress || "Điểm đón";
  const destination = request.destinationAddress || "Điểm đến";
  const groupPassengerCount = group?.currentPassengers ?? 1;
  const groupCapacity = group?.maxPassengers ?? 3;

  return {
    id: request.id,
    requestId: request.id,
    groupId: request.groupId ?? group?.id ?? "",
    route: `${pickup} → ${destination}`,
    vehicle: "Xe ghép",
    price: formatCurrencyVnd(Number(request.finalFare ?? request.quotedFare)),
    distance: formatDistanceKm(request.estimatedDistanceKm),
    duration: formatDurationMinute(request.estimatedDurationMinutes),
    seats: `${groupPassengerCount}/${groupCapacity} người`,
    note: formatSharedSchedule(request.scheduledAt),
    scheduleText: formatSharedSchedule(request.scheduledAt),
    status: request.status,
    statusLabel: normalizeSharedStatusLabel(request.status),
    driver: group?.driverName || "Chưa có tài xế",
    destination,
    participantCount: groupPassengerCount,
    capacity: groupCapacity,
    perPersonPrice: formatCurrencyVnd(Number(request.finalFare ?? request.quotedFare)),
    createdAt: request.createdAt,
  };
}

void mapRideSharingRequestToCard;

// formatSharedScheduleClean: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function formatSharedScheduleClean(value) {
  if (!value) {
    return "Chưa có lịch đi";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Chưa có lịch đi";
  }

  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const rideSharingRequestStatusNameByValue = {
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

const rideSharingGroupStatusNameByValue = {
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

// normalizeRideSharingStatusValue: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function normalizeRideSharingStatusValue(status, statusNameByValue) {
  const numericStatus = Number(status);

  if (Number.isInteger(numericStatus) && statusNameByValue[numericStatus]) {
    return statusNameByValue[numericStatus];
  }

  return String(status ?? "").replace(/\s+/g, "").toLowerCase();
}

// normalizeRideSharingRequestStatus: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function normalizeRideSharingRequestStatus(status) {
  return normalizeRideSharingStatusValue(status, rideSharingRequestStatusNameByValue);
}

// normalizeRideSharingGroupStatus: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function normalizeRideSharingGroupStatus(status) {
  return normalizeRideSharingStatusValue(status, rideSharingGroupStatusNameByValue);
}

// normalizeSharedStatusLabelClean: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function normalizeSharedStatusLabelClean(status) {
  const normalizedStatus = String(status ?? "").replace(/\s+/g, "").toLowerCase();
  const labels = {
    waiting: "Đang chờ ghép nhóm",
    matched: "Đã tìm thấy nhóm phù hợp",
    ingroup: "Đã vào nhóm",
    driverassigned: "Đã có tài xế",
    waitingdeparture: "Chờ đến giờ khởi hành",
    driverdriving: "Tài xế đang đến",
    driverdrivingtopickup: "Tài xế đang đến",
    passengerboarding: "Đang đón khách",
    inprogress: "Đang di chuyển",
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
    nodriverfound: "Chưa tìm thấy tài xế",
    expired: "Đã hết hạn",
    readyforbroadcast: "Sẵn sàng tìm tài xế",
    driveraccepted: "Tài xế đã nhận",
    waitingmatching: "Đang chờ ghép nhóm",
  };

  return labels[normalizedStatus] || status || "Pending";
}

// mapRideSharingRequestToCardClean: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function mapRideSharingRequestToCardClean(request, group = null) {
  if (!request?.id) {
    return null;
  }

  const pickup = request.pickupAddress || "Điểm đón";
  const destination = request.destinationAddress || "Điểm đến";
  const requestStatus = normalizeRideSharingRequestStatus(request.status);
  const requestGroupId = String(request.groupId ?? "").trim().toLowerCase();
  const receivedGroupId = String(group?.id ?? "").trim().toLowerCase();
  const matchingGroup =
    requestGroupId && requestGroupId === receivedGroupId ? group : null;
  const rawGroupStatus =
    matchingGroup?.status != null
      ? normalizeRideSharingGroupStatus(matchingGroup.status)
      : "";
  const shouldIgnoreGroup =
    requestStatus &&
    isSharedRideActive(requestStatus) &&
    isSharedGroupTerminal(rawGroupStatus);
  const effectiveGroup = shouldIgnoreGroup ? null : matchingGroup;
  const groupPassengerCount = effectiveGroup?.currentPassengers ?? 1;
  const groupCapacity = effectiveGroup?.maxPassengers ?? 3;
  const fare = Number(
    shouldIgnoreGroup
      ? request.quotedFare ?? request.finalFare
      : request.finalFare ?? request.quotedFare
  );
  const groupStatus = shouldIgnoreGroup ? "" : rawGroupStatus;
  const displayStatus = requestStatus;

  return {
    id: request.id,
    requestId: request.id,
    passengerId: request.passengerId ?? "",
    groupId: shouldIgnoreGroup ? "" : request.groupId ?? effectiveGroup?.id ?? "",
    route: `${pickup} → ${destination}`,
    vehicle: "Xe ghép",
    tripType: request.tripType ?? effectiveGroup?.tripType ?? "",
    price: formatCurrencyVnd(fare),
    distance: formatDistanceKm(request.estimatedDistanceKm),
    duration: formatDurationMinute(request.estimatedDurationMinutes),
    seats: `${groupPassengerCount}/${groupCapacity} người`,
    note: formatSharedScheduleClean(request.scheduledAt),
    scheduleText: formatSharedScheduleClean(request.scheduledAt),
    status: displayStatus,
    requestStatus,
    groupStatus,
    statusLabel: normalizeSharedStatusLabelClean(displayStatus),
    driver: effectiveGroup?.driverName || "Chưa có tài xế",
    destination,
    participantCount: groupPassengerCount,
    capacity: groupCapacity,
    perPersonPrice: formatCurrencyVnd(fare),
    createdAt: request.createdAt,
  };
}

// calculateAverageGroupFare: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function calculateAverageGroupFare(members, fallbackFare = 0) {
  const normalizedFares = (Array.isArray(members) ? members : [])
    .map((member) => Number(member?.finalFare ?? 0))
    .filter((fare) => Number.isFinite(fare) && fare > 0);

  if (normalizedFares.length > 0) {
    const totalFare = normalizedFares.reduce((sum, fare) => sum + fare, 0);
    return totalFare / normalizedFares.length;
  }

  const safeFallbackFare = Number(fallbackFare);
  return Number.isFinite(safeFallbackFare) && safeFallbackFare > 0
    ? safeFallbackFare
    : 0;
}

// calculateProjectedJoinFare: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function calculateProjectedJoinFare(members, currentPassengers, fallbackFare = 0) {
  const memberCount = Array.isArray(members) ? members.length : 0;
  const currentCount = Math.max(
    Number(currentPassengers) || 0,
    memberCount
  );
  const averageCurrentFare = calculateAverageGroupFare(members, fallbackFare);

  if (!Number.isFinite(averageCurrentFare) || averageCurrentFare <= 0) {
    return 0;
  }

  if (currentCount <= 0) {
    return averageCurrentFare;
  }

  return (averageCurrentFare * currentCount) / (currentCount + 1);
}

// mapRideSharingGroupToCard: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function mapRideSharingGroupToCard(group, { previewJoinFare = false } = {}) {
  if (!group?.id) {
    return null;
  }

  const members = Array.isArray(group.members) ? group.members : [];
  const firstMember = members[0] ?? {};
  const pickup = firstMember.pickupAddress || "Điểm đón";
  const destination =
    firstMember.destinationAddress ||
    group.destinationAddress ||
    "Điểm đến";
  const destinationLatitude =
    firstMember.destinationLatitude ?? group.destinationLatitude ?? null;
  const destinationLongitude =
    firstMember.destinationLongitude ?? group.destinationLongitude ?? null;
  const baseFare = calculateAverageGroupFare(members, group.finalFare);
  const fare = previewJoinFare
    ? calculateProjectedJoinFare(
        members,
        group.currentPassengers ?? members.length,
        group.finalFare
      )
    : baseFare;
  const groupStatus = normalizeRideSharingGroupStatus(group.status);

  return {
    id: group.id,
    requestId: firstMember.requestId || firstMember.rideSharingRequestId || "",
    passengerId: firstMember.passengerId || firstMember.userId || "",
    groupId: group.id,
    route: `${pickup} → ${destination}`,
    vehicle: "Nhóm xe ghép",
    price: formatCurrencyVnd(fare),
    distance: formatDistanceKm(firstMember.estimatedDistanceKm),
    duration: formatDurationMinute(firstMember.estimatedDurationMinutes),
    seats: `${group.currentPassengers ?? members.length}/${group.maxPassengers ?? 3} người`,
    note: formatSharedScheduleClean(group.scheduledDepartureTime),
    scheduleText: formatSharedScheduleClean(group.scheduledDepartureTime),
    status: groupStatus,
    groupStatus,
    statusLabel: normalizeSharedStatusLabelClean(groupStatus),
    driver: group.driverName || "Chưa có tài xế",
    destination,
    destinationLatitude,
    destinationLongitude,
    destinationAddress: destination,
    participantCount: group.currentPassengers ?? members.length,
    capacity: group.maxPassengers ?? 3,
    perPersonPrice: formatCurrencyVnd(fare),
    priceLabel: previewJoinFare ? "Giá khi tham gia" : "Giá mỗi người",
    createdAt: group.createdAt,
    canCancel: false,
    rawGroup: group,
  };
}

// normalizeRideSharingStatus: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function normalizeRideSharingStatus(status) {
  return normalizeRideSharingRequestStatus(status);
}

// isSharedTerminalStatus: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function isSharedTerminalStatus(status) {
  const normalizedStatus = String(status ?? "").replace(/\s+/g, "").toLowerCase();
  const inactiveStatuses = new Set([
    "cancelled",
    "completed",
    "expired",
    "nodriverfound",
  ]);

  return inactiveStatuses.has(normalizedStatus);
}

// isSharedRideActive: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function isSharedRideActive(status) {
  return !isSharedTerminalStatus(normalizeRideSharingRequestStatus(status));
}

// isSharedGroupTerminal: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function isSharedGroupTerminal(status) {
  return isSharedTerminalStatus(normalizeRideSharingGroupStatus(status));
}

// formatTripDateTime: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function formatTripDateTime(value) {
  if (!value) {
    return "Vừa hoàn thành";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Vừa hoàn thành";
  }

  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// toRadians: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

// calculateBackendDistanceKm: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function calculateBackendDistanceKm(origin, destination) {
  if (!origin?.location || !destination?.location) {
    return 0;
  }

  const originLat = Number(origin.location.lat);
  const originLng = Number(origin.location.lng);
  const destinationLat = Number(destination.location.lat);
  const destinationLng = Number(destination.location.lng);

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

// normalizePlaceCompareText: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function normalizePlaceCompareText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// areSameBookingPlaces: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function areSameBookingPlaces(origin, destination) {
  if (!origin?.location || !destination?.location) {
    return false;
  }

  const originLat = Number(origin.location.lat);
  const originLng = Number(origin.location.lng);
  const destinationLat = Number(destination.location.lat);
  const destinationLng = Number(destination.location.lng);

  if (
    Number.isFinite(originLat) &&
    Number.isFinite(originLng) &&
    Number.isFinite(destinationLat) &&
    Number.isFinite(destinationLng)
  ) {
    const latDiff = Math.abs(originLat - destinationLat);
    const lngDiff = Math.abs(originLng - destinationLng);

    if (latDiff < 0.00001 && lngDiff < 0.00001) {
      return true;
    }
  }

  const originAddress = normalizePlaceCompareText(
    origin.formattedAddress || origin.description || origin.label
  );
  const destinationAddress = normalizePlaceCompareText(
    destination.formattedAddress || destination.description || destination.label
  );

  return Boolean(
    originAddress && destinationAddress && originAddress === destinationAddress
  );
}

// getMinimumDistanceValidationMessage: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getMinimumDistanceValidationMessage(
  origin,
  destination,
  routeMetrics = null
) {
  if (!origin?.location || !destination?.location) {
    return "";
  }

  if (areSameBookingPlaces(origin, destination)) {
    return "Điểm đón và điểm đến không được trùng nhau.";
  }

  const routeDistanceKm = Number(routeMetrics?.distanceKm);
  const directDistanceKm = calculateBackendDistanceKm(origin, destination);
  const distanceKm =
    Number.isFinite(routeDistanceKm) && routeDistanceKm > 0
      ? routeDistanceKm
      : directDistanceKm;

  if (distanceKm < MIN_BOOKING_DISTANCE_KM) {
    return `Điểm đón và điểm đến quá gần nhau. Vui lòng chọn lộ trình cách nhau tối thiểu ${MIN_BOOKING_DISTANCE_METERS}m.`;
  }

  return "";
}

// getBackendTripMetrics: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getBackendTripMetrics(verifiedMap) {
  const routeDistanceKm = Number(verifiedMap?.directions?.distanceKm);
  const routeDurationMinute = Number(verifiedMap?.directions?.durationMinute);

  if (routeDistanceKm > 0 && routeDurationMinute > 0) {
    return {
      distanceKm: routeDistanceKm,
      durationMinute: Math.max(1, Math.round(routeDurationMinute)),
      distanceText: formatDistanceKm(routeDistanceKm),
      durationText: formatDurationMinute(routeDurationMinute),
    };
  }

  const routeDistanceMeters = Number(verifiedMap?.directions?.distanceMeters);
  const routeDurationSeconds = Number(verifiedMap?.directions?.durationSeconds);

  if (routeDistanceMeters > 0 && routeDurationSeconds > 0) {
    const distanceKm = routeDistanceMeters / 1000;
    const durationMinute = Math.max(1, Math.round(routeDurationSeconds / 60));

    return {
      distanceKm,
      durationMinute,
      distanceText: formatDistanceKm(distanceKm),
      durationText: formatDurationMinute(durationMinute),
    };
  }

  return null;
}

// normalizeTripStatus: Chuẩn hóa status chuyến từ số hoặc text về một dạng thống nhất
function normalizeTripStatus(status) {
  const numericStatus = Number(status);
  const statusNameByValue = {
    1: "pending",
    2: "accepted",
    3: "driverarrived",
    4: "inprogress",
    5: "completed",
    6: "cancelled",
    7: "pendingdriverassignment",
    8: "nodriverfound",
  };

  if (Number.isInteger(numericStatus) && statusNameByValue[numericStatus]) {
    return statusNameByValue[numericStatus];
  }

  return String(status ?? "pending").replace(/\s+/g, "").toLowerCase();
}

const sharedRequestFilterOptions = [
  { id: "booked", label: "Đã đặt" },
  { id: "cancelled", label: "Đã hủy" },
  { id: "completed", label: "Đã hoàn thành" },
];

// getSharedRequestFilterKey: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getSharedRequestFilterKey(status) {
  const normalizedStatus = normalizeRideSharingStatus(status);

  if (normalizedStatus === "completed") {
    return "completed";
  }

  if (
    normalizedStatus === "cancelled" ||
    normalizedStatus === "expired" ||
    normalizedStatus === "nodriverfound"
  ) {
    return "cancelled";
  }

  return "booked";
}

// getSharedRequestEffectiveStatus: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getSharedRequestEffectiveStatus(request) {
  if (!request) {
    return "";
  }

  const normalizedRequestStatus = normalizeRideSharingRequestStatus(
    request.requestStatus ?? request.status
  );

  if (
    normalizedRequestStatus === "completed" ||
    normalizedRequestStatus === "cancelled" ||
    normalizedRequestStatus === "expired" ||
    normalizedRequestStatus === "nodriverfound"
  ) {
    return normalizedRequestStatus;
  }

  if (request.groupStatus) {
    const normalizedGroupStatus = normalizeRideSharingGroupStatus(
      request.groupStatus
    );

    if (normalizedGroupStatus === "completed") {
      return "completed";
    }

    if (
      normalizedGroupStatus === "cancelled" ||
      normalizedGroupStatus === "nodriverfound"
    ) {
      return "cancelled";
    }

    if (
      normalizedGroupStatus === "driveraccepted" ||
      normalizedGroupStatus === "waitingdeparture" ||
      normalizedGroupStatus === "driverdrivingtopickup" ||
      normalizedGroupStatus === "passengerboarding" ||
      normalizedGroupStatus === "inprogress"
    ) {
      return normalizedGroupStatus;
    }
  }

  return normalizedRequestStatus;
}

// getSharedRequestCardKey: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getSharedRequestCardKey(card) {
  return String(card?.requestId || card?.groupId || card?.id || "");
}

// isRideSharingCardOwnedByUser: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function isRideSharingCardOwnedByUser(card, userId) {
  const normalizedUserId = String(userId ?? "").trim().toLowerCase();

  if (!normalizedUserId) {
    return false;
  }

  const passengerId = String(card?.passengerId ?? "").trim().toLowerCase();

  return !passengerId || passengerId === normalizedUserId;
}

// mergeSharedRequestCards: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function mergeSharedRequestCards(primaryCards, secondaryCards) {
  const mergedCards = [];
  const seenKeys = new Set();

  [...(primaryCards ?? []), ...(secondaryCards ?? [])].forEach((card) => {
    const key = getSharedRequestCardKey(card);

    if (!key || seenKeys.has(key)) {
      return;
    }

    seenKeys.add(key);
    mergedCards.push(card);
  });

  return mergedCards;
}

// removeSharedRequestCards: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function removeSharedRequestCards(cards, requestId, groupId = "") {
  const normalizedRequestId = String(requestId ?? "").trim().toLowerCase();
  const normalizedGroupId = String(groupId ?? "").trim().toLowerCase();

  return (cards ?? []).filter((card) => {
    const cardRequestId = String(card?.requestId ?? "").trim().toLowerCase();
    const cardGroupId = String(card?.groupId ?? "").trim().toLowerCase();
    const cardId = String(card?.id ?? "").trim().toLowerCase();

    if (
      normalizedRequestId &&
      (cardRequestId === normalizedRequestId || cardId === normalizedRequestId)
    ) {
      return false;
    }

    if (
      normalizedGroupId &&
      (cardGroupId === normalizedGroupId || cardId === normalizedGroupId)
    ) {
      return false;
    }

    return true;
  });
}

async function refreshStoredRideSharingCard(card, accessToken) {
  if (!card || !accessToken) {
    return card;
  }

  try {
    if (card.requestId) {
      const request = await getRideSharingRequest(card.requestId, accessToken);
      let group = null;

      if (request?.groupId) {
        try {
          group = await getRideSharingGroup(request.groupId, accessToken);
        } catch (error) {
          if (error?.status === 404) {
            group = null;
          } else {
            group = null;
          }
        }
      }

      return mapRideSharingRequestToCardClean(request, group) ?? null;
    }

    if (card.groupId) {
      const group = await getRideSharingGroup(card.groupId, accessToken);
      return mapRideSharingGroupToCard(group) ?? null;
    }
  } catch (error) {
    if (error?.status === 404) {
      return null;
    }

    return card;
  }

  return card;
}

async function getRideSharingGroupForRequest(request, currentGroup, accessToken) {
  const requestGroupId = String(request?.groupId ?? "").trim();
  const currentGroupId = String(currentGroup?.id ?? "").trim();

  if (!requestGroupId || !accessToken) {
    return currentGroup ?? null;
  }

  if (
    currentGroup &&
    currentGroupId.toLowerCase() === requestGroupId.toLowerCase()
  ) {
    return currentGroup;
  }

  try {
    return await getRideSharingGroup(requestGroupId, accessToken);
  } catch {
    return currentGroup ?? null;
  }
}

async function refreshStoredRideSharingCards(cards, accessToken) {
  const storedCards = (cards ?? []).filter(Boolean).slice(0, 50);

  if (storedCards.length === 0 || !accessToken) {
    return storedCards;
  }

  const refreshedCards = await Promise.allSettled(
    storedCards.map((card) => refreshStoredRideSharingCard(card, accessToken))
  );

  return refreshedCards
    .map((result, index) =>
      result.status === "fulfilled" ? result.value : storedCards[index]
    )
    .filter(Boolean);
}

// getRideSharingCreateErrorMessage: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getRideSharingCreateErrorMessage(error) {
  if (error?.status === 401) {
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tạo yêu cầu xe ghép.";
  }

  if (error?.status === 400) {
    return (
      error.message ||
      "Thông tin xe ghép chưa hợp lệ. Vui lòng kiểm tra điểm đi, ngày đi và slot."
    );
  }

  if (error?.status === 500 && error?.path === "/ride-sharing/requests") {
    return "BE chưa tạo được yêu cầu xe ghép trước khi lưu DB. Thường do còn yêu cầu đang hoạt động, quãng đường vượt 50 km hoặc token/tài khoản không khớp DB.";
  }

  return (
    error?.message ||
    "Không thể tạo yêu cầu xe ghép từ BE. Vui lòng thử lại sau."
  );
}

// logRideSharingCreateDebug: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function logRideSharingCreateDebug(label, data) {
  if (typeof __DEV__ !== "undefined" && !__DEV__) {
    return;
  }

  console.log(`[RideSharingCreate] ${label}`, data);
}

void getRideSharingCreateErrorMessage;

// getRideSharingCreateReadableErrorMessage: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getRideSharingCreateReadableErrorMessage(error) {
  if (error?.status === 401) {
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tạo yêu cầu xe ghép.";
  }

  if (error?.status === 400) {
    return (
      error.message ||
      "Thông tin xe ghép chưa hợp lệ. Vui lòng kiểm tra điểm đi, ngày đi và slot."
    );
  }

  if (error?.status === 500 && error?.path === "/ride-sharing/requests") {
    const serverMessage = error?.payload?.message || error?.message;
    return `Không tạo được yêu cầu xe ghép. BE trả lỗi: ${
      serverMessage || "An error occurred"
    }. Hãy xem log [RideSharingCreate] trong Metro để kiểm tra payload FE gửi lên.`;
  }

  return (
    error?.message ||
    "Không thể tạo yêu cầu xe ghép từ BE. Vui lòng thử lại sau."
  );
}

// isTerminalTripStatus: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function isTerminalTripStatus(status) {
  const normalizedStatus = normalizeTripStatus(status);
  return (
    normalizedStatus === "completed" ||
    normalizedStatus === "cancelled" ||
    normalizedStatus === "nodriverfound"
  );
}

function isNoDriverFoundTripStatus(status) {
  return normalizeTripStatus(status) === "nodriverfound";
}

// getTripStatusView: Quy đổi status chuyến thành label và màu hiển thị
function getTripStatusView(status, hasDriver) {
  const normalizedStatus = normalizeTripStatus(status);

  if (normalizedStatus === "driverarrived") {
    return {
      title: "Tài xế đã đến điểm đón",
      subtitle: "Vui lòng ra đúng điểm đón và kiểm tra biển số xe trước khi lên xe.",
      label: "Tài xế đã đến",
      icon: "✓",
    };
  }

  if (normalizedStatus === "inprogress") {
    return {
      title: "Chuyến đi đang diễn ra",
      subtitle: "Bạn đang trên chuyến đi. Hệ thống sẽ cập nhật khi tài xế hoàn thành chuyến.",
      label: "Chuyến đi đang diễn ra",
      icon: "→",
    };
  }

  if (normalizedStatus === "completed") {
    return {
      title: "Chuyến đi đã hoàn thành",
      subtitle: "Cảm ơn bạn đã sử dụng FPT Ride. Bạn có thể đánh giá tài xế sau chuyến đi.",
      label: "Hoàn thành",
      icon: "✓",
    };
  }

  if (normalizedStatus === "cancelled") {
    return {
      title: "Chuyến đi đã bị hủy",
      subtitle: "Yêu cầu chuyến đi này đã kết thúc. Bạn có thể quay lại đặt chuyến mới.",
      label: "Đã hủy",
      icon: "!",
    };
  }

  if (normalizedStatus === "nodriverfound") {
    return {
      title: "Không tìm thấy tài xế",
      subtitle: "Hiện chưa có tài xế phù hợp nhận chuyến này. Bạn có thể quay lại và đặt chuyến mới.",
      label: "Không tìm thấy tài xế",
      icon: "!",
    };
  }

  if (hasDriver || normalizedStatus === "accepted") {
    return {
      title: "Tài xế đã nhận chuyến",
      subtitle: "Tài xế đang di chuyển đến điểm đón của bạn.",
      label: "Đã có tài xế nhận chuyến",
      icon: "●",
    };
  }

  return {
    title: "Đang tìm tài xế cho bạn",
    subtitle: "Yêu cầu chuyến đi đã được lưu. Hệ thống đang quét tài xế phù hợp xung quanh.",
    label: "Đang tìm tài xế",
    icon: "●",
  };
}

// getSharedProposal: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getSharedProposal(ride) {
  const isCar7 = ride.vehicle.includes("7");
  const soloPrice = isCar7 ? "320.000đ" : "250.000đ";
  const sharedPrice = isCar7 ? "116.000đ" : "90.000đ";
  const savingPrice = isCar7 ? "204.000đ" : "160.000đ";
  const [startPoint = "Đại học FPT", endPoint = "Điểm đến"] =
    ride.route.split("→").map((item) => item.trim());

  return {
    soloPrice,
    sharedPrice,
    savingPrice,
    expectedPickup: isCar7 ? "6:35" : "7:30",
    expectedArrival: isCar7 ? "7:20" : "8:10",
    pickupDirection: isCar7
      ? "Chiều: Nhà → Trường"
      : "Chiều: Trường → Nhà",
    driverStatus: "Đã có tài xế",
    routeSteps: [
      `1. ${startPoint}`,
      `2. ${ride.driver.split(" ").slice(-2).join(" ") || "Khách"} - ${endPoint}`,
      "3. Bạn - Mê Trì",
    ],
    notes: [
      "1. Đồng ý tham gia sẽ giữ chỗ",
      "2. Hủy sau thời gian đóng nhóm sẽ bị cảnh cáo",
    ],
  };
}

// mapAvailableRideSharingGroupToCard: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function mapAvailableRideSharingGroupToCard(group) {
  if (!group?.id) {
    return null;
  }

  const participantCount = Number(group.currentPassengers ?? 0);
  const capacity = Number(group.maxPassengers ?? 3);
  const availableSeats = Number(
    group.availableSeats ?? Math.max(capacity - participantCount, 0)
  );
  const scheduleText = formatSharedScheduleClean(group.scheduledDepartureTime);
  const directionValue = Number(group.direction);
  const directionLabel =
    directionValue === 2 || String(group.direction ?? "").toLowerCase() === "inbound"
      ? "Chuyến về"
      : "Chuyến đi";

  return {
    id: group.id,
    requestId: "",
    groupId: group.id,
    route: `${directionLabel} • ${scheduleText}`,
    vehicle: "Ô tô",
    price: "--",
    distance: "--",
    duration: "--",
    seats: `${participantCount}/${capacity} người`,
    note: availableSeats > 0 ? "Nhóm còn chỗ trống" : "Nhóm đã đủ người",
    scheduleText,
    status: group.status,
    groupStatus: group.status,
    statusLabel: normalizeSharedStatusLabelClean(group.status),
    driver: "Chưa có tài xế",
    destination: group.destinationAddress || scheduleText,
    destinationLatitude: group.destinationLatitude ?? null,
    destinationLongitude: group.destinationLongitude ?? null,
    destinationAddress: group.destinationAddress || "",
    participantCount,
    capacity,
    perPersonPrice: "--",
    createdAt: group.createdAt,
    availableSeats,
    rawGroup: group,
  };
}

// getRideSharingJoinErrorMessage: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getRideSharingJoinErrorMessage(error) {
  const rawMessage =
    error?.payload?.message ||
    error?.payload?.detail ||
    error?.payload?.title ||
    error?.payload?.error ||
    error?.message ||
    "";
  const cleanedMessage = String(rawMessage)
    .replace(/^HTTP\s+\d+\s+\/ride-sharing\/groups\/[^:]+\/join:\s*/i, "")
    .trim();

  return (
    cleanedMessage ||
    "Không đủ điều kiện tham gia nhóm xe ghép. Vui lòng thử nhóm khác."
  );
}

// getJoinDestinationFromGroupCard: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getJoinDestinationFromGroupCard(groupCard) {
  const rawGroup = groupCard?.rawGroup ?? {};
  const groupLatitude = Number(
    rawGroup.destinationLatitude ?? groupCard?.destinationLatitude
  );
  const groupLongitude = Number(
    rawGroup.destinationLongitude ?? groupCard?.destinationLongitude
  );

  if (Number.isFinite(groupLatitude) && Number.isFinite(groupLongitude)) {
    return {
      formattedAddress:
        rawGroup.destinationAddress ||
        groupCard?.destinationAddress ||
        groupCard?.destination ||
        "Điểm đến nhóm xe ghép",
      location: {
        lat: groupLatitude,
        lng: groupLongitude,
      },
    };
  }

  const members = Array.isArray(rawGroup.members) ? rawGroup.members : [];
  const destinationMember = members.find((member) => {
    const latitude = Number(member?.destinationLatitude);
    const longitude = Number(member?.destinationLongitude);
    return Number.isFinite(latitude) && Number.isFinite(longitude);
  });

  if (destinationMember) {
    return {
      formattedAddress:
        destinationMember.destinationAddress ||
        groupCard?.destination ||
        "Điểm đến nhóm xe ghép",
      location: {
        lat: Number(destinationMember.destinationLatitude),
        lng: Number(destinationMember.destinationLongitude),
      },
    };
  }

  const groupDirection = String(
    rawGroup.direction ?? groupCard?.rawGroup?.Direction ?? ""
  ).toLowerCase();

  if (Number(rawGroup.direction) === 1 || groupDirection === "outbound") {
    return FPT_HOLA_PLACE;
  }

  return null;
}

const initialSavedAddresses = [
  {
    id: "saved-from",
    label: "Đại học FPT, Thạch Hòa",
  },
  {
    id: "saved-to",
    label: "Bến xe Mỹ Đình",
  },
];

// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const MAX_SCHEDULE_DAYS = 7;
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const MIN_PICKUP_BUFFER_MINUTES = 30;
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const MINUTE_STEP = 5;

// padSchedule: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function padSchedule(value) {
  return String(value).padStart(2, "0");
}

// addScheduleMinutes: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function addScheduleMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

// addScheduleDays: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function addScheduleDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

// roundScheduleDate: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function roundScheduleDate(date) {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  const remainder = rounded.getMinutes() % MINUTE_STEP;

  if (remainder !== 0) {
    rounded.setMinutes(rounded.getMinutes() + MINUTE_STEP - remainder);
  }

  return rounded;
}

// getScheduleBounds: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getScheduleBounds() {
  const now = new Date();
  return {
    min: roundScheduleDate(addScheduleMinutes(now, MIN_PICKUP_BUFFER_MINUTES)),
    max: addScheduleDays(now, MAX_SCHEDULE_DAYS),
  };
}

// formatScheduleDateValue: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function formatScheduleDateValue(date) {
  return `${date.getFullYear()}-${padSchedule(date.getMonth() + 1)}-${padSchedule(date.getDate())}`;
}

// formatScheduleDisplay: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function formatScheduleDisplay(date) {
  return `${padSchedule(date.getDate())}/${padSchedule(date.getMonth() + 1)}/${date.getFullYear()}`;
}

// parseScheduleDateValue: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function parseScheduleDateValue(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// getScheduleDateLabel: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getScheduleDateLabel(date, index) {
  if (index === 0) {
    return "Hôm nay";
  }

  if (index === 1) {
    return "Ngày mai";
  }

  return formatScheduleDisplay(date);
}

// createScheduleDateOptions: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function createScheduleDateOptions() {
  const { max } = getScheduleBounds();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDay = new Date(max);
  maxDay.setHours(0, 0, 0, 0);
  const options = [];

  for (let index = 0; index <= MAX_SCHEDULE_DAYS; index += 1) {
    const date = addScheduleDays(today, index);

    if (date > maxDay) {
      break;
    }

    options.push({
      value: formatScheduleDateValue(date),
      label: getScheduleDateLabel(date, index),
      display: formatScheduleDisplay(date),
      monthLabel: `Thg ${date.getMonth() + 1}`,
      dayLabel: padSchedule(date.getDate()),
    });
  }

  return options;
}

// getSharedSlotDateTime: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getSharedSlotDateTime(dateValue, slotTime) {
  if (!dateValue || !slotTime) {
    return null;
  }

  const date = parseScheduleDateValue(dateValue);
  const [hour, minute] = slotTime.split(":").map(Number);
  date.setHours(hour || 0, minute || 0, 0, 0);
  return date;
}

// formatLocalApiDateTime: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function formatLocalApiDateTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  return [
    date.getFullYear(),
    padSchedule(date.getMonth() + 1),
    padSchedule(date.getDate()),
  ].join("-") + `T${padSchedule(date.getHours())}:${padSchedule(date.getMinutes())}:00`;
}

// isSharedSlotAvailable: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function isSharedSlotAvailable(slot, dateValue) {
  if (!dateValue) {
    return true;
  }

  const slotDateTime = getSharedSlotDateTime(dateValue, slot.time);

  if (!slotDateTime) {
    return true;
  }

  return slotDateTime.getTime() - Date.now() > MIN_PICKUP_BUFFER_MINUTES * 60 * 1000;
}

// createScheduleDate: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function createScheduleDate(dateValue, hour, minute) {
  const date = parseScheduleDateValue(dateValue);
  date.setHours(Number(hour), Number(minute), 0, 0);
  return date;
}

// isScheduleInRange: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function isScheduleInRange(date) {
  const { min, max } = getScheduleBounds();
  return date >= min && date <= max;
}

// createScheduleHourOptions: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function createScheduleHourOptions(dateValue) {
  return Array.from({ length: 24 }, (_, hour) => padSchedule(hour)).filter((hour) =>
    Array.from({ length: 60 / MINUTE_STEP }, (_, index) =>
      padSchedule(index * MINUTE_STEP)
    ).some((minute) => isScheduleInRange(createScheduleDate(dateValue, hour, minute)))
  );
}

// createScheduleMinuteOptions: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function createScheduleMinuteOptions(dateValue, hour) {
  return Array.from({ length: 60 / MINUTE_STEP }, (_, index) =>
    padSchedule(index * MINUTE_STEP)
  ).filter((minute) => isScheduleInRange(createScheduleDate(dateValue, hour, minute)));
}

// normalizeBookingSchedule: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function normalizeBookingSchedule(draft) {
  const dateOptions = createScheduleDateOptions();
  const selectedDate = dateOptions.find((option) => option.value === draft.date);
  const date = selectedDate ?? dateOptions[0];
  const hourOptions = createScheduleHourOptions(date.value);
  const hour = hourOptions.includes(draft.hour) ? draft.hour : hourOptions[0];
  const minuteOptions = createScheduleMinuteOptions(date.value, hour);
  const minute = minuteOptions.includes(draft.minute)
    ? draft.minute
    : minuteOptions[0];

  return {
    ...draft,
    date: date.value,
    dateLabel: date.label,
    dateDisplay: date.display,
    hour,
    minute,
    time: `${hour}:${minute}`,
  };
}

// getDefaultBookingSchedule: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getDefaultBookingSchedule() {
  const { min } = getScheduleBounds();
  return normalizeBookingSchedule({
    date: formatScheduleDateValue(min),
    hour: padSchedule(min.getHours()),
    minute: padSchedule(min.getMinutes()),
  });
}

// SearchScreen: Component chính của luồng tìm kiếm và đặt xe
export default function SearchScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session, isAuthenticated, refreshSession } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  // NHẬN QUERY PARAMS TỪ CÁC MÀN KHÁC
  // - Home chọn xe lẻ sẽ push /search?mode=now&when=now&source=home&vehicle={bike|car4}
  // - Home chọn xe ghép sẽ push /search?mode=shared&when=any
  // SearchScreen đọc params này để chọn mode ban đầu và preselect loại xe.
  const rawMode = getSingleParam(params.mode) ?? "now";
  const normalizedMode = rawMode === "shared" ? "shared" : "now";
  const rawVehicle = getSingleParam(params.vehicle);
  const initialRideId = availableRideOptions.some(
    (option) => option.id === rawVehicle
  )
    ? rawVehicle
    : "bike";
  const isHomeBookingFlow =
    getSingleParam(params.source) === "home" && normalizedMode === "now";

  const [mode, setMode] = useState(normalizedMode);
  // Sync `mode` khi user navigate lại tới /search với query khác (vd: đang ở /search?mode=now,
  // bấm "Xe ghép" ở Home sẽ push /search?mode=shared — cùng route nên SearchScreen không re-mount,
  // useState ban đầu giữ "now". Effect này đảm bảo mode luôn khớp với URL mới nhất.
  useEffect(() => {
    setMode(normalizedMode);
  }, [normalizedMode]);
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [focusedField, setFocusedField] = useState("from");
  const [bookingStep, setBookingStep] = useState("form");
  const [alertMessage, setAlertMessage] = useState("");
  const [driverNote, setDriverNote] = useState("");
  const [selectedRideId, setSelectedRideId] = useState(initialRideId);
  const [ridePriceQuotes, setRidePriceQuotes] = useState({});
  const [isLoadingRidePrices, setIsLoadingRidePrices] = useState(false);
  const [ridePriceError, setRidePriceError] = useState("");
  const fromInputRef = useRef(null);
  const toInputRef = useRef(null);
  const sharedLocationPickedRef = useRef("");
  const joinSharedLocationPickedRef = useRef("");
  const sharedRefreshSequenceRef = useRef(0);
  const hasEditedFromInputRef = useRef(false);
  const [isVerifyingMap, setIsVerifyingMap] = useState(false);
  const [isOpeningSchedulePicker, setIsOpeningSchedulePicker] = useState(false);
  const [isFetchingCurrentLocation, setIsFetchingCurrentLocation] = useState(false);
  const [verifiedTripMap, setVerifiedTripMap] = useState(null);
  const [selectedFromPlace, setSelectedFromPlace] = useState(null);
  const [selectedToPlace, setSelectedToPlace] = useState(null);
  const [addressSuggestions, setAddressSuggestions] = useState({
    from: [],
    to: [],
  });
  const [suggestionError, setSuggestionError] = useState({
    from: "",
    to: "",
  });
  const [loadingSuggestionsFor, setLoadingSuggestionsFor] = useState("");
  const [schedulePickerVisible, setSchedulePickerVisible] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState(getDefaultBookingSchedule);
  const [scheduledRideTime, setScheduledRideTime] = useState("");
  const [scheduledRideAt, setScheduledRideAt] = useState("");
  const [pendingSharedRequests, setPendingSharedRequests] = useState([]);
  const [availableSharedGroups, setAvailableSharedGroups] = useState([]);
  const [sharedRequestFilter, setSharedRequestFilter] = useState("booked");
  const [createSharedVisible, setCreateSharedVisible] = useState(false);
  const [sharedForm, setSharedForm] = useState(defaultSharedForm);
  const [openSharedDropdown, setOpenSharedDropdown] = useState("");
  const [sharedFormError, setSharedFormError] = useState("");
  const [sharedCancelError, setSharedCancelError] = useState("");
  const [sharedLocationSuggestions, setSharedLocationSuggestions] = useState([]);
  const [sharedLocationLoading, setSharedLocationLoading] = useState(false);
  const [sharedLocationError, setSharedLocationError] = useState("");
  const [selectedSharedPlace, setSelectedSharedPlace] = useState(null);
  const [joinSharedGroup, setJoinSharedGroup] = useState(null);
  const [joinSharedPickup, setJoinSharedPickup] = useState("");
  const [joinSharedPlace, setJoinSharedPlace] = useState(null);
  const [joinSharedSuggestions, setJoinSharedSuggestions] = useState([]);
  const [joinSharedLocationLoading, setJoinSharedLocationLoading] = useState(false);
  const [joinSharedError, setJoinSharedError] = useState("");
  const [isJoiningSharedGroup, setIsJoiningSharedGroup] = useState(false);
  const [isLoadingSharedState, setIsLoadingSharedState] = useState(false);
  const [isCreatingSharedRequest, setIsCreatingSharedRequest] = useState(false);
  const [cancellingSharedRequestId, setCancellingSharedRequestId] = useState("");
  const [extendingSharedRequestId, setExtendingSharedRequestId] = useState("");
  const [isBookingRide, setIsBookingRide] = useState(false);
  const [isCancellingRide, setIsCancellingRide] = useState(false);
  const [isExtendingSoloSearch, setIsExtendingSoloSearch] = useState(false);
  const [activeBookedRide, setActiveBookedRide] = useState(null);
  const [acceptedTrip, setAcceptedTrip] = useState(null);
  const [noDriverPromptNowMs, setNoDriverPromptNowMs] = useState(() =>
    Date.now()
  );
  const [dismissedNoDriverPromptIds, setDismissedNoDriverPromptIds] = useState(
    {}
  );
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewedTripIds, setReviewedTripIds] = useState({});
  const [savedAddresses, setSavedAddresses] = useState(initialSavedAddresses);
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [addressForm, setAddressForm] = useState(defaultAddressForm);
  const [editingAddressId, setEditingAddressId] = useState("");
  const [addressFormError, setAddressFormError] = useState("");
  const [openAddressMenuId, setOpenAddressMenuId] = useState("");
  const deferredFrom = useDeferredValue(fromInput);
  const deferredTo = useDeferredValue(toInput);
  const suggestedSharedRides = availableSharedGroups;
  // Tách nhóm đã vào (request có groupId) và yêu cầu đang chờ ghép (chưa có groupId)
  // để render 2 section riêng, tránh trộn status "Đã vào nhóm" / "Chưa vào nhóm" trong cùng một danh sách.
  const filteredSharedRequests = pendingSharedRequests
    .filter((request) => isRideSharingCardOwnedByUser(request, session?.userId))
    .filter((request) => {
      const effectiveStatus = getSharedRequestEffectiveStatus(request);
      return getSharedRequestFilterKey(effectiveStatus) === sharedRequestFilter;
    });
  const myJoinedSharedGroups = filteredSharedRequests.filter(
    (request) => Boolean(request.groupId)
  );
  const waitingSharedRequests = filteredSharedRequests.filter(
    (request) => !request.groupId
  );
  const selectedSharedRequestFilterLabel =
    sharedRequestFilterOptions.find((option) => option.id === sharedRequestFilter)
      ?.label ?? "Đã đặt";
  const backendTripMetrics = getBackendTripMetrics(verifiedTripMap);
  const trackedTripStatus = normalizeTripStatus(
    acceptedTrip?.status ?? activeBookedRide?.status
  );
  const hasAssignedDriver = Boolean(
    acceptedTrip?.driverId ?? activeBookedRide?.driverId
  );
  const tripStatusView = getTripStatusView(trackedTripStatus, hasAssignedDriver);
  const isNoDriverFoundTrip = isNoDriverFoundTripStatus(trackedTripStatus);
  const shouldShowTripStatusCard =
    hasAssignedDriver || isTerminalTripStatus(trackedTripStatus);
  const canCancelTrackedTrip =
    trackedTripStatus === "pending" ||
    trackedTripStatus === "accepted" ||
    trackedTripStatus === "driverarrived";
  const isCompletedTrip = trackedTripStatus === "completed";
  const isSoloRideTrackingLocked =
    mode !== "shared" &&
    bookingStep === "findingDriver" &&
    ["pending", "pendingdriverassignment", "accepted", "driverarrived", "inprogress"].includes(
      trackedTripStatus
    );
  const isSoloRideInProgress =
    isSoloRideTrackingLocked && trackedTripStatus === "inprogress";
  const selectedRideOption =
    availableRideOptions.find((option) => option.id === selectedRideId) ??
    availableRideOptions[0];
  const selectedRidePrice = ridePriceQuotes[selectedRideOption.id] ?? "";
  const completedDbFare = getTripEstimatedFare(acceptedTrip);
  const completedFare =
    completedDbFare != null
      ? formatCurrencyVnd(Number(completedDbFare))
      : activeBookedRide?.estimatedFare ?? selectedRidePrice ?? "--";
  const completedAtText = formatTripDateTime(
    acceptedTrip?.completedAt ?? activeBookedRide?.completedAt
  );
  const completedTripId = acceptedTrip?.id ?? activeBookedRide?.id ?? "";
  const hasReviewedCompletedTrip = Boolean(
    completedTripId && reviewedTripIds[completedTripId]
  );
  const activeRidePromptId = activeBookedRide?.id
    ? `solo:${activeBookedRide.id}`
    : "";
  const shouldShowSoloNoDriverPrompt =
    Boolean(activeRidePromptId) &&
    bookingStep === "findingDriver" &&
    mode !== "shared" &&
    !hasAssignedDriver &&
    !activeBookedRide?.scheduledAt &&
    ["pending", "pendingdriverassignment"].includes(trackedTripStatus) &&
    hasWaitedLongerThanPromptDelay(
      activeBookedRide?.createdAt,
      noDriverPromptNowMs
    ) &&
    !dismissedNoDriverPromptIds[activeRidePromptId];
  const shouldShowSharedNoDriverPrompt = useCallback(
    (request) => {
      const requestId = request?.requestId || request?.id;
      const promptId = requestId ? `shared:${requestId}` : "";

      return (
        Boolean(promptId) &&
        isImmediateTripType(request?.tripType) &&
        isSharedRideActive(getSharedRequestEffectiveStatus(request)) &&
        !request?.driverId &&
        hasWaitedLongerThanPromptDelay(
          request?.createdAt,
          noDriverPromptNowMs
        ) &&
        !dismissedNoDriverPromptIds[promptId]
      );
    },
    [dismissedNoDriverPromptIds, noDriverPromptNowMs]
  );

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNoDriverPromptNowMs(Date.now());
    }, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (isHomeBookingFlow && selectedRideId !== initialRideId) {
      setSelectedRideId(initialRideId);
    }
  }, [initialRideId, isHomeBookingFlow, selectedRideId]);

  useEffect(() => {
    if (!isSoloRideTrackingLocked) {
      return undefined;
    }

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true
    );

    return () => backHandler.remove();
  }, [isSoloRideTrackingLocked]);

  const refreshSharedState = useCallback(
    async ({ showLoading = false } = {}) => {
      const refreshSequence = ++sharedRefreshSequenceRef.current;

      if (mode !== "shared" || !session?.accessToken) {
        setPendingSharedRequests([]);
        setAvailableSharedGroups([]);
        return;
      }

      if (showLoading) {
        setIsLoadingSharedState(true);
      }

      try {
        // refreshSharedState: LUỒNG NHẬN DỮ LIỆU XE GHÉP
        // 1. Gọi song song các API BE:
        //    - request hiện tại của khách
        //    - group khách đang tham gia
        //    - group còn trống chiều đi FPT và chiều về
        // 2. Đọc thêm card đã cache local để UI vẫn có dữ liệu khi reload.
        // 3. Map request/group BE thành card UI rồi setPendingSharedRequests/setAvailableSharedGroups.
        const [
          requestResult,
          groupResult,
          outboundGroupsResult,
          inboundGroupsResult,
          storedCardsResult,
        ] =
          await Promise.allSettled([
          getMyRideSharingRequest(session.accessToken),
          getMyRideSharingGroup(session.accessToken),
          getAvailableRideSharingGroups(1, session.accessToken),
          getAvailableRideSharingGroups(2, session.accessToken),
          loadStoredRideSharingCards(session.userId),
        ]);

        // Kết quả Promise.allSettled có thể fail từng API riêng; API lỗi sẽ được thay bằng null/[] để màn không crash.
        const request =
          requestResult.status === "fulfilled" ? requestResult.value : null;
        const group =
          groupResult.status === "fulfilled" ? groupResult.value : null;
        // Nếu request đã được ghép group, gọi thêm chi tiết group để lấy members/status/fare mới nhất.
        const requestGroup = await getRideSharingGroupForRequest(
          request,
          group,
          session.accessToken
        );
        const availableGroups = [
          ...(outboundGroupsResult.status === "fulfilled"
            ? outboundGroupsResult.value
            : []),
          ...(inboundGroupsResult.status === "fulfilled"
            ? inboundGroupsResult.value
            : []),
        ].filter(
          (group, index, groups) =>
            group?.id &&
            groups.findIndex((item) => String(item?.id) === String(group.id)) ===
              index
        );
        const storedCards =
          storedCardsResult.status === "fulfilled"
            ? storedCardsResult.value.filter((card) =>
                isRideSharingCardOwnedByUser(card, session.userId)
              )
            : [];
        const refreshedStoredCards = (
          await refreshStoredRideSharingCards(storedCards, session.accessToken)
        ).filter((card) => isRideSharingCardOwnedByUser(card, session.userId));
        // Với danh sách group available, gọi chi tiết từng group để card hiển thị đủ currentPassengers/driver/fare.
        const availableGroupDetails = await Promise.allSettled(
          availableGroups.map((item) =>
            getRideSharingGroup(item.id, session.accessToken)
          )
        );
        const mappedRequest = mapRideSharingRequestToCardClean(
          request,
          requestGroup
        );
        const mappedGroup = mapRideSharingGroupToCard(requestGroup);
        const currentGroupId = String(
          requestGroup?.id ?? request?.groupId ?? ""
        ).toLowerCase();
        const mappedAvailableGroups = availableGroups
          .map((item, index) => {
            const detailedGroup = availableGroupDetails[index];

            if (detailedGroup?.status === "fulfilled" && detailedGroup.value?.id) {
              return (
                mapRideSharingGroupToCard(detailedGroup.value, {
                  previewJoinFare: true,
                }) ?? mapAvailableRideSharingGroupToCard(item)
              );
            }

            return mapAvailableRideSharingGroupToCard(item);
          })
          .filter(Boolean)
          .filter(
            (item) =>
              String(item.groupId ?? "").toLowerCase() !== currentGroupId
          )
          // Loại nhóm đã đủ người (currentPassengers >= maxPassengers) khỏi đề xuất;
          // nhóm sẽ tự xuất hiện lại khi có thành viên rời.
          .filter((item) => {
            const currentCount = Number(item?.participantCount) || 0;
            const maxCount = Number(item?.capacity) || 0;
            if (maxCount <= 0) {
              return true;
            }
            return currentCount < maxCount;
          });

        const currentCards = mappedRequest
          ? [mappedRequest]
          : mappedGroup
            ? [mappedGroup]
            : [];
        const mergedCards = mergeSharedRequestCards(
          currentCards,
          refreshedStoredCards
        );

        if (refreshSequence !== sharedRefreshSequenceRef.current) {
          return;
        }

        // Đẩy request/group của chính user vào state đang chờ để render tab "Yêu cầu của tôi".
        setPendingSharedRequests(mergedCards);

        if (currentCards.length > 0 || refreshedStoredCards.length > 0) {
          persistRideSharingCards(
            mergeSharedRequestCards(currentCards, refreshedStoredCards),
            session.userId
          ).catch(() => {});
        }

        // Đẩy các group người dùng có thể join vào state gợi ý.
        setAvailableSharedGroups(mappedAvailableGroups);
      } finally {
        if (
          showLoading &&
          refreshSequence === sharedRefreshSequenceRef.current
        ) {
          setIsLoadingSharedState(false);
        }
      }
    },
    [mode, session?.accessToken, session?.userId]
  );

  useEffect(() => {
    if (mode === "shared" || bookingStep !== "form") {
      return undefined;
    }

    const query = focusedField === "from" ? deferredFrom : deferredTo;

    if (query.trim().length < 2) {
      return undefined;
    }

    let isActive = true;
    const timeoutId = setTimeout(async () => {
      if (!isMapConfigured()) {
        return;
      }

      setLoadingSuggestionsFor(focusedField);

      try {
        const suggestions = await getMapPlaceSuggestions(query);

        if (isActive) {
          setAddressSuggestions((current) => ({
            ...current,
            [focusedField]: suggestions,
          }));
          setSuggestionError((current) => ({
            ...current,
            [focusedField]: suggestions.length ? "" : "Chưa có gợi ý phù hợp, thử nhập rõ hơn tên đường/quận.",
          }));
        }
      } catch (error) {
        if (isActive) {
          setAddressSuggestions((current) => ({
            ...current,
            [focusedField]: [],
          }));
          setSuggestionError((current) => ({
            ...current,
            [focusedField]:
              error.message || "Không tải được gợi ý. Kiểm tra API bản đồ trong VietMap.",
          }));
        }
      } finally {
        if (isActive) {
          setLoadingSuggestionsFor("");
        }
      }
    }, 350);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [bookingStep, deferredFrom, deferredTo, focusedField, mode]);

  const fallbackTrackedTripDistanceText = backendTripMetrics?.distanceText;
  const fallbackTrackedTripDurationText = backendTripMetrics?.durationText;

  useEffect(() => {
    if (
      bookingStep !== "findingDriver" ||
      !activeBookedRide?.id ||
      isTerminalTripStatus(acceptedTrip?.status) ||
      !session?.accessToken
    ) {
      return undefined;
    }

    let isActive = true;

    const loadTripStatus = async () => {
      try {
        const trip = await getTrip(activeBookedRide.id, session.accessToken);
        const shouldUpdateTrip =
          Boolean(trip?.driverId) ||
          normalizeTripStatus(trip?.status) !== "pending";

        if (isActive && shouldUpdateTrip) {
          setAcceptedTrip(trip);
          setActiveBookedRide((current) => {
            const nextBookedRide = mergeBookedRideWithTrip(
              {
                ...(current ?? {}),
                tripDistance:
                  current?.tripDistance ?? fallbackTrackedTripDistanceText,
                tripDuration:
                  current?.tripDuration ?? fallbackTrackedTripDurationText,
              },
              trip
            );

            void persistBookedTrip(nextBookedRide);
            return nextBookedRide;
          });
        }
      } catch {
        // Bo qua loi tam thoi trong luc BE/driver chua cap nhat trang thai.
      }
    };

    loadTripStatus();
    const intervalId = setInterval(loadTripStatus, 3000);

    return () => {
      isActive = false;
      clearInterval(intervalId);
    };
  }, [
    activeBookedRide?.id,
    acceptedTrip?.status,
    bookingStep,
    fallbackTrackedTripDistanceText,
    fallbackTrackedTripDurationText,
    session?.accessToken,
  ]);

  useEffect(() => {
    if (mode === "shared" || !session?.accessToken || activeBookedRide?.id) {
      return undefined;
    }

    let isActive = true;

    const restoreActiveTrip = async () => {
      try {
        const bookedTrips = await loadBookedTrips();
        const candidateTrips = bookedTrips
          .filter((trip) => trip?.id && !trip?.scheduledAt)
          .filter((trip) => !isTerminalTripStatus(trip.status))
          .sort(
            (first, second) =>
              new Date(second.createdAt ?? 0).getTime() -
              new Date(first.createdAt ?? 0).getTime()
          );

        for (const bookedTrip of candidateTrips) {
          try {
            const trip = await getTrip(bookedTrip.id, session.accessToken);
            const normalizedStatus = normalizeTripStatus(
              trip?.status ?? bookedTrip.status
            );

            if (!isActive) {
              return;
            }

            if (!isTerminalTripStatus(normalizedStatus)) {
              setAcceptedTrip(trip ?? null);
              setActiveBookedRide(mergeBookedRideWithTrip(bookedTrip, trip));
              setBookingStep("findingDriver");
              setMode("now");
              return;
            }
          } catch {
            // Bo qua record local khong con tim thay tren BE, thu record tiep theo.
          }
        }
      } catch {
        // Khong chan nguoi dung dat xe moi neu local storage tam thoi loi.
      }
    };

    restoreActiveTrip();

    return () => {
      isActive = false;
    };
  }, [activeBookedRide?.id, mode, session?.accessToken]);

  useEffect(() => {
    if (!sharedForm.slotId || !sharedForm.date) {
      return;
    }

    const direction =
      sharedDirectionByTripType[sharedForm.tripType] ??
      sharedDirectionByTripType[sharedTripTypes[0]];
    const directionSlots = sharedSlotOptionsByDirection[direction] ?? [];
    const selectedSlot = directionSlots.find(
      (slot) => slot.id === sharedForm.slotId
    );

    if (selectedSlot && !isSharedSlotAvailable(selectedSlot, sharedForm.date)) {
      updateSharedForm("slotId", "");
    }
  }, [sharedForm.date, sharedForm.slotId, sharedForm.tripType]);

  useEffect(() => {
    if (!createSharedVisible) {
      return undefined;
    }

    const query = sharedForm.location.trim();

    if (query && query === sharedLocationPickedRef.current) {
      return undefined;
    }

    if (query.length < 2) {
      setSharedLocationSuggestions([]);
      setSharedLocationError("");
      setSharedLocationLoading(false);
      return undefined;
    }

    let isActive = true;
    const timeoutId = setTimeout(async () => {
      if (!isMapConfigured()) {
        return;
      }

      setSharedLocationLoading(true);

      try {
        const suggestions = await getMapPlaceSuggestions(query);

        if (isActive) {
          setSharedLocationSuggestions(suggestions);
          setSharedLocationError(
            suggestions.length
              ? ""
              : "Chưa có gợi ý phù hợp, thử nhập rõ hơn tên đường/quận."
          );
        }
      } catch (error) {
        if (isActive) {
          setSharedLocationSuggestions([]);
          setSharedLocationError(
            error.message || "Không tải được gợi ý. Kiểm tra API bản đồ trong VietMap."
          );
        }
      } finally {
        if (isActive) {
          setSharedLocationLoading(false);
        }
      }
    }, 350);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [createSharedVisible, sharedForm.location]);

  useEffect(() => {
    if (!joinSharedGroup) {
      return undefined;
    }

    const query = joinSharedPickup.trim();

    if (query && query === joinSharedLocationPickedRef.current) {
      return undefined;
    }

    if (query.length < 2) {
      setJoinSharedSuggestions([]);
      setJoinSharedError("");
      setJoinSharedLocationLoading(false);
      return undefined;
    }

    let isActive = true;
    const timeoutId = setTimeout(async () => {
      if (!isMapConfigured()) {
        return;
      }

      setJoinSharedLocationLoading(true);

      try {
        const suggestions = await getMapPlaceSuggestions(query);

        if (isActive) {
          setJoinSharedSuggestions(suggestions);
          setJoinSharedError(
            suggestions.length
              ? ""
              : "Chưa có gợi ý phù hợp, thử nhập rõ hơn tên đường/quận."
          );
        }
      } catch (error) {
        if (isActive) {
          setJoinSharedSuggestions([]);
          setJoinSharedError(
            error.message || "Không tải được gợi ý. Kiểm tra API bản đồ trong VietMap."
          );
        }
      } finally {
        if (isActive) {
          setJoinSharedLocationLoading(false);
        }
      }
    }, 350);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [joinSharedGroup, joinSharedPickup]);

  useEffect(() => {
    if (mode !== "shared" || !session?.accessToken) {
      setPendingSharedRequests([]);
      return undefined;
    }

    let isActive = true;

    const refreshIfActive = async (options) => {
      if (isActive) {
        await refreshSharedState(options);
      }
    };

    refreshIfActive({ showLoading: true });
    const intervalId = setInterval(() => {
      refreshIfActive({ showLoading: false });
    }, 5000);

    return () => {
      isActive = false;
      clearInterval(intervalId);
    };
  }, [mode, refreshSharedState, session?.accessToken]);

  useEffect(() => {
    if (bookingStep !== "rideOptions" || !verifiedTripMap) {
      setRidePriceQuotes({});
      setRidePriceError("");
      setIsLoadingRidePrices(false);
      return undefined;
    }

    const tripMetrics = getBackendTripMetrics(verifiedTripMap);
    const distanceKm = tripMetrics?.distanceKm ?? 0;
    const durationMinute = tripMetrics?.durationMinute ?? 0;

    if (distanceKm <= 0 || durationMinute <= 0) {
      setRidePriceQuotes({});
      setRidePriceError("Không thể tính giá từ quãng đường hiện tại.");
      setIsLoadingRidePrices(false);
      return undefined;
    }

    let isActive = true;

    // loadRidePrices: GỬI distance/duration/vehicleType lên Pricing API để nhận giá từng loại xe.
    const loadRidePrices = async () => {
      setIsLoadingRidePrices(true);
      setRidePriceError("");

      try {
        const results = await Promise.all(
          availableRideOptions.map(async (option) => {
            try {
              // Payload gửi sang /pricing/estimate; response nhận estimatedFare cho option hiện tại.
              const response = await estimateFare({
                vehicleType: option.vehicleType,
                rideType: "SingleRide",
                estimatedDistanceKm: distanceKm,
                estimatedDurationMinute: durationMinute,
              });

              return [option.id, response.estimatedFare];
            } catch {
              return [option.id, null];
            }
          })
        );

        if (isActive) {
          // Map response giá theo id loại xe để UI chọn xe đọc nhanh: { bike: "xxđ", car4: "yyđ" }.
          setRidePriceQuotes(
            Object.fromEntries(
              results.map(([id, fare]) => [id, fare == null ? null : formatCurrencyVnd(fare)])
            )
          );
        }
      } catch (error) {
        if (isActive) {
          setRidePriceQuotes({});
          setRidePriceError(error.message || "Không tải được giá cước từ BE.");
        }
      } finally {
        if (isActive) {
          setIsLoadingRidePrices(false);
        }
      }
    };

    loadRidePrices();

    return () => {
      isActive = false;
    };
  }, [bookingStep, verifiedTripMap]);

  const selectSingleRide = () => {
    setMode("now");
    setBookingStep(activeBookedRide?.id ? "findingDriver" : "form");
    setScheduledRideTime("");
    setScheduledRideAt("");
  };

  const selectSharedRide = () => {
    setMode("shared");
    setBookingStep("form");
    setAlertMessage("");
    setScheduledRideTime("");
    setScheduledRideAt("");
  };

  const fromLabel = fromInput.trim() || "Vị trí hiện tại";
  const toLabel = toInput.trim() || "Đại học FPT, Thạch Hòa";
  const verifiedFromLabel =
    verifiedTripMap?.origin.formattedAddress ?? fromLabel;
  const verifiedToLabel =
    verifiedTripMap?.destination.formattedAddress ?? toLabel;
  const scheduleDateOptions = createScheduleDateOptions();
  const selectedScheduleDate =
    scheduleDateOptions.find((option) => option.value === scheduleDraft.date) ??
    scheduleDateOptions[0];
  const selectedSharedDate = scheduleDateOptions.find(
    (option) => option.value === sharedForm.date
  );
  const selectedSharedDirection =
    sharedDirectionByTripType[sharedForm.tripType] ??
    sharedDirectionByTripType[sharedTripTypes[0]];
  const sharedSlotOptions =
    sharedSlotOptionsByDirection[selectedSharedDirection]?.slice(0, 4) ?? [];
  const availableSharedSlotOptions = sharedSlotOptions.filter((slot) =>
    isSharedSlotAvailable(slot, selectedSharedDate?.value)
  );
  const selectedSharedSlot = availableSharedSlotOptions.find(
    (option) => option.id === sharedForm.slotId
  );
  const isScheduledSharedRide = sharedForm.rideMode !== "immediate";
  const sharedCalendarPreview = selectedSharedDate ?? scheduleDateOptions[0];
  const sharedScheduleSummaryBase =
    selectedSharedSlot && selectedSharedDate
      ? `Xe ghép lúc ${selectedSharedSlot.time} • ${selectedSharedDate.display} (${selectedSharedDate.label})`
      : "Chọn slot và ngày đi để hoàn tất yêu cầu.";
  const isSharedTripToFpt = selectedSharedDirection === 1;
  const sharedLocationLabel = isSharedTripToFpt ? "Điểm đón" : "Điểm đến";
  const sharedLocationPlaceholder = isSharedTripToFpt
    ? "VD: Trạm xe, Đường XYZ..."
    : "VD: Bến xe Mỹ Đình, Xuân Mai...";
  const sharedScheduleSummary = isScheduledSharedRide
    ? sharedScheduleSummaryBase
    : "Ghép tức thì, hệ thống sẽ tìm nhóm phù hợp ngay sau khi bạn gửi yêu cầu.";
  const scheduleHourOptions = createScheduleHourOptions(selectedScheduleDate.value);
  const scheduleMinuteOptions = createScheduleMinuteOptions(
    selectedScheduleDate.value,
    scheduleDraft.hour
  );
  const pickupDate = createScheduleDate(
    selectedScheduleDate.value,
    scheduleDraft.hour,
    scheduleDraft.minute
  );
  const scheduleDisplayText = `${scheduleDraft.time} • ${scheduleDraft.dateDisplay} (${scheduleDraft.dateLabel})`;
  const pickupMapHtml = verifiedTripMap
    ? buildMapInteractiveMapHtml({
        center: verifiedTripMap.origin.location,
        markers: [
          {
            lat: verifiedTripMap.origin.location.lat,
            lng: verifiedTripMap.origin.location.lng,
            popupText: verifiedTripMap.origin.formattedAddress,
          },
        ],
        zoom: 17,
        draggableMarkerIndex: 0,
      })
    : "";
  const routeMapHtml = verifiedTripMap
    ? buildMapInteractiveMapHtml({
        center: verifiedTripMap.origin.location,
        markers: [
          {
            lat: verifiedTripMap.origin.location.lat,
            lng: verifiedTripMap.origin.location.lng,
            popupText: verifiedTripMap.origin.formattedAddress,
          },
          {
            lat: verifiedTripMap.destination.location.lat,
            lng: verifiedTripMap.destination.location.lng,
            popupText: verifiedTripMap.destination.formattedAddress,
          },
        ],
        routeGeometry: verifiedTripMap.directions.routeGeometry,
        zoom: 14,
        fitPadding: {
          paddingTopLeft: [28, 84],
          paddingBottomRight: [28, 36],
          maxZoom: 15,
        },
      })
    : "";

  const requireLogin = () => {
    if (isAuthenticated) {
      return true;
    }

    // Nếu chưa đăng nhập mà user bấm đặt xe/tạo xe ghép, chuyển sang /profile để lấy session trước.
    router.push("/profile");
    return false;
  };

  const syncAddressInputText = (field, nextValue) => {
    if (field === "from") {
      setFromInput(nextValue);
      return;
    }

    setToInput(nextValue);
  };

  const clearAddressField = (field) => {
    if (field === "from") {
      hasEditedFromInputRef.current = true;
      setFromInput("");
      setSelectedFromPlace(null);
    } else {
      setToInput("");
      setSelectedToPlace(null);
    }

    setVerifiedTripMap(null);
    setAddressSuggestions((current) => ({
      ...current,
      [field]: [],
    }));
    setSuggestionError((current) => ({
      ...current,
      [field]: "",
    }));
    setAlertMessage("");
    setFocusedField(field);

    if (field === "from") {
      fromInputRef.current?.focus();
    } else {
      toInputRef.current?.focus();
    }
  };

  const resolvePlaceSuggestion = async (suggestion) => {
    if (!suggestion?.placeId && !suggestion?.location) {
      throw new Error("Không tìm thấy thông tin địa chỉ từ VietMap.");
    }

    if (suggestion.location) {
      return {
        ...suggestion,
        description: suggestion.formattedAddress || suggestion.description,
        formattedAddress: suggestion.formattedAddress || suggestion.description,
      };
    }

    const place = await getMapPlaceDetails(suggestion.placeId);

    return {
      ...suggestion,
      placeId: place.placeId,
      description: place.formattedAddress || suggestion.description,
      formattedAddress: place.formattedAddress || suggestion.description,
      location: place.location,
    };
  };

  const resolveSavedAddress = async (label) => {
    const suggestions = await getMapPlaceSuggestions(label);
    const normalizedLabel = label.trim().toLowerCase();
    const matchedSuggestion =
      suggestions.find((suggestion) => {
        const suggestionText = (suggestion.description || "").trim().toLowerCase();
        const mainText = (suggestion.mainText || "").trim().toLowerCase();

        return (
          suggestionText === normalizedLabel ||
          mainText === normalizedLabel ||
          suggestionText.includes(normalizedLabel) ||
          normalizedLabel.includes(suggestionText)
        );
      }) ?? suggestions[0];

    if (!matchedSuggestion) {
      throw new Error(`Không tìm thấy địa chỉ "${label}" trên VietMap.`);
    }

    return resolvePlaceSuggestion(matchedSuggestion);
  };

  const resolveCurrentLocationPlace = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();

    if (permission.status !== "granted") {
      throw new Error("Vui lòng cho phép truy cập vị trí để lấy điểm đón.");
    }

    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      throw new Error("Thiết bị đang tắt dịch vụ vị trí. Vui lòng bật GPS rồi thử lại.");
    }

    let position = null;
    try {
      position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
    } catch {
      position = await Location.getLastKnownPositionAsync();
    }

    if (!position?.coords) {
      throw new Error(
        "Không thể lấy vị trí hiện tại. Hãy kiểm tra GPS hoặc đặt lại vị trí trên máy ảo rồi thử lại."
      );
    }

    const location = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
    const fallbackPlace = {
      placeId: "",
      formattedAddress: "Vị trí hiện tại",
      description: "Vị trí hiện tại",
      mainText: "Vị trí hiện tại",
      location,
    };

    if (!isMapConfigured()) {
      return fallbackPlace;
    }

    try {
      const reversedPlace = await reverseMapPlaceLocation(location);
      const reversedAddress =
        reversedPlace.formattedAddress ||
        reversedPlace.description ||
        reversedPlace.mainText ||
        "";

      if (!reversedAddress.trim()) {
        throw new Error("VietMap không trả về địa chỉ cho tọa độ hiện tại.");
      }

      return {
        ...fallbackPlace,
        ...reversedPlace,
        formattedAddress: reversedAddress || fallbackPlace.formattedAddress,
        description: reversedAddress || reversedPlace.description || fallbackPlace.description,
        mainText: reversedPlace.mainText || reversedAddress || fallbackPlace.mainText,
        location: reversedPlace.location || location,
      };
    } catch {
      try {
        const [deviceAddress] = await Location.reverseGeocodeAsync({
          latitude: location.lat,
          longitude: location.lng,
        });
        const formattedAddress = formatDeviceReverseAddress(deviceAddress);

        if (formattedAddress) {
          return {
            ...fallbackPlace,
            formattedAddress,
            description: formattedAddress,
            mainText: formattedAddress,
          };
        }
      } catch {
        // Neu ca VietMap va he thong deu khong reverse duoc, dung fallback an toan.
      }

      try {
        const nearbySuggestions = await getMapPlaceSuggestions(
          `${location.lat}, ${location.lng}`
        );
        const nearbyPlace = nearbySuggestions.find(
          (suggestion) =>
            suggestion.formattedAddress ||
            suggestion.description ||
            suggestion.mainText
        );
        const nearbyAddress =
          nearbyPlace?.formattedAddress ||
          nearbyPlace?.description ||
          nearbyPlace?.mainText ||
          "";

        if (nearbyAddress) {
          return {
            ...fallbackPlace,
            ...nearbyPlace,
            formattedAddress: nearbyAddress,
            description: nearbyAddress,
            mainText: nearbyPlace.mainText || nearbyAddress,
            location: nearbyPlace.location || location,
          };
        }
      } catch {
        // Neu VietMap khong tim duoc dia chi gan toa do, hien toa do de user biet GPS dang o dau.
      }

      const coordinateAddress = formatCoordinateAddress(location);

      return {
        ...fallbackPlace,
        formattedAddress: coordinateAddress || fallbackPlace.formattedAddress,
        description: coordinateAddress || fallbackPlace.description,
        mainText: coordinateAddress || fallbackPlace.mainText,
      };
    }
  };

  const useCurrentLocationAsPickup = async () => {
    if (isFetchingCurrentLocation) {
      return;
    }

    setIsFetchingCurrentLocation(true);
    setAlertMessage("");

    try {
      const resolvedPlace = await resolveCurrentLocationPlace();
      syncAddressInputText("from", resolvedPlace.formattedAddress);
      setSelectedFromPlace(resolvedPlace);
      setFocusedField("to");
      setAddressSuggestions((current) => ({
        ...current,
        from: [],
      }));
      setSuggestionError((current) => ({
        ...current,
        from: "",
      }));

      if (selectedToPlace) {
        await refreshVerifiedTripWithPickup(resolvedPlace);
      }
    } catch (error) {
      setAlertMessage(error.message || "Không thể lấy vị trí hiện tại.");
    } finally {
      setIsFetchingCurrentLocation(false);
    }
  };

  const refreshVerifiedTripWithPickup = async (nextOrigin) => {
    if (!selectedToPlace) {
      return;
    }

    setIsVerifyingMap(true);

    try {
      const nextVerifiedTripMap = await createVerifiedTripMap(nextOrigin, selectedToPlace);
      setVerifiedTripMap(nextVerifiedTripMap);
      setAlertMessage("");
    } catch (error) {
      setAlertMessage(error.message || "Không thể cập nhật bản đồ sau khi đổi điểm đón.");
    } finally {
      setIsVerifyingMap(false);
    }
  };

  const applyPickupMarkerDrag = async ({ location, formattedAddress }) => {
    if (!location) {
      return;
    }

    try {
      const resolvedPlace = formattedAddress
        ? {
            ...(selectedFromPlace ?? {}),
            placeId: selectedFromPlace?.placeId ?? "",
            formattedAddress,
            description: formattedAddress,
            mainText: formattedAddress,
            location,
          }
        : await reverseMapPlaceLocation(location);

      syncAddressInputText("from", resolvedPlace.formattedAddress);
      setSelectedFromPlace(resolvedPlace);
      setFocusedField("to");
      await refreshVerifiedTripWithPickup(resolvedPlace);
    } catch (error) {
      setAlertMessage(error.message || "Không thể cập nhật điểm đón từ bản đồ.");
    }
  };

  const handlePickupMapMessage = (event) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);

      if (payload?.type !== "pickup_marker_drag_end") {
        return;
      }

      applyPickupMarkerDrag(payload);
    } catch {
      // Ignore malformed messages from the WebView.
    }
  };

  const createVerifiedTripMap = async (
    origin,
    destination,
    vehicleType = selectedRideOption.vehicleType
  ) => {
    // createVerifiedTripMap: NHẬN điểm đón/điểm đến đã chọn từ VietMap.
    // Gửi 2 request tới map service:
    // - origin -> destination để lấy route chính cho khách.
    // - mock driver -> origin để mô phỏng đoạn tài xế tới đón.
    const directions = await getMapDirections(origin, destination, vehicleType);
    const driverDirections = await getMapDirections(MOCK_DRIVER_POINT, origin, vehicleType);

    return {
      origin,
      destination,
      driverOrigin: MOCK_DRIVER_POINT,
      vehicleProfile: directions.vehicleProfile,
      directions,
      driverDirections,
      mapImageUrl: getMapStaticMapUrl({
        origin,
        destination,
        routeGeometry: directions.routeGeometry,
      }),
      pickupMapImageUrl: getMapPlaceMapUrl({
        point: origin,
      }),
      driverMapImageUrl: getMapStaticMapUrl({
        origin: MOCK_DRIVER_POINT,
        destination: origin,
        routeGeometry: driverDirections.routeGeometry,
      }),
    };
  };

  const selectRideOption = async (option) => {
    setSelectedRideId(option.id);

    if (
      mode === "shared" ||
      !["confirm", "rideOptions"].includes(bookingStep) ||
      !verifiedTripMap?.origin ||
      !verifiedTripMap?.destination
    ) {
      return;
    }

    const expectedVehicleProfile = getVietMapVehicleProfile(option.vehicleType);
    const currentVehicleProfile =
      verifiedTripMap.vehicleProfile ?? verifiedTripMap.directions?.vehicleProfile;

    if (currentVehicleProfile === expectedVehicleProfile) {
      return;
    }

    setIsVerifyingMap(true);

    try {
      const nextVerifiedTripMap = await createVerifiedTripMap(
        verifiedTripMap.origin,
        verifiedTripMap.destination,
        option.vehicleType
      );

      setVerifiedTripMap(nextVerifiedTripMap);
      setAlertMessage("");
    } catch (error) {
      setAlertMessage(error.message || "Không thể cập nhật tuyến đường cho loại xe đang chọn.");
    } finally {
      setIsVerifyingMap(false);
    }
  };

  const handleBookRideLegacy = async () => {
    if (!requireLogin()) {
      return;
    }

    if (!verifiedTripMap) {
      setAlertMessage("Vui lòng xác nhận điểm đón và điểm đến trước khi đặt xe.");
      return;
    }

    const bookedTrip = {
      id: `trip-${Date.now()}`,
      status: "searching",
      statusLabel: "Đang tìm tài xế",
      icon: selectedRideOption.icon || "🚗",
      route: `${verifiedFromLabel} → ${verifiedToLabel}`,
      pickup: verifiedFromLabel,
      destination: verifiedToLabel,
      vehicleName: selectedRideOption.name,
      vehicleType: String(selectedRideOption.vehicleType),
      estimatedFare: selectedRidePrice,
      tripDistance: verifiedTripMap.directions.distanceText,
      tripDuration: verifiedTripMap.directions.durationText,
      pickupLatitude: verifiedTripMap.origin.location.lat,
      pickupLongitude: verifiedTripMap.origin.location.lng,
      destinationLatitude: verifiedTripMap.destination.location.lat,
      destinationLongitude: verifiedTripMap.destination.location.lng,
      driverOrigin:
        verifiedTripMap.driverOrigin.formattedAddress ?? MOCK_DRIVER_LOCATION,
      mapImageUrl: verifiedTripMap.driverMapImageUrl ?? "",
      duration: verifiedTripMap.driverDirections.durationText ?? "",
      distance: verifiedTripMap.driverDirections.distanceText ?? "",
      createdAt: new Date().toISOString(),
    };

    try {
      await persistBookedTrip(bookedTrip);
    } catch {
      // Nếu lưu cục bộ thất bại thì vẫn cho đi tiếp sang màn chuyến đi.
    }

    // Điều hướng legacy sang /trips bằng route params.
    // Các params này là bản rút gọn của bookedTrip để TripsScreen dựng active ride nếu cần:
    // - activeRide=1 báo TripsScreen mở trạng thái chuyến đang chạy.
    // - pickup/destination/vehicle/estimatedFare/tripDistance/tripDuration hiển thị trên card.
    // - tọa độ + driverOrigin + mapImageUrl dùng để dựng bản đồ/tài xế mô phỏng.
    // Flow hiện tại ưu tiên persistBookedTrip + setActiveBookedRide, nhưng giữ legacy để tương thích test/đường cũ.
    router.push({
      pathname: "/trips",
      params: {
        activeRide: "1",
        pickup: verifiedFromLabel,
        destination: verifiedToLabel,
        vehicleName: selectedRideOption.name,
        vehicleType: String(selectedRideOption.vehicleType),
        estimatedFare: selectedRidePrice,
        tripDistance: verifiedTripMap.directions.distanceText,
        tripDuration: verifiedTripMap.directions.durationText,
        pickupLatitude: String(verifiedTripMap.origin.location.lat),
        pickupLongitude: String(verifiedTripMap.origin.location.lng),
        destinationLatitude: String(verifiedTripMap.destination.location.lat),
        destinationLongitude: String(verifiedTripMap.destination.location.lng),
        driverOrigin:
          verifiedTripMap.driverOrigin.formattedAddress ?? MOCK_DRIVER_LOCATION,
        mapImageUrl: verifiedTripMap.driverMapImageUrl ?? "",
        duration: verifiedTripMap.driverDirections.durationText ?? "",
        distance: verifiedTripMap.driverDirections.distanceText ?? "",
      },
    });
  };

  void handleBookRideLegacy;

  const handleBookRide = async () => {
    if (!requireLogin()) {
      return;
    }

    if (!verifiedTripMap) {
      setAlertMessage("Vui lòng xác nhận điểm đón và điểm đến trước khi đặt xe.");
      return;
    }

    if (isBookingRide) {
      return;
    }

    if (isVerifyingMap) {
      setAlertMessage("Tuyến đường đang được cập nhật. Vui lòng đợi trong giây lát.");
      return;
    }

    if (!selectedRideOption) {
      setAlertMessage("Vui lòng chọn loại xe.");
      return;
    }

    const expectedVehicleProfile = getVietMapVehicleProfile(selectedRideOption.vehicleType);
    const currentVehicleProfile =
      verifiedTripMap.vehicleProfile ?? verifiedTripMap.directions?.vehicleProfile;

    if (currentVehicleProfile !== expectedVehicleProfile) {
      setAlertMessage("Tuyến đường chưa khớp với loại xe đang chọn. Vui lòng chọn lại loại xe hoặc thử lại.");
      return;
    }

    if (
      !verifiedTripMap.origin?.location ||
      !verifiedTripMap.destination?.location
    ) {
      setAlertMessage("Không tìm thấy tọa độ điểm đón hoặc điểm đến. Vui lòng chọn lại địa chỉ.");
      return;
    }

    if (!verifiedTripMap.directions) {
      setAlertMessage("Không thể tính tuyến đường cho chuyến đi. Vui lòng thử lại.");
      return;
    }

    const validatedTripMetrics = getBackendTripMetrics(verifiedTripMap);

    if (
      !validatedTripMetrics ||
      validatedTripMetrics.distanceKm <= 0 ||
      validatedTripMetrics.durationMinute <= 0
    ) {
      setAlertMessage("Không thể tính quãng đường hoặc thời gian di chuyển. Vui lòng chọn lại lộ trình.");
      return;
    }

    const minimumDistanceValidationMessage = getMinimumDistanceValidationMessage(
      verifiedTripMap.origin,
      verifiedTripMap.destination,
      validatedTripMetrics
    );

    if (minimumDistanceValidationMessage) {
      setAlertMessage(minimumDistanceValidationMessage);
      return;
    }

    if (isLoadingRidePrices) {
      setAlertMessage("Giá cước đang được tính. Vui lòng đợi trong giây lát.");
      return;
    }

    if (ridePriceError) {
      setAlertMessage(ridePriceError);
      return;
    }

    // Chặn đặt xe lẻ khi user đang có yêu cầu hoặc nhóm xe ghép của chính mình còn active.
    // Lưu ý: chỉ chặn dựa trên pendingSharedRequests (request/group của mình).
    // KHÔNG chặn vì availableSharedGroups (group người khác đề xuất cho mình tham gia):
    // đó chỉ là gợi ý, user chưa join thì không bị ràng buộc phải đợi.
    const hasActiveSharedRequest = pendingSharedRequests.some((request) => {
      if (!request) {
        return false;
      }
      // pendingSharedRequests chứa cả request và group của mình; dùng helper map tương ứng.
      // Card có groupId thường là group, còn lại là request.
      const looksLikeGroup = Boolean(request.groupId || request.rawGroup);
      const normalizedStatus = looksLikeGroup
        ? normalizeRideSharingGroupStatus(request.status)
        : normalizeRideSharingRequestStatus(request.status);
      return looksLikeGroup
        ? !isSharedGroupTerminal(normalizedStatus)
        : isSharedRideActive(request.status);
    });

    if (hasActiveSharedRequest) {
      setAlertMessage(
        "Bạn đang có yêu cầu hoặc nhóm xe ghép đang hoạt động. Vui lòng hủy hoặc chờ hoàn thành trước khi đặt xe lẻ."
      );
      return;
    }

    if (!selectedRidePrice || selectedRidePrice === "--") {
      setAlertMessage("Chưa có giá cước cho loại xe đang chọn. Vui lòng chọn loại xe khác hoặc thử lại.");
      return;
    }

    if (scheduledRideAt) {
      const scheduledDate = new Date(scheduledRideAt);

      if (
        Number.isNaN(scheduledDate.getTime()) ||
        !isScheduleInRange(scheduledDate)
      ) {
        setAlertMessage("Thời gian hẹn lịch không hợp lệ. Vui lòng chọn lại.");
        return;
      }
    }

    setIsBookingRide(true);
    setAlertMessage("");
    setAcceptedTrip(null);

    const isScheduledRide = Boolean(scheduledRideAt);
    const requestDistanceKm = Number(validatedTripMetrics.distanceKm);
    const requestDurationMinute = Math.max(
      1,
      Math.round(Number(validatedTripMetrics.durationMinute))
    );
    // createTripPayload: DỮ LIỆU FE GỬI LÊN BE ĐỂ TẠO CHUYẾN
    // Lấy từ verifiedTripMap sau khi VietMap đã xác minh địa chỉ/tọa độ.
    // BE sẽ tự tính/kiểm tra pricing theo distance, duration, vehicleType và tripType.
    const createTripPayload = {
      pickupLatitude: verifiedTripMap.origin.location.lat,
      pickupLongitude: verifiedTripMap.origin.location.lng,
      pickupAddress: verifiedFromLabel,
      destinationLatitude: verifiedTripMap.destination.location.lat,
      destinationLongitude: verifiedTripMap.destination.location.lng,
      destinationAddress: verifiedToLabel,
      estimatedDistanceKm: requestDistanceKm,
      estimatedDurationMinute: requestDurationMinute,
      vehicleType: selectedRideOption.vehicleType,
      tripType: isScheduledRide ? 2 : 1,
      ...(isScheduledRide ? { scheduledAt: scheduledRideAt } : {}),
    };

    try {
      let response;

      try {
        // Gửi request tạo chuyến bằng accessToken hiện tại.
        response = await createTrip(createTripPayload, session?.accessToken);
      } catch (error) {
        if (error?.status !== 401) {
          throw error;
        }

        // Nếu BE trả 401: refresh token rồi gửi lại createTrip một lần với accessToken mới.
        const nextSession = await refreshSession();
        response = await createTrip(createTripPayload, nextSession.accessToken);
      }

      // Response BE có thể là { trip } hoặc chính object trip, nên normalize về tripResponse.
      const tripResponse = response?.trip ?? response;
      const confirmedTripDistance =
        validatedTripMetrics?.distanceText ??
        verifiedTripMap.directions.distanceText ??
        "--";
      const confirmedTripDuration =
        validatedTripMetrics?.durationText ??
        verifiedTripMap.directions.durationText ??
        "--";
      // bookedTrip: object FE dùng để hiển thị/tracking local.
      // Nó merge dữ liệu BE trả về với route/map/giá đang có ở FE.
      const bookedTrip = {
        id: tripResponse.id || `trip-${Date.now()}`,
        status: isScheduledRide
          ? "scheduled"
          : (tripResponse.status || "pending").toLowerCase(),
        statusLabel: isScheduledRide
          ? "Chờ tài xế"
          : "Đang tìm tài xế",
        icon: selectedRideOption.icon || "🚗",
        route: `${verifiedFromLabel} → ${verifiedToLabel}`,
        pickup: tripResponse.pickupAddress || verifiedFromLabel,
        destination: tripResponse.destinationAddress || verifiedToLabel,
        vehicleName: selectedRideOption.name,
        vehicleType: String(selectedRideOption.vehicleType),
        estimatedFare: selectedRidePrice,
        tripDistance: confirmedTripDistance,
        tripDuration: confirmedTripDuration,
        pickupLatitude: verifiedTripMap.origin.location.lat,
        pickupLongitude: verifiedTripMap.origin.location.lng,
        destinationLatitude: verifiedTripMap.destination.location.lat,
        destinationLongitude: verifiedTripMap.destination.location.lng,
        driverOrigin:
          verifiedTripMap.driverOrigin.formattedAddress ?? MOCK_DRIVER_LOCATION,
        mapImageUrl: verifiedTripMap.driverMapImageUrl ?? "",
        duration: verifiedTripMap.driverDirections.durationText ?? "",
        distance: verifiedTripMap.driverDirections.distanceText ?? "",
        createdAt: tripResponse.createdAt || new Date().toISOString(),
        scheduledAt: tripResponse.scheduledAt || scheduledRideAt || "",
        scheduledRideTime,
      };

      try {
        // Lưu local để tab Trips/Home có thể đọc lại ngay cả khi reload hoặc API chậm.
        await persistBookedTrip(bookedTrip);
      } catch {
        // Neu luu cuc bo that bai thi van hien man tim tai xe.
      }

      setAcceptedTrip(null);
      if (isScheduledRide) {
        // Chuyến đặt trước: reset form và chuyển sang tab Trips để xem danh sách lịch hẹn.
        resetSingleRideBookingForm();
        // Điều hướng không cần params vì chuyến đã được BE tạo và persistBookedTrip lưu local; TripsScreen sẽ load từ BE/cache.
        router.push("/trips");
      } else {
        // Chuyến đi ngay: giữ bookedTrip trong state để màn "đang tìm tài xế" hiển thị realtime giả lập/API.
        setActiveBookedRide(bookedTrip);
        setBookingStep("findingDriver");
      }
    } catch (error) {
      if (error?.message === "An error occurred") {
        setAlertMessage("BE đang lỗi khi tạo chuyến đi. Hãy kiểm tra bảng giá active của loại xe đang chọn.");
      } else {
        setAlertMessage(error.message || "Không thể tạo chuyến đi.");
      }
    } finally {
      setIsBookingRide(false);
    }
  };

  const handleCancelBookedRide = async () => {
    if (isCancellingRide) {
      return;
    }

    // Nếu trip đang ở trạng thái terminal (NoDriverFound, completed, cancelled...)
    // thì không gọi BE cancel được — chỉ reset form về màn nhập địa chỉ.
    if (!canCancelTrackedTrip) {
      resetSingleRideBookingForm();
      return;
    }

    if (!activeBookedRide?.id || !session?.accessToken) {
      setAlertMessage("Không tìm thấy chuyến đi để hủy.");
      return;
    }

    setIsCancellingRide(true);
    setAlertMessage("");

    try {
      let cancelledTrip;

      try {
        // Gửi tripId + cancelReason lên BE để hủy chuyến phía passenger.
        cancelledTrip = await cancelTrip(
          activeBookedRide.id,
          { cancelReason: 4 },
          session.accessToken
        );
      } catch (error) {
        if (error?.status !== 401) {
          throw error;
        }

        // Nếu token hết hạn, refresh session rồi gửi lại request hủy.
        const nextSession = await refreshSession();
        cancelledTrip = await cancelTrip(
          activeBookedRide.id,
          { cancelReason: 4 },
          nextSession.accessToken
        );
      }

      // Response hủy từ BE được lưu vào acceptedTrip và merge lại activeBookedRide để UI đổi trạng thái.
      setAcceptedTrip(cancelledTrip);
      const nextBookedRide = {
        ...(activeBookedRide ?? {}),
        status: normalizeTripStatus(cancelledTrip?.status ?? "cancelled"),
        statusLabel: getTripStatusView("cancelled", false).label,
        cancelledAt: cancelledTrip?.cancelledAt ?? new Date().toISOString(),
      };

      setActiveBookedRide(nextBookedRide);

      try {
        // Lưu trạng thái đã hủy xuống cache local để tab Trips/Home đọc đúng sau khi quay lại.
        await persistBookedTrip(nextBookedRide);
      } catch {
        // Neu luu cuc bo that bai thi van hien trang thai huy tu BE.
      }
    } catch (error) {
      setAlertMessage(error.message || "Không thể hủy chuyến đi.");
    } finally {
      setIsCancellingRide(false);
    }
  };

  const handleExtendSoloSearch = async () => {
    if (!activeBookedRide?.id || !session?.accessToken) {
      setAlertMessage("Không tìm thấy chuyến đi để tiếp tục tìm.");
      return;
    }

    if (isExtendingSoloSearch) {
      return;
    }

    setIsExtendingSoloSearch(true);
    setAlertMessage("");

    try {
      let updatedTrip;

      try {
        updatedTrip = await extendTripSearch(activeBookedRide.id, session.accessToken);
      } catch (error) {
        if (error?.status === 400 && verifiedTripMap && selectedRideOption) {
          // Trip đã ở NoDriverFound (terminal) — BE không cho extend nữa.
          // Tạo chuyến mới với cùng pickup/destination/vehicleType, giữ user ở màn đang tìm tài xế.
          await recreateSoloTripAfterNoDriver();
          return;
        }

        if (error?.status !== 401) {
          throw error;
        }

        const nextSession = await refreshSession();
        updatedTrip = await extendTripSearch(activeBookedRide.id, nextSession.accessToken);
      }

      // Cập nhật lại trạng thái chuyến (LastSearchExtendedAt) và ẩn prompt.
      const lastSearchExtendedAt =
        updatedTrip?.lastSearchExtendedAt ?? new Date().toISOString();
      const nextBookedRide = {
        ...(activeBookedRide ?? {}),
        lastSearchExtendedAt,
        createdAt: activeBookedRide?.createdAt,
      };

      setAcceptedTrip(updatedTrip ?? acceptedTrip);
      setActiveBookedRide(nextBookedRide);

      try {
        await persistBookedTrip(nextBookedRide);
      } catch {
        // Lưu cache local thất bại: vẫn để UI cập nhật từ BE.
      }

      if (activeRidePromptId) {
        setDismissedNoDriverPromptIds((prev) => ({
          ...prev,
          [activeRidePromptId]: true,
        }));
      }
    } catch (error) {
      setAlertMessage(error.message || "Không thể tiếp tục tìm chuyến.");
    } finally {
      setIsExtendingSoloSearch(false);
    }
  };

  // recreateSoloTripAfterNoDriver: Khi trip cũ đã NoDriverFound (terminal), user bấm "Chờ tiếp" →
  // tạo chuyến mới với cùng pickup/destination/vehicleType rồi set activeBookedRide → UI tiếp tục
  // hiển thị màn "đang tìm tài xế" mà không cần user chọn lại địa chỉ.
  const recreateSoloTripAfterNoDriver = async () => {
    const currentBookedRide = activeBookedRide;
    if (!currentBookedRide || !session?.accessToken || !verifiedTripMap || !selectedRideOption) {
      resetSingleRideBookingForm();
      setIsExtendingSoloSearch(false);
      return;
    }

    const validatedTripMetrics = getBackendTripMetrics(verifiedTripMap);
    const requestDistanceKm = validatedTripMetrics?.distanceKm ?? 0;
    const requestDurationMinute = validatedTripMetrics?.durationMinute ?? 0;

    if (!requestDistanceKm || !requestDurationMinute) {
      resetSingleRideBookingForm();
      setIsExtendingSoloSearch(false);
      return;
    }

    const createTripPayload = {
      pickupLatitude: verifiedTripMap.origin.location.lat,
      pickupLongitude: verifiedTripMap.origin.location.lng,
      pickupAddress: verifiedFromLabel,
      destinationLatitude: verifiedTripMap.destination.location.lat,
      destinationLongitude: verifiedTripMap.destination.location.lng,
      destinationAddress: verifiedToLabel,
      estimatedDistanceKm: Number(requestDistanceKm),
      estimatedDurationMinute: Math.max(1, Math.round(Number(requestDurationMinute))),
      vehicleType: selectedRideOption.vehicleType,
      tripType: 1,
    };

    try {
      let response;

      try {
        response = await createTrip(createTripPayload, session.accessToken);
      } catch (error) {
        if (error?.status !== 401) {
          throw error;
        }
        const nextSession = await refreshSession();
        response = await createTrip(createTripPayload, nextSession.accessToken);
      }

      const tripResponse = response?.trip ?? response;
      const confirmedTripDistance =
        validatedTripMetrics?.distanceText ??
        verifiedTripMap.directions.distanceText ??
        "--";
      const confirmedTripDuration =
        validatedTripMetrics?.durationText ??
        verifiedTripMap.directions.durationText ??
        "--";

      const newBookedTrip = {
        id: tripResponse.id || `trip-${Date.now()}`,
        status: (tripResponse.status || "pending").toLowerCase(),
        statusLabel: "Đang tìm tài xế",
        icon: selectedRideOption.icon || "🚗",
        route: `${verifiedFromLabel} → ${verifiedToLabel}`,
        pickup: tripResponse.pickupAddress || verifiedFromLabel,
        destination: tripResponse.destinationAddress || verifiedToLabel,
        vehicleName: selectedRideOption.name,
        vehicleType: String(selectedRideOption.vehicleType),
        estimatedFare: selectedRidePrice,
        tripDistance: confirmedTripDistance,
        tripDuration: confirmedTripDuration,
        pickupLatitude: verifiedTripMap.origin.location.lat,
        pickupLongitude: verifiedTripMap.origin.location.lng,
        destinationLatitude: verifiedTripMap.destination.location.lat,
        destinationLongitude: verifiedTripMap.destination.location.lng,
        driverOrigin:
          verifiedTripMap.driverOrigin.formattedAddress ?? MOCK_DRIVER_LOCATION,
        mapImageUrl: verifiedTripMap.driverMapImageUrl ?? "",
        duration: verifiedTripMap.driverDirections.durationText ?? "",
        distance: verifiedTripMap.driverDirections.distanceText ?? "",
        createdAt: tripResponse.createdAt || new Date().toISOString(),
        lastSearchExtendedAt: null,
      };

      try {
        await persistBookedTrip(newBookedTrip);
      } catch {
        // Lưu cache local thất bại: vẫn để UI cập nhật từ BE.
      }

      // Ẩn prompt của trip cũ, set trip mới làm active. UI tự render lại màn "đang tìm tài xế".
      if (activeRidePromptId) {
        setDismissedNoDriverPromptIds((prev) => ({
          ...prev,
          [activeRidePromptId]: true,
        }));
      }
      setAcceptedTrip(null);
      setActiveBookedRide(newBookedTrip);
      setBookingStep("findingDriver");
    } catch (error) {
      setAlertMessage(error.message || "Không thể tạo chuyến mới. Vui lòng thử lại.");
    } finally {
      setIsExtendingSoloSearch(false);
    }
  };

  const openCompletedTripReview = () => {
    if (!requireLogin()) {
      return;
    }

    if (!completedTripId) {
      setAlertMessage("Không tìm thấy chuyến đi để đánh giá.");
      return;
    }

    if (hasReviewedCompletedTrip) {
      return;
    }

    setReviewRating(5);
    setReviewComment("");
    setReviewError("");
    setReviewModalVisible(true);
  };

  const handleSubmitCompletedTripReview = async () => {
    if (!requireLogin()) {
      return;
    }

    if (!completedTripId || !session?.accessToken || isSubmittingReview) {
      return;
    }

    setReviewError("");
    setIsSubmittingReview(true);

    // Payload gửi lên Review API: id chuyến đã hoàn thành, số sao và comment.
    const payload = {
      tripId: completedTripId,
      rating: reviewRating,
      comment: reviewComment.trim() || null,
    };

    try {
      try {
        // Gửi review bằng token hiện tại; nếu 401 sẽ refresh token và gửi lại.
        await createReview(payload, session.accessToken);
      } catch (error) {
        if (error?.status !== 401) {
          throw error;
        }

        const nextSession = await refreshSession();
        await createReview(payload, nextSession.accessToken);
      }

      setReviewedTripIds((current) => ({
        ...current,
        [completedTripId]: true,
      }));
      setReviewModalVisible(false);
      setReviewComment("");
    } catch (error) {
      setReviewError(
        error?.message || "Không thể gửi đánh giá. Vui lòng thử lại."
      );
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const resetSingleRideBookingForm = () => {
    setMode("now");
    setBookingStep("form");
    setFromInput("");
    setToInput("");
    setFocusedField("from");
    setSelectedFromPlace(null);
    setSelectedToPlace(null);
    setVerifiedTripMap(null);
    setRidePriceQuotes({});
    setRidePriceError("");
    setDriverNote("");
    setScheduledRideTime("");
    setScheduledRideAt("");
    setActiveBookedRide(null);
    setAcceptedTrip(null);
    setAlertMessage("");
    setAddressSuggestions({
      from: [],
      to: [],
    });
    setSuggestionError({
      from: "",
      to: "",
    });
    setLoadingSuggestionsFor("");
    hasEditedFromInputRef.current = false;
  };

    const verifyBookingLocations = async () => {
    if (!requireLogin()) {
      return null;
    }

    if (!fromInput.trim()) {
      setAlertMessage("Vui lòng nhập điểm đón.");
      setFocusedField("from");
      return null;
    }

    if (!toInput.trim()) {
      setAlertMessage("Vui lòng nhập điểm đến.");
      setFocusedField("to");
      return null;
    }

    if (!selectedFromPlace) {
      setAlertMessage("Vui lòng chọn điểm đón từ gợi ý VietMap.");
      setFocusedField("from");
      return null;
    }

    if (!selectedToPlace) {
      setAlertMessage("Vui lòng chọn điểm đến từ gợi ý VietMap.");
      setFocusedField("to");
      return null;
    }

    const directDistanceValidationMessage = getMinimumDistanceValidationMessage(
      selectedFromPlace,
      selectedToPlace
    );

    if (directDistanceValidationMessage) {
      setAlertMessage(directDistanceValidationMessage);
      setFocusedField("to");
      return null;
    }

    // verifyBookingLocations: LUỒNG XÁC MINH ĐỊA ĐIỂM TRƯỚC KHI ĐẶT XE
    // Input lấy từ form: fromInput/toInput và selectedFromPlace/selectedToPlace.
    // Xử lý: kiểm tra user đã chọn gợi ý VietMap, kiểm tra khoảng cách tối thiểu.
    // Output: verifiedTripMap gồm origin, destination, directions, map URL; state này dùng để tính giá và tạo trip.
    setIsVerifyingMap(true);

    try {
      // Gọi VietMap directions để nhận distance/duration/routeGeometry cho cặp điểm đã chọn.
      const nextVerifiedTripMap = await createVerifiedTripMap(
        selectedFromPlace,
        selectedToPlace
      );

      // Lưu route đã xác minh vào state; các bước confirm/rideOptions đọc state này.
      setVerifiedTripMap(nextVerifiedTripMap);
      setAlertMessage("");
      return nextVerifiedTripMap;
    } catch (error) {
      setVerifiedTripMap(null);
      setAlertMessage(error.message || "Không thể xác minh địa chỉ trên VietMap.");
      return null;
    } finally {
      setIsVerifyingMap(false);
    }
  };

  const showConfirmationStep = async () => {
    const nextVerifiedTripMap = await verifyBookingLocations();

    if (!nextVerifiedTripMap) {
      return;
    }

    setScheduledRideTime("");
    setScheduledRideAt("");
    setBookingStep("confirm");
  };

  const openSchedulePicker = async () => {
    if (isOpeningSchedulePicker) {
      return;
    }

    setIsOpeningSchedulePicker(true);
    const nextVerifiedTripMap = await verifyBookingLocations();

    if (nextVerifiedTripMap) {
      setSchedulePickerVisible(true);
    }

    setIsOpeningSchedulePicker(false);
  };

    const selectAddressSuggestion = async (field, suggestion) => {
    if (!requireLogin()) {
      return;
    }

    setAddressSuggestions((current) => ({
      ...current,
      [field]: [],
    }));
    setSuggestionError((current) => ({
      ...current,
      [field]: "",
    }));
    setAlertMessage("");
    setVerifiedTripMap(null);

    try {
      const resolvedPlace = await resolvePlaceSuggestion(suggestion);

      if (field === "from") {
        syncAddressInputText("from", resolvedPlace.formattedAddress);
        setSelectedFromPlace(resolvedPlace);
        setFocusedField("to");
        return;
      }

      syncAddressInputText("to", resolvedPlace.formattedAddress);
      setSelectedToPlace(resolvedPlace);

      if (!selectedFromPlace) {
        setAlertMessage("Vui lòng chọn điểm đón từ gợi ý trước.");
        setFocusedField("from");
        return;
      }

      setFocusedField("");
    } catch (error) {
      setAlertMessage(error.message || "Không thể lấy địa chỉ trên VietMap.");
    }
  };

  const confirmSchedulePicker = () => {
    if (!verifiedTripMap) {
      setAlertMessage("Vui lòng xác nhận điểm đón và điểm đến trước khi hẹn lịch.");
      setSchedulePickerVisible(false);
      return;
    }

    const routeMetrics = getBackendTripMetrics(verifiedTripMap);
    const minimumDistanceValidationMessage = getMinimumDistanceValidationMessage(
      verifiedTripMap.origin,
      verifiedTripMap.destination,
      routeMetrics
    );

    if (minimumDistanceValidationMessage) {
      setAlertMessage(minimumDistanceValidationMessage);
      setSchedulePickerVisible(false);
      return;
    }

    if (!scheduleDraft.date) {
      setAlertMessage("Vui lòng chọn ngày hẹn lịch.");
      return;
    }

    if (!scheduleDraft.hour || !scheduleDraft.minute) {
      setAlertMessage("Vui lòng chọn giờ hẹn lịch.");
      return;
    }

    if (!isScheduleInRange(pickupDate)) {
      setAlertMessage("Thời gian hẹn lịch không hợp lệ. Vui lòng chọn thời gian khác.");
      return;
    }

    setScheduledRideTime(scheduleDisplayText);
    setScheduledRideAt(pickupDate.toISOString());
    setSchedulePickerVisible(false);
    setBookingStep("confirm");
  };

  const updateSharedForm = (field, value) => {
    setSharedForm((current) => ({ ...current, [field]: value }));
    setSharedFormError("");

    if (field === "location" && value.trim() !== sharedLocationPickedRef.current) {
      sharedLocationPickedRef.current = "";
      setSelectedSharedPlace(null);
    }
  };

  const clearSharedLocation = () => {
    sharedLocationPickedRef.current = "";
    setSelectedSharedPlace(null);
    updateSharedForm("location", "");
    setSharedLocationSuggestions([]);
    setSharedLocationError("");
  };

  const selectSharedLocationSuggestion = async (suggestion) => {
    const formattedAddress =
      suggestion.formattedAddress || suggestion.description || suggestion.mainText || "";

    setSharedLocationLoading(true);

    try {
      // Khi user chọn gợi ý điểm đón để join group:
      // - Nếu suggestion đã có location thì dùng luôn.
      // - Nếu chỉ có placeId/refId thì gọi VietMap detail để nhận tọa độ.
      const resolvedPlace = suggestion.location
        ? suggestion
        : await getMapPlaceDetails(suggestion.refId || suggestion.placeId);

      const resolvedAddress =
        resolvedPlace.formattedAddress ||
        resolvedPlace.description ||
        resolvedPlace.mainText ||
        formattedAddress;

      sharedLocationPickedRef.current = resolvedAddress.trim();
      setSelectedSharedPlace({
        ...resolvedPlace,
        formattedAddress: resolvedAddress,
      });
      setSharedForm((current) => ({ ...current, location: resolvedAddress }));
      setSharedLocationSuggestions([]);
      setSharedLocationError("");
      setSharedFormError("");
    } catch (error) {
      setSelectedSharedPlace(null);
      setSharedLocationError(
        error.message || "Không thể lấy tọa độ địa chỉ từ VietMap."
      );
    } finally {
      setSharedLocationLoading(false);
    }
  };

  const closeJoinSharedModal = () => {
    if (isJoiningSharedGroup) {
      return;
    }

    setJoinSharedGroup(null);
    setJoinSharedPickup("");
    setJoinSharedPlace(null);
    setJoinSharedSuggestions([]);
    setJoinSharedLocationLoading(false);
    setJoinSharedError("");
    joinSharedLocationPickedRef.current = "";
  };

  const openJoinSharedModal = (groupCard) => {
    if (!requireLogin()) {
      return;
    }

    setJoinSharedGroup(groupCard);
    setJoinSharedPickup("");
    setJoinSharedPlace(null);
    setJoinSharedSuggestions([]);
    setJoinSharedLocationLoading(false);
    setJoinSharedError("");
    joinSharedLocationPickedRef.current = "";
  };

  const updateJoinSharedPickup = (value) => {
    setJoinSharedPickup(value);
    setJoinSharedError("");

    if (value.trim() !== joinSharedLocationPickedRef.current) {
      joinSharedLocationPickedRef.current = "";
      setJoinSharedPlace(null);
    }
  };

  const clearJoinSharedPickup = () => {
    joinSharedLocationPickedRef.current = "";
    setJoinSharedPickup("");
    setJoinSharedPlace(null);
    setJoinSharedSuggestions([]);
    setJoinSharedError("");
  };

  const selectJoinSharedLocationSuggestion = async (suggestion) => {
    const formattedAddress =
      suggestion.formattedAddress || suggestion.description || suggestion.mainText || "";

    setJoinSharedLocationLoading(true);

    try {
      const resolvedPlace = suggestion.location
        ? suggestion
        : await getMapPlaceDetails(suggestion.refId || suggestion.placeId);

      const resolvedAddress =
        resolvedPlace.formattedAddress ||
        resolvedPlace.description ||
        resolvedPlace.mainText ||
        formattedAddress;

      joinSharedLocationPickedRef.current = resolvedAddress.trim();
      // Lưu địa điểm đã resolve vào state; joinSuggestedSharedGroup sẽ lấy state này để gửi payload join.
      setJoinSharedPlace({
        ...resolvedPlace,
        formattedAddress: resolvedAddress,
      });
      setJoinSharedPickup(resolvedAddress);
      setJoinSharedSuggestions([]);
      setJoinSharedError("");
    } catch (error) {
      setJoinSharedPlace(null);
      setJoinSharedError(
        error.message || "Không thể lấy tọa độ điểm đón từ VietMap."
      );
    } finally {
      setJoinSharedLocationLoading(false);
    }
  };

  const joinSuggestedSharedGroup = async () => {
    if (!requireLogin() || !joinSharedGroup?.groupId || isJoiningSharedGroup) {
      return;
    }

    if (!joinSharedPickup.trim()) {
      setJoinSharedError("Vui lòng nhập điểm đón.");
      return;
    }

    if (!joinSharedPlace?.location) {
      setJoinSharedError("Vui lòng chọn điểm đón từ gợi ý VietMap.");
      return;
    }

    const destinationPlace = getJoinDestinationFromGroupCard(joinSharedGroup);
    if (!destinationPlace?.location) {
      setJoinSharedError(
        "Không xác định được điểm đến của nhóm xe ghép. Vui lòng xem chi tiết nhóm và thử lại."
      );
      return;
    }

    // joinSuggestedSharedGroup: LUỒNG GỬI DỮ LIỆU THAM GIA NHÓM XE GHÉP
    // Input từ UI: joinSharedGroup.groupId + joinSharedPlace (điểm đón khách chọn).
    // Xử lý:
    // - Kiểm tra khách chưa có request xe ghép active.
    // - Tính route từ điểm đón khách đến destination của group.
    // - Gửi payload join lên /ride-sharing/groups/{groupId}/join.
    // Output:
    // - Response group/request được map thành card pending.
    // - Group vừa join bị remove khỏi list available.
    setIsJoiningSharedGroup(true);
    setJoinSharedError("");

    try {
      // Gọi BE kiểm tra request active để chặn user join nhiều nhóm cùng lúc.
      const activeRequest = await getMyRideSharingRequest(
        session.accessToken
      ).catch((error) => {
        if (error?.status === 404) {
          return null;
        }

        throw error;
      });

      if (activeRequest && isSharedRideActive(activeRequest.status)) {
        setJoinSharedError(
          "Bạn đang có yêu cầu xe ghép đang hoạt động. Vui lòng hủy yêu cầu hiện tại trước khi tham gia nhóm khác."
        );
        return;
      }

      let joinDirections = null;
      try {
        // Gọi map service để lấy distance/duration thực tế giữa điểm đón user và điểm đến của group.
        joinDirections = await getMapDirections(
          joinSharedPlace,
          destinationPlace,
          2
        );
      } catch {
        joinDirections = null;
      }

      const routeMetrics =
        getBackendTripMetrics({
          origin: joinSharedPlace,
          destination: destinationPlace,
          directions: joinDirections,
        }) ?? {
          distanceKm: Math.max(
            calculateBackendDistanceKm(joinSharedPlace, destinationPlace),
            MIN_BOOKING_DISTANCE_KM
          ),
          durationMinute: 1,
        };

      const minimumDistanceValidationMessage = getMinimumDistanceValidationMessage(
        joinSharedPlace,
        destinationPlace,
        routeMetrics
      );

      if (minimumDistanceValidationMessage) {
        setJoinSharedError(minimumDistanceValidationMessage);
        return;
      }

      // Payload gửi lên BE khi join group: tọa độ/địa chỉ pickup của user + destination group + metrics tuyến đường.
      const joinedGroup = await joinRideSharingGroup(
        joinSharedGroup.groupId,
        {
          pickupLatitude: Number(joinSharedPlace.location.lat),
          pickupLongitude: Number(joinSharedPlace.location.lng),
          pickupAddress:
            joinSharedPlace.formattedAddress || joinSharedPickup.trim(),
          destinationLatitude: Number(destinationPlace.location.lat),
          destinationLongitude: Number(destinationPlace.location.lng),
          destinationAddress:
            destinationPlace.formattedAddress || "Điểm đến nhóm xe ghép",
          estimatedDistanceKm: Number(routeMetrics.distanceKm.toFixed(2)),
          estimatedDurationMinutes: Math.max(
            1,
            Math.round(routeMetrics.durationMinute)
          ),
        },
        session.accessToken
      );

      // Response BE được map thành card UI để hiển thị ngay ở danh sách yêu cầu của tôi.
      const mappedGroup = mapRideSharingGroupToCard(joinedGroup);
      if (mappedGroup) {
        setPendingSharedRequests((current) =>
          mergeSharedRequestCards([mappedGroup], current)
        );
        persistRideSharingCards([mappedGroup], session.userId).catch(() => {});
      }

      setAvailableSharedGroups((current) =>
        current.filter((group) => group.groupId !== joinSharedGroup.groupId)
      );
      setJoinSharedGroup(null);
      setJoinSharedPickup("");
      setJoinSharedPlace(null);
      setJoinSharedSuggestions([]);
      joinSharedLocationPickedRef.current = "";
      await refreshSharedState();
    } catch (error) {
      setJoinSharedError(getRideSharingJoinErrorMessage(error));
    } finally {
      setIsJoiningSharedGroup(false);
    }
  };

  const closeCreateSharedModal = () => {
    setCreateSharedVisible(false);
    setOpenSharedDropdown("");
    setSharedFormError("");
    sharedLocationPickedRef.current = "";
    setSelectedSharedPlace(null);
    setSharedLocationSuggestions([]);
    setSharedLocationLoading(false);
    setSharedLocationError("");
  };

  const createSharedRide = async () => {
    if (!requireLogin()) {
      return;
    }

    if (isCreatingSharedRequest) {
      return;
    }

    if (!sharedForm.tripType) {
      setSharedFormError("Vui lòng chọn loại chuyến.");
      return;
    }

    if (!sharedForm.location.trim()) {
      setSharedFormError(
        `Vui lòng nhập ${sharedLocationLabel.toLowerCase()}.`
      );
      return;
    }

    if (!selectedSharedPlace?.location) {
      setSharedFormError(
        `Vui lòng chọn ${sharedLocationLabel.toLowerCase()} từ gợi ý VietMap.`
      );
      return;
    }

    if (isScheduledSharedRide && !selectedSharedDate) {
      setSharedFormError("Vui lòng chọn ngày đi.");
      return;
    }

    if (isScheduledSharedRide && !sharedForm.slotId) {
      setSharedFormError("Vui lòng chọn slot đi.");
      return;
    }

    if (isScheduledSharedRide && !selectedSharedSlot) {
      setSharedFormError(
        "Slot này đã quá gần thời gian hiện tại. Vui lòng chọn slot khác."
      );
      return;
    }

    if (!selectedSharedPlace?.location) {
      setSharedFormError(`Vui lòng chọn ${sharedLocationLabel.toLowerCase()} từ gợi ý VietMap`);
      return;
    }

    // createSharedRide: LUỒNG TẠO REQUEST XE GHÉP MỚI
    // Input từ form: loại chuyến đi/về, địa điểm user nhập, ngày, slot.
    // Quy ước:
    // - direction = 1: từ nơi khác đến FPT, user nhập pickup.
    // - direction = 2: từ FPT đi nơi khác, user nhập destination.
    // FE tự ghép với FPT_HOLA_PLACE để tạo đủ pickup/destination trước khi gửi BE.
    const fptPlace = FPT_HOLA_PLACE;
    const pickupPlace = isSharedTripToFpt ? selectedSharedPlace : fptPlace;
    const destinationPlace = isSharedTripToFpt ? fptPlace : selectedSharedPlace;
    let sharedDirections = null;

    try {
      // Gọi map service để lấy distance/duration route xe ghép, dùng cho validation và payload BE.
      sharedDirections = await getMapDirections(pickupPlace, destinationPlace, 2);
    } catch {
      sharedDirections = null;
    }

    const routeMetrics = getBackendTripMetrics({
      origin: pickupPlace,
      destination: destinationPlace,
      directions: sharedDirections,
    });
    const scheduledAt = isScheduledSharedRide
      ? getSharedSlotDateTime(selectedSharedDate.value, selectedSharedSlot.time)
      : null;
    const scheduledAtText = isScheduledSharedRide
      ? formatLocalApiDateTime(scheduledAt)
      : null;
    const slotNumber = isScheduledSharedRide
      ? Number(selectedSharedSlot.id.replace("slot-", ""))
      : null;

    if (!routeMetrics) {
      setSharedFormError(
        "Không thể tính tuyến đường xe ghép. Vui lòng chọn lại địa chỉ."
      );
      return;
    }

    const minimumDistanceValidationMessage = getMinimumDistanceValidationMessage(
      pickupPlace,
      destinationPlace,
      routeMetrics
    );

    if (minimumDistanceValidationMessage) {
      setSharedFormError(minimumDistanceValidationMessage);
      return;
    }

    if (routeMetrics.distanceKm > SHARED_RIDE_MAX_DISTANCE_KM) {
      setSharedFormError(
        `Xe ghép chỉ hỗ trợ quãng đường tối đa ${SHARED_RIDE_MAX_DISTANCE_KM} km. Vui lòng chọn địa chỉ gần FPT hơn.`
      );
      return;
    }

    if (
      isScheduledSharedRide &&
      (!scheduledAtText || !Number.isFinite(slotNumber))
    ) {
      setSharedFormError(
        "Không thể tạo thời gian xe ghép. Vui lòng chọn lại ngày đi và slot."
      );
      return;
    }

    if (
      !routeMetrics ||
      (isScheduledSharedRide &&
        (!scheduledAtText || !Number.isFinite(slotNumber)))
    ) {
      setSharedFormError("Không thể tạo dữ liệu yêu cầu xe ghép. Vui lòng chọn lại địa chỉ và slot.");
      return;
    }

    // Tránh tạo yêu cầu xe ghép khi user đang có chuyến xe lẻ đã đặt/chờ tài xế.
    // Lý do: mỗi chuyến của user cần độc lập (không vừa book xe lẻ vừa mở request ghép),
    // tránh trùng chuyến hoặc tài xế nhận 2 chuyến cùng khung giờ.
    if (activeBookedRide?.id) {
      setSharedFormError(
        "Bạn đang có chuyến xe lẻ đang hoạt động. Vui lòng hủy hoặc hoàn thành chuyến xe lẻ trước khi tạo yêu cầu xe ghép."
      );
      return;
    }

    setIsCreatingSharedRequest(true);
    setSharedFormError("");

    try {
      // Trước khi tạo request mới, hỏi BE xem user đang có request active không để tránh tạo trùng.
      const latestActiveRequest = await getMyRideSharingRequest(
        session.accessToken
      ).catch((error) => {
        if (error?.status === 404) {
          return null;
        }

        throw error;
      });
      logRideSharingCreateDebug("latest active request", latestActiveRequest);

      if (latestActiveRequest && isSharedRideActive(latestActiveRequest.status)) {
        const latestMyGroup = await getMyRideSharingGroup(
          session.accessToken
        ).catch(() => null);
        const latestGroup = await getRideSharingGroupForRequest(
          latestActiveRequest,
          latestMyGroup,
          session.accessToken
        );
        logRideSharingCreateDebug("latest active group", latestGroup);

        const mappedRequest = mapRideSharingRequestToCardClean(
          latestActiveRequest,
          latestGroup
        );

        if (mappedRequest) {
          setPendingSharedRequests([mappedRequest]);
        }

        setSharedFormError(
          "Bạn đang có yêu cầu xe ghép đang hoạt động. Vui lòng hủy yêu cầu hiện tại trước khi tạo mới."
        );
        return;
      }

      // requestPayload: DỮ LIỆU FE GỬI LÊN BE ĐỂ TẠO YÊU CẦU XE GHÉP
      // Bao gồm tọa độ/địa chỉ pickup-destination, direction, distance/duration, tripType, scheduledAt, slot.
      const requestPayload = {
        pickupLatitude: pickupPlace.location.lat,
        pickupLongitude: pickupPlace.location.lng,
        pickupAddress: pickupPlace.formattedAddress,
        destinationLatitude: destinationPlace.location.lat,
        destinationLongitude: destinationPlace.location.lng,
        destinationAddress: destinationPlace.formattedAddress,
        direction: isSharedTripToFpt ? 1 : 2,
        estimatedDistanceKm: Number(routeMetrics.distanceKm.toFixed(2)),
        estimatedDurationMinutes: Math.max(
          1,
          Math.round(routeMetrics.durationMinute)
        ),
        tripType: isScheduledSharedRide ? 2 : 1,
        scheduledAt: isScheduledSharedRide ? scheduledAtText : null,
        scheduledSlot: isScheduledSharedRide ? slotNumber : null,
      };

      logRideSharingCreateDebug("create request payload", requestPayload);
      // Gửi request xe ghép lên BE; response ban đầu có thể chưa đủ group/member nên sẽ fetch lại detail phía dưới.
      const createdRequest = await createRideSharingRequest(
        requestPayload,
        session.accessToken
      );
      logRideSharingCreateDebug("created request response", createdRequest);
      let latestRequest = createdRequest;

      if (createdRequest?.id) {
        try {
          // Lấy lại request theo id để nhận status/groupId mới nhất sau khi BE xử lý matching.
          latestRequest = await getRideSharingRequest(
            createdRequest.id,
            session.accessToken
          );
        } catch {
          latestRequest = createdRequest;
        }
      }

      // Nếu request đã match group, lấy group của user để card có thông tin member/giá/trạng thái đầy đủ.
      const latestMyGroup = await getMyRideSharingGroup(session.accessToken).catch(
        () => null
      );
      const latestGroup = await getRideSharingGroupForRequest(
        latestRequest,
        latestMyGroup,
        session.accessToken
      );
      const mappedRequest = mapRideSharingRequestToCardClean(
        latestRequest,
        latestGroup
      );
      const mappedGroup = mapRideSharingGroupToCard(latestGroup);
      const currentCards = mappedRequest
        ? [mappedRequest]
        : mappedGroup
          ? [mappedGroup]
          : [];

      // Đẩy card mới vào state pending và lưu cache để reload app vẫn thấy yêu cầu vừa tạo.
      setPendingSharedRequests((current) =>
        mergeSharedRequestCards(currentCards, current)
      );

      if (currentCards.length > 0) {
        persistRideSharingCards(currentCards, session.userId).catch(() => {});
      }

      setSharedForm(defaultSharedForm);
      closeCreateSharedModal();
    } catch (error) {
      logRideSharingCreateDebug("create request error", {
        message: error?.message,
        status: error?.status,
        path: error?.path,
        payload: error?.payload,
        rawText: error?.rawText,
      });
      setSharedFormError(getRideSharingCreateReadableErrorMessage(error));
      if (error?.message || error?.status) {
        return;
      }
      setSharedFormError(
        error.message || "Không thể tạo yêu cầu xe ghép từ BE."
      );
    } finally {
      setIsCreatingSharedRequest(false);
    }
  };

  const handleCancelSharedRequest = async (requestId) => {
    if (!requestId || !session?.accessToken || cancellingSharedRequestId) {
      return;
    }

    setCancellingSharedRequestId(requestId);
    setSharedFormError("");
    setSharedCancelError("");

    try {
      // handleCancelSharedRequest: GỬI hủy request xe ghép theo requestId.
      // Nếu API hủy lỗi nhưng kiểm tra lại thấy request đã terminal/404 thì vẫn coi là đã hủy để UI không kẹt.
      const requestToCancel = pendingSharedRequests.find(
        (request) => request.requestId === requestId
      );

      let cancelledRequest = null;

      let cancelApiError = null;

      try {
        // Gửi cancelReason lên BE để hủy request phía passenger.
        cancelledRequest = await cancelRideSharingRequest(
          requestId,
          { cancelReason: 4 },
          session.accessToken
        );
      } catch (error) {
        cancelApiError = error;
      }

      if (cancelApiError) {
        let latestRequest = null;
        let requestNoLongerExists = false;

        try {
          // Nếu cancel API lỗi, fetch lại request để xác minh trạng thái thật trên BE.
          latestRequest = await getRideSharingRequest(
            requestId,
            session.accessToken
          );
        } catch (verifyError) {
          requestNoLongerExists = verifyError?.status === 404;
        }

        const latestStatus = normalizeRideSharingRequestStatus(
          latestRequest?.status
        );

        if (requestNoLongerExists || isSharedTerminalStatus(latestStatus)) {
          cancelledRequest = latestRequest ?? {
            ...requestToCancel,
            id: requestId,
            status: "Cancelled",
            groupId: "",
          };
        } else {
          throw cancelApiError;
        }
      }

      // Map request đã hủy thành card UI rồi lưu lại vào cache/tab cancelled.
      const cancelledCard = mapRideSharingRequestToCardClean(
        {
          ...(cancelledRequest ?? requestToCancel ?? {}),
          id: requestId,
          requestId,
          status: "cancelled",
          groupId: "",
        },
        null
      );

      if (cancelledCard) {
        sharedRefreshSequenceRef.current += 1;
        setIsLoadingSharedState(false);

        const remainingRequests = removeSharedRequestCards(
          pendingSharedRequests,
          requestId,
          requestToCancel?.groupId
        );
        const nextRequests = mergeSharedRequestCards(
          [{ ...cancelledCard, status: "cancelled", requestStatus: "cancelled" }],
          remainingRequests
        );

        setPendingSharedRequests(nextRequests);
        await replaceRideSharingCards(nextRequests, session.userId).catch(() => []);
        setSharedRequestFilter("cancelled");
        await refreshSharedState({ showLoading: false });
      }
    } catch (error) {
      const serverMessage = error?.payload?.message || error?.message;
      const readableMessage = String(
        serverMessage || "Không thể hủy yêu cầu xe ghép."
      ).replace(/^HTTP\s+\d+\s+\S+:\s*/, "");

      setSharedCancelError(readableMessage);
    } finally {
      setCancellingSharedRequestId("");
    }
  };

  const handleExtendSharedSearch = async (requestId) => {
    if (!requestId || !session?.accessToken) {
      return;
    }

    if (extendingSharedRequestId === requestId) {
      return;
    }

    setExtendingSharedRequestId(requestId);
    setSharedCancelError("");

    try {
      let updatedRequest;

      try {
        updatedRequest = await extendRideSharingSearch(requestId, session.accessToken);
      } catch (error) {
        if (error?.status !== 401) {
          throw error;
        }

        const nextSession = await refreshSession();
        updatedRequest = await extendRideSharingSearch(requestId, nextSession.accessToken);
      }

      const promptId = `shared:${requestId}`;
      setDismissedNoDriverPromptIds((prev) => ({
        ...prev,
        [promptId]: true,
      }));

      // Cập nhật lại LastSearchExtendedAt trong card local để prompt không hiện lại ngay.
      setPendingSharedRequests((prev) =>
        prev.map((req) =>
          req?.requestId === requestId || req?.id === requestId
            ? {
                ...req,
                lastSearchExtendedAt:
                  updatedRequest?.lastSearchExtendedAt ?? new Date().toISOString(),
              }
            : req
        )
      );

      // Refresh trạng thái thật từ BE.
      try {
        await refreshSharedState({ showLoading: false });
      } catch {
        // Bỏ qua nếu refresh lỗi; UI vẫn cập nhật local.
      }
    } catch (error) {
      const serverMessage = error?.payload?.message || error?.message;
      const readableMessage = String(
        serverMessage || "Không thể tiếp tục tìm chuyến ghép."
      ).replace(/^HTTP\s+\d+\s+\S+:\s*/, "");
      setSharedCancelError(readableMessage);
    } finally {
      setExtendingSharedRequestId("");
    }
  };

  const fillAddressToFocusedField = async (address) => {
    if (!address?.label) {
      return;
    }

    setAlertMessage("");
    setVerifiedTripMap(null);
    setOpenAddressMenuId("");

    try {
      const resolvedPlace = await resolveSavedAddress(address.label);

      if (focusedField === "from") {
        syncAddressInputText("from", resolvedPlace.formattedAddress);
        setSelectedFromPlace(resolvedPlace);
        setFocusedField("to");
        return;
      }

      syncAddressInputText("to", resolvedPlace.formattedAddress);
      setSelectedToPlace(resolvedPlace);

      if (!selectedFromPlace) {
        setFocusedField("from");
        setAlertMessage("Vui lòng chọn điểm đón trước.");
        return;
      }

      setFocusedField("");
    } catch (error) {
      setAlertMessage(error.message || "Không thể lấy địa chỉ đã lưu từ VietMap.");
    }
  };

  const openCreateAddressModal = () => {
    if (!requireLogin()) {
      return;
    }

    setAddressForm(defaultAddressForm);
    setEditingAddressId("");
    setAddressFormError("");
    setOpenAddressMenuId("");
    setAddressModalVisible(true);
  };

  const openEditAddressModal = (address) => {
    setAddressForm({
      label: address.label,
    });
    setEditingAddressId(address.id);
    setAddressFormError("");
    setOpenAddressMenuId("");
    setAddressModalVisible(true);
  };

  const closeAddressModal = () => {
    setAddressModalVisible(false);
    setAddressFormError("");
    setOpenAddressMenuId("");
  };

  const updateAddressForm = (field, value) => {
    setAddressForm((current) => ({ ...current, [field]: value }));
    setAddressFormError("");
  };

  const saveAddress = () => {
    if (!requireLogin()) {
      return;
    }

    if (!addressForm.label.trim()) {
      setAddressFormError("Vui lòng nhập tên địa chỉ");
      return;
    }

    const nextAddress = {
      id: editingAddressId || `saved-${Date.now()}`,
      label: addressForm.label.trim(),
    };

    setSavedAddresses((current) => {
      if (!editingAddressId) {
        return [nextAddress, ...current];
      }

      return current.map((address) =>
        address.id === editingAddressId ? nextAddress : address
      );
    });
    setAddressForm(defaultAddressForm);
    closeAddressModal();
  };

  const deleteAddress = (addressId) => {
    setSavedAddresses((current) =>
      current.filter((address) => address.id !== addressId)
    );
    setOpenAddressMenuId("");
  };

  return (
    <>
      {/* ScrollView: Cho phép nội dung dài cuộn được trên màn hình nhỏ. */}
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={[
          styles.contentContainer,
          bookingStep === "confirm" && styles.contentContainerFit,
          bookingStep === "rideOptions" && styles.contentContainerFit,
          bookingStep === "findingDriver" && styles.contentContainerFit,
          {
            paddingTop: ScreenHeaderTop,
            paddingBottom:
              bookingStep === "confirm"
                ? insets.bottom + Math.max(BottomTabInset - 44, Spacing.two)
                : bookingStep === "findingDriver"
                  ? insets.bottom + Math.max(BottomTabInset - 54, Spacing.one)
                : bookingStep === "rideOptions"
                  ? insets.bottom + Math.max(BottomTabInset - 54, Spacing.one)
                : insets.bottom + Spacing.five,
          },
        ]}
        scrollEnabled={bookingStep === "form" || isCompletedTrip}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {/* Khối content: Bố cục bao ngoài, canh lề và giới hạn chiều rộng nội dung. */}
        <View
          style={[
            styles.content,
            bookingStep === "confirm" && styles.contentFit,
            bookingStep === "rideOptions" && styles.contentRideOptions,
            bookingStep === "findingDriver" && styles.contentFit,
          ]}
        >
        {/* Khối header row: Phần đầu của card/modal/màn hình, thường chứa tiêu đề và nút đóng. */}
        <View style={styles.headerRow}>
          {!isSoloRideTrackingLocked ? (
            /* Nút back có logic theo step: findingDriver/form thì quay stack, rideOptions thì về confirm, confirm thì về form. */
            <Pressable
              onPress={() => {
                if (bookingStep === "findingDriver") {
                  // Đang tracking chuyến đi ngay: quay lại màn trước trong stack Expo Router.
                  router.back();
                  return;
                }

                if (bookingStep === "rideOptions") {
                  // Đang chọn loại xe: không rời màn, chỉ lùi về bước xác nhận route.
                  setBookingStep("confirm");
                  return;
                }

                if (bookingStep === "confirm") {
                  // Đang confirm địa điểm: không rời màn, quay về form nhập địa điểm để sửa.
                  setBookingStep("form");
                  return;
                }

                // Mặc định: quay lại route trước đó trong navigation stack.
                router.back();
              }}
              style={styles.backButton}
            >
              <ThemedText type="subtitle" style={styles.backIcon}>
                {"←"}
              </ThemedText>
            </Pressable>
          ) : null}
          <ThemedText type="default" style={styles.headerTitle}>
                    {"Đặt xe"}
                  </ThemedText>
        </View>

        {/* Khối segment row: Nhóm lựa chọn dạng tab/segment để đổi chế độ hiển thị. */}
        <View style={styles.segmentRow}>
          {/* Tab xe lẻ: gọi selectSingleRide để set mode=now, reset lịch xe ghép và đưa UI về flow đặt xe riêng. */}
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
              {"Xe lẻ"}
            </ThemedText>
          </Pressable>
          {/* Tab xe ghép: gọi selectSharedRide để set mode=shared, load/hiển thị request và group xe ghép. */}
          <Pressable
            style={[styles.segment, mode === "shared" && styles.segmentActive]}
            onPress={selectSharedRide}
            testID="booking-mode-shared"
          >
            <ThemedText
              type="smallBold"
              style={[
                styles.segmentText,
                mode === "shared" && styles.segmentTextActive,
              ]}
            >
              {"Xe ghép"}
            </ThemedText>
          </Pressable>
        </View>

        {bookingStep === "findingDriver" && mode !== "shared" ? (
          /* Khối finding driver stage: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */
          <View testID="booking-finding-driver-stage" style={styles.findingDriverStage}>
            {/* Khối finding radar card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
            <View
              style={[
                styles.findingRadarCard,
                shouldShowTripStatusCard && styles.driverAcceptedCard,
              ]}
            >
              {shouldShowTripStatusCard ? (
                <>
                  {/* Khối driver avatar: Hiển thị avatar/chữ cái đại diện của người dùng. */}
                  <View
                    style={[
                      styles.driverAvatar,
                      trackedTripStatus === "completed" && styles.completedAvatar,
                      trackedTripStatus === "cancelled" && styles.cancelledAvatar,
                      isNoDriverFoundTrip && styles.noDriverFoundAvatar,
                    ]}
                  >
                    <ThemedText type="subtitle" style={styles.driverAvatarText}>
                      {hasAssignedDriver
                        ? (acceptedTrip?.driverName || "T").trim().slice(0, 1).toUpperCase()
                        : tripStatusView.icon}
                    </ThemedText>
                  </View>
                  <ThemedText type="subtitle" style={styles.findingTitle}>
                    {tripStatusView.title}
                  </ThemedText>
                  <ThemedText type="small" style={styles.findingSubtitle}>
                    {tripStatusView.subtitle}
                  </ThemedText>
                  {hasAssignedDriver ? (
                    /* Khối driver info box: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */
                    <View style={styles.driverInfoBox}>
                      <ThemedText type="default" style={styles.driverNameText}>
                        {acceptedTrip?.driverName || activeBookedRide?.driverName || "Tài xế"}
                      </ThemedText>
                      <ThemedText type="small" style={styles.driverInfoText}>
                        {"SĐT: "}{acceptedTrip?.driverPhone || activeBookedRide?.driverPhone || "Chưa có"}
                      </ThemedText>
                      <ThemedText type="small" style={styles.driverInfoText}>
                        {"Biển số: "}{acceptedTrip?.driverLicensePlate || activeBookedRide?.driverLicensePlate || "Chưa có"}
                      </ThemedText>
                      <ThemedText type="small" style={styles.driverInfoText}>
                        {"Xe: "}{acceptedTrip?.driverVehicleInfo || activeBookedRide?.driverVehicleInfo || acceptedTrip?.vehicleType || "Chưa có"}
                      </ThemedText>
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  {/* Khối radar outer: Hiển thị điểm đón, điểm đến và thông tin tuyến đường. */}
                  <View style={styles.radarOuter}>
                    {/* Khối radar middle: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
                    <View style={styles.radarMiddle}>
                      {/* Khối radar inner: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
                      <View style={styles.radarInner}>
                        <ThemedText type="default" style={styles.radarIcon}>
                          {"●"}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                  <ThemedText type="subtitle" style={styles.findingTitle}>
                    {tripStatusView.title}
                  </ThemedText>
                  <ThemedText type="small" style={styles.findingSubtitle}>
                    {tripStatusView.subtitle}
                  </ThemedText>
                </>
              )}
            </View>

            {/* Khối finding trip card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
            <View style={styles.findingTripCard}>
              {/* Khối finding trip header: Phần đầu của card/modal/màn hình, thường chứa tiêu đề và nút đóng. */}
              <View style={styles.findingTripHeader}>
                <ThemedText type="smallBold" style={styles.findingVehicle}>
                  {activeBookedRide?.vehicleName ?? getRideOptionDisplayLabel(selectedRideOption)}
                </ThemedText>
                <ThemedText type="smallBold" style={styles.findingFare}>
                  {activeBookedRide?.estimatedFare ?? selectedRidePrice}
                </ThemedText>
              </View>
              <ThemedText type="small" style={styles.findingMeta}>
                {(activeBookedRide?.tripDuration ??
                  backendTripMetrics?.durationText ??
                  verifiedTripMap?.directions.durationText ??
                  "--")} {"•"}{" "}
                {(activeBookedRide?.tripDistance ??
                  backendTripMetrics?.distanceText ??
                  verifiedTripMap?.directions.distanceText ??
                  "--")}
              </ThemedText>
              <ThemedText type="smallBold" style={styles.findingStatusText}>
                {tripStatusView.label}
              </ThemedText>
              {/* Khối finding route box: Hiển thị điểm đón, điểm đến và thông tin tuyến đường. */}
              <View style={styles.findingRouteBox}>
                <ThemedText type="smallBold" style={styles.findingAddress} numberOfLines={2}>
                  {"Đón: "}{activeBookedRide?.pickup ?? verifiedFromLabel}
                </ThemedText>
                <ThemedText type="smallBold" style={styles.findingAddress} numberOfLines={2}>
                  {"Đến: "}{activeBookedRide?.destination ?? verifiedToLabel}
                </ThemedText>
              </View>
              {isCompletedTrip ? (
                /* Khối completed summary box: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */
                <View style={styles.completedSummaryBox}>
                  {/* Khối completed summary row: Dàn các phần tử trên cùng một hàng. */}
                  <View style={styles.completedSummaryRow}>
                    <ThemedText type="small" style={styles.completedSummaryLabel}>
                      {"Tổng tiền"}
                    </ThemedText>
                    <ThemedText type="smallBold" style={styles.completedSummaryValue}>
                      {completedFare}
                    </ThemedText>
                  </View>
                  {/* Khối completed summary row: Dàn các phần tử trên cùng một hàng. */}
                  <View style={styles.completedSummaryRow}>
                    <ThemedText type="small" style={styles.completedSummaryLabel}>
                      {"Thời gian hoàn thành"}
                    </ThemedText>
                    <ThemedText type="smallBold" style={styles.completedSummaryValue}>
                      {completedAtText}
                    </ThemedText>
                  </View>
                </View>
              ) : null}
              {isCompletedTrip ? (
                /* Khối completed action row: Dàn các phần tử trên cùng một hàng. */
                <View style={styles.completedActionRow}>
                  {/* Pressable: Vùng bấm xử lý thao tác người dùng trong UI. */}
                  <Pressable
                    testID="booking-completed-review-button"
                    style={[
                      styles.completedReviewButton,
                      hasReviewedCompletedTrip && styles.completedReviewButtonDisabled,
                    ]}
                    disabled={hasReviewedCompletedTrip}
                    onPress={openCompletedTripReview}
                  >
                    <ThemedText type="smallBold" style={styles.completedReviewText}>
                      {hasReviewedCompletedTrip ? "Đã đánh giá" : "Đánh giá tài xế"}
                    </ThemedText>
                  </Pressable>
                  {/* Pressable: Vùng bấm xử lý thao tác người dùng trong UI. */}
                  <Pressable
                    style={styles.completedHomeButton}
                    onPress={resetSingleRideBookingForm}
                  >
                    <ThemedText type="smallBold" style={styles.completedHomeText}>
                      {"Quay lại"}
                    </ThemedText>
                  </Pressable>
                </View>
              ) : isSoloRideInProgress ? null : isNoDriverFoundTrip ? (
                /* Khi BE trả NoDriverFound (terminal): gọi extend search để BE refresh tìm tài xế.
                   handleExtendSoloSearch catch 400 và giữ user ở màn đang tìm. */
                <View style={styles.findingActionsRow}>
                  <Pressable
                    testID="booking-finding-no-driver-extend"
                    style={[
                      styles.findingSecondaryButton,
                      isExtendingSoloSearch && styles.bookButtonDisabled,
                    ]}
                    disabled={isExtendingSoloSearch}
                    onPress={handleExtendSoloSearch}
                  >
                    <ThemedText
                      type="smallBold"
                      style={styles.findingSecondaryText}
                    >
                      {isExtendingSoloSearch ? "Đang xử lý..." : "Chờ tiếp"}
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    testID="booking-finding-no-driver-cancel"
                    style={[
                      styles.findingSecondaryButton,
                      styles.cancelRideButton,
                      isCancellingRide && styles.bookButtonDisabled,
                    ]}
                    disabled={isCancellingRide}
                    onPress={handleCancelBookedRide}
                  >
                    <ThemedText
                      type="smallBold"
                      style={styles.cancelRideButtonText}
                    >
                      {"Hủy chuyến"}
                    </ThemedText>
                  </Pressable>
                </View>
              ) : (
                /* Nút hủy thao tác hiện tại và đóng form/modal liên quan. */
                <Pressable
                  testID="booking-finding-secondary-button"
                  style={[
                    styles.findingSecondaryButton,
                    canCancelTrackedTrip && styles.cancelRideButton,
                    isCancellingRide && styles.bookButtonDisabled,
                  ]}
                  disabled={isCancellingRide}
                  onPress={() => {
                    if (canCancelTrackedTrip) {
                      handleCancelBookedRide();
                    } else if (trackedTripStatus === "cancelled") {
                      resetSingleRideBookingForm();
                    } else {
                      setBookingStep("rideOptions");
                    }
                  }}
                >
                  <ThemedText
                    type="smallBold"
                    style={[
                      styles.findingSecondaryText,
                      canCancelTrackedTrip && styles.cancelRideButtonText,
                    ]}
                  >
                    {isCancellingRide
                      ? "Đang hủy..."
                      : canCancelTrackedTrip
                        ? "Hủy chuyến"
                        : "Quay lại"}
                  </ThemedText>
                </Pressable>
              )}
            </View>

            {shouldShowSoloNoDriverPrompt ? (
              /* Khối no driver prompt: Hiển thị khi chờ tài xế quá thời gian, cho phép tiếp tục tìm hoặc hủy. */
              <View
                testID="booking-solo-no-driver-prompt"
                style={styles.noDriverPromptCard}
              >
                <ThemedText type="smallBold" style={styles.noDriverPromptTitle}>
                  {"Chưa tìm được tài xế"}
                </ThemedText>
                <ThemedText type="small" style={styles.noDriverPromptSubtitle}>
                  {"Bạn muốn tiếp tục chờ hay hủy chuyến?"}
                </ThemedText>
                <View style={styles.noDriverPromptActions}>
                  <Pressable
                    testID="booking-solo-no-driver-extend"
                    style={[
                      styles.noDriverPromptSecondaryButton,
                      isExtendingSoloSearch && styles.buttonDisabled,
                    ]}
                    disabled={isExtendingSoloSearch}
                    onPress={handleExtendSoloSearch}
                  >
                    <ThemedText type="smallBold" style={styles.noDriverPromptSecondaryText}>
                      {isExtendingSoloSearch ? "Đang xử lý..." : "Tiếp tục tìm"}
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    testID="booking-solo-no-driver-cancel"
                    style={[
                      styles.noDriverPromptPrimaryButton,
                      isCancellingRide && styles.buttonDisabled,
                    ]}
                    disabled={isCancellingRide}
                    onPress={handleCancelBookedRide}
                  >
                    <ThemedText type="smallBold" style={styles.noDriverPromptPrimaryText}>
                      {isCancellingRide ? "Đang hủy..." : "Hủy chuyến"}
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        ) : bookingStep === "rideOptions" && mode !== "shared" ? (
          <>
            {/* Khối dots row: Dàn các phần tử trên cùng một hàng. */}
            <View style={styles.dotsRow}>
              {/* Khối dot active: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
              <View style={styles.dotActive} />
              {/* Khối dot active: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
              <View style={styles.dotActive} />
              {/* Khối dot active: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
              <View style={styles.dotActive} />
            </View>

            {/* Khối route map card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
            <View style={styles.routeMapCard}>
              {verifiedTripMap ? (
                /* WebView: Nhúng bản đồ HTML tương tác để hiển thị tuyến đường/marker. */
                <WebView
                  key={`route-map-${verifiedTripMap.origin.placeId || verifiedTripMap.origin.formattedAddress}-${verifiedTripMap.destination.placeId || verifiedTripMap.destination.formattedAddress}`}
                  source={{ html: routeMapHtml }}
                  style={styles.googleMapImage}
                  originWhitelist={["*"]}
                  javaScriptEnabled
                  domStorageEnabled
                  mixedContentMode="always"
                  scrollEnabled
                  nestedScrollEnabled
                />
              ) : (
                /* Khối route map fallback: Khu vực bản đồ/preview tuyến đường cho chuyến đi. */
                <View style={styles.routeMapFallback}>
                  {/* Khối route map fallback header: Phần đầu của card/modal/màn hình, thường chứa tiêu đề và nút đóng. */}
                  <View style={styles.routeMapFallbackHeader}>
                    <ThemedText type="smallBold" style={styles.routeMapFallbackTitle}>
                    {"Tuyến đường đã xác minh"}
                  </ThemedText>
                    <ThemedText type="small" style={styles.routeMapFallbackMeta}>
                      {backendTripMetrics?.durationText ||
                        verifiedTripMap?.directions.durationText ||
                        "Đang tính"} {"•"}{" "}
                      {backendTripMetrics?.distanceText ||
                        verifiedTripMap?.directions.distanceText ||
                        "--"}
                    </ThemedText>
                  </View>
                  {/* Khối route map fallback body: Khu vực bản đồ/preview tuyến đường cho chuyến đi. */}
                  <View style={styles.routeMapFallbackBody}>
                    <ThemedText type="smallBold" style={styles.routeMapFallbackPoint}>
                      {verifiedFromLabel}
                    </ThemedText>
                    <ThemedText type="small" style={styles.routeMapFallbackArrow}>
                    {"↓"}
                  </ThemedText>
                    <ThemedText type="smallBold" style={styles.routeMapFallbackPoint}>
                      {verifiedToLabel}
                    </ThemedText>
                  </View>
                </View>
              )}
              {/* Khối route map top bar: Khu vực bản đồ/preview tuyến đường cho chuyến đi. */}
              <View style={styles.routeMapTopBar}>
                {/* Khối route info pill: Hiển thị điểm đón, điểm đến và thông tin tuyến đường. */}
                <View style={styles.routeInfoPill}>
                  <ThemedText type="smallBold" style={styles.routeInfoText}>
                    {backendTripMetrics?.durationText ||
                      verifiedTripMap?.directions.durationText ||
                      "Đang tính"} {"•"}{" "}
                    {backendTripMetrics?.distanceText ||
                      verifiedTripMap?.directions.distanceText ||
                      "--"}
                  </ThemedText>
                </View>
              </View>
              {/* Khối route destination pill: Hiển thị điểm đón, điểm đến và thông tin tuyến đường. */}
              <View style={styles.routeDestinationPill}>
                <ThemedText
                  type="smallBold"
                  style={styles.routeDestinationText}
                  numberOfLines={1}
                >
                  {verifiedToLabel}
                </ThemedText>
              </View>
            </View>

            {/* Khối ride options sheet: Thông tin nhóm/chuyến xe ghép đang hiển thị. */}
            <View testID="booking-ride-options-stage" style={styles.rideOptionsSheet}>
              {/* Khối sheet handle: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
              <View style={styles.sheetHandle} />
              <ThemedText type="default" style={styles.rideSheetTitle}>
                    {isHomeBookingFlow ? "Giá chuyến đi" : "Chọn loại xe"}
                  </ThemedText>
              {Boolean(ridePriceError) && (
                <ThemedText type="small" style={styles.paymentNoticeText}>
                  {ridePriceError}
                </ThemedText>
              )}
              {isHomeBookingFlow ? (
                /* Khối ride option: Thông tin nhóm/chuyến xe ghép đang hiển thị. */
                <View
                  testID={`booking-ride-option-${selectedRideOption.id}`}
                  style={[
                    styles.rideOption,
                    { backgroundColor: theme.backgroundElement },
                    styles.rideOptionActive,
                  ]}
                >
                  {/* Khối ride option name: Thông tin nhóm/chuyến xe ghép đang hiển thị. */}
                  <View>
                    <ThemedText type="smallBold" style={styles.rideOptionName}>
                      {getRideOptionDisplayLabel(selectedRideOption)}
                    </ThemedText>
                  </View>
                  <ThemedText type="default" style={styles.rideOptionPrice}>
                    {isLoadingRidePrices ? "Đang tính..." : selectedRidePrice ?? "--"}
                  </ThemedText>
                </View>
              ) : (
                availableRideOptions.map((option) => {
                  const isSelected = option.id === selectedRideId;

                  return (
                    /* Chọn loại xe: gọi selectRideOption(option), cập nhật selectedRideId và nếu cần gọi lại VietMap route theo profile xe mới. */
                    <Pressable
                      testID={`booking-ride-option-${option.id}`}
                      key={option.id}
                      style={[
                        styles.rideOption,
                        { backgroundColor: theme.backgroundElement },
                        isSelected && styles.rideOptionActive,
                      ]}
                      onPress={() => selectRideOption(option)}
                      >
                      {/* Khối ride option name: Thông tin nhóm/chuyến xe ghép đang hiển thị. */}
                      <View>
                        <ThemedText type="smallBold" style={styles.rideOptionName}>
                          {getRideOptionDisplayLabel(option)}
                        </ThemedText>
                      </View>
                      <ThemedText type="default" style={styles.rideOptionPrice}>
                        {isLoadingRidePrices
                          ? "Đang tính..."
                          : ridePriceQuotes[option.id] ?? "--"}
                      </ThemedText>
                    </Pressable>
                  );
                })
              )}
              {/* Nút đặt xe: gọi handleBookRide, gửi createTripPayload lên BE, lưu bookedTrip local rồi chuyển sang tracking/tabs. */}
              <Pressable
                testID="booking-book-button"
                style={[
                  styles.bookButton,
                  (isBookingRide || isVerifyingMap) && styles.bookButtonDisabled,
                ]}
                onPress={handleBookRide}
                disabled={isBookingRide || isVerifyingMap}
              >
                <ThemedText type="smallBold" style={styles.bookButtonText}>
                  {isBookingRide ? "Đang đặt..." : "Đặt xe"}
                </ThemedText>
              </Pressable>
            </View>
          </>
        ) : bookingStep === "confirm" && mode !== "shared" ? (
          /* Khối confirm stage: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */
          <View testID="booking-confirm-stage" style={styles.confirmStage}>
            {/* Khối dots row: Dàn các phần tử trên cùng một hàng. */}
            <View style={styles.dotsRow}>
              {/* Khối dot active: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
              <View style={styles.dotActive} />
              {/* Khối dot active: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
              <View style={styles.dotActive} />
              {/* Khối dot inactive: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
              <View style={styles.dotInactive} />
            </View>

            {/* Khối pickup map card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
            <View style={styles.pickupMapCard}>
              {verifiedTripMap ? (
                /* WebView: Nhúng bản đồ HTML tương tác để hiển thị tuyến đường/marker. */
                <WebView
                  key={`pickup-map-${verifiedTripMap.origin.placeId || verifiedTripMap.origin.formattedAddress}`}
                  source={{ html: pickupMapHtml }}
                  style={styles.googleMapImage}
                  originWhitelist={["*"]}
                  javaScriptEnabled
                  domStorageEnabled
                  mixedContentMode="always"
                  scrollEnabled
                  nestedScrollEnabled
                  onMessage={handlePickupMapMessage}
                />
              ) : (
                <>
                  {/* Khối pin wrap: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
                  <View style={styles.pinWrap}>
                    <ThemedText type="default" style={styles.pinIcon}>
                    {"●"}
                  </ThemedText>
                  </View>
                  <ThemedText type="default" style={styles.mapLabel}>
                    {fromLabel}
                  </ThemedText>
                </>
              )}
            </View>

            {/* Khối pickup confirm sheet: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
            <View style={styles.pickupConfirmSheet}>
              {/* Khối pickup address row: Dàn các phần tử trên cùng một hàng. */}
              <View style={styles.pickupAddressRow}>
                {/* Khối pickup address icon wrap: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
                <View style={styles.pickupAddressIconWrap}>
                  <ThemedText type="default" style={styles.pickupAddressIcon}>
                    {"📍"}
                  </ThemedText>
                  <ThemedText type="small" style={styles.pickupDistanceText}>
                    20 m
                  </ThemedText>
                </View>
                {/* Khối pickup address content: Bố cục bao ngoài, canh lề và giới hạn chiều rộng nội dung. */}
                <View style={styles.pickupAddressContent}>
                  <ThemedText
                    type="default"
                    style={styles.pickupAddressTitle}
                    numberOfLines={2}
                  >
                    {verifiedFromLabel}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={styles.pickupAddressSubtitle}
                    numberOfLines={2}
                  >
                    {"Điểm đến: "}{verifiedToLabel}
                  </ThemedText>
                </View>
              </View>

              {/* TextInput: Ô nhập dữ liệu người dùng, thường đi kèm validate và state form. */}
              <TextInput
                {...vietnameseTextInputProps}
                placeholder={"Thêm ghi chú cho bác tài (ví dụ: gần cổng)."}
                placeholderTextColor="#9CA3AF"
                style={styles.pickupNoteInput}
                value={driverNote}
                onChangeText={setDriverNote}
              />

              {Boolean(scheduledRideTime) && (
                /* Khối pickup schedule badge: Nhãn trạng thái nhỏ giúp người dùng quét thông tin nhanh. */
                <View style={styles.pickupScheduleBadge}>
                  <ThemedText type="smallBold" style={styles.pickupScheduleText}>
                    {"Hẹn lịch: "}{scheduledRideTime}
                  </ThemedText>
                </View>
              )}

              {/* Xác nhận điểm đến: không gọi API mới, chỉ chuyển bookingStep sang rideOptions để hiện giá và loại xe. */}
              <Pressable
                testID="booking-confirm-destination-button"
                style={styles.pickupConfirmButton}
                onPress={() => setBookingStep("rideOptions")}
              >
                <ThemedText type="smallBold" style={styles.pickupConfirmButtonText}>
                  {"Xác nhận điểm đến"}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        ) : mode !== "shared" ? (
          <>
            {/* Khối field group: Nhóm label, input và lỗi validate của một trường form. */}
            <View style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.inputLabel}>
                {"Điểm đón"}
              </ThemedText>
              {/* Khối input wrap: Bao ô nhập và nút phụ như xóa nhanh hoặc chọn gợi ý. */}
              <View
                style={[
                  styles.inputWrap,
                  {
                    backgroundColor: theme.backgroundElement,
                  },
                ]}
              >
                {/* TextInput: Ô nhập dữ liệu người dùng, thường đi kèm validate và state form. */}
                <TextInput
                  testID="booking-pickup-input"
                  ref={fromInputRef}
                  {...vietnameseTextInputProps}
                  placeholder={"Nhập điểm xuất phát"}
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.input,
                    {
                      color: fromInput ? PICKUP_BLUE : theme.text,
                    },
                  ]}
                  value={fromInput}
                  onChangeText={(value) => {
                    hasEditedFromInputRef.current = true;
                    setFromInput(value);
                    setSelectedFromPlace(null);
                    setSelectedToPlace(null);
                    setVerifiedTripMap(null);
                    if (value.trim().length < 2) {
                      setAddressSuggestions((current) => ({
                        ...current,
                        from: [],
                      }));
                      setSuggestionError((current) => ({
                        ...current,
                        from: '',
                      }));
                    }
                    if (alertMessage) {
                      setAlertMessage('');
                    }
                  }}
                  onFocus={() => setFocusedField('from')}
                />
                {Boolean(fromInput) && (
                  /* Xóa điểm đón: clearAddressField("from") reset input, selectedFromPlace, suggestions và verifiedTripMap. */
                  <Pressable
                    style={styles.inputClearButton}
                    onPress={() => clearAddressField("from")}
                  >
                    <ThemedText type="smallBold" style={styles.inputClearText}>
                      {"×"}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            </View>
            {focusedField === "from" &&
              (addressSuggestions.from.length > 0 ||
                loadingSuggestionsFor === "from" ||
                suggestionError.from) && (
                /* Khối suggestion card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */
                <View style={styles.suggestionCard}>
                  {loadingSuggestionsFor === "from" ? (
                    <ThemedText type="small" style={styles.suggestionLoading}>
                      {"Đang tải gợi ý..."}
                    </ThemedText>
                  ) : suggestionError.from ? (
                    <ThemedText type="small" style={styles.suggestionError}>
                      {suggestionError.from}
                    </ThemedText>
                  ) : (
                    addressSuggestions.from.map((suggestion, index) => (
                      /* Chọn gợi ý điểm đón: selectAddressSuggestion("from", suggestion) resolve VietMap detail và lưu tọa độ pickup. */
                      <Pressable
                        testID={`booking-pickup-suggestion-${index}`}
                        key={suggestion.placeId}
                        style={styles.suggestionItem}
                        onPress={() => selectAddressSuggestion("from", suggestion)}
                      >
                        {/* Khối suggestion icon: Danh sách gợi ý địa điểm trả về từ dịch vụ bản đồ. */}
                        <View style={styles.suggestionIcon}>
                          <ThemedText type="smallBold" style={styles.suggestionIconText}>
                            {"•"}
                          </ThemedText>
                        </View>
                        {/* Khối suggestion content: Bố cục bao ngoài, canh lề và giới hạn chiều rộng nội dung. */}
                        <View style={styles.suggestionContent}>
                          <ThemedText
                            type="smallBold"
                            style={styles.suggestionMainText}
                            numberOfLines={1}
                          >
                            {suggestion.mainText}
                          </ThemedText>
                          <ThemedText
                            type="small"
                            style={styles.suggestionSecondaryText}
                            numberOfLines={2}
                          >
                            {suggestion.secondaryText || suggestion.description}
                          </ThemedText>
                        </View>
                      </Pressable>
                    ))
                  )}

                  <ThemedText type="small" style={styles.suggestionAttribution}>
                    VietMap
                  </ThemedText>
                </View>
              )}
            {/* Khối field group: Nhóm label, input và lỗi validate của một trường form. */}
            <View style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.inputLabel}>
                {"Điểm đến"}
              </ThemedText>
              {/* Khối input wrap: Bao ô nhập và nút phụ như xóa nhanh hoặc chọn gợi ý. */}
              <View
                style={[
                  styles.inputWrap,
                  {
                    backgroundColor: theme.backgroundElement,
                  },
                ]}
              >
                {/* TextInput: Ô nhập dữ liệu người dùng, thường đi kèm validate và state form. */}
                <TextInput
                  testID="booking-destination-input"
                  ref={toInputRef}
                  {...vietnameseTextInputProps}
                  placeholder={"Bạn muốn đi đâu?"}
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.input,
                    {
                      color: toInput ? DESTINATION_GREEN : theme.text,
                    },
                  ]}
                  value={toInput}
                  onChangeText={(value) => {
                    setToInput(value);
                    setSelectedToPlace(null);
                    setVerifiedTripMap(null);
                    if (value.trim().length < 2) {
                      setAddressSuggestions((current) => ({
                        ...current,
                        to: [],
                      }));
                      setSuggestionError((current) => ({
                        ...current,
                        to: '',
                      }));
                    }
                    if (alertMessage) {
                      setAlertMessage('');
                    }
                  }}
                  onFocus={() => setFocusedField('to')}
                />
                {Boolean(toInput) && (
                  /* Xóa điểm đến: clearAddressField("to") reset input, selectedToPlace, suggestions và verifiedTripMap. */
                  <Pressable
                    style={styles.inputClearButton}
                    onPress={() => clearAddressField("to")}
                  >
                    <ThemedText type="smallBold" style={styles.inputClearText}>
                      {"×"}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            </View>
            {focusedField === "to" &&
              (addressSuggestions.to.length > 0 ||
                loadingSuggestionsFor === "to" ||
                suggestionError.to) && (
                /* Khối suggestion card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */
                <View style={styles.suggestionCard}>
                  {loadingSuggestionsFor === "to" ? (
                    <ThemedText type="small" style={styles.suggestionLoading}>
                      {"Đang tải gợi ý..."}
                    </ThemedText>
                  ) : suggestionError.to ? (
                    <ThemedText type="small" style={styles.suggestionError}>
                      {suggestionError.to}
                    </ThemedText>
                  ) : (
                    addressSuggestions.to.map((suggestion, index) => (
                      /* Chọn gợi ý điểm đến: selectAddressSuggestion("to", suggestion) resolve VietMap detail và lưu tọa độ destination. */
                      <Pressable
                        testID={`booking-destination-suggestion-${index}`}
                        key={suggestion.placeId}
                        style={styles.suggestionItem}
                        onPress={() => selectAddressSuggestion("to", suggestion)}
                      >
                        {/* Khối suggestion icon: Danh sách gợi ý địa điểm trả về từ dịch vụ bản đồ. */}
                        <View style={styles.suggestionIcon}>
                          <ThemedText type="smallBold" style={styles.suggestionIconText}>
                    {"•"}
                  </ThemedText>
                        </View>
                        {/* Khối suggestion content: Bố cục bao ngoài, canh lề và giới hạn chiều rộng nội dung. */}
                        <View style={styles.suggestionContent}>
                          <ThemedText
                            type="smallBold"
                            style={styles.suggestionMainText}
                            numberOfLines={1}
                          >
                            {suggestion.mainText}
                          </ThemedText>
                          <ThemedText
                            type="small"
                            style={styles.suggestionSecondaryText}
                            numberOfLines={2}
                          >
                            {suggestion.secondaryText || suggestion.description}
                          </ThemedText>
                        </View>
                      </Pressable>
                    ))
                  )}
                  <ThemedText type="small" style={styles.suggestionAttribution}>
                    VietMap
                  </ThemedText>
                </View>
              )}

            {/* Khối saved list: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
            <View style={styles.savedList}>
              {/* Khối saved header: Phần đầu của card/modal/màn hình, thường chứa tiêu đề và nút đóng. */}
              <View style={styles.savedHeader}>
                <ThemedText type="smallBold">{"Địa chỉ đã lưu"}</ThemedText>
                {/* Mở modal lưu địa chỉ: reset addressForm rồi hiển thị form tạo địa chỉ mới. */}
                <Pressable onPress={openCreateAddressModal}>
                  <ThemedText type="smallBold" style={styles.saveAddressButtonText}>
                    {"+ Lưu địa chỉ"}
                  </ThemedText>
                </Pressable>
              </View>
              {savedAddresses.map((item) => (
                /* Khối saved item row wrap: Dàn các phần tử trên cùng một hàng. */
                <View key={item.id} style={styles.savedItemRowWrap}>
                  {/* Dùng địa chỉ đã lưu: fillAddressToFocusedField(item) đưa label vào ô đang focus và resolve tọa độ qua VietMap. */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.savedItem,
                      pressed && styles.savedItemPressed,
                    ]}
                    onPress={() => fillAddressToFocusedField(item)}
                  >
                    <ThemedText
                      style={[
                        styles.savedItemText,
                        (fromInput === item.label || toInput === item.label) &&
                          styles.savedItemTextActive,
                      ]}
                    >
                      {item.label}
                    </ThemedText>
                  </Pressable>
                  {/* Mở/đóng menu nhỏ của địa chỉ đã lưu; chỉ đổi openAddressMenuId, chưa sửa/xóa dữ liệu. */}
                  <Pressable
                    style={styles.savedMoreButton}
                    onPress={() =>
                      setOpenAddressMenuId((current) =>
                        current === item.id ? "" : item.id
                      )
                    }
                  >
                    <ThemedText type="smallBold" style={styles.savedMoreText}>
                      {"⋯"}
                    </ThemedText>
                  </Pressable>

                  {openAddressMenuId === item.id && (
                    /* Khối saved mini menu: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */
                    <View style={styles.savedMiniMenu}>
                      {/* Sửa địa chỉ lưu: mở modal edit, nạp item hiện tại vào addressForm. */}
                      <Pressable
                        style={styles.savedMiniAction}
                        onPress={() => openEditAddressModal(item)}
                      >
                        <ThemedText type="smallBold" style={styles.savedEditText}>
                          {"Sửa"}
                        </ThemedText>
                      </Pressable>
                      {/* Xóa địa chỉ lưu: deleteAddress(item.id) remove khỏi savedAddresses state. */}
                      <Pressable
                        style={styles.savedMiniAction}
                        onPress={() => deleteAddress(item.id)}
                      >
                        <ThemedText type="smallBold" style={styles.savedDeleteText}>
                          {"Xóa"}
                        </ThemedText>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}
            </View>

            {/* Khối button row: Nhóm nút cuối form để hủy hoặc xác nhận thao tác. */}
            <View style={styles.buttonRow}>
              {/* Hẹn lịch: openSchedulePicker verify địa điểm trước, sau đó mở modal chọn ngày/giờ. */}
              <Pressable
                style={[
                  styles.secondaryButton,
                  isOpeningSchedulePicker && styles.buttonDisabled,
                ]}
                onPress={openSchedulePicker}
                disabled={isOpeningSchedulePicker}
              >
                <ThemedText type="smallBold" style={styles.secondaryButtonText}>
                  {isOpeningSchedulePicker ? "Đang mở..." : "Hẹn lịch"}
                </ThemedText>
              </Pressable>

              {/* Tiếp tục: showConfirmationStep gọi verifyBookingLocations, nhận verifiedTripMap rồi sang bước confirm. */}
              <Pressable
                testID="booking-continue-button"
                style={[styles.primaryButton, isVerifyingMap && styles.buttonDisabled]}
                onPress={showConfirmationStep}
                disabled={isVerifyingMap}
              >
                <ThemedText type="smallBold" style={styles.primaryButtonText}>
                  {"Tiếp tục"}
                </ThemedText>
              </Pressable>
            </View>
          </>
        ) : (
          /* Khối shared section: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */
          <View testID="ride-sharing-section" style={styles.sharedSection}>
            {/* Khối pending shared section: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
            <View style={styles.pendingSharedSection}>
              {/* Khối shared header: Phần đầu của card/modal/màn hình, thường chứa tiêu đề và nút đóng. */}
              <View style={styles.sharedHeader}>
                <ThemedText type="default" style={styles.pendingSharedTitle}>
                  {"Yêu cầu xe ghép của bạn"}
                </ThemedText>
                {/* Tạo yêu cầu xe ghép: kiểm tra login rồi mở modal createSharedVisible để nhập direction/date/slot/location. */}
                <Pressable
                  testID="ride-sharing-create-button"
                  onPress={() => {
                    if (requireLogin()) {
                      setCreateSharedVisible(true);
                    }
                  }}
                >
                  <ThemedText type="smallBold" style={styles.createButtonText}>
                    {"+ Tạo yêu cầu"}
                  </ThemedText>
                </Pressable>
              </View>

              {/* Khối shared request filter box: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
              <View style={styles.sharedRequestFilterBox}>
                <ThemedText type="smallBold" style={styles.sharedRequestFilterLabel}>
                  {"Chọn chuyến ghép"}
                </ThemedText>
                {/* Mở dropdown lọc request: chỉ đổi openSharedDropdown, không gọi API. */}
                <Pressable
                  style={styles.sharedRequestSelect}
                  onPress={() =>
                    setOpenSharedDropdown((current) =>
                      current === "requestFilter" ? "" : "requestFilter"
                    )
                  }
                >
                  <ThemedText type="smallBold" style={styles.sharedRequestSelectText}>
                    {selectedSharedRequestFilterLabel}
                  </ThemedText>
                  <ThemedText type="default" style={styles.sharedRequestSelectIcon}>
                    {openSharedDropdown === "requestFilter" ? "▲" : "▼"}
                  </ThemedText>
                </Pressable>

                {openSharedDropdown === "requestFilter" && (
                  /* Khối shared request dropdown: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */
                  <View style={styles.sharedRequestDropdown}>
                    {sharedRequestFilterOptions.map((option) => (
                      /* Chọn filter request: cập nhật sharedRequestFilter để lọc pendingSharedRequests theo booked/cancelled/etc. */
                      <Pressable
                        key={option.id}
                        style={[
                          styles.sharedRequestDropdownItem,
                          sharedRequestFilter === option.id &&
                            styles.sharedRequestDropdownItemActive,
                        ]}
                        onPress={() => {
                          setSharedRequestFilter(option.id);
                          setOpenSharedDropdown("");
                        }}
                      >
                        <ThemedText
                          type="smallBold"
                          style={[
                            styles.sharedRequestDropdownText,
                            sharedRequestFilter === option.id &&
                              styles.sharedRequestDropdownTextActive,
                          ]}
                        >
                          {option.label}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              {Boolean(sharedCancelError) && (
                <ThemedText type="smallBold" style={styles.createError}>
                  {sharedCancelError}
                </ThemedText>
              )}

              {isLoadingSharedState ? (
                /* Khối pending shared empty card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */
                <View style={styles.pendingSharedEmptyCard}>
                  <ThemedText type="small" style={styles.pendingSharedMeta}>
                    {"Đang tải yêu cầu xe ghép của bạn..."}
                  </ThemedText>
                </View>
              ) : waitingSharedRequests.length === 0 ? (
                /* Khối pending shared empty card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */
                <View style={styles.pendingSharedEmptyCard}>
                  <ThemedText type="smallBold" style={styles.emptySharedTitle}>
                    {"Chưa có yêu cầu xe ghép"}
                  </ThemedText>
                  <ThemedText type="small" style={styles.emptySharedText}>
                    {"Bạn chưa có yêu cầu xe ghép nào đang chờ ghép nhóm. Hãy tạo yêu cầu mới hoặc chọn bộ lọc khác."}
                  </ThemedText>
                </View>
              ) : null}

              {waitingSharedRequests.map((request, index) => (
                /* Khối pending shared card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */
                <View
                  key={request.id}
                  testID={`ride-sharing-request-card-${index}`}
                  style={styles.pendingSharedCard}
                >
                  {/* Khối pending shared header: Phần đầu của card/modal/màn hình, thường chứa tiêu đề và nút đóng. */}
                  <View style={styles.pendingSharedHeader}>
                    <ThemedText type="smallBold" style={styles.pendingSharedVehicle}>
                      {request.vehicle}
                    </ThemedText>
                    {/* Khối pending badge: Nhãn trạng thái nhỏ giúp người dùng quét thông tin nhanh. */}
                    <View style={styles.pendingBadge}>
                      <ThemedText type="smallBold" style={styles.pendingBadgeText}>
                        {request.statusLabel}
                      </ThemedText>
                    </View>
                  </View>

                  <ThemedText
                    type="smallBold"
                    style={styles.pendingSharedRoute}
                    numberOfLines={2}
                  >
                    {request.route}
                  </ThemedText>
                  <ThemedText type="small" style={styles.pendingSharedMeta}>
                    {request.scheduleText}
                  </ThemedText>
                  <ThemedText type="small" style={styles.pendingSharedMeta}>
                    {request.groupId
                      ? `Nhóm: ${request.participantCount}/${request.capacity} người • ${request.statusLabel}`
                      : `Chưa vào nhóm • ${request.statusLabel}`}
                  </ThemedText>
                  <ThemedText type="small" style={styles.pendingSharedMeta}>
                    {"Quãng đường: "}{request.distance}{" • "}{request.duration}
                  </ThemedText>
                  {/* Khối pending shared footer: Nhóm nút cuối form để hủy hoặc xác nhận thao tác. */}
                  <View style={styles.pendingSharedFooter}>
                    <ThemedText type="smallBold" style={styles.pendingSharedPrice}>
                      {request.price}
                    </ThemedText>
                    {Boolean(request.groupId) && (
                      /* Điều hướng xem group từ request của tôi: request.groupId là id nhóm BE trả về sau khi match. */
                      /* Màn /search/shared-ride/[id] nhận groupId qua params.id và fetch lại getRideSharingGroup(groupId). */
                      <Pressable
                        testID={`ride-sharing-request-detail-${index}`}
                        style={styles.pendingSharedDetailButton}
                        onPress={() =>
                          router.push(`/search/shared-ride/${request.groupId}`)
                        }
                      >
                        <ThemedText
                          type="smallBold"
                          style={styles.pendingSharedDetailText}
                        >
                          {"Xem nhóm"}
                        </ThemedText>
                      </Pressable>
                    )}
                    {request.requestId &&
                    isSharedRideActive(getSharedRequestEffectiveStatus(request)) ? (
                      /* Hủy request xe ghép: handleCancelSharedRequest gửi requestId lên BE, cập nhật pendingSharedRequests/cache. */
                      <Pressable
                        testID={`ride-sharing-request-cancel-${index}`}
                        style={[
                          styles.pendingSharedCancelButton,
                          cancellingSharedRequestId === request.requestId &&
                            styles.buttonDisabled,
                        ]}
                        onPress={() => handleCancelSharedRequest(request.requestId)}
                        disabled={cancellingSharedRequestId === request.requestId}
                      >
                        <ThemedText
                          type="smallBold"
                          style={styles.pendingSharedCancelText}
                        >
                          {cancellingSharedRequestId === request.requestId
                            ? "Đang hủy..."
                            : "Hủy yêu cầu"}
                        </ThemedText>
                      </Pressable>
                    ) : null}
                  </View>
                  {shouldShowSharedNoDriverPrompt(request) ? (
                    /* Khối shared no driver prompt: Hiển thị khi chờ ghép quá thời gian. */
                    <View
                      testID={`ride-sharing-no-driver-prompt-${index}`}
                      style={styles.noDriverPromptCard}
                    >
                      <ThemedText type="smallBold" style={styles.noDriverPromptTitle}>
                        {"Chưa tìm được nhóm/tài xế"}
                      </ThemedText>
                      <ThemedText type="small" style={styles.noDriverPromptSubtitle}>
                        {"Bạn muốn tiếp tục chờ hay hủy yêu cầu?"}
                      </ThemedText>
                      <View style={styles.noDriverPromptActions}>
                        <Pressable
                          testID={`ride-sharing-no-driver-extend-${index}`}
                          style={[
                            styles.noDriverPromptSecondaryButton,
                            extendingSharedRequestId === request.requestId &&
                              styles.buttonDisabled,
                          ]}
                          disabled={extendingSharedRequestId === request.requestId}
                          onPress={() => handleExtendSharedSearch(request.requestId)}
                        >
                          <ThemedText
                            type="smallBold"
                            style={styles.noDriverPromptSecondaryText}
                          >
                            {extendingSharedRequestId === request.requestId
                              ? "Đang xử lý..."
                              : "Tiếp tục tìm"}
                          </ThemedText>
                        </Pressable>
                        <Pressable
                          testID={`ride-sharing-no-driver-cancel-${index}`}
                          style={[
                            styles.noDriverPromptPrimaryButton,
                            cancellingSharedRequestId === request.requestId &&
                              styles.buttonDisabled,
                          ]}
                          disabled={cancellingSharedRequestId === request.requestId}
                          onPress={() => handleCancelSharedRequest(request.requestId)}
                        >
                          <ThemedText
                            type="smallBold"
                            style={styles.noDriverPromptPrimaryText}
                          >
                            {cancellingSharedRequestId === request.requestId
                              ? "Đang hủy..."
                              : "Hủy yêu cầu"}
                          </ThemedText>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>

            {/* Section "Nhóm của tôi": chỉ render các request đã match vào nhóm (có groupId).
                Tách riêng để tránh hiển thị trộn lẫn status "Đã vào nhóm" / "Chưa vào nhóm" trong cùng một section. */}
            {myJoinedSharedGroups.length > 0 ? (
              <View style={styles.pendingSharedSection}>
                <View style={styles.sharedHeader}>
                  <ThemedText type="default" style={styles.pendingSharedTitle}>
                    {"Nhóm xe ghép của tôi"}
                  </ThemedText>
                </View>

                {myJoinedSharedGroups.map((request, index) => (
                  <View
                    key={request.id}
                    testID={`ride-sharing-my-group-card-${index}`}
                    style={styles.pendingSharedCard}
                  >
                    <View style={styles.pendingSharedHeader}>
                      <ThemedText
                        type="smallBold"
                        style={styles.pendingSharedVehicle}
                      >
                        {request.vehicle}
                      </ThemedText>
                      <View style={styles.pendingBadge}>
                        <ThemedText
                          type="smallBold"
                          style={styles.pendingBadgeText}
                        >
                          {request.statusLabel}
                        </ThemedText>
                      </View>
                    </View>

                    <ThemedText
                      type="smallBold"
                      style={styles.pendingSharedRoute}
                      numberOfLines={2}
                    >
                      {request.route}
                    </ThemedText>
                    <ThemedText type="small" style={styles.pendingSharedMeta}>
                      {request.scheduleText}
                    </ThemedText>
                    <ThemedText type="small" style={styles.pendingSharedMeta}>
                      {`Nhóm: ${request.participantCount}/${request.capacity} người`}
                    </ThemedText>
                    <ThemedText type="small" style={styles.pendingSharedMeta}>
                      {"Quãng đường: "}
                      {request.distance}
                      {" • "}
                      {request.duration}
                    </ThemedText>

                    <View style={styles.pendingSharedFooter}>
                      <ThemedText
                        type="smallBold"
                        style={styles.pendingSharedPrice}
                      >
                        {request.price}
                      </ThemedText>
                      {Boolean(request.groupId) && (
                        <Pressable
                          testID={`ride-sharing-my-group-detail-${index}`}
                          style={styles.pendingSharedDetailButton}
                          onPress={() =>
                            router.push(
                              `/search/shared-ride/${request.groupId}`
                            )
                          }
                        >
                          <ThemedText
                            type="smallBold"
                            style={styles.pendingSharedDetailText}
                          >
                            {"Xem nhóm"}
                          </ThemedText>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Khối shared header: Phần đầu của card/modal/màn hình, thường chứa tiêu đề và nút đóng. */}
            <View style={styles.sharedHeader}>
              <ThemedText type="default" style={styles.sharedTitle}>
                {"Đề xuất nhóm ghép sẵn có"}
              </ThemedText>
            </View>

            {suggestedSharedRides.length === 0 ? (
              /* Khối empty shared card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */
              <View style={styles.emptySharedCard}>
                <ThemedText type="smallBold" style={styles.emptySharedTitle}>
                    {"Chưa có nhóm ghép phù hợp"}
                  </ThemedText>
                <ThemedText type="small" style={styles.emptySharedText}>
                    {"Nhóm chỉ có một người sẽ chưa được đề xuất. Khi có thêm người tham gia, hệ thống sẽ hiển thị tại đây."}
                  </ThemedText>
              </View>
            ) : null}

            {suggestedSharedRides.map((ride, index) => {
              return (
                /* Khối suggested group card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */
                <View
                  key={ride.id}
                  testID={`ride-sharing-suggested-group-${index}`}
                  style={styles.suggestedGroupCard}
                >
                  {/* Khối suggested group top: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
                  <View style={styles.suggestedGroupTop}>
                    {/* Khối suggested group label: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
                    <View style={styles.suggestedGroupLabel}>
                      <ThemedText type="smallBold" style={styles.suggestedGroupLabelText}>
                        {"Nhóm phù hợp"}
                      </ThemedText>
                    </View>
                    {/* Khối suggested group badge: Nhãn trạng thái nhỏ giúp người dùng quét thông tin nhanh. */}
                    <View style={styles.suggestedGroupBadge}>
                      <ThemedText type="smallBold" style={styles.suggestedGroupBadgeText}>
                        {ride.seats}
                      </ThemedText>
                    </View>
                  </View>

                  <ThemedText
                    type="smallBold"
                    style={styles.suggestedGroupVehicle}
                  >
                    {ride.vehicle}
                  </ThemedText>
                  <ThemedText
                    type="default"
                    style={styles.suggestedGroupRoute}
                    numberOfLines={2}
                  >
                    {ride.route}
                  </ThemedText>

                  {/* Khối suggested group chip row: Dàn các phần tử trên cùng một hàng. */}
                  <View style={styles.suggestedGroupChipRow}>
                    {/* Khối suggested group chip: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
                    <View style={styles.suggestedGroupChip}>
                      <ThemedText type="small" style={styles.suggestedGroupChipText}>
                        {ride.scheduleText || "Chưa có lịch"}
                      </ThemedText>
                    </View>
                    {/* Khối suggested group chip: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
                    <View style={styles.suggestedGroupChip}>
                      <ThemedText type="small" style={styles.suggestedGroupChipText}>
                        {ride.statusLabel}
                      </ThemedText>
                    </View>
                  </View>

                  {/* Khối suggested group driver card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
                  <View style={styles.suggestedGroupDriverCard}>
                    <ThemedText type="small" style={styles.suggestedGroupDriverLabel}>
                      {"Tài xế"}
                    </ThemedText>
                    <ThemedText
                      type="smallBold"
                      style={styles.suggestedGroupDriverValue}
                      numberOfLines={1}
                    >
                      {ride.driver || "Chưa có"}
                    </ThemedText>
                  </View>

                  {/* Khối suggested group footer: Nhóm nút cuối form để hủy hoặc xác nhận thao tác. */}
                  <View style={styles.suggestedGroupFooter}>
                    {/* Khối suggested group price block: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
                    <View style={styles.suggestedGroupPriceBlock}>
                      <ThemedText type="small" style={styles.suggestedGroupPriceLabel}>
                        {ride.priceLabel || "Giá mỗi người"}
                      </ThemedText>
                      <ThemedText type="default" style={styles.suggestedGroupPriceValue}>
                        {ride.price || ride.perPersonPrice || "--"}
                      </ThemedText>
                    </View>

                    {/* Khối suggested group actions: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
                    <View style={styles.suggestedGroupActions}>
                      {/* Điều hướng xem chi tiết group đề xuất: ride.id là groupId đã map từ BE available group. */}
                      {/* Không gửi toàn bộ object qua route, chỉ gửi id; màn detail tự gọi API để tránh dùng dữ liệu cũ. */}
                      <Pressable
                        testID={`ride-sharing-suggested-detail-${index}`}
                        style={styles.suggestedGroupSecondaryButton}
                        onPress={() => router.push(`/search/shared-ride/${ride.id}`)}
                      >
                        <ThemedText
                          type="smallBold"
                          style={styles.suggestedGroupSecondaryText}
                        >
                          {"Xem nhóm"}
                        </ThemedText>
                      </Pressable>
                      {/* Mở modal join ngay tại SearchScreen: truyền cả ride card vào state joinSharedGroup để form biết groupId/destination. */}
                      <Pressable
                        testID={`ride-sharing-suggested-join-${index}`}
                        style={styles.suggestedGroupPrimaryButton}
                        onPress={() => openJoinSharedModal(ride)}
                      >
                        <ThemedText
                          type="smallBold"
                          style={styles.suggestedGroupPrimaryText}
                        >
                          {"Tham gia nhóm"}
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
        </View>
      </ScrollView>

      {/* Modal: Lớp giao diện nổi dùng để xác nhận, nhập form hoặc thông báo mà không rời màn hiện tại. */}
      <Modal
        visible={addressModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeAddressModal}
      >
        {/* Khối address overlay: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
        <View style={styles.addressOverlay}>
          {/* Khối address card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
          <View
            style={[
              styles.addressCard,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            {/* Khối address header: Phần đầu của card/modal/màn hình, thường chứa tiêu đề và nút đóng. */}
            <View style={styles.addressHeader}>
              <ThemedText type="default" style={styles.addressTitle}>
                {editingAddressId ? "Sửa địa chỉ" : "Lưu địa chỉ"}
              </ThemedText>
              {/* Nút đóng modal/popup đang hiển thị. */}
              <Pressable style={styles.addressCloseButton} onPress={closeAddressModal}>
                <ThemedText type="default" style={styles.addressCloseText}>
                    {"x"}
                  </ThemedText>
              </Pressable>
            </View>

            {/* Khối address field: Nhóm label, input và lỗi validate của một trường form. */}
            <View style={styles.addressField}>
              <ThemedText type="smallBold" style={styles.addressLabel}>
                    {"Tên địa chỉ"}
                  </ThemedText>
              {/* TextInput: Ô nhập dữ liệu người dùng, thường đi kèm validate và state form. */}
              <TextInput
                {...vietnameseTextInputProps}
                placeholder={"VD: Đại học FPT, Bến xe Mỹ Đình..."}
                placeholderTextColor="#9CA3AF"
                style={[
                  styles.addressInput,
                  { color: theme.text, backgroundColor: theme.background },
                ]}
                value={addressForm.label}
                onChangeText={(value) => updateAddressForm("label", value)}
              />
            </View>

            {Boolean(addressFormError) && (
              <ThemedText type="smallBold" style={styles.addressError}>
                {addressFormError}
              </ThemedText>
            )}

            {/* Khối address button row: Nhóm nút cuối form để hủy hoặc xác nhận thao tác. */}
            <View style={styles.addressButtonRow}>
              {/* Nút hành động chính: gửi dữ liệu người dùng đang nhập lên luồng xử lý. */}
              <Pressable
                style={[styles.addressSecondaryButton, { backgroundColor: theme.background }]}
                onPress={closeAddressModal}
              >
                <ThemedText type="smallBold">{"Hủy"}</ThemedText>
              </Pressable>
              {/* Nút hành động chính: gửi dữ liệu người dùng đang nhập lên luồng xử lý. */}
              <Pressable style={styles.addressPrimaryButton} onPress={saveAddress}>
                <ThemedText type="smallBold" style={styles.addressPrimaryText}>
                    {"Lưu địa chỉ"}
                  </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Lớp giao diện nổi dùng để xác nhận, nhập form hoặc thông báo mà không rời màn hiện tại. */}
      <Modal
        visible={schedulePickerVisible}
        animationType="slide"
        onRequestClose={() => setSchedulePickerVisible(false)}
      >
        {/* Khối schedule screen: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
        <View
          style={[
            styles.scheduleScreen,
            {
              paddingTop: insets.top + Spacing.three,
              paddingBottom: insets.bottom + Spacing.three,
            },
          ]}
        >
          {/* Khối schedule header: Phần đầu của card/modal/màn hình, thường chứa tiêu đề và nút đóng. */}
          <View style={styles.scheduleHeader}>
            {/* Nút quay lại màn trước trong stack điều hướng. */}
            <Pressable
              style={styles.scheduleBackButton}
              onPress={() => setSchedulePickerVisible(false)}
            >
              <ThemedText type="default" style={styles.scheduleBackIcon}>
                    {"←"}
                  </ThemedText>
            </Pressable>
            <ThemedText type="default" style={styles.scheduleTitle}>
                    {"Hẹn giờ"}
                  </ThemedText>
            {/* Khối schedule back button: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
            <View style={styles.scheduleBackButton} />
          </View>

          {/* Khối schedule calendar card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
          <View style={styles.scheduleCalendarCard}>
            <ThemedText type="default" style={styles.scheduleCalendarMonth}>
              {selectedScheduleDate.monthLabel}
            </ThemedText>
            <ThemedText type="default" style={styles.scheduleCalendarDay}>
              {selectedScheduleDate.dayLabel}
            </ThemedText>
          </View>

          {/* Khối schedule intro: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
          <View style={styles.scheduleIntro}>
            <ThemedText type="default" style={styles.scheduleQuestion}>
                    {"Bạn muốn xe đón lúc nào?"}
                  </ThemedText>
            <ThemedText type="default" style={styles.scheduleHint}>
              {"Chọn thời gian trong vòng tối đa 7 ngày kể từ hiện tại."}
            </ThemedText>
          </View>

          {/* Khối schedule picker panel: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
          <View style={styles.schedulePickerPanel}>
            {/* ScrollView: Cho phép nội dung dài cuộn được trên màn hình nhỏ. */}
            <ScrollView
              style={styles.scheduleDateColumn}
              showsVerticalScrollIndicator={false}
            >
              {scheduleDateOptions.map((option) => {
                const isSelected = option.value === selectedScheduleDate.value;

                return (
                  /* Pressable: Vùng bấm xử lý thao tác người dùng trong UI. */
                  <Pressable
                    key={option.value}
                    style={[
                      styles.schedulePickerRow,
                      isSelected && styles.schedulePickerRowActive,
                    ]}
                    onPress={() =>
                      setScheduleDraft((current) =>
                        normalizeBookingSchedule({
                          ...current,
                          date: option.value,
                          dateLabel: option.label,
                          dateDisplay: option.display,
                        })
                      )
                    }
                  >
                    <ThemedText
                      type="smallBold"
                      style={[
                        styles.schedulePickerDateText,
                        isSelected && styles.schedulePickerTextActive,
                      ]}
                    >
                      {option.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* ScrollView: Cho phép nội dung dài cuộn được trên màn hình nhỏ. */}
            <ScrollView
              style={styles.scheduleTimeColumn}
              showsVerticalScrollIndicator={false}
            >
              {scheduleHourOptions.map((hour) => {
                const isSelected = hour === scheduleDraft.hour;

                return (
                  /* Pressable: Vùng bấm xử lý thao tác người dùng trong UI. */
                  <Pressable
                    key={hour}
                    style={[
                      styles.scheduleTimeCell,
                      isSelected && styles.scheduleTimeCellActive,
                    ]}
                    onPress={() =>
                      setScheduleDraft((current) =>
                        normalizeBookingSchedule({ ...current, hour })
                      )
                    }
                  >
                    <ThemedText
                      type="default"
                      style={[
                        styles.scheduleTimeText,
                        isSelected && styles.schedulePickerTextActive,
                      ]}
                    >
                      {hour}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>

            <ThemedText type="default" style={styles.scheduleColon}>
              :
            </ThemedText>

            {/* ScrollView: Cho phép nội dung dài cuộn được trên màn hình nhỏ. */}
            <ScrollView
              style={styles.scheduleTimeColumn}
              showsVerticalScrollIndicator={false}
            >
              {scheduleMinuteOptions.map((minute) => {
                const isSelected = minute === scheduleDraft.minute;

                return (
                  /* Pressable: Vùng bấm xử lý thao tác người dùng trong UI. */
                  <Pressable
                    key={minute}
                    style={[
                      styles.scheduleTimeCell,
                      isSelected && styles.scheduleTimeCellActive,
                    ]}
                    onPress={() =>
                      setScheduleDraft((current) =>
                        normalizeBookingSchedule({ ...current, minute })
                      )
                    }
                  >
                    <ThemedText
                      type="default"
                      style={[
                        styles.scheduleTimeText,
                        isSelected && styles.schedulePickerTextActive,
                      ]}
                    >
                      {minute}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Khối schedule result card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
          <View style={styles.scheduleResultCard}>
            <ThemedText type="default" style={styles.scheduleResultTitle}>
              {"Xe đón bạn lúc "}{scheduleDisplayText}
            </ThemedText>
          </View>

          {/* Pressable: Vùng bấm xử lý thao tác người dùng trong UI. */}
          <Pressable
            style={styles.scheduleConfirmButton}
            onPress={confirmSchedulePicker}
          >
            <ThemedText type="smallBold" style={styles.scheduleConfirmText}>
                    {"Xác nhận"}
                  </ThemedText>
          </Pressable>
        </View>
      </Modal>

      {/* Modal: Lớp giao diện nổi dùng để xác nhận, nhập form hoặc thông báo mà không rời màn hiện tại. */}
      <Modal
        visible={Boolean(joinSharedGroup)}
        transparent
        animationType="fade"
        onRequestClose={closeJoinSharedModal}
      >
        {/* Khối create shared overlay: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
        <View style={styles.createSharedOverlay}>
          {/* Khối create shared card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
          <View testID="ride-sharing-join-modal" style={styles.createSharedCard}>
            {/* Khối create shared header: Phần đầu của card/modal/màn hình, thường chứa tiêu đề và nút đóng. */}
            <View style={styles.createSharedHeader}>
              <ThemedText type="default" style={styles.createSharedTitle}>
                {"Tham gia nhóm xe ghép"}
              </ThemedText>
              {/* Nút tham gia nhóm đi ghép hoặc mở form nhập thông tin tham gia. */}
              <Pressable
                style={styles.createSharedClose}
                onPress={closeJoinSharedModal}
                disabled={isJoiningSharedGroup}
              >
                <ThemedText type="default" style={styles.createSharedCloseText}>
                  {"x"}
                </ThemedText>
              </Pressable>
            </View>

            {/* ScrollView: Cho phép nội dung dài cuộn được trên màn hình nhỏ. */}
            <ScrollView
              style={styles.createSharedBody}
              contentContainerStyle={styles.createSharedBodyContent}
              showsVerticalScrollIndicator
            >
              {/* Khối create field: Nhóm label, input và lỗi validate của một trường form. */}
              <View style={styles.createField}>
                <ThemedText type="small" style={styles.createLabel}>
                  {"Nhóm đã chọn"}
                </ThemedText>
                {/* Khối join group summary: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
                <View style={styles.joinGroupSummary}>
                  <ThemedText type="smallBold" style={styles.joinGroupSummaryTitle}>
                    {joinSharedGroup?.route || "Nhóm xe ghép"}
                  </ThemedText>
                  <ThemedText type="small" style={styles.joinGroupSummaryMeta}>
                    {joinSharedGroup?.scheduleText || "Chưa có lịch"}{" • "}
                    {joinSharedGroup?.seats || "--"}
                  </ThemedText>
                </View>
              </View>

              {/* Khối create field: Nhóm label, input và lỗi validate của một trường form. */}
              <View style={styles.createField}>
                <ThemedText type="small" style={styles.createLabel}>
                  {"Điểm đón của bạn"}
                  <ThemedText type="small" style={styles.requiredMark}>*</ThemedText>
                </ThemedText>
                {/* Khối create location input wrap: Bao ô nhập và nút phụ như xóa nhanh hoặc chọn gợi ý. */}
                <View style={styles.createLocationInputWrap}>
                  {/* TextInput: Ô nhập dữ liệu người dùng, thường đi kèm validate và state form. */}
                  <TextInput
                    testID="ride-sharing-join-location-input"
                    {...vietnameseTextInputProps}
                    placeholder="Nhập điểm đón để kiểm tra điều kiện tham gia"
                    placeholderTextColor="#A1A1AA"
                    style={styles.createInput}
                    value={joinSharedPickup}
                    onChangeText={updateJoinSharedPickup}
                  />
                  {Boolean(joinSharedPickup) && (
                    /* Nút tham gia nhóm đi ghép hoặc mở form nhập thông tin tham gia. */
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Xóa điểm đón"
                      style={styles.createInputClearButton}
                      onPress={clearJoinSharedPickup}
                    >
                      <ThemedText type="smallBold" style={styles.createInputClearText}>
                        {"×"}
                      </ThemedText>
                    </Pressable>
                  )}
                </View>

                {(joinSharedLocationLoading ||
                  joinSharedError ||
                  joinSharedSuggestions.length > 0) && (
                  /* Khối shared suggestion card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */
                  <View style={styles.sharedSuggestionCard}>
                    {joinSharedLocationLoading ? (
                      <ThemedText type="small" style={styles.suggestionLoading}>
                        {"Đang tải gợi ý..."}
                      </ThemedText>
                    ) : joinSharedSuggestions.length > 0 ? (
                      joinSharedSuggestions.map((suggestion, index) => (
                        /* Nút tham gia nhóm đi ghép hoặc mở form nhập thông tin tham gia. */
                        <Pressable
                          testID={`ride-sharing-join-location-suggestion-${index}`}
                          key={suggestion.placeId || suggestion.description}
                          style={styles.suggestionItem}
                          onPress={() => selectJoinSharedLocationSuggestion(suggestion)}
                        >
                          {/* Khối suggestion icon: Danh sách gợi ý địa điểm trả về từ dịch vụ bản đồ. */}
                          <View style={styles.suggestionIcon}>
                            <ThemedText type="smallBold" style={styles.suggestionIconText}>
                              {"•"}
                            </ThemedText>
                          </View>
                          {/* Khối suggestion content: Bố cục bao ngoài, canh lề và giới hạn chiều rộng nội dung. */}
                          <View style={styles.suggestionContent}>
                            <ThemedText
                              type="smallBold"
                              style={styles.suggestionTitle}
                              numberOfLines={1}
                            >
                              {suggestion.mainText || suggestion.description}
                            </ThemedText>
                            <ThemedText
                              type="small"
                              style={styles.suggestionSubtitle}
                              numberOfLines={2}
                            >
                              {suggestion.secondaryText ||
                                suggestion.formattedAddress ||
                                suggestion.description}
                            </ThemedText>
                          </View>
                        </Pressable>
                      ))
                    ) : (
                      <ThemedText type="small" style={styles.suggestionError}>
                        {joinSharedError}
                      </ThemedText>
                    )}
                  </View>
                )}
              </View>

              {Boolean(joinSharedError) && joinSharedSuggestions.length > 0 && (
                <ThemedText
                  testID="ride-sharing-join-error"
                  type="smallBold"
                  style={styles.createError}
                >
                  {joinSharedError}
                </ThemedText>
              )}
            </ScrollView>

            {/* Khối create shared footer: Nhóm nút cuối form để hủy hoặc xác nhận thao tác. */}
            <View style={styles.createSharedFooter}>
              {/* Nút tham gia nhóm đi ghép hoặc mở form nhập thông tin tham gia. */}
              <Pressable
                style={styles.secondaryButton}
                onPress={closeJoinSharedModal}
                disabled={isJoiningSharedGroup}
              >
                <ThemedText type="smallBold" style={styles.secondaryButtonText}>
                  {"Đóng"}
                </ThemedText>
              </Pressable>
              {/* Nút tham gia nhóm đi ghép hoặc mở form nhập thông tin tham gia. */}
              <Pressable
                testID="ride-sharing-join-submit-button"
                style={[
                  styles.primaryButton,
                  isJoiningSharedGroup && styles.buttonDisabled,
                ]}
                onPress={joinSuggestedSharedGroup}
                disabled={isJoiningSharedGroup}
              >
                <ThemedText type="smallBold" style={styles.primaryButtonText}>
                  {isJoiningSharedGroup ? "Đang kiểm tra..." : "Kiểm tra và tham gia"}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Lớp giao diện nổi dùng để xác nhận, nhập form hoặc thông báo mà không rời màn hiện tại. */}
      <Modal
        visible={createSharedVisible}
        transparent
        animationType="fade"
        onRequestClose={closeCreateSharedModal}
      >
        {/* Khối create shared overlay: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
        <View style={styles.createSharedOverlay}>
          {/* Khối create shared card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
          <View testID="ride-sharing-create-modal" style={styles.createSharedCard}>
            {/* Khối create shared header: Phần đầu của card/modal/màn hình, thường chứa tiêu đề và nút đóng. */}
            <View style={styles.createSharedHeader}>
              <ThemedText type="default" style={styles.createSharedTitle}>
                    {"Tạo yêu cầu xe ghép"}
                  </ThemedText>
              {/* Nút đóng modal/popup đang hiển thị. */}
              <Pressable
                style={styles.createSharedClose}
                onPress={closeCreateSharedModal}
              >
                <ThemedText type="default" style={styles.createSharedCloseText}>
                    {"x"}
                  </ThemedText>
              </Pressable>
            </View>

            {/* ScrollView: Cho phép nội dung dài cuộn được trên màn hình nhỏ. */}
            <ScrollView
              style={styles.createSharedBody}
              contentContainerStyle={styles.createSharedBodyContent}
              showsVerticalScrollIndicator
            >
              {/* Khối create field: Nhóm label, input và lỗi validate của một trường form. */}
              <View style={styles.createField}>
                <ThemedText type="small" style={styles.createLabel}>
                  {"Kiểu ghép"}
                </ThemedText>
                {/* Khối segment row: Nhóm lựa chọn dạng tab/segment để đổi chế độ hiển thị. */}
                <View style={styles.segmentRow}>
                  {/* Nút tab/segment để đổi nhóm nội dung đang xem. */}
                  <Pressable
                    style={[
                      styles.segment,
                      !isScheduledSharedRide && styles.segmentActive,
                    ]}
                    onPress={() => {
                      setSharedForm((current) => ({
                        ...current,
                        rideMode: "immediate",
                        slotId: "",
                        date: "",
                      }));
                      setSharedFormError("");
                    }}
                  >
                    <ThemedText
                      type="smallBold"
                      style={[
                        styles.segmentText,
                        !isScheduledSharedRide && styles.segmentTextActive,
                      ]}
                    >
                      {"Ghép tức thì"}
                    </ThemedText>
                  </Pressable>
                  {/* Nút tab/segment để đổi nhóm nội dung đang xem. */}
                  <Pressable
                    style={[
                      styles.segment,
                      isScheduledSharedRide && styles.segmentActive,
                    ]}
                    onPress={() => {
                      setSharedForm((current) => ({
                        ...current,
                        rideMode: "scheduled",
                      }));
                      setSharedFormError("");
                    }}
                  >
                    <ThemedText
                      type="smallBold"
                      style={[
                        styles.segmentText,
                        isScheduledSharedRide && styles.segmentTextActive,
                      ]}
                    >
                      {"Hẹn trước"}
                    </ThemedText>
                  </Pressable>
                </View>
              </View>

              {/* Khối create field: Nhóm label, input và lỗi validate của một trường form. */}
              <View style={styles.createField}>
                <ThemedText type="small" style={styles.createLabel}>
                  {"Loại chuyến"}
                  <ThemedText type="small" style={styles.requiredMark}>*</ThemedText>
                </ThemedText>
                {/* Mở dropdown loại chuyến: chỉ đổi openSharedDropdown, chưa đổi dữ liệu form. */}
                <Pressable
                  style={styles.createSelect}
                  onPress={() =>
                    setOpenSharedDropdown(
                      openSharedDropdown === "tripType" ? "" : "tripType"
                    )
                  }
                >
                  <ThemedText type="default" style={styles.createSelectText}>
                    {sharedForm.tripType}
                  </ThemedText>
                  {/* Khối create select indicator: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
                  <View style={styles.createSelectIndicator}>
                    <ThemedText type="smallBold" style={styles.createSelectChevron}>
                      {openSharedDropdown === "tripType" ? "⌃" : "⌄"}
                    </ThemedText>
                  </View>
                </Pressable>
                {openSharedDropdown === "tripType" && (
                  /* Khối create dropdown: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */
                  <View style={styles.createDropdown}>
                    {sharedTripTypes.map((item) => (
                      /* Chọn loại chuyến: ghi tripType vào sharedForm và reset slotId vì slot phụ thuộc chiều đi/về. */
                      <Pressable
                        key={item}
                        style={[
                          styles.createDropdownItem,
                          sharedForm.tripType === item &&
                            styles.createDropdownItemActive,
                        ]}
                        onPress={() => {
                          setSharedForm((current) => ({
                            ...current,
                            tripType: item,
                            slotId: "",
                          }));
                          setSharedFormError("");
                          setOpenSharedDropdown("");
                        }}
                      >
                        <ThemedText
                          type="smallBold"
                          style={[
                            styles.createDropdownText,
                            sharedForm.tripType === item &&
                              styles.createDropdownTextActive,
                          ]}
                        >
                          {item}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              {/* Khối create field: Nhóm label, input và lỗi validate của một trường form. */}
              <View style={styles.createField}>
                <ThemedText type="small" style={styles.createLabel}>
                  {"Loại xe"}
                </ThemedText>
                {/* Khối create select: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
                <View style={styles.createSelect}>
                  <ThemedText type="default" style={styles.createSelectText}>
                    Ô tô
                  </ThemedText>
                </View>
              </View>

              {/* Khối create field: Nhóm label, input và lỗi validate của một trường form. */}
              <View style={styles.createField}>
                <ThemedText type="small" style={styles.createLabel}>
                  {sharedLocationLabel}
                  <ThemedText type="small" style={styles.requiredMark}>*</ThemedText>
                </ThemedText>
                {/* Khối create location input wrap: Bao ô nhập và nút phụ như xóa nhanh hoặc chọn gợi ý. */}
                <View style={styles.createLocationInputWrap}>
                  {/* TextInput: Ô nhập dữ liệu người dùng, thường đi kèm validate và state form. */}
                  <TextInput
                    testID="ride-sharing-location-input"
                    {...vietnameseTextInputProps}
                    placeholder={sharedLocationPlaceholder}
                    placeholderTextColor="#A1A1AA"
                    style={styles.createInput}
                    value={sharedForm.location}
                    onChangeText={(value) => updateSharedForm("location", value)}
                  />
                  {Boolean(sharedForm.location) && (
                    /* Xóa địa điểm xe ghép: clearSharedLocation reset sharedForm.location, selectedSharedPlace và suggestions. */
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Xóa địa chỉ"
                      style={styles.createInputClearButton}
                      onPress={clearSharedLocation}
                    >
                      <ThemedText type="smallBold" style={styles.createInputClearText}>
                        {"×"}
                      </ThemedText>
                    </Pressable>
                  )}
                </View>
                {(sharedLocationLoading ||
                  sharedLocationError ||
                  sharedLocationSuggestions.length > 0) && (
                  /* Khối shared suggestion card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */
                  <View style={styles.sharedSuggestionCard}>
                    {sharedLocationLoading ? (
                      <ThemedText type="small" style={styles.suggestionLoading}>
                        {"Đang tải gợi ý..."}
                      </ThemedText>
                    ) : sharedLocationError ? (
                      <ThemedText type="small" style={styles.suggestionError}>
                        {sharedLocationError}
                      </ThemedText>
                    ) : (
                      sharedLocationSuggestions.map((suggestion, index) => (
                        /* Chọn gợi ý location xe ghép: resolve VietMap detail, lưu selectedSharedPlace có lat/lng để tạo payload. */
                        <Pressable
                          testID={`ride-sharing-location-suggestion-${index}`}
                          key={suggestion.placeId || suggestion.description}
                          style={styles.suggestionItem}
                          onPress={() => selectSharedLocationSuggestion(suggestion)}
                        >
                          {/* Khối suggestion icon: Danh sách gợi ý địa điểm trả về từ dịch vụ bản đồ. */}
                          <View style={styles.suggestionIcon}>
                            <ThemedText type="smallBold" style={styles.suggestionIconText}>
                              {"•"}
                            </ThemedText>
                          </View>
                          {/* Khối suggestion content: Bố cục bao ngoài, canh lề và giới hạn chiều rộng nội dung. */}
                          <View style={styles.suggestionContent}>
                            <ThemedText
                              type="smallBold"
                              style={styles.suggestionMainText}
                              numberOfLines={1}
                            >
                              {suggestion.mainText || suggestion.description || ""}
                            </ThemedText>
                            <ThemedText
                              type="small"
                              style={styles.suggestionSecondaryText}
                              numberOfLines={2}
                            >
                              {suggestion.secondaryText || suggestion.formattedAddress || ""}
                            </ThemedText>
                          </View>
                        </Pressable>
                      ))
                    )}
                    <ThemedText type="small" style={styles.suggestionAttribution}>
                      VietMap
                    </ThemedText>
                  </View>
                )}
              </View>

              {isScheduledSharedRide ? (
              /* Khối create schedule card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */
              <View style={styles.createScheduleCard}>
                {/* Khối create schedule header: Phần đầu của card/modal/màn hình, thường chứa tiêu đề và nút đóng. */}
                <View style={styles.createScheduleHeader}>
                  {/* Khối create calendar badge: Nhãn trạng thái nhỏ giúp người dùng quét thông tin nhanh. */}
                  <View style={styles.createCalendarBadge}>
                    <ThemedText type="smallBold" style={styles.createCalendarMonth}>
                      {sharedCalendarPreview?.monthLabel ?? "Ngày"}
                    </ThemedText>
                    <ThemedText type="title" style={styles.createCalendarDay}>
                      {sharedCalendarPreview?.dayLabel ?? "--"}
                    </ThemedText>
                  </View>
                  {/* Khối create schedule intro: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
                  <View style={styles.createScheduleIntro}>
                    <ThemedText type="default" style={styles.createScheduleTitle}>
                    {"Chọn lịch ngày đi"}
                  </ThemedText>
                    <ThemedText type="small" style={styles.createScheduleHint}>
                    {"Chọn slot cố định và ngày bạn muốn đi ghép xe."}
                  </ThemedText>
                  </View>
                </View>

                {/* Khối create schedule block: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
                <View style={styles.createScheduleBlock}>
                  <ThemedText type="smallBold" style={styles.createSubLabel}>
                    Slot
                    <ThemedText type="smallBold" style={styles.requiredMark}>*</ThemedText>
                  </ThemedText>
                  {/* Khối slot grid: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
                  <View style={styles.slotGrid}>
                    {availableSharedSlotOptions.map((slot) => {
                      const isSelected = sharedForm.slotId === slot.id;

                      return (
                        /* Chọn slot xe ghép: ghi slot.id vào sharedForm.slotId; createSharedRide sẽ đổi thành scheduledSlot gửi BE. */
                        <Pressable
                          testID={`ride-sharing-slot-${slot.id}`}
                          key={slot.id}
                          style={[
                            styles.slotChip,
                            isSelected && styles.slotChipActive,
                          ]}
                          onPress={() => {
                            updateSharedForm("slotId", slot.id);
                            setOpenSharedDropdown("");
                          }}
                        >
                          <ThemedText
                            type="smallBold"
                            style={[
                              styles.slotChipLabel,
                              isSelected && styles.slotChipLabelActive,
                            ]}
                          >
                            {slot.label}
                          </ThemedText>
                          <ThemedText
                            type="default"
                            style={[
                              styles.slotChipTime,
                              isSelected && styles.slotChipTimeActive,
                            ]}
                          >
                            {slot.time}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                  {availableSharedSlotOptions.length === 0 ? (
                    <ThemedText type="small" style={styles.createError}>
                      {"Hôm nay không còn slot nào cách thời gian hiện tại hơn 60 phút."}
                    </ThemedText>
                  ) : null}
                </View>

                {/* Khối create schedule block: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
                <View style={styles.createScheduleBlock}>
                  <ThemedText type="smallBold" style={styles.createSubLabel}>
                    {"Ngày đi"}
                    <ThemedText type="smallBold" style={styles.requiredMark}>*</ThemedText>
                  </ThemedText>
                  {/* ScrollView: Cho phép nội dung dài cuộn được trên màn hình nhỏ. */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.dateChipRow}
                  >
                    {scheduleDateOptions.slice(0, 7).map((date, index) => {
                      const isSelected = sharedForm.date === date.value;

                      return (
                        /* Chọn ngày xe ghép: ghi date.value vào sharedForm.date; createSharedRide ghép với slot.time thành scheduledAt. */
                        <Pressable
                          testID={`ride-sharing-date-${index}`}
                          key={date.value}
                          style={[
                            styles.dateChip,
                            isSelected && styles.dateChipActive,
                          ]}
                          onPress={() => {
                            updateSharedForm("date", date.value);
                            setOpenSharedDropdown("");
                          }}
                        >
                          <ThemedText
                            type="smallBold"
                            style={[
                              styles.dateChipLabel,
                              isSelected && styles.dateChipLabelActive,
                            ]}
                          >
                            {date.label}
                          </ThemedText>
                          <ThemedText
                            type="small"
                            style={[
                              styles.dateChipDate,
                              isSelected && styles.dateChipDateActive,
                            ]}
                          >
                            {date.display}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Khối create schedule summary: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
                <View style={styles.createScheduleSummary}>
                  <ThemedText type="smallBold" style={styles.createScheduleSummaryText}>
                    {sharedScheduleSummary}
                  </ThemedText>
                </View>
              </View>
              ) : (
                /* Khối create schedule summary: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */
                <View style={styles.createScheduleSummary}>
                  <ThemedText type="smallBold" style={styles.createScheduleSummaryText}>
                    {sharedScheduleSummary}
                  </ThemedText>
                </View>
              )}

              {Boolean(sharedFormError) && (
                <ThemedText
                  testID="ride-sharing-form-error"
                  type="smallBold"
                  style={styles.createError}
                >
                  {sharedFormError}
                </ThemedText>
              )}

              {/* Submit tạo request xe ghép: createSharedRide validate form, tính route metrics, gửi createRideSharingRequest lên BE. */}
              <Pressable
                testID="ride-sharing-submit-button"
                style={[
                  styles.createSubmitButton,
                  isCreatingSharedRequest && styles.buttonDisabled,
                ]}
                onPress={createSharedRide}
                disabled={isCreatingSharedRequest}
              >
                <ThemedText type="smallBold" style={styles.createSubmitText}>
                    {isCreatingSharedRequest ? "Đang tạo..." : "Tạo yêu cầu"}
                  </ThemedText>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Lớp giao diện nổi dùng để xác nhận, nhập form hoặc thông báo mà không rời màn hiện tại. */}
      <Modal
        visible={reviewModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReviewModalVisible(false)}
      >
        {/* Khối review overlay: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
        <View style={styles.reviewOverlay}>
          {/* Khối review card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
          <View testID="booking-review-modal" style={styles.reviewCard}>
            <ThemedText type="default" style={styles.reviewTitle}>
              {"Đánh giá chuyến đi"}
            </ThemedText>
            <ThemedText type="small" style={styles.reviewRouteText} numberOfLines={2}>
              {(activeBookedRide?.pickup ?? verifiedFromLabel) + " → " + (activeBookedRide?.destination ?? verifiedToLabel)}
            </ThemedText>

            {/* Khối review stars row: Dàn các phần tử trên cùng một hàng. */}
            <View style={styles.reviewStarsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                /* Chọn số sao review: chỉ cập nhật reviewRating, payload gửi BE khi bấm nút submit review. */
                <Pressable
                  key={star}
                  testID={`booking-review-star-${star}`}
                  style={styles.reviewStarButton}
                  onPress={() => setReviewRating(star)}
                >
                  <ThemedText
                    type="default"
                    style={[
                      styles.reviewStarText,
                      star <= reviewRating && styles.reviewStarTextActive,
                    ]}
                  >
                    {"★"}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            {/* TextInput: Ô nhập dữ liệu người dùng, thường đi kèm validate và state form. */}
            <TextInput
              testID="booking-review-comment-input"
              {...vietnameseTextInputProps}
              multiline
              placeholder={"Nhận xét chuyến đi"}
              placeholderTextColor="#9CA3AF"
              style={styles.reviewCommentInput}
              value={reviewComment}
              onChangeText={setReviewComment}
            />

            {Boolean(reviewError) && (
              <ThemedText testID="booking-review-error" type="smallBold" style={styles.reviewErrorText}>
                {reviewError}
              </ThemedText>
            )}

            {/* Khối review button row: Nhóm nút cuối form để hủy hoặc xác nhận thao tác. */}
            <View style={styles.reviewButtonRow}>
              {/* Hủy review: đóng modal, chưa gọi API và giữ nguyên trạng thái chuyến. */}
              <Pressable
                style={styles.reviewCancelButton}
                onPress={() => setReviewModalVisible(false)}
              >
                <ThemedText type="smallBold" style={styles.reviewCancelText}>
                  {"Hủy"}
                </ThemedText>
              </Pressable>
              {/* Submit review: handleSubmitCompletedTripReview gửi { tripId, rating, comment } lên Review API. */}
              <Pressable
                testID="booking-review-submit-button"
                style={[
                  styles.reviewSubmitButton,
                  isSubmittingReview && styles.bookButtonDisabled,
                ]}
                disabled={isSubmittingReview}
                onPress={handleSubmitCompletedTripReview}
              >
                <ThemedText type="smallBold" style={styles.reviewSubmitText}>
                  {isSubmittingReview ? "Đang gửi..." : "Gửi đánh giá"}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Lớp giao diện nổi dùng để xác nhận, nhập form hoặc thông báo mà không rời màn hiện tại. */}
      <Modal
        visible={Boolean(alertMessage)}
        transparent
        animationType="fade"
        onRequestClose={() => setAlertMessage("")}
      >
        {/* Bấm nền alert: chỉ clear alertMessage để đóng modal, không gửi API. */}
        <Pressable
          style={styles.alertOverlay}
          onPress={() => setAlertMessage("")}
        >
          {/* Card alert chặn click lan xuống màn booking; không có handler gửi dữ liệu. */}
          <Pressable testID="booking-alert-card" style={styles.alertCard}>
            {/* Khối alert icon: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
            <View style={styles.alertIcon}>
              <ThemedText type="smallBold" style={styles.alertIconText}>
                !
              </ThemedText>
            </View>
            <ThemedText type="default" style={styles.alertTitle}>
                    {getBookingAlertTitle(alertMessage)}
                  </ThemedText>
            <ThemedText
              testID="booking-alert-message"
              type="default"
              style={styles.alertMessage}
            >
              {alertMessage}
            </ThemedText>
            {/* Nút đóng alert: clear alertMessage để user sửa input/logic bị thiếu. */}
            <Pressable
              style={styles.alertButton}
              onPress={() => setAlertMessage("")}
            >
              <ThemedText type="smallBold" style={styles.alertButtonText}>
                    {"Đã hiểu"}
                  </ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
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
  contentContainerFit: {
    flexGrow: 1,
  },
  content: {
    width: "100%",
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  contentFit: {
    flex: 1,
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
  fieldGroup: {
    gap: 6,
  },
  inputLabel: {
    color: "#1F2937",
    paddingLeft: Spacing.one,
  },
  inputWrap: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EEE",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one,
  },
  input: {
    flex: 1,
    minHeight: 52,
    paddingRight: Spacing.one,
    cursor: "text",
  },
  inputClearButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FFE2C2",
    alignItems: "center",
    justifyContent: "center",
  },
  inputClearText: {
    color: "#C75B00",
    fontSize: 16,
    lineHeight: 18,
  },
  suggestionCard: {
    marginTop: -Spacing.one,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  suggestionItem: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  currentLocationSuggestion: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    backgroundColor: "#FFF7ED",
    borderBottomWidth: 1,
    borderBottomColor: "#FFE2C2",
  },
  suggestionDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
  },
  suggestionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionIconText: {
    color: BRAND,
    fontSize: 18,
  },
  suggestionContent: {
    flex: 1,
    gap: 3,
  },
  suggestionMainText: {
    color: "#111827",
    fontSize: 16,
  },
  suggestionTitle: {
    color: "#111827",
    fontSize: 15,
  },
  suggestionSecondaryText: {
    color: "#6B7280",
    lineHeight: 18,
  },
  suggestionSubtitle: {
    color: "#6B7280",
    lineHeight: 18,
  },
  suggestionLoading: {
    color: "#6B7280",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  suggestionError: {
    color: "#B45309",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    lineHeight: 18,
  },
  suggestionAttribution: {
    color: "#9CA3AF",
    textAlign: "right",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  savedList: {
    marginTop: Spacing.one,
    gap: Spacing.one,
  },
  savedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  saveAddressButtonText: {
    color: BRAND,
  },
  savedItemRowWrap: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  savedItemPressed: {
    opacity: 0.75,
  },
  savedItem: {
    flex: 1,
    paddingVertical: 10,
  },
  savedItemText: {
    color: "#111827",
  },
  savedItemTextActive: {
    color: BRAND,
    fontWeight: "700",
  },
  savedMoreButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  savedMoreText: {
    color: "#9CA3AF",
    fontSize: 18,
  },
  savedMiniMenu: {
    position: "absolute",
    right: 0,
    top: 34,
    zIndex: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    overflow: "hidden",
  },
  savedMiniAction: {
    minWidth: 80,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  savedEditText: {
    color: BRAND,
  },
  savedDeleteText: {
    color: "#DC2626",
  },
  alertOverlay: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.42)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.three,
  },
  reviewOverlay: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.48)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.three,
  },
  reviewCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    padding: Spacing.three,
    gap: Spacing.two,
    backgroundColor: "#FFFFFF",
  },
  reviewTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  reviewRouteText: {
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 18,
  },
  reviewStarsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.two,
  },
  reviewStarButton: {
    padding: Spacing.one,
  },
  reviewStarText: {
    color: "#D1D5DB",
    fontSize: 32,
  },
  reviewStarTextActive: {
    color: "#FACC15",
  },
  reviewCommentInput: {
    minHeight: 104,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: Spacing.two,
    color: "#111827",
    textAlignVertical: "top",
  },
  reviewErrorText: {
    color: "#DC2626",
  },
  reviewButtonRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  reviewCancelButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FFD2AE",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewCancelText: {
    color: "#C75B00",
  },
  reviewSubmitButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewSubmitText: {
    color: "#FFFFFF",
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
    fontSize: 18,
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
  addressOverlay: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.45)",
    justifyContent: "center",
    paddingHorizontal: Spacing.three,
  },
  addressCard: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    borderRadius: 22,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  addressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  addressTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
  },
  addressCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  addressCloseText: {
    color: "#6B7280",
    fontSize: 28,
    lineHeight: 30,
  },
  addressField: {
    gap: Spacing.one,
  },
  addressLabel: {
    color: "#374151",
  },
  addressInput: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: Spacing.three,
  },
  addressError: {
    color: "#DC2626",
  },
  addressButtonRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  addressSecondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  addressPrimaryButton: {
    flex: 1.4,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
  },
  addressPrimaryText: {
    color: "#FFFFFF",
  },
  createSharedOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    paddingHorizontal: Spacing.two,
  },
  createSharedCard: {
    width: "100%",
    maxWidth: MaxContentWidth,
    maxHeight: "82%",
    alignSelf: "center",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  createSharedHeader: {
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  createSharedTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
  },
  createSharedClose: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  createSharedCloseText: {
    color: "#6B7280",
    fontSize: 34,
    lineHeight: 38,
  },
  createSharedBody: {
    maxHeight: 520,
  },
  createSharedBodyContent: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  createSharedFooter: {
    padding: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    flexDirection: "row",
    gap: Spacing.two,
  },
  createField: {
    gap: Spacing.one,
  },
  joinGroupSummary: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FED7AA",
    backgroundColor: "#FFF7ED",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: 4,
  },
  joinGroupSummaryTitle: {
    color: "#111827",
  },
  joinGroupSummaryMeta: {
    color: "#7C2D12",
  },
  createLabel: {
    color: "#4B5563",
  },
  requiredMark: {
    color: "#EF4444",
  },
  createSelect: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: Spacing.two,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  createSelectText: {
    flex: 1,
    color: "#111827",
  },
  createSelectIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF1E6",
  },
  createSelectChevron: {
    color: BRAND,
    fontSize: 18,
    lineHeight: 19,
    fontWeight: "800",
  },
  createDropdown: {
    borderWidth: 1,
    borderColor: "#111827",
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  createDropdownItem: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: Spacing.two,
  },
  createDropdownItemActive: {
    backgroundColor: "#2563EB",
  },
  createDropdownText: {
    color: "#111827",
  },
  createDropdownTextActive: {
    color: "#FFFFFF",
  },
  createInput: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: Spacing.two,
    paddingRight: 48,
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  createLocationInputWrap: {
    position: "relative",
    justifyContent: "center",
  },
  createInputClearButton: {
    position: "absolute",
    right: Spacing.one,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FFE2C2",
    alignItems: "center",
    justifyContent: "center",
  },
  createInputClearText: {
    color: "#C75B00",
    fontSize: 16,
    lineHeight: 18,
  },
  sharedSuggestionCard: {
    marginTop: Spacing.one,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  createScheduleCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FED7AA",
    backgroundColor: "#FFFFFF",
    padding: Spacing.three,
    gap: Spacing.three,
    shadowColor: "#9A3412",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  createScheduleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  createCalendarBadge: {
    width: 74,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#FDBA74",
    backgroundColor: "#FFF7ED",
  },
  createCalendarMonth: {
    textAlign: "center",
    color: "#FFFFFF",
    backgroundColor: BRAND,
    paddingVertical: 6,
    fontSize: 13,
  },
  createCalendarDay: {
    textAlign: "center",
    color: "#111827",
    paddingVertical: 8,
    fontSize: 30,
    fontWeight: "900",
  },
  createScheduleIntro: {
    flex: 1,
    gap: 4,
  },
  createScheduleTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
  },
  createScheduleHint: {
    color: "#78716C",
    lineHeight: 18,
  },
  createScheduleBlock: {
    gap: Spacing.two,
  },
  createSubLabel: {
    color: "#7C2D12",
  },
  slotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  slotChip: {
    width: "47.5%",
    minHeight: 74,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FED7AA",
    backgroundColor: "#FFFBF7",
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    justifyContent: "center",
    gap: 4,
  },
  slotChipActive: {
    borderColor: BRAND,
    backgroundColor: BRAND,
  },
  slotChipLabel: {
    color: "#9A3412",
    fontSize: 13,
  },
  slotChipLabelActive: {
    color: "#FFFFFF",
  },
  slotChipTime: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
  },
  slotChipTimeActive: {
    color: "#FFFFFF",
  },
  dateChipRow: {
    gap: Spacing.two,
    paddingRight: Spacing.one,
  },
  dateChip: {
    minWidth: 116,
    minHeight: 62,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FED7AA",
    backgroundColor: "#FFFBF7",
    paddingHorizontal: Spacing.three,
    justifyContent: "center",
    alignItems: "center",
    gap: 3,
  },
  dateChipActive: {
    borderColor: BRAND,
    backgroundColor: "#FFF1E6",
  },
  dateChipLabel: {
    color: "#7C2D12",
  },
  dateChipLabelActive: {
    color: "#C2410C",
  },
  dateChipDate: {
    color: "#78716C",
  },
  dateChipDateActive: {
    color: "#111827",
  },
  createScheduleSummary: {
    borderRadius: 16,
    backgroundColor: "#FFF7ED",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  createScheduleSummaryText: {
    color: "#9A3412",
    textAlign: "center",
  },
  createError: {
    color: "#DC2626",
  },
  createSubmitButton: {
    minHeight: 50,
    borderRadius: 10,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
  },
  createSubmitText: {
    color: "#FFFFFF",
    fontSize: 16,
  },
  scheduleScreen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: Spacing.three,
  },
  scheduleHeader: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scheduleBackButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FFE2C2",
  },
  scheduleBackIcon: {
    color: "#C75B00",
    fontSize: 24,
    fontWeight: "900",
  },
  scheduleTitle: {
    color: "#111113",
    fontSize: 30,
    fontWeight: "900",
  },
  scheduleCalendarCard: {
    width: 110,
    alignSelf: "center",
    marginTop: Spacing.four,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FFD2AE",
    shadowColor: "#C75B00",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  scheduleCalendarMonth: {
    textAlign: "center",
    color: "#FFFFFF",
    backgroundColor: BRAND,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: "900",
  },
  scheduleCalendarDay: {
    textAlign: "center",
    color: "#111113",
    paddingVertical: 20,
    fontSize: 40,
    fontWeight: "900",
  },
  scheduleIntro: {
    marginTop: Spacing.four,
    alignItems: "center",
    gap: Spacing.one,
  },
  scheduleQuestion: {
    color: "#09090B",
    textAlign: "center",
    fontSize: 28,
    fontWeight: "900",
  },
  scheduleHint: {
    color: "#9A3412",
    textAlign: "center",
  },
  schedulePickerPanel: {
    marginTop: "auto",
    minHeight: 220,
    borderRadius: 30,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FFE2C2",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.two,
    shadowColor: "#C75B00",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  scheduleDateColumn: {
    flex: 1.45,
    maxHeight: 200,
  },
  scheduleTimeColumn: {
    flex: 0.65,
    maxHeight: 200,
  },
  schedulePickerRow: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.two,
  },
  schedulePickerRowActive: {
    backgroundColor: "#FFF1E6",
  },
  schedulePickerDateText: {
    color: "#3F3F46",
    fontSize: 17,
  },
  schedulePickerTextActive: {
    color: "#C2410C",
  },
  scheduleTimeCell: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleTimeCellActive: {
    backgroundColor: "#FFE4CC",
  },
  scheduleTimeText: {
    color: "#3F3F46",
    fontSize: 22,
    fontWeight: "800",
  },
  scheduleColon: {
    color: BRAND,
    fontSize: 30,
    fontWeight: "900",
  },
  scheduleResultCard: {
    marginTop: Spacing.four,
    borderRadius: 24,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FFE2C2",
    padding: Spacing.four,
    gap: Spacing.two,
  },
  scheduleResultTitle: {
    color: "#09090B",
    textAlign: "center",
    fontSize: 18,
    fontWeight: "900",
  },
  scheduleArrivalText: {
    color: "#C75B00",
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
  },
  scheduleConfirmButton: {
    minHeight: 60,
    borderRadius: 20,
    marginTop: "auto",
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#C75B00",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  scheduleConfirmText: {
    color: "#FFFFFF",
    fontSize: 18,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 6,
    alignSelf: "flex-start",
  },
  confirmStage: {
    flex: 1,
    gap: Spacing.two,
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
    overflow: "hidden",
  },
  mapCardCompact: {
    minHeight: 200,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
    backgroundColor: MAP_BG,
    overflow: "hidden",
  },
  pickupMapCard: {
    flex: 1,
    minHeight: 285,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#EEF4F7",
  },
  routeMapCard: {
    minHeight: 290,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#EEF4F7",
  },
  findingDriverStage: {
    flex: 1,
    justifyContent: "center",
    gap: Spacing.three,
  },
  findingRadarCard: {
    borderRadius: 28,
    backgroundColor: "#FFF7ED",
    padding: Spacing.four,
    alignItems: "center",
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: "#FFD2AE",
  },
  driverAcceptedCard: {
    backgroundColor: "#FFFDF8",
    borderColor: BRAND,
  },
  driverAvatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BRAND,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  completedAvatar: {
    backgroundColor: "#16A34A",
    shadowColor: "#16A34A",
  },
  cancelledAvatar: {
    backgroundColor: "#EF4444",
    shadowColor: "#EF4444",
  },
  noDriverFoundAvatar: {
    backgroundColor: "#F97316",
    shadowColor: "#F97316",
  },
  driverAvatarText: {
    color: "#FFFFFF",
    fontSize: 34,
  },
  driverInfoBox: {
    width: "100%",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    padding: Spacing.three,
    gap: 6,
    borderWidth: 1,
    borderColor: "#FFEDD5",
  },
  driverNameText: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 18,
  },
  driverInfoText: {
    color: "#4B5563",
  },
  radarOuter: {
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: "rgba(255, 122, 0, 0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  radarMiddle: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: "rgba(255, 122, 0, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  radarInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BRAND,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 4,
  },
  radarIcon: {
    color: "#FFFFFF",
    fontSize: 24,
  },
  findingTitle: {
    color: "#111827",
    textAlign: "center",
    fontSize: 24,
  },
  findingSubtitle: {
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 21,
  },
  findingTripCard: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    padding: Spacing.three,
    gap: Spacing.two,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  findingTripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  findingVehicle: {
    color: "#111827",
    fontSize: 17,
  },
  findingFare: {
    color: BRAND,
    fontSize: 17,
  },
  findingMeta: {
    color: "#6B7280",
  },
  findingStatusText: {
    color: BRAND,
  },
  findingRouteBox: {
    borderRadius: 16,
    backgroundColor: "#F9FAFB",
    padding: Spacing.two,
    gap: Spacing.one,
  },
  findingAddress: {
    color: "#374151",
  },
  completedSummaryBox: {
    borderRadius: 16,
    backgroundColor: "#FFF7ED",
    padding: Spacing.two,
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  completedSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  completedSummaryLabel: {
    color: "#6B7280",
    flex: 1,
  },
  completedSummaryValue: {
    color: "#111827",
    flexShrink: 0,
    textAlign: "right",
  },
  completedActionRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  completedReviewButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
  },
  completedReviewButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  completedReviewText: {
    color: "#FFFFFF",
  },
  completedHomeButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FFD2AE",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  completedHomeText: {
    color: "#C75B00",
  },
  findingSecondaryButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FFD2AE",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  findingActionsRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  cancelRideButton: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
  },
  findingSecondaryText: {
    color: "#C75B00",
  },
  cancelRideButtonText: {
    color: "#DC2626",
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
  routeMapFallback: {
    flex: 1,
    backgroundColor: "#FFFDF8",
    padding: Spacing.four,
    justifyContent: "space-between",
  },
  routeMapFallbackHeader: {
    gap: Spacing.one,
  },
  routeMapFallbackTitle: {
    color: BRAND,
  },
  routeMapFallbackMeta: {
    color: "#6B7280",
  },
  routeMapFallbackBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
  },
  routeMapFallbackPoint: {
    color: "#111827",
    textAlign: "center",
  },
  routeMapFallbackArrow: {
    color: BRAND,
    fontSize: 24,
  },
  googleMapImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  mapOverlayBadge: {
    position: "absolute",
    left: Spacing.three,
    right: Spacing.three,
    bottom: Spacing.three,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    alignItems: "center",
  },
  routeEtaText: {
    color: "#111827",
    fontWeight: "700",
  },
  pickupMapTopBar: {
    position: "absolute",
    top: Spacing.three,
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  pickupBackButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  pickupBackIcon: {
    color: "#111827",
    fontSize: 28,
  },
  pickupSearchPill: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    paddingHorizontal: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  pickupSearchIcon: {
    fontSize: 18,
  },
  pickupSearchText: {
    color: "#111827",
    fontSize: 18,
  },
  pickupPinBubble: {
    position: "absolute",
    top: "42%",
    alignSelf: "center",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  pickupPinText: {
    color: "#111827",
    fontSize: 16,
  },
  pickupConfirmSheet: {
    marginTop: -Spacing.two,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    padding: Spacing.two,
    gap: Spacing.two,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  pickupAddressRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  pickupAddressIconWrap: {
    width: 48,
    alignItems: "center",
    gap: 4,
  },
  pickupAddressIcon: {
    fontSize: 22,
  },
  pickupDistanceText: {
    color: "#6B7280",
  },
  pickupAddressContent: {
    flex: 1,
    gap: 4,
  },
  pickupAddressTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900",
  },
  pickupAddressSubtitle: {
    color: "#6B7280",
  },
  pickupNoteInput: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: Spacing.two,
    color: "#111827",
  },
  pickupScheduleBadge: {
    borderRadius: 10,
    backgroundColor: "#FFF7ED",
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  pickupScheduleText: {
    color: "#9A3412",
  },
  pickupConfirmButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
  },
  pickupConfirmButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
  },
  routeMapTopBar: {
    position: "absolute",
    top: Spacing.three,
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  routeBackButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    alignItems: "center",
    justifyContent: "center",
  },
  routeBackIcon: {
    color: "#111827",
    fontSize: 28,
  },
  routeInfoPill: {
    borderRadius: 999,
    backgroundColor: "rgba(231, 252, 252, 0.95)",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  routeInfoText: {
    color: "#075E61",
    fontSize: 15,
  },
  routeDestinationPill: {
    position: "absolute",
    top: 68,
    left: 76,
    right: Spacing.three,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  routeDestinationText: {
    color: "#111827",
    fontSize: 15,
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
  rideOptionsSheet: {
    marginTop: -Spacing.two,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.one,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  sheetHandle: {
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginBottom: Spacing.one,
  },
  rideSheetTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
  },
  rideOption: {
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  rideOptionActive: {
    borderColor: "#23C6C8",
    borderWidth: 2,
    backgroundColor: "#F0FFFF",
  },
  rideOptionName: {
    color: "#111827",
    fontSize: 16,
    // Tránh label "Xe máy"/"Ô tô" bị truncate khi row layout dùng space-between.
    flexShrink: 1,
  },
  rideOptionPrice: {
    color: "#111827",
    fontWeight: "800",
  },
  paymentNotice: {
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    backgroundColor: "#FFF7ED",
  },
  paymentNoticeText: {
    color: "#B45309",
  },
  bookButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.one,
  },
  bookButtonDisabled: {
    opacity: 0.72,
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
    borderColor: "#FFD2AE",
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#C75B00",
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
  buttonDisabled: {
    opacity: 0.65,
  },
  hidden: {
    display: "none",
  },
  sharedSection: {
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  pendingSharedSection: {
    gap: Spacing.two,
  },
  pendingSharedTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "800",
  },
  sharedRequestFilterBox: {
    position: "relative",
    zIndex: 5,
    gap: 6,
    maxWidth: 240,
  },
  sharedRequestFilterLabel: {
    color: "#7C2D12",
  },
  sharedRequestSelect: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FFD2AE",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  sharedRequestSelectText: {
    color: "#111827",
  },
  sharedRequestSelectIcon: {
    color: BRAND,
    fontSize: 18,
    lineHeight: 20,
  },
  sharedRequestDropdown: {
    position: "absolute",
    top: 70,
    left: 0,
    right: 0,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FFD2AE",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  sharedRequestDropdownItem: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: "#FFF1E6",
  },
  sharedRequestDropdownItemActive: {
    backgroundColor: "#FFF7ED",
  },
  sharedRequestDropdownText: {
    color: "#111827",
  },
  sharedRequestDropdownTextActive: {
    color: BRAND,
  },
  pendingSharedEmptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#FFD2AE",
    backgroundColor: "#FFF7ED",
    padding: Spacing.three,
    gap: 4,
  },
  pendingSharedCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#FFD2AE",
    backgroundColor: "#FFFBF7",
    padding: Spacing.three,
    gap: Spacing.one,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  pendingSharedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  pendingSharedVehicle: {
    color: "#111827",
  },
  pendingBadge: {
    borderRadius: 999,
    backgroundColor: "#FFF3E8",
    borderWidth: 1,
    borderColor: "#FDBA74",
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
  },
  pendingBadgeText: {
    color: "#C75B00",
    fontSize: 12,
  },
  pendingSharedRoute: {
    color: "#111827",
  },
  pendingSharedMeta: {
    color: "#6B7280",
  },
  pendingSharedFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  pendingSharedPrice: {
    color: BRAND,
    fontSize: 18,
  },
  pendingSharedCancelButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FFB47A",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  pendingSharedCancelText: {
    color: BRAND,
  },
  pendingSharedDetailButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FDBA74",
    backgroundColor: "#FFF7ED",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  pendingSharedDetailText: {
    color: BRAND,
  },
  sharedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sharedTitle: {
    flex: 1,
    color: "#111827",
    fontSize: 22,
    fontWeight: "800",
  },
  createButtonText: {
    color: BRAND,
    fontSize: 18,
  },
  emptySharedCard: {
    borderRadius: 16,
    padding: Spacing.three,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#FFD2AE",
    backgroundColor: "#FFFFFF",
    gap: Spacing.one,
  },
  emptySharedTitle: {
    color: "#111827",
  },
  emptySharedText: {
    color: "#71717A",
  },
  suggestedGroupCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FFD2AE",
    backgroundColor: "#FFFCF8",
    padding: Spacing.three,
    gap: Spacing.two,
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  suggestedGroupTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  suggestedGroupLabel: {
    borderRadius: 999,
    backgroundColor: "#FFF1E6",
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
  },
  suggestedGroupLabelText: {
    color: "#C75B00",
    fontSize: 12,
  },
  suggestedGroupBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FDBA74",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
  },
  suggestedGroupBadgeText: {
    color: "#9A3412",
    fontSize: 12,
  },
  suggestedGroupVehicle: {
    color: "#6B7280",
  },
  suggestedGroupRoute: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 25,
  },
  suggestedGroupChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  suggestedGroupChip: {
    borderRadius: 999,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
  },
  suggestedGroupChipText: {
    color: "#9A3412",
  },
  suggestedGroupDriverCard: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FDE7D3",
    padding: Spacing.two,
    gap: 4,
  },
  suggestedGroupDriverLabel: {
    color: "#6B7280",
  },
  suggestedGroupDriverValue: {
    color: "#111827",
  },
  suggestedGroupFooter: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: "#FDE7D3",
  },
  suggestedGroupPriceBlock: {
    flex: 1,
    gap: 2,
  },
  suggestedGroupPriceLabel: {
    color: "#6B7280",
  },
  suggestedGroupPriceValue: {
    color: BRAND,
    fontSize: 22,
    fontWeight: "900",
  },
  suggestedGroupActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  suggestedGroupSecondaryButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FDBA74",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestedGroupSecondaryText: {
    color: "#C75B00",
  },
  suggestedGroupPrimaryButton: {
    borderRadius: 14,
    backgroundColor: BRAND,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestedGroupPrimaryText: {
    color: "#FFFFFF",
  },
});






