import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import {
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
  reverseVietMapPlaceLocation as reverseMapPlaceLocation,
  isVietMapConfigured as isMapConfigured,
} from "@/features/booking/services/vietmap-api";
import { estimateFare } from "@/features/booking/services/pricing-api";
import {
  cancelTrip,
  createTrip,
  getTrip,
} from "@/features/booking/services/trip-api";
import {
  loadBookedTrips,
  persistBookedTrip,
} from "@/features/booking/services/trip-storage";
import {
  cancelRideSharingRequest,
  createRideSharingRequest,
  getAvailableRideSharingGroups,
  getMyRideSharingGroup,
  getMyRideSharingRequest,
  getRideSharingGroup,
  getRideSharingRequest,
  leaveRideSharingGroup,
} from "@/features/ride-sharing/services/ride-sharing-api";
import {
  loadStoredRideSharingCards,
  persistRideSharingCards,
  replaceRideSharingCards,
} from "@/features/ride-sharing/services/ride-sharing-storage";

const BRAND = "#FF7A00";
const MAP_BG = "#FFF3C9";
const PICKUP_BLUE = "#2563EB";
const DESTINATION_GREEN = "#16A34A";
const MOCK_DRIVER_POINT = {
  placeId: "",
  formattedAddress: "Cổng chính Đại học FPT, Thạch Hòa, Hà Nội",
  location: {
    lat: 21.0137,
    lng: 105.5262,
  },
};
const FPT_HOLA_PLACE = {
  placeId: "fpt-hola",
  formattedAddress:
    "Đại học FPT, Khu Công nghệ cao Hòa Lạc, Thạch Hòa, Thạch Thất, Hà Nội",
  location: {
    lat: 21.012845855,
    lng: 105.527637553,
  },
};
const MOCK_DRIVER_LOCATION = "Cổng chính Đại học FPT, Thạch Hòa, Hà Nội";
const SHARED_RIDE_MAX_DISTANCE_KM = 50;
const vietnameseTextInputProps = {
  autoCapitalize: "none",
  autoCorrect: false,
  autoComplete: "off",
  spellCheck: false,
  keyboardType: "default",
  disableFullscreenUI: true,
};

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

const rideOptions = [
  {
    id: "bike",
    icon: "Xe máy",
    name: "Xe máy",
    eta: "Đón trong 3 phút",
    vehicleType: 1,
  },
  {
    id: "car4",
    icon: "Xe 4 chỗ",
    name: "Xe 4 chỗ",
    eta: "Đón trong 5 phút",
    vehicleType: 2,
  },
  {
    id: "car7",
    icon: "Xe 7 chỗ",
    name: "Xe 7 chỗ",
    eta: "Đón trong 7 phút",
    vehicleType: 4,
  },
];
const availableRideOptions = rideOptions.filter((option) => option.id !== "car7");

const sharedTripTypes = [
  "Chuyến đi (Từ nơi khác đến FPT)",
  "Chuyến về (Từ FPT đi nơi khác)",
];

const sharedVehicleOptions = [
  { label: "Xe 4 chỗ", vehicle: "Xe 4 chỗ", capacity: 4, price: "30.000đ" },
  { label: "Xe 7 chỗ", vehicle: "Xe 7 chỗ", capacity: 7, price: "42.000đ" },
];
const sharedSlotOptions = [
  { id: "slot-1", label: "Slot 1", time: "07:30" },
  { id: "slot-2", label: "Slot 2", time: "10:00" },
  { id: "slot-3", label: "Slot 3", time: "12:50" },
  { id: "slot-4", label: "Slot 4", time: "15:20" },
];

const defaultSharedForm = {
  rideMode: "scheduled",
  tripType: sharedTripTypes[0],
  vehicleIndex: 0,
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

function formatCurrencyVnd(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return `${Math.round(value).toLocaleString("vi-VN")}đ`;
}

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

function formatDurationMinute(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "--";
  }

  return `${Math.max(1, Math.round(numberValue))} phút`;
}

function getTripEstimatedFare(trip) {
  return trip?.pricing?.estimatedFare ?? trip?.estimatedFare ?? null;
}

function getTripDistanceText(trip, fallbackText = "--") {
  return trip?.estimatedDistanceKm != null
    ? formatDistanceKm(trip.estimatedDistanceKm)
    : fallbackText;
}

function getTripDurationText(trip, fallbackText = "--") {
  return trip?.estimatedDurationMinute != null
    ? formatDurationMinute(trip.estimatedDurationMinute)
    : fallbackText;
}

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

function normalizeRideSharingStatusValue(status, statusNameByValue) {
  const numericStatus = Number(status);

  if (Number.isInteger(numericStatus) && statusNameByValue[numericStatus]) {
    return statusNameByValue[numericStatus];
  }

  return String(status ?? "").replace(/\s+/g, "").toLowerCase();
}

function normalizeRideSharingRequestStatus(status) {
  return normalizeRideSharingStatusValue(status, rideSharingRequestStatusNameByValue);
}

function normalizeRideSharingGroupStatus(status) {
  return normalizeRideSharingStatusValue(status, rideSharingGroupStatusNameByValue);
}

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

function mapRideSharingRequestToCardClean(request, group = null) {
  if (!request?.id) {
    return null;
  }

  const pickup = request.pickupAddress || "Điểm đón";
  const destination = request.destinationAddress || "Điểm đến";
  const requestStatus = normalizeRideSharingRequestStatus(request.status);
  const rawGroupStatus =
    group?.status != null ? normalizeRideSharingGroupStatus(group.status) : "";
  const shouldIgnoreGroup =
    requestStatus &&
    isSharedRideActive(requestStatus) &&
    isSharedGroupTerminal(rawGroupStatus);
  const effectiveGroup = shouldIgnoreGroup ? null : group;
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
    participantCount: group.currentPassengers ?? members.length,
    capacity: group.maxPassengers ?? 3,
    perPersonPrice: formatCurrencyVnd(fare),
    priceLabel: previewJoinFare ? "Giá khi tham gia" : "Giá mỗi người",
    createdAt: group.createdAt,
    canCancel: false,
  };
}

function normalizeRideSharingStatus(status) {
  return normalizeRideSharingRequestStatus(status);
}

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

