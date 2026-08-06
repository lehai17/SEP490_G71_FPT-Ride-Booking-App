import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import { useDeferredValue, useEffect, useRef, useState } from "react";
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
import { rideGroups } from "@/constants/ride-data";
import { useTheme } from "@/hooks/use-theme";
import {
  getGeoapifyDirections,
  buildGeoapifyInteractiveMapHtml,
  getGeoapifyPlaceDetails,
  getGeoapifyPlaceSuggestions,
  getGeoapifyPlaceMapUrl,
  getGeoapifyStaticMapUrl,
  reverseGeoapifyPlaceLocation,
  isGeoapifyConfigured,
} from "@/features/booking/services/geoapify-api";
import { estimateFare } from "@/features/booking/services/pricing-api";
import {
  cancelTrip,
  createTrip,
  getTrip,
} from "@/features/booking/services/trip-api";
import { persistBookedTrip } from "@/features/booking/services/trip-storage";

const BRAND = "#FF7A00";
const MAP_BG = "#FFF3C9";
const PICKUP_BLUE = "#2563EB";
const DESTINATION_GREEN = "#16A34A";
const MOCK_DRIVER_POINT = {
  placeId: "",
  formattedAddress: "C\u1ed5ng ch\u00ednh \u0110\u1ea1i h\u1ecdc FPT, Th\u1ea1ch H\u00f2a, H\u00e0 N\u1ed9i",
  location: {
    lat: 21.0137,
    lng: 105.5262,
  },
};
const MOCK_DRIVER_LOCATION = "C\u1ed5ng ch\u00ednh \u0110\u1ea1i h\u1ecdc FPT, Th\u1ea1ch H\u00f2a, H\u00e0 N\u1ed9i";
const vietnameseTextInputProps = {
  autoCapitalize: "none",
  autoCorrect: false,
  autoComplete: "off",
  spellCheck: false,
  keyboardType: "default",
  disableFullscreenUI: true,
};
const rideOptions = [
  {
    id: "bike",
    icon: "Xe m\u00e1y",
    name: "Xe m\u00e1y",
    eta: "\u0110\u00f3n trong 3 ph\u00fat",
    vehicleType: 1,
  },
  {
    id: "car4",
    icon: "Xe 4 ch\u1ed7",
    name: "Xe 4 ch\u1ed7",
    eta: "\u0110\u00f3n trong 5 ph\u00fat",
    vehicleType: 2,
  },
  {
    id: "car7",
    icon: "Xe 7 ch\u1ed7",
    name: "Xe 7 ch\u1ed7",
    eta: "\u0110\u00f3n trong 7 ph\u00fat",
    vehicleType: 4,
  },
];
const availableRideOptions = rideOptions.filter((option) => option.id !== "car7");

const sharedTripTypes = [
  "Chuy\u1ebfn \u0111i (T\u1eeb n\u01a1i kh\u00e1c \u0111\u1ebfn FPT)",
  "Chuy\u1ebfn v\u1ec1 (T\u1eeb FPT \u0111i n\u01a1i kh\u00e1c)",
];

const sharedVehicleOptions = [
  { label: "Xe 4 ch\u1ed7", vehicle: "Xe 4 ch\u1ed7", capacity: 4, price: "30.000\u0111" },
  { label: "Xe 7 ch\u1ed7", vehicle: "Xe 7 ch\u1ed7", capacity: 7, price: "42.000\u0111" },
];
const sharedSlotOptions = [
  { id: "slot-1", label: "Slot 1", time: "07:30" },
  { id: "slot-2", label: "Slot 2", time: "10:00" },
  { id: "slot-3", label: "Slot 3", time: "12:50" },
  { id: "slot-4", label: "Slot 4", time: "15:20" },
];

const defaultSharedForm = {
  tripType: sharedTripTypes[0],
  vehicleIndex: 0,
  location: "",
  slotId: "",
  date: "",
};

const defaultAddressForm = {
  label: "",
};