function isSharedRideActive(status) {
  return !isSharedTerminalStatus(normalizeRideSharingRequestStatus(status));
}

function isSharedGroupTerminal(status) {
  return isSharedTerminalStatus(normalizeRideSharingGroupStatus(status));
}

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

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

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

function normalizePlaceCompareText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

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

function normalizeTripStatus(status) {
  return String(status ?? "pending").replace(/\s+/g, "").toLowerCase();
}

const sharedRequestFilterOptions = [
  { id: "booked", label: "Đã đặt" },
  { id: "cancelled", label: "Đã hủy" },
  { id: "completed", label: "Đã hoàn thành" },
];

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

function getSharedRequestCardKey(card) {
  return String(card?.requestId || card?.groupId || card?.id || "");
}

function isRideSharingCardOwnedByUser(card, userId) {
  const normalizedUserId = String(userId ?? "").trim().toLowerCase();

  if (!normalizedUserId) {
    return false;
  }

  const passengerId = String(card?.passengerId ?? "").trim().toLowerCase();

  return !passengerId || passengerId === normalizedUserId;
}

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

function logRideSharingCreateDebug(label, data) {
  if (typeof __DEV__ !== "undefined" && !__DEV__) {
    return;
  }

  console.log(`[RideSharingCreate] ${label}`, data);
}

void getRideSharingCreateErrorMessage;

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

function isTerminalTripStatus(status) {
  const normalizedStatus = normalizeTripStatus(status);
  return normalizedStatus === "completed" || normalizedStatus === "cancelled";
}

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
      ? "Chuyáº¿n vá»"
      : "Chuyáº¿n Ä‘i";

  return {
    id: group.id,
    requestId: "",
    groupId: group.id,
    route: `${directionLabel} â€¢ ${scheduleText}`,
    vehicle: capacity >= 7 ? "Xe 7 chá»—" : "Xe 4 chá»—",
    price: "--",
    distance: "--",
    duration: "--",
    seats: `${participantCount}/${capacity} ngÆ°á»i`,
    note: availableSeats > 0 ? "NhÃ³m cÃ²n chá»— trá»‘ng" : "NhÃ³m Ä‘Ã£ Ä‘á»§ ngÆ°á»i",
    scheduleText,
    status: group.status,
    groupStatus: group.status,
    statusLabel: normalizeSharedStatusLabelClean(group.status),
    driver: "ChÆ°a cÃ³ tÃ i xáº¿",
    destination: scheduleText,
    participantCount,
    capacity,
    perPersonPrice: "--",
    createdAt: group.createdAt,
    availableSeats,
    rawGroup: group,
  };
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

const MAX_SCHEDULE_DAYS = 7;
const MIN_PICKUP_BUFFER_MINUTES = 30;
const MINUTE_STEP = 5;
const MOCK_TRIP_DURATION_MINUTES = 13;

function padSchedule(value) {
  return String(value).padStart(2, "0");
}

function addScheduleMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addScheduleDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function roundScheduleDate(date) {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  const remainder = rounded.getMinutes() % MINUTE_STEP;

  if (remainder !== 0) {
    rounded.setMinutes(rounded.getMinutes() + MINUTE_STEP - remainder);
  }

  return rounded;
}

function getScheduleBounds() {
  const now = new Date();
  return {
    min: roundScheduleDate(addScheduleMinutes(now, MIN_PICKUP_BUFFER_MINUTES)),
    max: addScheduleDays(now, MAX_SCHEDULE_DAYS),
  };
}

function formatScheduleDateValue(date) {
  return `${date.getFullYear()}-${padSchedule(date.getMonth() + 1)}-${padSchedule(date.getDate())}`;
}