function formatCurrencyVnd(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return `${Math.round(value).toLocaleString("vi-VN")}\u0111`;
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

  return `${Math.max(1, Math.round(numberValue))} ph\u00fat`;
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

function formatTripDateTime(value) {
  if (!value) {
    return "V\u1eeba ho\u00e0n th\u00e0nh";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "V\u1eeba ho\u00e0n th\u00e0nh";
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

function getBackendTripMetrics(verifiedMap) {
  const distanceKm = calculateBackendDistanceKm(
    verifiedMap?.origin,
    verifiedMap?.destination
  );

  if (distanceKm <= 0) {
    return null;
  }

  const durationMinute = Math.ceil((distanceKm / 30) * 60);

  return {
    distanceKm,
    durationMinute,
    distanceText: formatDistanceKm(distanceKm),
    durationText: formatDurationMinute(durationMinute),
  };
}

function normalizeTripStatus(status) {
  return String(status ?? "pending").replace(/\s+/g, "").toLowerCase();
}

function isTerminalTripStatus(status) {
  const normalizedStatus = normalizeTripStatus(status);
  return normalizedStatus === "completed" || normalizedStatus === "cancelled";
}

function getTripStatusView(status, hasDriver) {
  const normalizedStatus = normalizeTripStatus(status);

  if (normalizedStatus === "driverarrived") {
    return {
      title: "T\u00e0i x\u1ebf \u0111\u00e3 \u0111\u1ebfn \u0111i\u1ec3m \u0111\u00f3n",
      subtitle: "Vui l\u00f2ng ra \u0111\u00fang \u0111i\u1ec3m \u0111\u00f3n v\u00e0 ki\u1ec3m tra bi\u1ec3n s\u1ed1 xe tr\u01b0\u1edbc khi l\u00ean xe.",
      label: "T\u00e0i x\u1ebf \u0111\u00e3 \u0111\u1ebfn",
      icon: "\u2713",
    };
  }

  if (normalizedStatus === "inprogress") {
    return {
      title: "Chuy\u1ebfn \u0111i \u0111ang di\u1ec5n ra",
      subtitle: "B\u1ea1n \u0111ang tr\u00ean chuy\u1ebfn \u0111i. H\u1ec7 th\u1ed1ng s\u1ebd c\u1eadp nh\u1eadt khi t\u00e0i x\u1ebf ho\u00e0n th\u00e0nh chuy\u1ebfn.",
      label: "Chuy\u1ebfn \u0111i \u0111ang di\u1ec5n ra",
      icon: "\u2192",
    };
  }

  if (normalizedStatus === "completed") {
    return {
      title: "Chuy\u1ebfn \u0111i \u0111\u00e3 ho\u00e0n th\u00e0nh",
      subtitle: "C\u1ea3m \u01a1n b\u1ea1n \u0111\u00e3 s\u1eed d\u1ee5ng FPT Ride. B\u1ea1n c\u00f3 th\u1ec3 \u0111\u00e1nh gi\u00e1 t\u00e0i x\u1ebf sau chuy\u1ebfn \u0111i.",
      label: "Ho\u00e0n th\u00e0nh",
      icon: "\u2713",
    };
  }

  if (normalizedStatus === "cancelled") {
    return {
      title: "Chuy\u1ebfn \u0111i \u0111\u00e3 b\u1ecb h\u1ee7y",
      subtitle: "Y\u00eau c\u1ea7u chuy\u1ebfn \u0111i n\u00e0y \u0111\u00e3 k\u1ebft th\u00fac. B\u1ea1n c\u00f3 th\u1ec3 quay l\u1ea1i \u0111\u1eb7t chuy\u1ebfn m\u1edbi.",
      label: "\u0110\u00e3 h\u1ee7y",
      icon: "!",
    };
  }

  if (hasDriver || normalizedStatus === "accepted") {
    return {
      title: "T\u00e0i x\u1ebf \u0111\u00e3 nh\u1eadn chuy\u1ebfn",
      subtitle: "T\u00e0i x\u1ebf \u0111ang di chuy\u1ec3n \u0111\u1ebfn \u0111i\u1ec3m \u0111\u00f3n c\u1ee7a b\u1ea1n.",
      label: "\u0110\u00e3 c\u00f3 t\u00e0i x\u1ebf nh\u1eadn chuy\u1ebfn",
      icon: "\u25cf",
    };
  }

  return {
    title: "\u0110ang t\u00ecm t\u00e0i x\u1ebf cho b\u1ea1n",
    subtitle: "Y\u00eau c\u1ea7u chuy\u1ebfn \u0111i \u0111\u00e3 \u0111\u01b0\u1ee3c l\u01b0u. H\u1ec7 th\u1ed1ng \u0111ang qu\u00e9t t\u00e0i x\u1ebf ph\u00f9 h\u1ee3p xung quanh.",
    label: "\u0110ang t\u00ecm t\u00e0i x\u1ebf",
    icon: "\u25cf",
  };
}

function getSharedProposal(ride) {
  const isCar7 = ride.vehicle.includes("7");
  const soloPrice = isCar7 ? "320.000\u0111" : "250.000\u0111";
  const sharedPrice = isCar7 ? "116.000\u0111" : "90.000\u0111";
  const savingPrice = isCar7 ? "204.000\u0111" : "160.000\u0111";
  const [startPoint = "\u0110\u1ea1i h\u1ecdc FPT", endPoint = "\u0110i\u1ec3m \u0111\u1ebfn"] =
    ride.route.split("\u2192").map((item) => item.trim());

  return {
    soloPrice,
    sharedPrice,
    savingPrice,
    expectedPickup: isCar7 ? "6:35" : "7:30",
    expectedArrival: isCar7 ? "7:20" : "8:10",
    pickupDirection: isCar7
      ? "Chi\u1ec1u: Nh\u00e0 \u2192 Tr\u01b0\u1eddng"
      : "Chi\u1ec1u: Tr\u01b0\u1eddng \u2192 Nh\u00e0",
    driverStatus: "\u0110\u00e3 c\u00f3 t\u00e0i x\u1ebf",
    routeSteps: [
      `1. ${startPoint}`,
      `2. ${ride.driver.split(" ").slice(-2).join(" ") || "Kh\u00e1ch"} - ${endPoint}`,
      "3. B\u1ea1n - M\u00ea Tr\u00ec",
    ],
    notes: [
      "1. \u0110\u1ed3ng \u00fd tham gia s\u1ebd gi\u1eef ch\u1ed7",
      "2. H\u1ee7y sau th\u1eddi gian \u0111\u00f3ng nh\u00f3m s\u1ebd b\u1ecb c\u1ea3nh c\u00e1o",
    ],
  };
}

const initialSavedAddresses = [
  {
    id: "saved-from",
    label: "\u0110\u1ea1i h\u1ecdc FPT, Th\u1ea1ch H\u00f2a",
  },
  {
    id: "saved-to",
    label: "B\u1ebfn xe M\u1ef9 \u0110\u00ecnh",
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
    return "H\u00f4m nay";
  }

  if (index === 1) {
    return "Ng\u00e0y mai";
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
  const { session, isAuthenticated } = useAuth();
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
  const [sharedRides] = useState(rideGroups);
  const [pendingSharedRequests, setPendingSharedRequests] = useState([]);
  const [createSharedVisible, setCreateSharedVisible] = useState(false);
  const [sharedForm, setSharedForm] = useState(defaultSharedForm);
  const [openSharedDropdown, setOpenSharedDropdown] = useState("");
  const [sharedFormError, setSharedFormError] = useState("");
  const [sharedLocationSuggestions, setSharedLocationSuggestions] = useState([]);
  const [sharedLocationLoading, setSharedLocationLoading] = useState(false);
  const [sharedLocationError, setSharedLocationError] = useState("");
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
  const suggestedSharedRides = sharedRides.filter(
    (ride) => ride.participantCount > 1
  );
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
      if (!isGeoapifyConfigured()) {
        return;
      }

      setLoadingSuggestionsFor(focusedField);

      try {
        const suggestions = await getGeoapifyPlaceSuggestions(query);

        if (isActive) {
          setAddressSuggestions((current) => ({
            ...current,
            [focusedField]: suggestions,
          }));
          setSuggestionError((current) => ({
            ...current,
            [focusedField]: suggestions.length ? "" : "Ch\u01b0a c\u00f3 g\u1ee3i \u00fd ph\u00f9 h\u1ee3p, th\u1eed nh\u1eadp r\u00f5 h\u01a1n t\u00ean \u0111\u01b0\u1eddng/qu\u1eadn.",
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
              error.message || "Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c g\u1ee3i \u00fd. Ki\u1ec3m tra API b\u1ea3n \u0111\u1ed3 trong Geoapify.",
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
          const dbEstimatedFare = getTripEstimatedFare(trip);

          setAcceptedTrip(trip);
          setActiveBookedRide((current) => ({
            ...(current ?? {}),
            status: normalizeTripStatus(trip.status),
            statusLabel: getTripStatusView(trip.status, Boolean(trip.driverId)).label,
            estimatedFare:
              dbEstimatedFare != null
                ? formatCurrencyVnd(Number(dbEstimatedFare))
                : current?.estimatedFare,
            tripDistance: getTripDistanceText(trip, current?.tripDistance),
            tripDuration: getTripDurationText(trip, current?.tripDuration),
            driverId: trip.driverId,
            driverName: trip.driverName,
            driverPhone: trip.driverPhone,
            driverLicensePlate: trip.driverLicensePlate,
            driverVehicleInfo: trip.driverVehicleInfo,
          }));
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
  }, [activeBookedRide?.id, acceptedTrip?.status, bookingStep, session?.accessToken]);

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
      if (!isGeoapifyConfigured()) {
        return;
      }

      setSharedLocationLoading(true);

      try {
        const suggestions = await getGeoapifyPlaceSuggestions(query);

        if (isActive) {
          setSharedLocationSuggestions(suggestions);
          setSharedLocationError(
            suggestions.length
              ? ""
              : "Ch\u01b0a c\u00f3 g\u1ee3i \u00fd ph\u00f9 h\u1ee3p, th\u1eed nh\u1eadp r\u00f5 h\u01a1n t\u00ean \u0111\u01b0\u1eddng/qu\u1eadn."
          );
        }
      } catch (error) {
        if (isActive) {
          setSharedLocationSuggestions([]);
          setSharedLocationError(
            error.message || "Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c g\u1ee3i \u00fd. Ki\u1ec3m tra API b\u1ea3n \u0111\u1ed3 trong Geoapify."
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
      setRidePriceError("Kh\u00f4ng th\u1ec3 t\u00ednh gi\u00e1 t\u1eeb qu\u00e3ng \u0111\u01b0\u1eddng hi\u1ec7n t\u1ea1i.");
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
          setRidePriceError(error.message || "Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c gi\u00e1 c\u01b0\u1edbc t\u1eeb BE.");
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

  const fromLabel = fromInput.trim() || "V\u1ecb tr\u00ed hi\u1ec7n t\u1ea1i";
  const toLabel = toInput.trim() || "\u0110\u1ea1i h\u1ecdc FPT, Th\u1ea1ch H\u00f2a";
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
  const sharedCalendarPreview = selectedSharedDate ?? scheduleDateOptions[0];
  const sharedScheduleSummary =
    selectedSharedSlot && selectedSharedDate
      ? `Xe gh\u00e9p l\u00fac ${selectedSharedSlot.time} \u2022 ${selectedSharedDate.display} (${selectedSharedDate.label})`
      : "Ch\u1ecdn slot v\u00e0 ng\u00e0y \u0111i \u0111\u1ec3 ho\u00e0n t\u1ea5t y\u00eau c\u1ea7u.";
  const isSharedTripToFpt = sharedForm.tripType.startsWith("Chuy\u1ebfn \u0111i");
  const sharedLocationLabel = isSharedTripToFpt ? "\u0110i\u1ec3m \u0111\u00f3n" : "\u0110i\u1ec3m \u0111\u1ebfn";
  const sharedLocationPlaceholder = isSharedTripToFpt
    ? "VD: Tr\u1ea1m xe, \u0110\u01b0\u1eddng XYZ..."
    : "VD: B\u1ebfn xe M\u1ef9 \u0110\u00ecnh, Xu\u00e2n Mai...";
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
  const scheduleDisplayText = `${scheduleDraft.time} \u2022 ${scheduleDraft.dateDisplay} (${scheduleDraft.dateLabel})`;
  const pickupMapHtml = verifiedTripMap
    ? buildGeoapifyInteractiveMapHtml({
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
    ? buildGeoapifyInteractiveMapHtml({
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
      throw new Error("Kh\u00f4ng t\u00ecm th\u1ea5y th\u00f4ng tin \u0111\u1ecba ch\u1ec9 t\u1eeb Geoapify.");
    }

    if (suggestion.location) {
      return {
        ...suggestion,
        description: suggestion.formattedAddress || suggestion.description,
        formattedAddress: suggestion.formattedAddress || suggestion.description,
      };
    }

    const place = await getGeoapifyPlaceDetails(suggestion.placeId);

    return {
      ...suggestion,
      placeId: place.placeId,
      description: place.formattedAddress || suggestion.description,
      formattedAddress: place.formattedAddress || suggestion.description,
      location: place.location,
    };
  };

  const resolveSavedAddress = async (label) => {
    const suggestions = await getGeoapifyPlaceSuggestions(label);
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
      throw new Error(`Kh\u00f4ng t\u00ecm th\u1ea5y \u0111\u1ecba ch\u1ec9 "${label}" tr\u00ean Geoapify.`);
    }

    return resolvePlaceSuggestion(matchedSuggestion);
  };

  const resolveCurrentLocationPlace = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();

    if (permission.status !== "granted") {
      throw new Error("Vui l\u00f2ng cho ph\u00e9p truy c\u1eadp v\u1ecb tr\u00ed \u0111\u1ec3 l\u1ea5y \u0111i\u1ec3m \u0111\u00f3n.");
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const location = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
    const fallbackPlace = {
      placeId: "",
      formattedAddress: "V\u1ecb tr\u00ed hi\u1ec7n t\u1ea1i",
      description: "V\u1ecb tr\u00ed hi\u1ec7n t\u1ea1i",
      mainText: "V\u1ecb tr\u00ed hi\u1ec7n t\u1ea1i",
      location,
    };

    if (!isGeoapifyConfigured()) {
      return fallbackPlace;
    }

    try {
      const reversedPlace = await reverseGeoapifyPlaceLocation(location);

      return {
        ...fallbackPlace,
        ...reversedPlace,
        formattedAddress: reversedPlace.formattedAddress || fallbackPlace.formattedAddress,
        description: reversedPlace.description || fallbackPlace.description,
        mainText: reversedPlace.mainText || fallbackPlace.mainText,
        location: reversedPlace.location || location,
      };
    } catch {
      return fallbackPlace;
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
      setAlertMessage(error.message || "Kh\u00f4ng th\u1ec3 l\u1ea5y v\u1ecb tr\u00ed hi\u1ec7n t\u1ea1i.");
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
      setAlertMessage(error.message || "Kh\u00f4ng th\u1ec3 c\u1eadp nh\u1eadt b\u1ea3n \u0111\u1ed3 sau khi \u0111\u1ed5i \u0111i\u1ec3m \u0111\u00f3n.");
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
        : await reverseGeoapifyPlaceLocation(location);

      syncAddressInputText("from", resolvedPlace.formattedAddress);
      setSelectedFromPlace(resolvedPlace);
      setFocusedField("to");
      await refreshVerifiedTripWithPickup(resolvedPlace);
    } catch (error) {
      setAlertMessage(error.message || "Kh\u00f4ng th\u1ec3 c\u1eadp nh\u1eadt \u0111i\u1ec3m \u0111\u00f3n t\u1eeb b\u1ea3n \u0111\u1ed3.");
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
    const directions = await getGeoapifyDirections(origin, destination);
    const driverDirections = await getGeoapifyDirections(MOCK_DRIVER_POINT, origin);

    return {
      origin,
      destination,
      driverOrigin: MOCK_DRIVER_POINT,
      directions,
      driverDirections,
      mapImageUrl: getGeoapifyStaticMapUrl({
        origin,
        destination,
        routeGeometry: directions.routeGeometry,
      }),
      pickupMapImageUrl: getGeoapifyPlaceMapUrl({
        point: origin,
      }),
      driverMapImageUrl: getGeoapifyStaticMapUrl({
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
      setAlertMessage("Vui l\u00f2ng x\u00e1c nh\u1eadn \u0111i\u1ec3m \u0111\u00f3n v\u00e0 \u0111i\u1ec3m \u0111\u1ebfn tr\u01b0\u1edbc khi \u0111\u1eb7t xe.");
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
      setAlertMessage("Vui l\u00f2ng x\u00e1c nh\u1eadn \u0111i\u1ec3m \u0111\u00f3n v\u00e0 \u0111i\u1ec3m \u0111\u1ebfn tr\u01b0\u1edbc khi \u0111\u1eb7t xe.");
      return;
    }

    if (isBookingRide) {
      return;
    }

    setIsBookingRide(true);
    setAlertMessage("");
    setAcceptedTrip(null);

    const isScheduledRide = Boolean(scheduledRideAt);
    const createTripPayload = {
      pickupLatitude: verifiedTripMap.origin.location.lat,
      pickupLongitude: verifiedTripMap.origin.location.lng,
      pickupAddress: verifiedFromLabel,
      destinationLatitude: verifiedTripMap.destination.location.lat,
      destinationLongitude: verifiedTripMap.destination.location.lng,
      destinationAddress: verifiedToLabel,
      vehicleType: selectedRideOption.vehicleType,
      tripType: isScheduledRide ? 2 : 1,
      ...(isScheduledRide ? { scheduledAt: scheduledRideAt } : {}),
    };

    try {
      const response = await createTrip(createTripPayload, session?.accessToken);
      const tripResponse = response?.trip ?? response;
      const dbEstimatedFare = getTripEstimatedFare(tripResponse);
      const fallbackTripDistance =
        backendTripMetrics?.distanceText ?? verifiedTripMap.directions.distanceText;
      const fallbackTripDuration =
        backendTripMetrics?.durationText ?? verifiedTripMap.directions.durationText;
      const bookedTrip = {
        id: tripResponse.id || `trip-${Date.now()}`,
        status: isScheduledRide
          ? "scheduled"
          : (tripResponse.status || "pending").toLowerCase(),
        statusLabel: isScheduledRide
          ? "Ch\u1edd t\u00e0i x\u1ebf"
          : "\u0110ang t\u00ecm t\u00e0i x\u1ebf",
        icon: selectedRideOption.icon || "Xe",
        route: `${verifiedFromLabel} \u2192 ${verifiedToLabel}`,
        pickup: tripResponse.pickupAddress || verifiedFromLabel,
        destination: tripResponse.destinationAddress || verifiedToLabel,
        vehicleName: selectedRideOption.name,
        vehicleType: String(selectedRideOption.vehicleType),
        estimatedFare:
          dbEstimatedFare != null
            ? formatCurrencyVnd(Number(dbEstimatedFare))
            : selectedRidePrice,
        tripDistance: getTripDistanceText(tripResponse, fallbackTripDistance),
        tripDuration: getTripDurationText(tripResponse, fallbackTripDuration),
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
        setAlertMessage("BE \u0111ang l\u1ed7i khi t\u1ea1o chuy\u1ebfn \u0111i. H\u00e3y ki\u1ec3m tra b\u1ea3ng gi\u00e1 active c\u1ee7a lo\u1ea1i xe \u0111ang ch\u1ecdn.");
      } else {
        setAlertMessage(error.message || "Kh\u00f4ng th\u1ec3 t\u1ea1o chuy\u1ebfn \u0111i.");
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
      setAlertMessage("Kh\u00f4ng t\u00ecm th\u1ea5y chuy\u1ebfn \u0111i \u0111\u1ec3 h\u1ee7y.");
      return;
    }

    setIsCancellingRide(true);
    setAlertMessage("");

    try {
      const cancelledTrip = await cancelTrip(
        activeBookedRide.id,
        { cancelReason: 4 },
        session.accessToken
      );

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
      setAlertMessage(error.message || "Kh\u00f4ng th\u1ec3 h\u1ee7y chuy\u1ebfn \u0111i.");
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
      setAlertMessage("Vui l\u00f2ng nh\u1eadp \u0111i\u1ec3m \u0111\u00f3n");
      setFocusedField("from");
      return null;
    }

    if (!toInput.trim()) {
      setAlertMessage("Vui l\u00f2ng nh\u1eadp \u0111i\u1ec3m \u0111\u1ebfn");
      setFocusedField("to");
      return null;
    }

    if (!selectedFromPlace) {
      setAlertMessage("Vui l\u00f2ng ch\u1ecdn \u0111i\u1ec3m \u0111\u00f3n t\u1eeb g\u1ee3i \u00fd Geoapify.");
      setFocusedField("from");
      return null;
    }

    if (!selectedToPlace) {
      setAlertMessage("Vui l\u00f2ng ch\u1ecdn \u0111i\u1ec3m \u0111\u1ebfn t\u1eeb g\u1ee3i \u00fd Geoapify.");
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
      setAlertMessage(error.message || "Kh\u00f4ng th\u1ec3 x\u00e1c minh \u0111\u1ecba ch\u1ec9 tr\u00ean Geoapify.");
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
        setAlertMessage("Vui l\u00f2ng ch\u1ecdn \u0111i\u1ec3m \u0111\u00f3n t\u1eeb g\u1ee3i \u00fd tr\u01b0\u1edbc.");
        setFocusedField("from");
        return;
      }

      setFocusedField("");
    } catch (error) {
      setAlertMessage(error.message || "Kh\u00f4ng th\u1ec3 l\u1ea5y \u0111\u1ecba ch\u1ec9 tr\u00ean Geoapify.");
    }
  };

  const confirmSchedulePicker = () => {
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
    }
  };

  const clearSharedLocation = () => {
    sharedLocationPickedRef.current = "";
    updateSharedForm("location", "");
    setSharedLocationSuggestions([]);
    setSharedLocationError("");
  };

  const selectSharedLocationSuggestion = (suggestion) => {
    const formattedAddress =
      suggestion.formattedAddress || suggestion.description || suggestion.mainText || "";

    sharedLocationPickedRef.current = formattedAddress.trim();
    updateSharedForm("location", formattedAddress);
    setSharedLocationSuggestions([]);
    setSharedLocationError("");
  };

  const closeCreateSharedModal = () => {
    setCreateSharedVisible(false);
    setOpenSharedDropdown("");
    setSharedFormError("");
    sharedLocationPickedRef.current = "";
    setSharedLocationSuggestions([]);
    setSharedLocationLoading(false);
    setSharedLocationError("");
  };

  const createSharedRide = () => {
    if (!requireLogin()) {
      return;
    }

    if (!sharedForm.tripType) {
      setSharedFormError("Vui l\u00f2ng ch\u1ecdn lo\u1ea1i chuy\u1ebfn");
      return;
    }

    if (!sharedForm.location.trim()) {
      setSharedFormError(`Vui l\u00f2ng nh\u1eadp ${sharedLocationLabel.toLowerCase()}`);
      return;
    }

    if (!selectedSharedSlot) {
      setSharedFormError("Vui l\u00f2ng ch\u1ecdn slot \u0111i");
      return;
    }

    if (!selectedSharedDate) {
      setSharedFormError("Vui l\u00f2ng ch\u1ecdn ng\u00e0y \u0111i");
      return;
    }

    const selectedVehicle = sharedVehicleOptions[sharedForm.vehicleIndex];
    const route = isSharedTripToFpt
      ? `${sharedForm.location.trim()} \u2192 \u0110\u1ea1i h\u1ecdc FPT`
      : `\u0110\u1ea1i h\u1ecdc FPT \u2192 ${sharedForm.location.trim()}`;
    const scheduleText = `${selectedSharedSlot.label} (${selectedSharedSlot.time}) \u2022 ${selectedSharedDate.display}`;

    setPendingSharedRequests((current) => [
      {
        id: `shared-created-${Date.now()}`,
        route,
        vehicle: selectedVehicle.vehicle,
        price: selectedVehicle.price,
        distance: "18 km",
        seats: `1/${selectedVehicle.capacity} th\u00e0nh vi\u00ean`,
        note: scheduleText,
        scheduleText,
        date: selectedSharedDate.value,
        slotId: selectedSharedSlot.id,
        status: "Pending",
        statusLabel: "\u0110ang ch\u1edd gh\u00e9p nh\u00f3m",
        driver: "Ch\u01b0a c\u00f3 t\u00e0i x\u1ebf",
        destination: route,
        participantCount: 1,
        capacity: selectedVehicle.capacity,
        perPersonPrice: "15.000\u0111/ng\u01b0\u1eddi",
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);
    setSharedForm(defaultSharedForm);
    closeCreateSharedModal();
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
        setAlertMessage("Vui l\u00f2ng ch\u1ecdn \u0111i\u1ec3m \u0111\u00f3n tr\u01b0\u1edbc.");
        return;
      }

      setFocusedField("");
    } catch (error) {
      setAlertMessage(error.message || "Kh\u00f4ng th\u1ec3 l\u1ea5y \u0111\u1ecba ch\u1ec9 \u0111\u00e3 l\u01b0u t\u1eeb Geoapify.");
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
      setAddressFormError("Vui l\u00f2ng nh\u1eadp t\u00ean \u0111\u1ecba ch\u1ec9");
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
                setBookingStep("rideOptions");
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
                    {"\u2190"}
                  </ThemedText>
          </Pressable>
          <ThemedText type="default" style={styles.headerTitle}>
                    {"\u0110\u1eb7t xe"}
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
              {"Xe l\u1ebb"}
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
              {"Xe gh\u00e9p"}
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
                        {acceptedTrip?.driverName || activeBookedRide?.driverName || "T\u00e0i x\u1ebf"}
                      </ThemedText>
                      <ThemedText type="small" style={styles.driverInfoText}>
                        {"S\u0110T: "}{acceptedTrip?.driverPhone || activeBookedRide?.driverPhone || "Ch\u01b0a c\u00f3"}
                      </ThemedText>
                      <ThemedText type="small" style={styles.driverInfoText}>
                        {"Bi\u1ec3n s\u1ed1: "}{acceptedTrip?.driverLicensePlate || activeBookedRide?.driverLicensePlate || "Ch\u01b0a c\u00f3"}
                      </ThemedText>
                      <ThemedText type="small" style={styles.driverInfoText}>
                        {"Xe: "}{acceptedTrip?.driverVehicleInfo || activeBookedRide?.driverVehicleInfo || acceptedTrip?.vehicleType || "Ch\u01b0a c\u00f3"}
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
                          {"\u25cf"}
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
                  "--")} {"\u2022"}{" "}
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
                  {"\u0110\u00f3n: "}{activeBookedRide?.pickup ?? verifiedFromLabel}
                </ThemedText>
                <ThemedText type="smallBold" style={styles.findingAddress} numberOfLines={2}>
                  {"\u0110\u1ebfn: "}{activeBookedRide?.destination ?? verifiedToLabel}
                </ThemedText>
              </View>
              {isCompletedTrip ? (
                <View style={styles.completedSummaryBox}>
                  <View style={styles.completedSummaryRow}>
                    <ThemedText type="small" style={styles.completedSummaryLabel}>
                      {"T\u1ed5ng ti\u1ec1n"}
                    </ThemedText>
                    <ThemedText type="smallBold" style={styles.completedSummaryValue}>
                      {completedFare}
                    </ThemedText>
                  </View>
                  <View style={styles.completedSummaryRow}>
                    <ThemedText type="small" style={styles.completedSummaryLabel}>
                      {"Th\u1eddi gian ho\u00e0n th\u00e0nh"}
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
                      {"\u0110\u00e1nh gi\u00e1 t\u00e0i x\u1ebf"}
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={styles.completedHomeButton}
                    onPress={() => router.push("/")}
                  >
                    <ThemedText type="smallBold" style={styles.completedHomeText}>
                      {"V\u1ec1 trang ch\u1ee7"}
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
                      ? "\u0110ang h\u1ee7y..."
                      : canCancelTrackedTrip
                        ? "H\u1ee7y chuy\u1ebfn"
                        : "Quay l\u1ea1i"}
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
                    {"Tuy\u1ebfn \u0111\u01b0\u1eddng \u0111\u00e3 x\u00e1c minh"}
                  </ThemedText>
                    <ThemedText type="small" style={styles.routeMapFallbackMeta}>
                      {backendTripMetrics?.durationText ||
                        verifiedTripMap?.directions.durationText ||
                        "\u0110ang t\u00ednh"} {"\u2022"}{" "}
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
                    {"\u2193"}
                  </ThemedText>
                    <ThemedText type="smallBold" style={styles.routeMapFallbackPoint}>
                      {verifiedToLabel}
                    </ThemedText>
                  </View>
                </View>
              )}
              <View style={styles.routeMapTopBar}>
                <Pressable
                  style={styles.routeBackButton}
                  onPress={() => setBookingStep("confirm")}
                >
                  <ThemedText type="default" style={styles.routeBackIcon}>
                    {"\u2190"}
                  </ThemedText>
                </Pressable>
                <View style={styles.routeInfoPill}>
                  <ThemedText type="smallBold" style={styles.routeInfoText}>
                    {backendTripMetrics?.durationText ||
                      verifiedTripMap?.directions.durationText ||
                      "\u0110ang t\u00ednh"} {"\u2022"}{" "}
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
                    {"Ch\u1ecdn lo\u1ea1i xe"}
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
                        ? "\u0110ang t\u00ednh..."
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
                  {isBookingRide ? "\u0110ang \u0111\u1eb7t..." : "\u0110\u1eb7t xe"}
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
                    {"\u25cf"}
                  </ThemedText>
                  </View>
                  <ThemedText type="default" style={styles.mapLabel}>
                    {fromLabel}
                  </ThemedText>
                </>
              )}
              <View style={styles.pickupMapTopBar}>
                <Pressable
                  style={styles.pickupBackButton}
                  onPress={() => setBookingStep("form")}
                >
                  <ThemedText type="default" style={styles.pickupBackIcon}>
                    {"\u2190"}
                  </ThemedText>
                </Pressable>
                <View style={styles.pickupSearchPill}>
                  <ThemedText type="default" style={styles.pickupSearchIcon}>
                    {""}
                  </ThemedText>
                  <ThemedText
                    type="smallBold"
                    style={styles.pickupSearchText}
                    numberOfLines={1}
                  >
                    {"T\u00ecm ki\u1ebfm"}
                  </ThemedText>
                </View>
              </View>
            </View>

            <View style={styles.pickupConfirmSheet}>
              <View style={styles.pickupAddressRow}>
                <View style={styles.pickupAddressIconWrap}>
                  <ThemedText type="default" style={styles.pickupAddressIcon}>
                    {"\ud83d\udccd"}
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
                    {"\u0110i\u1ec3m \u0111\u1ebfn: "}{verifiedToLabel}
                  </ThemedText>
                </View>
              </View>

              <TextInput
                {...vietnameseTextInputProps}
                placeholder={"Th\u00eam ghi ch\u00fa cho b\u00e1c t\u00e0i (v\u00ed d\u1ee5: g\u1ea7n c\u1ed5ng)."}
                placeholderTextColor="#9CA3AF"
                style={styles.pickupNoteInput}
                value={driverNote}
                onChangeText={setDriverNote}
              />

              {Boolean(scheduledRideTime) && (
                <View style={styles.pickupScheduleBadge}>
                  <ThemedText type="smallBold" style={styles.pickupScheduleText}>
                    {"H\u1eb9n l\u1ecbch: "}{scheduledRideTime}
                  </ThemedText>
                </View>
              )}

              <Pressable
                style={styles.pickupConfirmButton}
                onPress={() => setBookingStep("rideOptions")}
              >
                <ThemedText type="smallBold" style={styles.pickupConfirmButtonText}>
                  {"X\u00e1c nh\u1eadn \u0111i\u1ec3m \u0111\u00f3n"}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        ) : mode !== "shared" ? (
          <>
            <View style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.inputLabel}>
                {"\u0110i\u1ec3m \u0111\u00f3n"}
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
                  placeholder={"Nh\u1eadp \u0111i\u1ec3m xu\u1ea5t ph\u00e1t"}
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
                      {"\u00d7"}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            </View>
            {focusedField === "from" && (
              <View style={styles.suggestionCard}>
                <Pressable
                  style={styles.currentLocationSuggestion}
                  onPress={useCurrentLocationAsPickup}
                  disabled={isFetchingCurrentLocation}
                >
                  <View style={styles.suggestionIcon}>
                    <ThemedText type="smallBold" style={styles.suggestionIconText}>
                      {"\u25cf"}
                    </ThemedText>
                  </View>
                  <View style={styles.suggestionContent}>
                    <ThemedText
                      type="smallBold"
                      style={styles.suggestionMainText}
                      numberOfLines={1}
                    >
                      {"S\u1eed d\u1ee5ng v\u1ecb tr\u00ed hi\u1ec7n t\u1ea1i"}
                    </ThemedText>
                    <ThemedText
                      type="small"
                      style={styles.suggestionSecondaryText}
                      numberOfLines={2}
                    >
                      {isFetchingCurrentLocation
                        ? "\u0110ang l\u1ea5y v\u1ecb tr\u00ed..."
                        : "B\u1ea5m \u0111\u1ec3 l\u1ea5y \u0111\u1ecba ch\u1ec9 GPS v\u00e0o \u00f4 \u0111i\u1ec3m \u0111\u00f3n."}
                    </ThemedText>
                  </View>
                </Pressable>

                {(addressSuggestions.from.length > 0 ||
                  loadingSuggestionsFor === "from" ||
                  suggestionError.from) && <View style={styles.suggestionDivider} />}

                {loadingSuggestionsFor === "from" ? (
                  <ThemedText type="small" style={styles.suggestionLoading}>
                    {"\u0110ang t\u1ea3i g\u1ee3i \u00fd..."}
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
                          {"\u2022"}
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

                {(addressSuggestions.from.length > 0 ||
                  loadingSuggestionsFor === "from" ||
                  suggestionError.from) && (
                  <ThemedText type="small" style={styles.suggestionAttribution}>
                    Geoapify
                  </ThemedText>
                )}
              </View>
            )}
            <View style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.inputLabel}>
                {"\u0110i\u1ec3m \u0111\u1ebfn"}
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
                  placeholder={"B\u1ea1n mu\u1ed1n \u0111i \u0111\u00e2u?"}
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
                      {"\u00d7"}
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
                      {"\u0110ang t\u1ea3i g\u1ee3i \u00fd..."}
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
                    {"\u2022"}
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
                    Geoapify
                  </ThemedText>
                </View>
              )}

            <View style={styles.savedList}>
              <View style={styles.savedHeader}>
                <ThemedText type="smallBold">{"\u0110\u1ecba ch\u1ec9 \u0111\u00e3 l\u01b0u"}</ThemedText>
                <Pressable onPress={openCreateAddressModal}>
                  <ThemedText type="smallBold" style={styles.saveAddressButtonText}>
                    {"+ L\u01b0u \u0111\u1ecba ch\u1ec9"}
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
                      {"\u22ef"}
                    </ThemedText>
                  </Pressable>

                  {openAddressMenuId === item.id && (
                    <View style={styles.savedMiniMenu}>
                      <Pressable
                        style={styles.savedMiniAction}
                        onPress={() => openEditAddressModal(item)}
                      >
                        <ThemedText type="smallBold" style={styles.savedEditText}>
                          {"S\u1eeda"}
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={styles.savedMiniAction}
                        onPress={() => deleteAddress(item.id)}
                      >
                        <ThemedText type="smallBold" style={styles.savedDeleteText}>
                          {"X\u00f3a"}
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
                  {isOpeningSchedulePicker ? "\u0110ang m\u1edf..." : "H\u1eb9n l\u1ecbch"}
                </ThemedText>
              </Pressable>

              <Pressable
                style={[styles.primaryButton, isVerifyingMap && styles.buttonDisabled]}
                onPress={showConfirmationStep}
                disabled={isVerifyingMap}
              >
                <ThemedText type="smallBold" style={styles.primaryButtonText}>
                  {"Ti\u1ebfp t\u1ee5c"}
                </ThemedText>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.sharedSection}>
            {pendingSharedRequests.length > 0 ? (
              <View style={styles.pendingSharedSection}>
                <ThemedText type="default" style={styles.pendingSharedTitle}>
                  {"Y\u00eau c\u1ea7u xe gh\u00e9p c\u1ee7a b\u1ea1n"}
                </ThemedText>

                {pendingSharedRequests.map((request) => (
                  <View key={request.id} style={styles.pendingSharedCard}>
                    <View style={styles.pendingSharedHeader}>
                      <ThemedText type="smallBold" style={styles.pendingSharedVehicle}>
                        {request.vehicle}
                      </ThemedText>
                      <View style={styles.pendingBadge}>
                        <ThemedText type="smallBold" style={styles.pendingBadgeText}>
                          {"Pending"}
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
                      {"Nh\u00f3m: "}{request.participantCount}/{request.capacity}
                      {" ng\u01b0\u1eddi \u2022 "}{request.statusLabel}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.sharedHeader}>
              <ThemedText type="default" style={styles.sharedTitle}>
                    {"\u0110\u1ec1 xu\u1ea5t nh\u00f3m gh\u00e9p s\u1eb5n c\u00f3"}
                  </ThemedText>
              <Pressable
                onPress={() => {
                  if (requireLogin()) {
                    setCreateSharedVisible(true);
                  }
                }}
                >
                  <ThemedText type="smallBold" style={styles.createButtonText}>
                      {"+ T\u1ea1o y\u00eau c\u1ea7u"}
                    </ThemedText>
                </Pressable>
            </View>

            {suggestedSharedRides.length === 0 ? (
              <View style={styles.emptySharedCard}>
                <ThemedText type="smallBold" style={styles.emptySharedTitle}>
                    {"Ch\u01b0a c\u00f3 nh\u00f3m gh\u00e9p ph\u00f9 h\u1ee3p"}
                  </ThemedText>
                <ThemedText type="small" style={styles.emptySharedText}>
                    {"Nh\u00f3m ch\u1ec9 c\u00f3 m\u1ed9t ng\u01b0\u1eddi s\u1ebd ch\u01b0a \u0111\u01b0\u1ee3c \u0111\u1ec1 xu\u1ea5t. Khi c\u00f3 th\u00eam ng\u01b0\u1eddi tham gia, h\u1ec7 th\u1ed1ng s\u1ebd hi\u1ec3n th\u1ecb t\u1ea1i \u0111\u00e2y."}
                  </ThemedText>
              </View>
            ) : null}

            {suggestedSharedRides.map((ride) => {
              const proposal = getSharedProposal(ride);

              return (
                <View key={ride.id} style={styles.proposalCard}>
                  <View style={styles.proposalHeader}>
                    <ThemedText type="default" style={styles.proposalHeaderText}>
                    {"\u0110\u1ec0 XU\u1ea4T THAM GIA NH\u00d3M"}
                  </ThemedText>
                  </View>

                  <View style={styles.proposalBody}>
                    <View style={styles.proposalInfoCard}>
                      <ThemedText type="smallBold" style={styles.proposalVehicle}>
                        {ride.vehicle}
                      </ThemedText>
                      <ThemedText type="smallBold" style={styles.savingText}>
                        {"\ud83d\udcb0 Ti\u1ebft ki\u1ec7m "}{proposal.savingPrice}
                      </ThemedText>

                      <View style={styles.priceLine}>
                        <ThemedText type="smallBold" style={styles.priceLabel}>
                          {"\u0110i l\u1ebb:"}
                        </ThemedText>
                        <ThemedText type="smallBold" style={styles.soloPriceText}>
                          {proposal.soloPrice}
                        </ThemedText>
                      </View>
                      <View style={styles.priceLine}>
                        <ThemedText type="smallBold" style={styles.priceLabel}>
                          {"\u0110i gh\u00e9p:"}
                        </ThemedText>
                        <ThemedText type="smallBold" style={styles.sharedPriceText}>
                          {proposal.sharedPrice}
                        </ThemedText>
                      </View>

                      <View style={styles.proposalDashedDivider} />

                      <ThemedText type="smallBold" style={styles.proposalHighlight}>
                        {"Th\u1eddi gian \u0111\u00f3n d\u1ef1 ki\u1ebfn: "}{proposal.expectedPickup}
                      </ThemedText>
                      <ThemedText type="small" style={styles.proposalMuted}>
                        {"D\u1ef1 ki\u1ebfn \u0111\u1ebfn n\u01a1i l\u00fac: "}{proposal.expectedArrival}
                      </ThemedText>
                      <ThemedText type="small" style={styles.proposalMuted}>
                        {"H\u1ea1n gh\u00e9p xe (\u0111\u1ebfm ng\u01b0\u1ee3c th\u1eddi gian): 15p"}
                      </ThemedText>
                      <ThemedText type="small" style={styles.proposalMuted}>
                        {"Nh\u00f3m: "}{ride.participantCount}/{ride.capacity}{" ng\u01b0\u1eddi"}
                      </ThemedText>
                      <ThemedText type="small" style={styles.proposalMuted}>
                        {"Slot 1: 7:30 - "}{proposal.pickupDirection}
                      </ThemedText>
                      <ThemedText type="small" style={styles.proposalMuted}>
                        {"T\u00e0i x\u1ebf: "}{proposal.driverStatus}
                      </ThemedText>

                      <View style={styles.proposalDashedDivider} />

                      <ThemedText type="smallBold" style={styles.proposalSectionTitle}>
                    {"L\u1ed9 tr\u00ecnh nh\u00f3m (\u0111\u00f3n xa \u2192 g\u1ea7n):"}
                  </ThemedText>
                      {proposal.routeSteps.map((step) => (
                        <ThemedText
                          key={`${ride.id}-${step}`}
                          type="small"
                          style={styles.proposalMuted}
                        >
                          {step}
                        </ThemedText>
                      ))}

                      <View style={styles.proposalDashedDivider} />

                      <ThemedText type="smallBold" style={styles.proposalWarningTitle}>
                        {"L\u01b0u \u00fd"}
                      </ThemedText>
                      {proposal.notes.map((note) => (
                        <ThemedText
                          key={`${ride.id}-${note}`}
                          type="small"
                          style={styles.proposalMuted}
                        >
                          {note}
                        </ThemedText>
                      ))}

                      <View style={styles.proposalFooterLine}>
                        <ThemedText type="smallBold" style={styles.proposalVehicle}>
                          {"\ud83d\ude97 "}{ride.vehicle}
                        </ThemedText>
                        <ThemedText type="default" style={styles.proposalTotal}>
                          {proposal.sharedPrice}
                        </ThemedText>
                      </View>
                      <ThemedText type="small" style={styles.proposalMuted}>
                        {"\u0110\u00f3n trong 5 ph\u00fat"}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.proposalActionRow}>
                    <Pressable
                      style={styles.joinProposalButton}
                      onPress={() => {
                        if (requireLogin()) {
                          router.push(`/search/shared-ride/${ride.id}`);
                        }
                      }}
                    >
                      <ThemedText type="smallBold" style={styles.joinProposalText}>
                    {"Tham gia nh\u00f3m"}
                  </ThemedText>
                    </Pressable>
                    <Pressable
                      style={styles.backProposalButton}
                      onPress={() => setMode("now")}
                    >
                      <ThemedText type="smallBold" style={styles.backProposalText}>
                    {"Quay l\u1ea1i"}
                  </ThemedText>
                    </Pressable>
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
                {editingAddressId ? "S\u1eeda \u0111\u1ecba ch\u1ec9" : "L\u01b0u \u0111\u1ecba ch\u1ec9"}
              </ThemedText>
              <Pressable style={styles.addressCloseButton} onPress={closeAddressModal}>
                <ThemedText type="default" style={styles.addressCloseText}>
                    {"x"}
                  </ThemedText>
              </Pressable>
            </View>

            <View style={styles.addressField}>
              <ThemedText type="smallBold" style={styles.addressLabel}>
                    {"T\u00ean \u0111\u1ecba ch\u1ec9"}
                  </ThemedText>
              <TextInput
                {...vietnameseTextInputProps}
                placeholder={"VD: \u0110\u1ea1i h\u1ecdc FPT, B\u1ebfn xe M\u1ef9 \u0110\u00ecnh..."}
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
                <ThemedText type="smallBold">{"H\u1ee7y"}</ThemedText>
              </Pressable>
              <Pressable style={styles.addressPrimaryButton} onPress={saveAddress}>
                <ThemedText type="smallBold" style={styles.addressPrimaryText}>
                    {"L\u01b0u \u0111\u1ecba ch\u1ec9"}
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
                    {"\u2190"}
                  </ThemedText>
            </Pressable>
            <ThemedText type="default" style={styles.scheduleTitle}>
                    {"H\u1eb9n gi\u1edd"}
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
                    {"B\u1ea1n mu\u1ed1n xe \u0111\u00f3n l\u00fac n\u00e0o?"}
                  </ThemedText>
            <ThemedText type="default" style={styles.scheduleHint}>
              {"Ch\u1ecdn th\u1eddi gian trong v\u00f2ng t\u1ed1i \u0111a 7 ng\u00e0y k\u1ec3 t\u1eeb hi\u1ec7n t\u1ea1i."}
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
              {"Xe \u0111\u00f3n b\u1ea1n l\u00fac "}{scheduleDisplayText}
            </ThemedText>
            <ThemedText type="default" style={styles.scheduleArrivalText}>
              {"\u0110\u1ebfn n\u01a1i l\u00fac "}{padSchedule(arrivalDate.getHours())}:{padSchedule(arrivalDate.getMinutes())}
            </ThemedText>
            <ThemedText type="small" style={styles.scheduleHint}>
              {"di chuy\u1ec3n kho\u1ea3ng "}{MOCK_TRIP_DURATION_MINUTES}{" ph\u00fat"}
            </ThemedText>
          </View>

          <Pressable
            style={styles.scheduleConfirmButton}
            onPress={confirmSchedulePicker}
          >
            <ThemedText type="smallBold" style={styles.scheduleConfirmText}>
                    {"X\u00e1c nh\u1eadn"}
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
                    {"T\u1ea1o y\u00eau c\u1ea7u xe gh\u00e9p"}
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
                  {"Lo\u1ea1i chuy\u1ebfn"}
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
                      {openSharedDropdown === "tripType" ? "\u2303" : "\u2304"}
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
                  {"Lo\u1ea1i xe"}
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
                      {openSharedDropdown === "vehicle" ? "\u2303" : "\u2304"}
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
                      accessibilityLabel="X\u00f3a \u0111\u1ecba ch\u1ec9"
                      style={styles.createInputClearButton}
                      onPress={clearSharedLocation}
                    >
                      <ThemedText type="smallBold" style={styles.createInputClearText}>
                        {"\u00d7"}
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
                        {"\u0110ang t\u1ea3i g\u1ee3i \u00fd..."}
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
                              {"\u2022"}
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
                      Geoapify
                    </ThemedText>
                  </View>
                )}
              </View>

              <View style={styles.createScheduleCard}>
                <View style={styles.createScheduleHeader}>
                  <View style={styles.createCalendarBadge}>
                    <ThemedText type="smallBold" style={styles.createCalendarMonth}>
                      {sharedCalendarPreview?.monthLabel ?? "Ng\u00e0y"}
                    </ThemedText>
                    <ThemedText type="title" style={styles.createCalendarDay}>
                      {sharedCalendarPreview?.dayLabel ?? "--"}
                    </ThemedText>
                  </View>
                  <View style={styles.createScheduleIntro}>
                    <ThemedText type="default" style={styles.createScheduleTitle}>
                    {"Ch\u1ecdn l\u1ecbch ng\u00e0y \u0111i"}
                  </ThemedText>
                    <ThemedText type="small" style={styles.createScheduleHint}>
                    {"Ch\u1ecdn slot c\u1ed1 \u0111\u1ecbnh v\u00e0 ng\u00e0y b\u1ea1n mu\u1ed1n \u0111i gh\u00e9p xe."}
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
                      {"H\u00f4m nay kh\u00f4ng c\u00f2n slot n\u00e0o c\u00e1ch th\u1eddi gian hi\u1ec7n t\u1ea1i h\u01a1n 60 ph\u00fat."}
                    </ThemedText>
                  ) : null}
                </View>

                <View style={styles.createScheduleBlock}>
                  <ThemedText type="smallBold" style={styles.createSubLabel}>
                    {"Ng\u00e0y \u0111i"}
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

              {Boolean(sharedFormError) && (
                <ThemedText type="smallBold" style={styles.createError}>
                  {sharedFormError}
                </ThemedText>
              )}

              <Pressable
                style={styles.createSubmitButton}
                onPress={createSharedRide}
              >
                <ThemedText type="smallBold" style={styles.createSubmitText}>
                    {"T\u1ea1o y\u00eau c\u1ea7u"}
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
                    {"Thi\u1ebfu th\u00f4ng tin"}
                  </ThemedText>
            <ThemedText type="default" style={styles.alertMessage}>
              {alertMessage}
            </ThemedText>
            <Pressable
              style={styles.alertButton}
              onPress={() => setAlertMessage("")}
            >
              <ThemedText type="smallBold" style={styles.alertButtonText}>
                    {"\u0110\u00e3 hi\u1ec3u"}
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
  proposalCard: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FFD2AE",
    borderLeftWidth: 4,
    borderLeftColor: BRAND,
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  proposalHeader: {
    minHeight: 54,
    justifyContent: "center",
    paddingHorizontal: Spacing.three,
    backgroundColor: "#FFF3E8",
    borderBottomWidth: 1,
    borderBottomColor: "#FFD2AE",
  },
  proposalHeaderText: {
    color: "#C75B00",
    fontSize: 19,
    fontWeight: "900",
    lineHeight: 24,
  },
  proposalBody: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  proposalInfoCard: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 0,
    paddingVertical: 0,
    gap: 5,
  },
  proposalVehicle: {
    color: "#111827",
  },
  savingText: {
    color: "#16A34A",
  },
  priceLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  priceLabel: {
    color: "#111827",
  },
  soloPriceText: {
    color: "#DC2626",
  },
  sharedPriceText: {
    color: "#111827",
  },
  proposalDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 5,
  },
  proposalDashedDivider: {
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderColor: "#FDBA74",
    marginVertical: 7,
  },
  proposalMuted: {
    color: "#9CA3AF",
  },
  proposalHighlight: {
    color: "#FB7185",
  },
  proposalSectionTitle: {
    color: "#6B7280",
  },
  proposalWarningTitle: {
    color: "#FB7185",
  },
  proposalFooterLine: {
    marginTop: Spacing.one,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  proposalTotal: {
    color: "#9CA3AF",
    fontSize: 18,
    fontWeight: "900",
  },
  proposalActionRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
  },
  joinProposalButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND,
  },
  joinProposalText: {
    color: "#FFFFFF",
    textAlign: "center",
  },
  backProposalButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFD2AE",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF7ED",
  },
  backProposalText: {
    color: "#C75B00",
    textAlign: "center",
  },
});