function formatScheduleDisplay(date) {
  return `${padSchedule(date.getDate())}/${padSchedule(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function parseScheduleDateValue(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getScheduleDateLabel(date, index) {
  if (index === 0) {
    return "Hôm nay";
  }

  if (index === 1) {
    return "Ngày mai";
  }

  return formatScheduleDisplay(date);
}

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

function getSharedSlotDateTime(dateValue, slotTime) {
  if (!dateValue || !slotTime) {
    return null;
  }

  const date = parseScheduleDateValue(dateValue);
  const [hour, minute] = slotTime.split(":").map(Number);
  date.setHours(hour || 0, minute || 0, 0, 0);
  return date;
}

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

function createScheduleDate(dateValue, hour, minute) {
  const date = parseScheduleDateValue(dateValue);
  date.setHours(Number(hour), Number(minute), 0, 0);
  return date;
}

function isScheduleInRange(date) {
  const { min, max } = getScheduleBounds();
  return date >= min && date <= max;
}

function createScheduleHourOptions(dateValue) {
  return Array.from({ length: 24 }, (_, hour) => padSchedule(hour)).filter((hour) =>
    Array.from({ length: 60 / MINUTE_STEP }, (_, index) =>
      padSchedule(index * MINUTE_STEP)
    ).some((minute) => isScheduleInRange(createScheduleDate(dateValue, hour, minute)))
  );
}

function createScheduleMinuteOptions(dateValue, hour) {
  return Array.from({ length: 60 / MINUTE_STEP }, (_, index) =>
    padSchedule(index * MINUTE_STEP)
  ).filter((minute) => isScheduleInRange(createScheduleDate(dateValue, hour, minute)));
}

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

function getDefaultBookingSchedule() {
  const { min } = getScheduleBounds();
  return normalizeBookingSchedule({
    date: formatScheduleDateValue(min),
    hour: padSchedule(min.getHours()),
    minute: padSchedule(min.getMinutes()),
  });
}

export default function SearchScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session, isAuthenticated, refreshSession } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const rawMode = params.mode ?? "now";
  const normalizedMode = rawMode === "shared" ? "shared" : "now";

  const [mode, setMode] = useState(normalizedMode);
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [focusedField, setFocusedField] = useState("from");
  const [bookingStep, setBookingStep] = useState("form");
  const [alertMessage, setAlertMessage] = useState("");
  const [driverNote, setDriverNote] = useState("");
  const [selectedRideId, setSelectedRideId] = useState("bike");
  const [ridePriceQuotes, setRidePriceQuotes] = useState({});
  const [isLoadingRidePrices, setIsLoadingRidePrices] = useState(false);
  const [ridePriceError, setRidePriceError] = useState("");
  const fromInputRef = useRef(null);
  const toInputRef = useRef(null);
  const sharedLocationPickedRef = useRef("");
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
  const [sharedLocationSuggestions, setSharedLocationSuggestions] = useState([]);
  const [sharedLocationLoading, setSharedLocationLoading] = useState(false);
  const [sharedLocationError, setSharedLocationError] = useState("");
  const [selectedSharedPlace, setSelectedSharedPlace] = useState(null);
  const [isLoadingSharedState, setIsLoadingSharedState] = useState(false);
  const [isCreatingSharedRequest, setIsCreatingSharedRequest] = useState(false);
  const [cancellingSharedRequestId, setCancellingSharedRequestId] = useState("");
  const [isBookingRide, setIsBookingRide] = useState(false);
  const [isCancellingRide, setIsCancellingRide] = useState(false);
  const [activeBookedRide, setActiveBookedRide] = useState(null);
  const [acceptedTrip, setAcceptedTrip] = useState(null);
  const [savedAddresses, setSavedAddresses] = useState(initialSavedAddresses);
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [addressForm, setAddressForm] = useState(defaultAddressForm);
  const [editingAddressId, setEditingAddressId] = useState("");
  const [addressFormError, setAddressFormError] = useState("");
  const [openAddressMenuId, setOpenAddressMenuId] = useState("");
  const deferredFrom = useDeferredValue(fromInput);
  const deferredTo = useDeferredValue(toInput);
  const suggestedSharedRides = availableSharedGroups;
  const filteredSharedRequests = pendingSharedRequests
    .filter((request) => isRideSharingCardOwnedByUser(request, session?.userId))
    .filter((request) => {
      const effectiveStatus = getSharedRequestEffectiveStatus(request);
      return getSharedRequestFilterKey(effectiveStatus) === sharedRequestFilter;
    });
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
  const shouldShowTripStatusCard =
    hasAssignedDriver || isTerminalTripStatus(trackedTripStatus);
  const canCancelTrackedTrip =
    trackedTripStatus === "pending" ||
    trackedTripStatus === "accepted" ||
    trackedTripStatus === "driverarrived";
  const isCompletedTrip = trackedTripStatus === "completed";
  const completedDbFare = getTripEstimatedFare(acceptedTrip);
  const completedFare =
    completedDbFare != null
      ? formatCurrencyVnd(Number(completedDbFare))
      : activeBookedRide?.estimatedFare ?? selectedRidePrice ?? "--";
  const completedAtText = formatTripDateTime(
    acceptedTrip?.completedAt ?? activeBookedRide?.completedAt
  );
  const refreshSharedState = useCallback(
    async ({ showLoading = false } = {}) => {
      if (mode !== "shared" || !session?.accessToken) {
        setPendingSharedRequests([]);
        setAvailableSharedGroups([]);
        return;
      }

      if (showLoading) {
        setIsLoadingSharedState(true);
      }

      try {
        const direction =
          sharedDirectionByTripType[sharedForm.tripType] ??
          sharedDirectionByTripType[sharedTripTypes[0]];

        const [
          requestResult,
          groupResult,
          availableGroupsResult,
          storedCardsResult,
        ] =
          await Promise.allSettled([
          getMyRideSharingRequest(session.accessToken),
          getMyRideSharingGroup(session.accessToken),
          getAvailableRideSharingGroups(direction, session.accessToken),
          loadStoredRideSharingCards(session.userId),
        ]);

        const request =
          requestResult.status === "fulfilled" ? requestResult.value : null;
        const group = groupResult.status === "fulfilled" ? groupResult.value : null;
        const availableGroups =
          availableGroupsResult.status === "fulfilled"
            ? availableGroupsResult.value
            : [];
        const storedCards =
          storedCardsResult.status === "fulfilled"
            ? storedCardsResult.value.filter((card) =>
                isRideSharingCardOwnedByUser(card, session.userId)
              )
            : [];
        const refreshedStoredCards = (
          await refreshStoredRideSharingCards(storedCards, session.accessToken)
        ).filter((card) => isRideSharingCardOwnedByUser(card, session.userId));
        const availableGroupDetails = await Promise.allSettled(
          availableGroups.map((item) =>
            getRideSharingGroup(item.id, session.accessToken)
          )
        );
        const mappedRequest = mapRideSharingRequestToCardClean(request, group);
        const mappedGroup = mapRideSharingGroupToCard(group);
        const currentGroupId = String(group?.id ?? request?.groupId ?? "").toLowerCase();
        const mappedAvailableGroups = availableGroups
          .map((item, index) => {
            const detailedGroup = availableGroupDetails[index];

            if (detailedGroup?.status === "fulfilled" && detailedGroup.value?.id) {
              return mapRideSharingGroupToCard(detailedGroup.value, {
                previewJoinFare: true,
              });
            }

            return mapAvailableRideSharingGroupToCard(item);
          })
          .filter(Boolean)
          .filter(
            (item) =>
              String(item.groupId ?? "").toLowerCase() !== currentGroupId
          );

        const currentCards = mappedRequest
          ? [mappedRequest]
          : mappedGroup
            ? [mappedGroup]
            : [];
        const mergedCards = mergeSharedRequestCards(
          currentCards,
          refreshedStoredCards
        );

        setPendingSharedRequests(mergedCards);

        if (currentCards.length > 0 || refreshedStoredCards.length > 0) {
          persistRideSharingCards(
            mergeSharedRequestCards(currentCards, refreshedStoredCards),
            session.userId
          ).catch(() => {});
        }

        setAvailableSharedGroups(mappedAvailableGroups);
      } finally {
        if (showLoading) {
          setIsLoadingSharedState(false);
        }
      }
    },
    [mode, session?.accessToken, session?.userId, sharedForm.tripType]
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
          setActiveBookedRide((current) =>
            mergeBookedRideWithTrip(
              {
                ...(current ?? {}),
                tripDistance:
                  current?.tripDistance ?? fallbackTrackedTripDistanceText,
                tripDuration:
                  current?.tripDuration ?? fallbackTrackedTripDurationText,
              },
              trip
            )
          );
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

    const selectedSlot = sharedSlotOptions.find(
      (slot) => slot.id === sharedForm.slotId
    );

    if (selectedSlot && !isSharedSlotAvailable(selectedSlot, sharedForm.date)) {
      updateSharedForm("slotId", "");
    }
  }, [sharedForm.date, sharedForm.slotId]);

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

    const loadRidePrices = async () => {
      setIsLoadingRidePrices(true);
      setRidePriceError("");

      try {
        const results = await Promise.all(
          availableRideOptions.map(async (option) => {
            try {
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
    setBookingStep("form");
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
  const selectedRideOption =
    availableRideOptions.find((option) => option.id === selectedRideId) ??
    availableRideOptions[0];
  const selectedRidePrice = ridePriceQuotes[selectedRideOption.id] ?? "";
  const scheduleDateOptions = createScheduleDateOptions();
  const selectedScheduleDate =
    scheduleDateOptions.find((option) => option.value === scheduleDraft.date) ??
    scheduleDateOptions[0];
  const selectedSharedDate = scheduleDateOptions.find(
    (option) => option.value === sharedForm.date
  );
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
  const isSharedTripToFpt = sharedForm.tripType.startsWith("Chuyến đi");
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
  const arrivalDate = addScheduleMinutes(pickupDate, MOCK_TRIP_DURATION_MINUTES);
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

  const createVerifiedTripMap = async (origin, destination) => {
    const directions = await getMapDirections(origin, destination);
    const driverDirections = await getMapDirections(MOCK_DRIVER_POINT, origin);

    return {
      origin,
      destination,
      driverOrigin: MOCK_DRIVER_POINT,
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

    if (!selectedRideOption) {
      setAlertMessage("Vui lòng chọn loại xe.");
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

    if (isLoadingRidePrices) {
      setAlertMessage("Giá cước đang được tính. Vui lòng đợi trong giây lát.");
      return;
    }

    if (ridePriceError) {
      setAlertMessage(ridePriceError);
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
        response = await createTrip(createTripPayload, session?.accessToken);
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
      const bookedTrip = {
        id: tripResponse.id || `trip-${Date.now()}`,
        status: isScheduledRide
          ? "scheduled"
          : (tripResponse.status || "pending").toLowerCase(),
        statusLabel: isScheduledRide
          ? "Chờ tài xế"
          : "Đang tìm tài xế",
        icon: selectedRideOption.icon || "Xe",
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
        await persistBookedTrip(bookedTrip);
      } catch {
        // Neu luu cuc bo that bai thi van hien man tim tai xe.
      }

      setAcceptedTrip(null);
      if (isScheduledRide) {
        resetSingleRideBookingForm();
        router.push("/trips");
      } else {
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
    if (!canCancelTrackedTrip || isCancellingRide) {
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
        cancelledTrip = await cancelTrip(
          activeBookedRide.id,
          { cancelReason: 4 },
          session.accessToken
        );
      } catch (error) {
        if (error?.status !== 401) {
          throw error;
        }

        const nextSession = await refreshSession();
        cancelledTrip = await cancelTrip(
          activeBookedRide.id,
          { cancelReason: 4 },
          nextSession.accessToken
        );
      }

      setAcceptedTrip(cancelledTrip);
      const nextBookedRide = {
        ...(activeBookedRide ?? {}),
        status: normalizeTripStatus(cancelledTrip?.status ?? "cancelled"),
        statusLabel: getTripStatusView("cancelled", false).label,
        cancelledAt: cancelledTrip?.cancelledAt ?? new Date().toISOString(),
      };

      setActiveBookedRide(nextBookedRide);

      try {
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

    if (areSameBookingPlaces(selectedFromPlace, selectedToPlace)) {
      setAlertMessage("Điểm đón và điểm đến không được trùng nhau.");
      setFocusedField("to");
      return null;
    }

    const distanceBetweenPlaces = calculateBackendDistanceKm(
      selectedFromPlace,
      selectedToPlace
    );

    if (Number.isFinite(distanceBetweenPlaces) && distanceBetweenPlaces < 0.1) {
      setAlertMessage("Điểm đón và điểm đến quá gần nhau. Vui lòng chọn lộ trình khác.");
      setFocusedField("to");
      return null;
    }

    setIsVerifyingMap(true);

    try {
      const nextVerifiedTripMap = await createVerifiedTripMap(
        selectedFromPlace,
        selectedToPlace
      );

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

    const hasActiveSharedRide = pendingSharedRequests.some((request) =>
      isSharedRideActive(request.status)
    );

    if (hasActiveSharedRide) {
      setSharedFormError(
        "Bạn đang có yêu cầu xe ghép đang hoạt động. Vui lòng hủy yêu cầu hiện tại trước khi tạo mới."
      );
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

    const fptPlace = FPT_HOLA_PLACE;
    const pickupPlace = isSharedTripToFpt ? selectedSharedPlace : fptPlace;
    const destinationPlace = isSharedTripToFpt ? fptPlace : selectedSharedPlace;
    let sharedDirections = null;

    try {
      sharedDirections = await getMapDirections(pickupPlace, destinationPlace);
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

    setIsCreatingSharedRequest(true);
    setSharedFormError("");

    try {
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
        const latestGroup = await getMyRideSharingGroup(session.accessToken).catch(
          () => null
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
      const createdRequest = await createRideSharingRequest(
        requestPayload,
        session.accessToken
      );
      logRideSharingCreateDebug("created request response", createdRequest);
      let latestRequest = createdRequest;

      if (createdRequest?.id) {
        try {
          latestRequest = await getRideSharingRequest(
            createdRequest.id,
            session.accessToken
          );
        } catch {
          latestRequest = createdRequest;
        }
      }

      const latestGroup = await getMyRideSharingGroup(session.accessToken).catch(
        () => null
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

    try {
      const requestToCancel = pendingSharedRequests.find(
        (request) => request.requestId === requestId
      );

      let cancelledRequest = null;

      if (requestToCancel?.groupId) {
        await leaveRideSharingGroup(
          requestToCancel.groupId,
          { cancelReason: 4 },
          session.accessToken
        );

        try {
          cancelledRequest = await getRideSharingRequest(
            requestId,
            session.accessToken
          );
        } catch {
          cancelledRequest = {
            ...requestToCancel,
            id: requestId,
            status: "Cancelled",
            groupId: "",
          };
        }
      } else {
        cancelledRequest = await cancelRideSharingRequest(
          requestId,
          { cancelReason: 4 },
          session.accessToken
        );
      }

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
        setPendingSharedRequests((current) => {
          const remainingRequests = removeSharedRequestCards(
            current,
            requestId,
            requestToCancel?.groupId
          );
          const nextRequests = mergeSharedRequestCards(
            [{ ...cancelledCard, status: "cancelled", requestStatus: "cancelled" }],
            remainingRequests
          );
          replaceRideSharingCards(nextRequests, session.userId).catch(() => {});
          return nextRequests;
        });
        setSharedRequestFilter("cancelled");
      }
    } catch (error) {
      setAlertMessage(error.message || "Không thể hủy yêu cầu xe ghép.");
    } finally {
      setCancellingSharedRequestId("");
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
        scrollEnabled={bookingStep === "form"}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.content,
            bookingStep === "confirm" && styles.contentFit,
            bookingStep === "rideOptions" && styles.contentRideOptions,
            bookingStep === "findingDriver" && styles.contentFit,
          ]}
        >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => {
              if (bookingStep === "findingDriver") {
                router.back();
                return;
              }

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
                    {"←"}
                  </ThemedText>
          </Pressable>
          <ThemedText type="default" style={styles.headerTitle}>
                    {"Đặt xe"}
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
              {"Xe lẻ"}
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
              {"Xe ghép"}
            </ThemedText>
          </Pressable>
        </View>

        {bookingStep === "findingDriver" && mode !== "shared" ? (
          <View style={styles.findingDriverStage}>
            <View
              style={[
                styles.findingRadarCard,
                shouldShowTripStatusCard && styles.driverAcceptedCard,
              ]}
            >
              {shouldShowTripStatusCard ? (
                <>
                  <View
                    style={[
                      styles.driverAvatar,
                      trackedTripStatus === "completed" && styles.completedAvatar,
                      trackedTripStatus === "cancelled" && styles.cancelledAvatar,
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
                  <View style={styles.radarOuter}>
                    <View style={styles.radarMiddle}>
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

            <View style={styles.findingTripCard}>
              <View style={styles.findingTripHeader}>
                <ThemedText type="smallBold" style={styles.findingVehicle}>
                  {activeBookedRide?.vehicleName ?? selectedRideOption.name}
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
              <View style={styles.findingRouteBox}>
                <ThemedText type="smallBold" style={styles.findingAddress} numberOfLines={2}>
                  {"Đón: "}{activeBookedRide?.pickup ?? verifiedFromLabel}
                </ThemedText>
                <ThemedText type="smallBold" style={styles.findingAddress} numberOfLines={2}>
                  {"Đến: "}{activeBookedRide?.destination ?? verifiedToLabel}
                </ThemedText>
              </View>
              {isCompletedTrip ? (
                <View style={styles.completedSummaryBox}>
                  <View style={styles.completedSummaryRow}>
                    <ThemedText type="small" style={styles.completedSummaryLabel}>
                      {"Tổng tiền"}
                    </ThemedText>
                    <ThemedText type="smallBold" style={styles.completedSummaryValue}>
                      {completedFare}
                    </ThemedText>
                  </View>
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
                <View style={styles.completedActionRow}>
                  <Pressable style={styles.completedReviewButton}>
                    <ThemedText type="smallBold" style={styles.completedReviewText}>
                      {"Đánh giá tài xế"}
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={styles.completedHomeButton}
                    onPress={() => router.push("/")}
                  >
                    <ThemedText type="smallBold" style={styles.completedHomeText}>
                      {"Về trang chủ"}
                    </ThemedText>
                  </Pressable>
                </View>
              ) : (
                <Pressable
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
          </View>
        ) : bookingStep === "rideOptions" && mode !== "shared" ? (
          <>
            <View style={styles.dotsRow}>
              <View style={styles.dotActive} />
              <View style={styles.dotActive} />
              <View style={styles.dotActive} />
            </View>

            <View style={styles.routeMapCard}>
              {verifiedTripMap ? (
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
                <View style={styles.routeMapFallback}>
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
              <View style={styles.routeMapTopBar}>
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

            <View style={styles.rideOptionsSheet}>
              <View style={styles.sheetHandle} />
              <ThemedText type="default" style={styles.rideSheetTitle}>
                    {"Chọn loại xe"}
                  </ThemedText>
              {Boolean(ridePriceError) && (
                <ThemedText type="small" style={styles.paymentNoticeText}>
                  {ridePriceError}
                </ThemedText>
              )}
              {availableRideOptions.map((option) => {
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
                        {option.name}
                      </ThemedText>
                      <ThemedText type="small" style={styles.rideOptionEta}>
                        {option.eta}
                      </ThemedText>
                    </View>
                    <ThemedText type="default" style={styles.rideOptionPrice}>
                      {isLoadingRidePrices
                        ? "Đang tính..."
                        : ridePriceQuotes[option.id] ?? "--"}
                    </ThemedText>
                  </Pressable>
                );
              })}
              <Pressable
                style={[styles.bookButton, isBookingRide && styles.bookButtonDisabled]}
                onPress={handleBookRide}
                disabled={isBookingRide}
              >
                <ThemedText type="smallBold" style={styles.bookButtonText}>
                  {isBookingRide ? "Đang đặt..." : "Đặt xe"}
                </ThemedText>
              </Pressable>
            </View>
          </>
        ) : bookingStep === "confirm" && mode !== "shared" ? (
          <View style={styles.confirmStage}>
            <View style={styles.dotsRow}>
              <View style={styles.dotActive} />
              <View style={styles.dotActive} />
              <View style={styles.dotInactive} />
            </View>

            <View style={styles.pickupMapCard}>
              {verifiedTripMap ? (
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

            <View style={styles.pickupConfirmSheet}>
              <View style={styles.pickupAddressRow}>
                <View style={styles.pickupAddressIconWrap}>
                  <ThemedText type="default" style={styles.pickupAddressIcon}>
                    {"📍"}
                  </ThemedText>
                  <ThemedText type="small" style={styles.pickupDistanceText}>
                    20 m
                  </ThemedText>
                </View>
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

              <TextInput
                {...vietnameseTextInputProps}
                placeholder={"Thêm ghi chú cho bác tài (ví dụ: gần cổng)."}
                placeholderTextColor="#9CA3AF"
                style={styles.pickupNoteInput}
                value={driverNote}
                onChangeText={setDriverNote}
              />

              {Boolean(scheduledRideTime) && (
                <View style={styles.pickupScheduleBadge}>
                  <ThemedText type="smallBold" style={styles.pickupScheduleText}>
                    {"Hẹn lịch: "}{scheduledRideTime}
                  </ThemedText>
                </View>
              )}

              <Pressable
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
            <View style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.inputLabel}>
                {"Điểm đón"}
              </ThemedText>
              <View
                style={[
                  styles.inputWrap,
                  {
                    backgroundColor: theme.backgroundElement,
                  },
                ]}
              >
                <TextInput
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
                    addressSuggestions.from.map((suggestion) => (
                      <Pressable
                        key={suggestion.placeId}
                        style={styles.suggestionItem}
                        onPress={() => selectAddressSuggestion("from", suggestion)}
                      >
                        <View style={styles.suggestionIcon}>
                          <ThemedText type="smallBold" style={styles.suggestionIconText}>
                            {"•"}
                          </ThemedText>
                        </View>
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
            <View style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.inputLabel}>
                {"Điểm đến"}
              </ThemedText>
              <View
                style={[
                  styles.inputWrap,
                  {
                    backgroundColor: theme.backgroundElement,
                  },
                ]}
              >
                <TextInput
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
                    addressSuggestions.to.map((suggestion) => (
                      <Pressable
                        key={suggestion.placeId}
                        style={styles.suggestionItem}
                        onPress={() => selectAddressSuggestion("to", suggestion)}
                      >
                        <View style={styles.suggestionIcon}>
                          <ThemedText type="smallBold" style={styles.suggestionIconText}>
                    {"•"}
                  </ThemedText>
                        </View>
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

            <View style={styles.savedList}>
              <View style={styles.savedHeader}>
                <ThemedText type="smallBold">{"Địa chỉ đã lưu"}</ThemedText>
                <Pressable onPress={openCreateAddressModal}>
                  <ThemedText type="smallBold" style={styles.saveAddressButtonText}>
                    {"+ Lưu địa chỉ"}
                  </ThemedText>
                </Pressable>
              </View>
              {savedAddresses.map((item) => (
                <View key={item.id} style={styles.savedItemRowWrap}>
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
                    <View style={styles.savedMiniMenu}>
                      <Pressable
                        style={styles.savedMiniAction}
                        onPress={() => openEditAddressModal(item)}
                      >
                        <ThemedText type="smallBold" style={styles.savedEditText}>
                          {"Sửa"}
                        </ThemedText>
                      </Pressable>
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

            <View style={styles.buttonRow}>
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

              <Pressable
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
          <View style={styles.sharedSection}>
            <View style={styles.pendingSharedSection}>
              <View style={styles.sharedHeader}>
                <ThemedText type="default" style={styles.pendingSharedTitle}>
                  {"Yêu cầu xe ghép của bạn"}
                </ThemedText>
                <Pressable
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

              <View style={styles.sharedRequestFilterBox}>
                <ThemedText type="smallBold" style={styles.sharedRequestFilterLabel}>
                  {"Chọn chuyến ghép"}
                </ThemedText>
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
                  <View style={styles.sharedRequestDropdown}>
                    {sharedRequestFilterOptions.map((option) => (
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

              {isLoadingSharedState ? (
                <View style={styles.pendingSharedEmptyCard}>
                  <ThemedText type="small" style={styles.pendingSharedMeta}>
                    {"Đang tải yêu cầu xe ghép của bạn..."}
                  </ThemedText>
                </View>
              ) : filteredSharedRequests.length === 0 ? (
                <View style={styles.pendingSharedEmptyCard}>
                  <ThemedText type="smallBold" style={styles.emptySharedTitle}>
                    {"Chưa có yêu cầu/chuyến ghép nào"}
                  </ThemedText>
                  <ThemedText type="small" style={styles.emptySharedText}>
                    {"Bạn chưa có yêu cầu xe ghép nào ở trạng thái này. Hãy tạo yêu cầu mới hoặc chọn bộ lọc khác."}
                  </ThemedText>
                </View>
              ) : null}

              {filteredSharedRequests.map((request) => (
                <View key={request.id} style={styles.pendingSharedCard}>
                  <View style={styles.pendingSharedHeader}>
                    <ThemedText type="smallBold" style={styles.pendingSharedVehicle}>
                      {request.vehicle}
                    </ThemedText>
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
                    {"Nhóm: "}{request.participantCount}/{request.capacity}
                    {" người • "}{request.statusLabel}
                  </ThemedText>
                  <ThemedText type="small" style={styles.pendingSharedMeta}>
                    {"Quãng đường: "}{request.distance}{" • "}{request.duration}
                  </ThemedText>
                  <View style={styles.pendingSharedFooter}>
                    <ThemedText type="smallBold" style={styles.pendingSharedPrice}>
                      {request.price}
                    </ThemedText>
                    {Boolean(request.groupId) && (
                      <Pressable
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
                    <Pressable
                      style={[
                        styles.pendingSharedCancelButton,
                        !request.requestId && styles.hidden,
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
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.sharedHeader}>
              <ThemedText type="default" style={styles.sharedTitle}>
                {"Đề xuất nhóm ghép sẵn có"}
              </ThemedText>
            </View>

            {suggestedSharedRides.length === 0 ? (
              <View style={styles.emptySharedCard}>
                <ThemedText type="smallBold" style={styles.emptySharedTitle}>
                    {"Chưa có nhóm ghép phù hợp"}
                  </ThemedText>
                <ThemedText type="small" style={styles.emptySharedText}>
                    {"Nhóm chỉ có một người sẽ chưa được đề xuất. Khi có thêm người tham gia, hệ thống sẽ hiển thị tại đây."}
                  </ThemedText>
              </View>
            ) : null}

            {suggestedSharedRides.map((ride) => {
              return (
                <View key={ride.id} style={styles.suggestedGroupCard}>
                  <View style={styles.suggestedGroupTop}>
                    <View style={styles.suggestedGroupLabel}>
                      <ThemedText type="smallBold" style={styles.suggestedGroupLabelText}>
                        {"Nhóm phù hợp"}
                      </ThemedText>
                    </View>
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

                  <View style={styles.suggestedGroupChipRow}>
                    <View style={styles.suggestedGroupChip}>
                      <ThemedText type="small" style={styles.suggestedGroupChipText}>
                        {ride.scheduleText || "Chưa có lịch"}
                      </ThemedText>
                    </View>
                    <View style={styles.suggestedGroupChip}>
                      <ThemedText type="small" style={styles.suggestedGroupChipText}>
                        {ride.statusLabel}
                      </ThemedText>
                    </View>
                  </View>

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

                  <View style={styles.suggestedGroupFooter}>
                    <View style={styles.suggestedGroupPriceBlock}>
                      <ThemedText type="small" style={styles.suggestedGroupPriceLabel}>
                        {ride.priceLabel || "Giá mỗi người"}
                      </ThemedText>
                      <ThemedText type="default" style={styles.suggestedGroupPriceValue}>
                        {ride.price || ride.perPersonPrice || "--"}
                      </ThemedText>
                    </View>

                    <View style={styles.suggestedGroupActions}>
                      <Pressable
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
                      <Pressable
                        style={styles.suggestedGroupPrimaryButton}
                        onPress={() => {
                          if (requireLogin()) {
                            router.push(`/search/shared-ride/${ride.id}`);
                          }
                        }}
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

      <Modal
        visible={addressModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeAddressModal}
      >
        <View style={styles.addressOverlay}>
          <View
            style={[
              styles.addressCard,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            <View style={styles.addressHeader}>
              <ThemedText type="default" style={styles.addressTitle}>
                {editingAddressId ? "Sửa địa chỉ" : "Lưu địa chỉ"}
              </ThemedText>
              <Pressable style={styles.addressCloseButton} onPress={closeAddressModal}>
                <ThemedText type="default" style={styles.addressCloseText}>
                    {"x"}
                  </ThemedText>
              </Pressable>
            </View>

            <View style={styles.addressField}>
              <ThemedText type="smallBold" style={styles.addressLabel}>
                    {"Tên địa chỉ"}
                  </ThemedText>
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

            <View style={styles.addressButtonRow}>
              <Pressable
                style={[styles.addressSecondaryButton, { backgroundColor: theme.background }]}
                onPress={closeAddressModal}
              >
                <ThemedText type="smallBold">{"Hủy"}</ThemedText>
              </Pressable>
              <Pressable style={styles.addressPrimaryButton} onPress={saveAddress}>
                <ThemedText type="smallBold" style={styles.addressPrimaryText}>
                    {"Lưu địa chỉ"}
                  </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={schedulePickerVisible}
        animationType="slide"
        onRequestClose={() => setSchedulePickerVisible(false)}
      >
        <View
          style={[
            styles.scheduleScreen,
            {
              paddingTop: insets.top + Spacing.three,
              paddingBottom: insets.bottom + Spacing.three,
            },
          ]}
        >
          <View style={styles.scheduleHeader}>
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
            <View style={styles.scheduleBackButton} />
          </View>

          <View style={styles.scheduleCalendarCard}>
            <ThemedText type="default" style={styles.scheduleCalendarMonth}>
              {selectedScheduleDate.monthLabel}
            </ThemedText>
            <ThemedText type="default" style={styles.scheduleCalendarDay}>
              {selectedScheduleDate.dayLabel}
            </ThemedText>
          </View>

          <View style={styles.scheduleIntro}>
            <ThemedText type="default" style={styles.scheduleQuestion}>
                    {"Bạn muốn xe đón lúc nào?"}
                  </ThemedText>
            <ThemedText type="default" style={styles.scheduleHint}>
              {"Chọn thời gian trong vòng tối đa 7 ngày kể từ hiện tại."}
            </ThemedText>
          </View>

          <View style={styles.schedulePickerPanel}>
            <ScrollView
              style={styles.scheduleDateColumn}
              showsVerticalScrollIndicator={false}
            >
              {scheduleDateOptions.map((option) => {
                const isSelected = option.value === selectedScheduleDate.value;

                return (
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

            <ScrollView
              style={styles.scheduleTimeColumn}
              showsVerticalScrollIndicator={false}
            >
              {scheduleHourOptions.map((hour) => {
                const isSelected = hour === scheduleDraft.hour;

                return (
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

            <ScrollView
              style={styles.scheduleTimeColumn}
              showsVerticalScrollIndicator={false}
            >
              {scheduleMinuteOptions.map((minute) => {
                const isSelected = minute === scheduleDraft.minute;

                return (
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

          <View style={styles.scheduleResultCard}>
            <ThemedText type="default" style={styles.scheduleResultTitle}>
              {"Xe đón bạn lúc "}{scheduleDisplayText}
            </ThemedText>
            <ThemedText type="default" style={styles.scheduleArrivalText}>
              {"Đến nơi lúc "}{padSchedule(arrivalDate.getHours())}:{padSchedule(arrivalDate.getMinutes())}
            </ThemedText>
            <ThemedText type="small" style={styles.scheduleHint}>
              {"di chuyển khoảng "}{MOCK_TRIP_DURATION_MINUTES}{" phút"}
            </ThemedText>
          </View>

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

      <Modal
        visible={createSharedVisible}
        transparent
        animationType="fade"
        onRequestClose={closeCreateSharedModal}
      >
        <View style={styles.createSharedOverlay}>
          <View style={styles.createSharedCard}>
            <View style={styles.createSharedHeader}>
              <ThemedText type="default" style={styles.createSharedTitle}>
                    {"Tạo yêu cầu xe ghép"}
                  </ThemedText>
              <Pressable
                style={styles.createSharedClose}
                onPress={closeCreateSharedModal}
              >
                <ThemedText type="default" style={styles.createSharedCloseText}>
                    {"x"}
                  </ThemedText>
              </Pressable>
            </View>

            <ScrollView
              style={styles.createSharedBody}
              contentContainerStyle={styles.createSharedBodyContent}
              showsVerticalScrollIndicator
            >
              <View style={styles.createField}>
                <ThemedText type="small" style={styles.createLabel}>
                  {"Kiểu ghép"}
                </ThemedText>
                <View style={styles.segmentRow}>
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

              <View style={styles.createField}>
                <ThemedText type="small" style={styles.createLabel}>
                  {"Loại chuyến"}
                  <ThemedText type="small" style={styles.requiredMark}>*</ThemedText>
                </ThemedText>
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
                  <View style={styles.createSelectIndicator}>
                    <ThemedText type="smallBold" style={styles.createSelectChevron}>
                      {openSharedDropdown === "tripType" ? "⌃" : "⌄"}
                    </ThemedText>
                  </View>
                </Pressable>
                {openSharedDropdown === "tripType" && (
                  <View style={styles.createDropdown}>
                    {sharedTripTypes.map((item) => (
                      <Pressable
                        key={item}
                        style={[
                          styles.createDropdownItem,
                          sharedForm.tripType === item &&
                            styles.createDropdownItemActive,
                        ]}
                        onPress={() => {
                          updateSharedForm("tripType", item);
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

              <View style={styles.createField}>
                <ThemedText type="small" style={styles.createLabel}>
                  {"Loại xe"}
                </ThemedText>
                <Pressable
                  style={styles.createSelect}
                  onPress={() =>
                    setOpenSharedDropdown(
                      openSharedDropdown === "vehicle" ? "" : "vehicle"
                    )
                  }
                >
                  <ThemedText type="default" style={styles.createSelectText}>
                    {sharedVehicleOptions[sharedForm.vehicleIndex].label}
                  </ThemedText>
                  <View style={styles.createSelectIndicator}>
                    <ThemedText type="smallBold" style={styles.createSelectChevron}>
                      {openSharedDropdown === "vehicle" ? "⌃" : "⌄"}
                    </ThemedText>
                  </View>
                </Pressable>
                {openSharedDropdown === "vehicle" && (
                  <View style={styles.createDropdown}>
                    {sharedVehicleOptions.map((item, index) => (
                      <Pressable
                        key={item.vehicle}
                        style={[
                          styles.createDropdownItem,
                          sharedForm.vehicleIndex === index &&
                            styles.createDropdownItemActive,
                        ]}
                        onPress={() => {
                          setSharedForm((current) => ({
                            ...current,
                            vehicleIndex: index,
                          }));
                          setOpenSharedDropdown("");
                          setSharedFormError("");
                        }}
                      >
                        <ThemedText
                          type="smallBold"
                          style={[
                            styles.createDropdownText,
                            sharedForm.vehicleIndex === index &&
                              styles.createDropdownTextActive,
                          ]}
                        >
                          {item.label}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.createField}>
                <ThemedText type="small" style={styles.createLabel}>
                  {sharedLocationLabel}
                  <ThemedText type="small" style={styles.requiredMark}>*</ThemedText>
                </ThemedText>
                <View style={styles.createLocationInputWrap}>
                  <TextInput
                    {...vietnameseTextInputProps}
                    placeholder={sharedLocationPlaceholder}
                    placeholderTextColor="#A1A1AA"
                    style={styles.createInput}
                    value={sharedForm.location}
                    onChangeText={(value) => updateSharedForm("location", value)}
                  />
                  {Boolean(sharedForm.location) && (
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
                      sharedLocationSuggestions.map((suggestion) => (
                        <Pressable
                          key={suggestion.placeId || suggestion.description}
                          style={styles.suggestionItem}
                          onPress={() => selectSharedLocationSuggestion(suggestion)}
                        >
                          <View style={styles.suggestionIcon}>
                            <ThemedText type="smallBold" style={styles.suggestionIconText}>
                              {"•"}
                            </ThemedText>
                          </View>
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
              <View style={styles.createScheduleCard}>
                <View style={styles.createScheduleHeader}>
                  <View style={styles.createCalendarBadge}>
                    <ThemedText type="smallBold" style={styles.createCalendarMonth}>
                      {sharedCalendarPreview?.monthLabel ?? "Ngày"}
                    </ThemedText>
                    <ThemedText type="title" style={styles.createCalendarDay}>
                      {sharedCalendarPreview?.dayLabel ?? "--"}
                    </ThemedText>
                  </View>
                  <View style={styles.createScheduleIntro}>
                    <ThemedText type="default" style={styles.createScheduleTitle}>
                    {"Chọn lịch ngày đi"}
                  </ThemedText>
                    <ThemedText type="small" style={styles.createScheduleHint}>
                    {"Chọn slot cố định và ngày bạn muốn đi ghép xe."}
                  </ThemedText>
                  </View>
                </View>

                <View style={styles.createScheduleBlock}>
                  <ThemedText type="smallBold" style={styles.createSubLabel}>
                    Slot
                    <ThemedText type="smallBold" style={styles.requiredMark}>*</ThemedText>
                  </ThemedText>
                  <View style={styles.slotGrid}>
                    {availableSharedSlotOptions.map((slot) => {
                      const isSelected = sharedForm.slotId === slot.id;

                      return (
                        <Pressable
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

                <View style={styles.createScheduleBlock}>
                  <ThemedText type="smallBold" style={styles.createSubLabel}>
                    {"Ngày đi"}
                    <ThemedText type="smallBold" style={styles.requiredMark}>*</ThemedText>
                  </ThemedText>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.dateChipRow}
                  >
                    {scheduleDateOptions.slice(0, 7).map((date) => {
                      const isSelected = sharedForm.date === date.value;

                      return (
                        <Pressable
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

                <View style={styles.createScheduleSummary}>
                  <ThemedText type="smallBold" style={styles.createScheduleSummaryText}>
                    {sharedScheduleSummary}
                  </ThemedText>
                </View>
              </View>
              ) : (
                <View style={styles.createScheduleSummary}>
                  <ThemedText type="smallBold" style={styles.createScheduleSummaryText}>
                    {sharedScheduleSummary}
                  </ThemedText>
                </View>
              )}

              {Boolean(sharedFormError) && (
                <ThemedText type="smallBold" style={styles.createError}>
                  {sharedFormError}
                </ThemedText>
              )}

              <Pressable
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
                    {"Thiếu thông tin"}
                  </ThemedText>
            <ThemedText type="default" style={styles.alertMessage}>
              {alertMessage}
            </ThemedText>
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
  suggestionSecondaryText: {
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
  createField: {
    gap: Spacing.one,
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






