import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Image,
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
import { useAuth } from "@/contexts/auth-context";
import { tripSections } from "@/constants/ride-data";
import { useTheme } from "@/hooks/use-theme";
import {
  loadBookedTrips,
  removeBookedTrip,
  toActiveTripSectionItem,
  toScheduledTripSectionItem,
} from "@/features/booking/services/trip-storage";
import {
  cancelTrip,
  getDriverTrips,
  getPassengerTrips,
} from "@/features/booking/services/trip-api";
import {
  createReview,
  getMyReviews,
} from "@/features/trip-history/services/review-api";
import { mapTripToHistoryItem } from "@/features/trip-history/utils/trip-history-mapper";

const BRAND = "#FF7A00";
const BORDER = "#E9E9E9";
const MUTED = "#6B7280";
const HISTORY_PAGE_SIZE = 3;
const PASSENGER_CANCEL_REASON_OTHER = 5;

const tabs = [
  { key: "scheduled", label: "\u0110\u00e3 \u0111\u1eb7t tr\u01b0\u1edbc" },
  { key: "history", label: "L\u1ecbch s\u1eed", minWidth: 88 },
];

const MAX_SCHEDULE_DAYS = 7;
const MIN_PICKUP_BUFFER_MINUTES = 30;
const MINUTE_STEP = 5;
const MOCK_TRIP_DURATION_MINUTES = 13;

function pad(value) {
  return String(value).padStart(2, "0");
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function roundUpToStep(date, step) {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  const remainder = rounded.getMinutes() % step;

  if (remainder !== 0) {
    rounded.setMinutes(rounded.getMinutes() + step - remainder);
  }

  return rounded;
}

function getScheduleBounds() {
  const now = new Date();
  return {
    min: roundUpToStep(addMinutes(now, MIN_PICKUP_BUFFER_MINUTES), MINUTE_STEP),
    max: addDays(now, MAX_SCHEDULE_DAYS),
  };
}

function formatDateValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDateDisplay(date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function parseDateValue(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getDateLabel(date, index) {
  if (index === 0) {
    return "H\u00f4m nay";
  }

  if (index === 1) {
    return "Ng\u00e0y mai";
  }

  return formatDateDisplay(date);
}

function createDateOptions() {
  const { max } = getScheduleBounds();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDay = new Date(max);
  maxDay.setHours(0, 0, 0, 0);
  const options = [];

  for (let index = 0; index <= MAX_SCHEDULE_DAYS; index += 1) {
    const date = addDays(today, index);

    if (date > maxDay) {
      break;
    }

    options.push({
      value: formatDateValue(date),
      label: getDateLabel(date, index),
      display: formatDateDisplay(date),
      monthLabel: `Thg ${date.getMonth() + 1}`,
      dayLabel: pad(date.getDate()),
    });
  }

  return options;
}

function createScheduleDate(dateValue, hour, minute) {
  const date = parseDateValue(dateValue);
  date.setHours(Number(hour), Number(minute), 0, 0);
  return date;
}

function isWithinScheduleRange(date) {
  const { min, max } = getScheduleBounds();
  return date >= min && date <= max;
}

function createHourOptions(dateValue) {
  return Array.from({ length: 24 }, (_, hour) => pad(hour)).filter((hour) =>
    Array.from({ length: 60 / MINUTE_STEP }, (_, index) =>
      pad(index * MINUTE_STEP)
    ).some((minute) => isWithinScheduleRange(createScheduleDate(dateValue, hour, minute)))
  );
}

function createMinuteOptions(dateValue, hour) {
  return Array.from({ length: 60 / MINUTE_STEP }, (_, index) =>
    pad(index * MINUTE_STEP)
  ).filter((minute) => isWithinScheduleRange(createScheduleDate(dateValue, hour, minute)));
}

function normalizeScheduleDraft(draft) {
  const dateOptions = createDateOptions();
  const selectedDate = dateOptions.find((option) => option.value === draft.date);
  const date = selectedDate ?? dateOptions[0];
  const hourOptions = createHourOptions(date.value);
  const hour = hourOptions.includes(draft.hour) ? draft.hour : hourOptions[0];
  const minuteOptions = createMinuteOptions(date.value, hour);
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

function getDefaultScheduleDraft() {
  const { min } = getScheduleBounds();
  const dateValue = formatDateValue(min);
  return normalizeScheduleDraft({
    date: dateValue,
    hour: pad(min.getHours()),
    minute: pad(min.getMinutes()),
  });
}

function getTripDraft(item) {
  const [from = "", to = ""] = item.route.split(/\s*(?:Ã¢â€ â€™|->|\\u279D)\s*/);
  const [schedule = "", price = ""] = item.meta.split(/\s*[Ã‚Â·Ã¢â‚¬Â¢]\s*/);
  const defaultSchedule = getDefaultScheduleDraft();
  const scheduleMatch = schedule.match(/(.+)\s+(\d{1,2}):(\d{2})$/);
  const dateOptions = createDateOptions();
  const matchedDate = scheduleMatch
    ? dateOptions.find(
        (option) =>
          option.label === scheduleMatch[1].trim() ||
          option.display === scheduleMatch[1].trim()
      )
    : null;
  const scheduleDraft = normalizeScheduleDraft({
    date: matchedDate?.value ?? defaultSchedule.date,
    hour: scheduleMatch ? pad(scheduleMatch[2]) : defaultSchedule.hour,
    minute: scheduleMatch ? pad(scheduleMatch[3]) : defaultSchedule.minute,
  });

  return {
    from,
    to,
    ...scheduleDraft,
    price,
  };
}

function getScheduledTripView(item) {
  const [destination = item.route, pickup = "VÃ¡Â»â€¹ trÃƒÂ­ hiÃ¡Â»â€¡n tÃ¡ÂºÂ¡i"] = item.route.split(/\s*(?:\u2192|->|\u279D)\s*/);
  const [time = "", price = ""] = item.meta.split(/\s*[\u00B7\u2022]\s*/);
  const vehicle = item.icon.includes("\uD83D\uDEF5") || item.icon.includes("\uD83D\uDE97")
    ? "Xe mÃƒÂ¡y"
    : "Xe 4 chÃ¡Â»â€”";

  return {
    destination,
    pickup,
    time:
      !isSchedulePlaceholder(item.scheduledPickupText) && item.scheduledPickupText
        ? item.scheduledPickupText
        : !isSchedulePlaceholder(time)
          ? time
          : "",
    price,
    vehicle,
    statusLabel: item.statusLabel || getScheduledStatusLabel(item.status),
  };
}

function isScheduledTrip(trip) {
  const tripType = String(trip?.tripType ?? "").toLowerCase();
  const status = String(trip?.status ?? "").toLowerCase();

  return (
    tripType === "scheduled" ||
    tripType === "2" ||
    status === "scheduled" ||
    Boolean(trip?.scheduledAt)
  );
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

function formatCurrencyVnd(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "--";
  }

  return `${Math.round(numberValue).toLocaleString("vi-VN")}\u0111`;
}

function formatDistanceKm(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "";
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
    return "";
  }

  return `${Math.max(1, Math.round(numberValue))} ph\u00fat`;
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

  const normalizedStatus = statusByNumber[rawStatus] ?? rawStatus.replace(/\s+/g, "");

  if (normalizedStatus === "scheduled") {
    return "pendingdriverassignment";
  }

  return normalizedStatus;
}

function getScheduledStatusLabel(status) {
  switch (normalizeTripStatus(status)) {
    case "pending":
      return "Ã„Âang tÃƒÂ¬m tÃƒÂ i xÃ¡ÂºÂ¿";
    case "pendingdriverassignment":
      return "ChÃ¡Â»Â phÃƒÂ¢n tÃƒÂ i xÃ¡ÂºÂ¿";
    case "accepted":
      return "TÃƒÂ i xÃ¡ÂºÂ¿ Ã„â€˜ÃƒÂ£ nhÃ¡ÂºÂ­n";
    case "driverarrived":
      return "TÃƒÂ i xÃ¡ÂºÂ¿ Ã„â€˜ÃƒÂ£ Ã„â€˜Ã¡ÂºÂ¿n";
    case "inprogress":
      return "Ã„Âang di chuyÃ¡Â»Æ’n";
    case "completed":
      return "HoÃƒÂ n thÃƒÂ nh";
    case "cancelled":
      return "Ã„ÂÃƒÂ£ hÃ¡Â»Â§y";
    case "nodriverfound":
      return "KhÃƒÂ´ng tÃƒÂ¬m thÃ¡ÂºÂ¥y tÃƒÂ i xÃ¡ÂºÂ¿";
    default:
      return "ChÃ¡Â»Â tÃƒÂ i xÃ¡ÂºÂ¿";
  }
}

function formatScheduledPickupText(value) {
  const scheduledDate = value ? new Date(value) : null;

  if (!scheduledDate || Number.isNaN(scheduledDate.getTime())) {
    return "";
  }

  const time = `${pad(scheduledDate.getHours())}:${pad(
    scheduledDate.getMinutes()
  )}`;
  const date = `${pad(scheduledDate.getDate())}/${pad(
    scheduledDate.getMonth() + 1
  )}/${scheduledDate.getFullYear()}`;

  return `GiÃ¡Â»Â Ã„â€˜ÃƒÂ³n: ${time} Ã¢â‚¬Â¢ ${date}`;
}

function isSchedulePlaceholder(value) {
  return String(value ?? "").trim() === "\u0110\u00e3 h\u1eb9n l\u1ecbch";
}

function mapTripToScheduledItem(trip) {
  const scheduledAt = getTripField(trip, "scheduledAt", "ScheduledAt");
  const status = getTripField(trip, "status", "Status");
  const vehicleType = getTripField(trip, "vehicleType", "VehicleType");

  return toScheduledTripSectionItem({
    id: getTripField(trip, "id", "Id"),
    icon:
      String(vehicleType ?? "").toLowerCase().includes("bike") ||
      String(vehicleType ?? "") === "1"
        ? "\ud83d\udef5"
        : "\ud83d\ude97",
    route: `${getTripField(trip, "pickupAddress", "PickupAddress") || "\u0110i\u1ec3m \u0111\u00f3n"} \u2192 ${
      getTripField(trip, "destinationAddress", "DestinationAddress") || "\u0110i\u1ec3m \u0111\u1ebfn"
    }`,
    pickup: getTripField(trip, "pickupAddress", "PickupAddress"),
    destination: getTripField(trip, "destinationAddress", "DestinationAddress"),
    estimatedFare: formatCurrencyVnd(getTripFare(trip)),
    scheduledAt,
    scheduledPickupText: formatScheduledPickupText(scheduledAt),
    status,
    distanceText: formatDistanceKm(getTripField(trip, "estimatedDistanceKm", "EstimatedDistanceKm")),
    durationText: formatDurationMinute(getTripField(trip, "estimatedDurationMinute", "EstimatedDurationMinute")),
  });
}

export default function TripsScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams();
  const router = useRouter();
  const safeAreaInsets = useSafeAreaInsets();
  const { isAuthenticated, session, refreshSession } = useAuth();
  const [selectedTab, setSelectedTab] = useState("scheduled");
  const [tripsBySection, setTripsBySection] = useState({
    ...tripSections,
    history: [],
  });
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [scheduledSortOrder, setScheduledSortOrder] = useState("newest");
  const [historySortOrder, setHistorySortOrder] = useState("newest");
  const [historyPage, setHistoryPage] = useState(1);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [schedulePickerVisible, setSchedulePickerVisible] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [isCancellingTrip, setIsCancellingTrip] = useState(false);
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [ratingDraft, setRatingDraft] = useState(5);
  const [reviewDraft, setReviewDraft] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    {
      id: "driver-hi",
      sender: "driver",
      text: "MÃƒÂ¬nh Ã„â€˜ang Ã„â€˜Ã¡ÂºÂ¿n Ã„â€˜iÃ¡Â»Æ’m Ã„â€˜ÃƒÂ³n, bÃ¡ÂºÂ¡n chÃ¡Â»Â mÃƒÂ¬nh khoÃ¡ÂºÂ£ng 1 phÃƒÂºt nhÃƒÂ©.",
    },
  ]);
  const [editDraft, setEditDraft] = useState({
    from: "",
    to: "",
    ...getDefaultScheduleDraft(),
    price: "",
  });
  const [cancelReason, setCancelReason] = useState("");
  const [formError, setFormError] = useState("");
  const [ratingsByTripId, setRatingsByTripId] = useState({});
  const [reportsByTripId, setReportsByTripId] = useState({});
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function restoreBookedTrips() {
      const bookedTrips = await loadBookedTrips();

      if (!isMounted || !bookedTrips.length) {
        return;
      }

      setTripsBySection((current) => {
        const nextActive = [...(current.active ?? [])];
        const nextScheduled = [...(current.scheduled ?? [])];

        bookedTrips.forEach((trip) => {
          if (
            trip.status === "completed" ||
            trip.status === "history" ||
            trip.status === "cancelled"
          ) {
            return;
          }

          const isScheduled = isScheduledTrip(trip);
          const item = isScheduled
            ? toScheduledTripSectionItem(trip)
            : toActiveTripSectionItem(trip);

          if (isScheduled) {
            if (!nextScheduled.some((existing) => existing.id === item.id)) {
              nextScheduled.unshift(item);
            }
          } else if (!nextActive.some((existing) => existing.id === item.id)) {
            nextActive.unshift(item);
          }
        });

        return {
          ...current,
          active: nextActive,
          scheduled: nextScheduled,
        };
      });
    }

    restoreBookedTrips();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !session?.accessToken) {
      Promise.resolve().then(() => {
        setTripsBySection((current) => ({
          ...current,
          history: [],
        }));
      });
      return;
    }

    let isMounted = true;

    async function loadTripHistoryFromDb() {
      setIsHistoryLoading(true);

      try {
        const role = String(session.role ?? "").toLowerCase();
        const localBookedTrips = await loadBookedTrips();
        const localHistoryById = new Map(
          (localBookedTrips ?? []).map((trip) => [trip.id, trip])
        );
        const [trips, myReviews] = await Promise.all([
          role === "driver"
            ? getDriverTrips(session.accessToken)
            : getPassengerTrips(session.accessToken),
          role === "driver" ? Promise.resolve([]) : getMyReviews(session.accessToken),
        ]);

        if (!isMounted) {
          return;
        }

        const ratingsMap = Array.isArray(myReviews)
          ? myReviews.reduce((accumulator, review) => {
              if (review?.tripId) {
                accumulator[review.tripId] = {
                  rating: review.rating,
                  review: review.comment ?? "",
                  createdAt: review.createdAt,
                };
              }

              return accumulator;
            }, {})
          : {};

        setRatingsByTripId(ratingsMap);

        setTripsBySection((current) => {
          const localScheduledById = new Map(
            (current.scheduled ?? []).map((trip) => [trip.id, trip])
          );
          const scheduled = Array.isArray(trips)
            ? trips.filter(isScheduledTrip).map((trip) => {
                const item = mapTripToScheduledItem(trip);
                const localItem = localScheduledById.get(item.id);

                const localScheduleText = localItem?.meta?.split(/\s*[Ã‚Â·Ã¢â‚¬Â¢]\s*/)?.[0] || "";

                return {
                  ...item,
                  scheduledAt: item.scheduledAt || localItem?.scheduledAt || "",
                  scheduledPickupText:
                    (!isSchedulePlaceholder(item.scheduledPickupText) &&
                      item.scheduledPickupText) ||
                    (!isSchedulePlaceholder(localItem?.scheduledPickupText) &&
                      localItem?.scheduledPickupText) ||
                    (!isSchedulePlaceholder(localScheduleText) &&
                      localScheduleText) ||
                    "",
                };
              })
            : current.scheduled;

          return {
            ...current,
            scheduled,
            history: Array.isArray(trips)
              ? trips.map((trip) =>
                  mapTripToHistoryItem(trip, localHistoryById.get(trip.id))
                )
              : [],
          };
        });
        setHistoryPage(1);
      } catch {
        if (isMounted) {
          setTripsBySection((current) => ({
            ...current,
            history: [],
          }));
        }
      } finally {
        if (isMounted) {
          setIsHistoryLoading(false);
        }
      }
    }

    loadTripHistoryFromDb();

    return () => {
      isMounted = false;
    };
  }, [historyRefreshKey, isAuthenticated, selectedTab, session?.accessToken, session?.role]);

  const rawItems = tripsBySection[selectedTab] ?? [];
  const sortedScheduledItems =
    selectedTab === "scheduled"
      ? [...rawItems].sort((firstTrip, secondTrip) => {
          const firstTime = firstTrip.sortTimestamp ?? 0;
          const secondTime = secondTrip.sortTimestamp ?? 0;

          return scheduledSortOrder === "newest"
            ? secondTime - firstTime
            : firstTime - secondTime;
        })
      : rawItems;
  const sortedHistoryItems =
    selectedTab === "history"
      ? [...rawItems].sort((firstTrip, secondTrip) => {
          const firstTime = firstTrip.sortTimestamp ?? 0;
          const secondTime = secondTrip.sortTimestamp ?? 0;

          return historySortOrder === "newest"
            ? secondTime - firstTime
            : firstTime - secondTime;
        })
      : rawItems;
  const totalHistoryPages = Math.max(
    1,
    Math.ceil(sortedHistoryItems.length / HISTORY_PAGE_SIZE)
  );
  const currentHistoryPage = Math.min(historyPage, totalHistoryPages);
  const items =
    selectedTab === "history"
      ? sortedHistoryItems.slice(
          (currentHistoryPage - 1) * HISTORY_PAGE_SIZE,
          currentHistoryPage * HISTORY_PAGE_SIZE
        )
      : selectedTab === "scheduled"
        ? sortedScheduledItems
      : rawItems;
  const hasActiveRide = params.activeRide === "1";
  const activePickup =
    typeof params.pickup === "string" && params.pickup
      ? params.pickup
      : "CÃ¡Â»â€¢ng FPT";
  const activeDriverOrigin =
    typeof params.driverOrigin === "string" && params.driverOrigin
      ? params.driverOrigin
      : "VÃ¡Â»â€¹ trÃƒÂ­ tÃƒÂ i xÃ¡ÂºÂ¿";
  const activeDestination =
    typeof params.destination === "string" && params.destination
      ? params.destination
      : "VÃ¡Â»â€¹ trÃƒÂ­ cÃ¡Â»Â§a bÃ¡ÂºÂ¡n";
  const activeMapImageUrl =
    typeof params.mapImageUrl === "string" ? params.mapImageUrl : "";
  const activeDuration =
    typeof params.duration === "string" && params.duration ? params.duration : "1 phÃƒÂºt";
  const activeDistance =
    typeof params.distance === "string" && params.distance ? params.distance : "1.2 km";
  const scheduleDateOptions = createDateOptions();
  const selectedDateOption =
    scheduleDateOptions.find((option) => option.value === editDraft.date) ??
    scheduleDateOptions[0];
  const scheduleHourOptions = createHourOptions(selectedDateOption.value);
  const scheduleMinuteOptions = createMinuteOptions(
    selectedDateOption.value,
    editDraft.hour
  );
  const selectedPickupDate = createScheduleDate(
    selectedDateOption.value,
    editDraft.hour,
    editDraft.minute
  );
  const selectedArrivalDate = addMinutes(
    selectedPickupDate,
    MOCK_TRIP_DURATION_MINUTES
  );
  const selectedScheduleText = `${editDraft.time} Ã¢â‚¬Â¢ ${editDraft.dateDisplay} (${editDraft.dateLabel})`;

  function requireLogin() {
    if (isAuthenticated) {
      return true;
    }

    router.push("/profile");
    return false;
  }

  function handlePrimaryAction(item) {
    if (!requireLogin()) {
      return;
    }

    if (selectedTab === "scheduled") {
      setSelectedTrip(item);
      setEditDraft(getTripDraft(item));
      setFormError("");
      setEditModalVisible(true);
      return;
    }

    if (item.actionPrimary !== "Ã„ÂÃƒÂ¡nh giÃƒÂ¡") {
      return;
    }

    setSelectedTrip(item);
    setRatingDraft(item.rating ?? 5);
    setReviewDraft("");
    setRatingModalVisible(true);
  }

  function handleSecondaryAction(item) {
    if (!requireLogin()) {
      return;
    }

    if (selectedTab === "scheduled" || selectedTab === "active") {
      setSelectedTrip(item);
      setCancelReason("");
      setFormError("");
      setCancelModalVisible(true);
      return;
    }

    if (item.actionSecondary !== "BÃƒÂ¡o cÃƒÂ¡o") {
      return;
    }

    setSelectedTrip(item);
    setReportReason("");
    setFormError("");
    setReportModalVisible(true);
  }

  function handleUpdateScheduledTrip() {
    if (!requireLogin()) {
      return;
    }

    if (!editDraft.from.trim() || !editDraft.to.trim()) {
      setFormError("Vui lÃƒÂ²ng nhÃ¡ÂºÂ­p Ã„â€˜Ã¡ÂºÂ§y Ã„â€˜Ã¡Â»Â§ Ã„â€˜iÃ¡Â»Æ’m Ã„â€˜ÃƒÂ³n vÃƒÂ  Ã„â€˜iÃ¡Â»Æ’m Ã„â€˜Ã¡ÂºÂ¿n");
      return;
    }

    if (!editDraft.date.trim() || !editDraft.time.trim()) {
      setFormError("Vui lÃƒÂ²ng chÃ¡Â»Ân ngÃƒÂ y vÃƒÂ  giÃ¡Â»Â hÃ¡ÂºÂ¹n");
      return;
    }

    setTripsBySection((current) => ({
      ...current,
      scheduled: current.scheduled.map((trip) =>
        trip.id === selectedTrip?.id
          ? {
              ...trip,
              route: `${editDraft.from.trim()} Ã¢â€ â€™ ${editDraft.to.trim()}`,
              meta: `${editDraft.dateLabel} ${editDraft.time.trim()} Ã‚Â· ${editDraft.price}`,
            }
          : trip
      ),
    }));
    setEditModalVisible(false);
    setSelectedTrip(null);
    setFormError("");
  }

  async function handleCancelTrip() {
    if (!requireLogin()) {
      return;
    }

    if (!selectedTrip?.id || !session?.accessToken) {
      setFormError("Kh\u00f4ng t\u00ecm th\u1ea5y chuy\u1ebfn c\u1ea7n h\u1ee7y");
      return;
    }

    if (!cancelReason.trim()) {
      setFormError("Vui lÃƒÂ²ng nhÃ¡ÂºÂ­p lÃƒÂ½ do hÃ¡Â»Â§y");
      return;
    }

    setIsCancellingTrip(true);

    try {
      try {
        await cancelTrip(
          selectedTrip.id,
          { cancelReason: PASSENGER_CANCEL_REASON_OTHER },
          session.accessToken
        );
      } catch (error) {
        if (error?.status !== 401) {
          throw error;
        }

        const nextSession = await refreshSession();
        await cancelTrip(
          selectedTrip.id,
          { cancelReason: PASSENGER_CANCEL_REASON_OTHER },
          nextSession.accessToken
        );
      }
      await removeBookedTrip(selectedTrip.id);

      setTripsBySection((current) => ({
        ...current,
        [selectedTab]: current[selectedTab].filter(
          (trip) => trip.id !== selectedTrip.id
        ),
      }));
      setHistoryRefreshKey((current) => current + 1);
      setCancelModalVisible(false);
      setSelectedTrip(null);
      setCancelReason("");
      setFormError("");
    } catch (error) {
      setFormError(
        error.message ||
          "Kh\u00f4ng th\u1ec3 h\u1ee7y chuy\u1ebfn. Vui l\u00f2ng th\u1eed l\u1ea1i."
      );
    } finally {
      setIsCancellingTrip(false);
    }
  }

  async function handleSubmitRating() {
    if (!requireLogin()) {
      return;
    }

    if (!selectedTrip?.id || !session?.accessToken || isSubmittingReview) {
      return;
    }

    setFormError("");
    setIsSubmittingReview(true);

    try {
      await createReview(
        {
          tripId: selectedTrip.id,
          rating: ratingDraft,
          comment: reviewDraft.trim() || null,
        },
        session.accessToken
      );

      setRatingsByTripId((current) => ({
        ...current,
        [selectedTrip.id]: {
          rating: ratingDraft,
          review: reviewDraft.trim(),
          createdAt: new Date().toISOString(),
        },
      }));
      setRatingModalVisible(false);
      setSelectedTrip(null);
      setReviewDraft("");
    } catch (error) {
      setFormError(
        error?.message || "KhÃƒÂ´ng thÃ¡Â»Æ’ gÃ¡Â»Â­i Ã„â€˜ÃƒÂ¡nh giÃƒÂ¡. Vui lÃƒÂ²ng thÃ¡Â»Â­ lÃ¡ÂºÂ¡i."
      );
    } finally {
      setIsSubmittingReview(false);
    }
  }

  function handleSubmitReport() {
    if (!requireLogin()) {
      return;
    }

    if (!selectedTrip) {
      return;
    }

    if (!reportReason.trim()) {
      setFormError("Vui lÃƒÂ²ng nhÃ¡ÂºÂ­p nÃ¡Â»â„¢i dung bÃƒÂ¡o cÃƒÂ¡o");
      return;
    }

    setReportsByTripId((current) => ({
      ...current,
      [selectedTrip.id]: {
        reason: reportReason.trim(),
        submittedAt: new Date().toISOString(),
      },
    }));
    setReportModalVisible(false);
    setSelectedTrip(null);
    setReportReason("");
    setFormError("");
  }

  function handleSendChatMessage() {
    if (!requireLogin()) {
      return;
    }

    const message = chatInput.trim();

    if (!message) {
      return;
    }

    setChatInput("");
    setChatMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        sender: "user",
        text: message,
      },
    ]);

    setTimeout(() => {
      setChatMessages((current) => [
        ...current,
        {
          id: `driver-${Date.now()}`,
          sender: "driver",
          text: "TÃƒÂ i xÃ¡ÂºÂ¿ Ã„â€˜ÃƒÂ£ nhÃ¡ÂºÂ­n tin nhÃ¡ÂºÂ¯n, mÃƒÂ¬nh sÃ¡ÂºÂ½ phÃ¡ÂºÂ£n hÃ¡Â»â€œi ngay.",
        },
      ]);
    }, 700);
  }

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: ScreenHeaderTop,
            paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <ThemedText type="default" style={styles.screenTitle}>
            {"Hành trình"}
          </ThemedText>

          <View style={styles.tabRow}>
            {tabs.map((tab) => {
              const isActive = tab.key === selectedTab;

              return (
                <Pressable
                key={tab.key}
                style={[
                  styles.tabButton,
                  tab.minWidth && { minWidth: tab.minWidth },
                  isActive && styles.tabButtonActive,
                ]}
                onPress={() => {
                  setSelectedTab(tab.key);

                  if (tab.key === "history") {
                    setHistoryRefreshKey((current) => current + 1);
                  }
                }}
              >
                <ThemedText
                  type="smallBold"
                  style={[styles.tabText, isActive && styles.tabTextActive]}
                  numberOfLines={1}
                >
                  {tab.label}
                </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {selectedTab === "history" ? (
            <View style={styles.historyFilterRow}>
              {[
                { key: "newest", label: "M\u1edbi nh\u1ea5t" },
                { key: "oldest", label: "C\u0169 nh\u1ea5t" },
              ].map((option) => {
                const isActive = historySortOrder === option.key;

                return (
                  <Pressable
                    key={option.key}
                    style={[
                      styles.historyFilterButton,
                      isActive && styles.historyFilterButtonActive,
                    ]}
                    onPress={() => {
                      setHistorySortOrder(option.key);
                      setHistoryPage(1);
                    }}
                  >
                    <ThemedText
                      type="smallBold"
                      style={[
                        styles.historyFilterText,
                        isActive && styles.historyFilterTextActive,
                      ]}
                    >
                      {option.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {selectedTab === "scheduled" ? (
            <View style={styles.historyFilterRow}>
              {[
                { key: "newest", label: "M\u1edbi nh\u1ea5t" },
                { key: "oldest", label: "C\u0169 nh\u1ea5t" },
              ].map((option) => {
                const isActive = scheduledSortOrder === option.key;

                return (
                  <Pressable
                    key={option.key}
                    style={[
                      styles.historyFilterButton,
                      isActive && styles.historyFilterButtonActive,
                    ]}
                    onPress={() => setScheduledSortOrder(option.key)}
                  >
                    <ThemedText
                      type="smallBold"
                      style={[
                        styles.historyFilterText,
                        isActive && styles.historyFilterTextActive,
                      ]}
                    >
                      {option.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {selectedTab === "active" ? (
            <View style={styles.activeJourney}>
              {hasActiveRide ? (
                <>
                  <ThemedText type="default" style={styles.activeJourneyTitle}>
                    HÃƒÂ nh trÃƒÂ¬nh cÃ¡Â»Â§a bÃ¡ÂºÂ¡n
                  </ThemedText>

                  <View style={styles.activeMapCard}>
                    {activeMapImageUrl ? (
                      <Image
                        source={{ uri: activeMapImageUrl }}
                        style={styles.activeMapImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.activeMapFallback}>
                        <ThemedText type="default" style={styles.activeMapFallbackIcon}>
                          Ã°Å¸â€”ÂºÃ¯Â¸Â
                        </ThemedText>
                        <ThemedText type="smallBold" style={styles.activeMapFallbackText}>
                          BÃ¡ÂºÂ£n Ã„â€˜Ã¡Â»â€œ hÃƒÂ nh trÃƒÂ¬nh
                        </ThemedText>
                      </View>
                    )}
                    <View style={styles.activeMapBadge}>
                      <ThemedText type="smallBold" style={styles.activeMapBadgeText}>
                        Google Maps Ã¢â‚¬Â¢ Driver Ã¢â€ â€™ KhÃƒÂ¡ch
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.activeEtaCard}>
                    <ThemedText type="small" style={styles.activeEtaStatus}>
                      Ã°Å¸â€ºÂµ TÃƒÂ i xÃ¡ÂºÂ¿ Ã„â€˜ang Ã„â€˜Ã¡ÂºÂ¿n...
                    </ThemedText>
                    <ThemedText type="default" style={styles.activeEtaNumber}>
                      {activeDuration}
                    </ThemedText>
                    <ThemedText type="small" style={styles.activeEtaDistance}>
                      KhoÃ¡ÂºÂ£ng cÃƒÂ¡ch {activeDistance}
                    </ThemedText>
                  </View>

                  <View
                    style={[
                      styles.activeRouteCard,
                      { backgroundColor: theme.backgroundElement },
                    ]}
                  >
                    <ThemedText type="small" style={styles.activeRouteLabel}>
                      Ã„ÂiÃ¡Â»Æ’m tÃƒÂ i xÃ¡ÂºÂ¿ xuÃ¡ÂºÂ¥t phÃƒÂ¡t
                    </ThemedText>
                    <ThemedText type="default" style={styles.activeRouteValue}>
                      {activeDriverOrigin}
                    </ThemedText>
                    <ThemedText type="small" style={styles.activeRouteLabel}>
                      Ã„ÂiÃ¡Â»Æ’m Ã„â€˜ÃƒÂ³n khÃƒÂ¡ch
                    </ThemedText>
                    <ThemedText type="default" style={styles.activeRouteValue}>
                      {activePickup}
                    </ThemedText>
                    <ThemedText type="small" style={styles.activeRouteLabel}>
                      Ã„ÂiÃ¡Â»Æ’m Ã„â€˜Ã¡ÂºÂ¿n chuyÃ¡ÂºÂ¿n xe
                    </ThemedText>
                    <ThemedText type="default" style={styles.activeRouteValue}>
                      {activeDestination}
                    </ThemedText>
                  </View>

                  <View
                    style={[
                      styles.activeDriverCard,
                      { backgroundColor: theme.backgroundElement },
                    ]}
                  >
                    <View style={styles.activeDriverAvatar}>
                      <ThemedText type="default">Ã°Å¸â€˜Â¨</ThemedText>
                    </View>
                    <View style={styles.activeDriverInfo}>
                      <ThemedText type="default" style={styles.activeDriverName}>
                        NguyÃ¡Â»â€¦n VÃ„Æ’n TÃƒÂ i
                      </ThemedText>
                      <ThemedText type="small" style={styles.activeDriverPhone}>
                        0901 234 567
                      </ThemedText>
                      <ThemedText type="small" style={styles.activeDriverMeta}>
                        59-X1 234.56 Ã‚Â· Ã¢Ëœâ€¦ 4.8
                      </ThemedText>
                    </View>
                    <Pressable
                      style={styles.activeMessageButton}
                      onPress={() => {
                        if (requireLogin()) {
                          setChatModalVisible(true);
                        }
                      }}
                    >
                      <ThemedText type="default" style={styles.activeMessageIcon}>
                        Ã°Å¸â€™Â¬
                      </ThemedText>
                    </Pressable>
                  </View>

                  <View style={styles.activePaymentCard}>
                    <ThemedText type="small" style={styles.activePaymentText}>
                      Ã°Å¸â€™Âµ TrÃ¡ÂºÂ£ tiÃ¡Â»Ân mÃ¡ÂºÂ·t: 25.000Ã„â€˜
                    </ThemedText>
                  </View>
                </>
              ) : (
                <View
                  style={[
                    styles.emptyActiveCard,
                    { backgroundColor: theme.backgroundElement },
                  ]}
                >
                  <ThemedText type="default" style={styles.emptyActiveTitle}>
                    ChÃ†Â°a cÃƒÂ³ chuyÃ¡ÂºÂ¿n xe Ã„â€˜Ã†Â°Ã¡Â»Â£c Ã„â€˜Ã¡ÂºÂ·t hiÃ¡Â»â€¡n tÃ¡ÂºÂ¡i
                  </ThemedText>
                  <ThemedText type="small" style={styles.emptyActiveText}>
                    Khi bÃ¡ÂºÂ¡n Ã„â€˜Ã¡ÂºÂ·t xe thÃƒÂ nh cÃƒÂ´ng, thÃƒÂ´ng tin chuyÃ¡ÂºÂ¿n Ã„â€˜ang Ã„â€˜i sÃ¡ÂºÂ½ hiÃ¡Â»Æ’n thÃ¡Â»â€¹ Ã¡Â»Å¸ Ã„â€˜ÃƒÂ¢y.
                  </ThemedText>
                </View>
              )}
            </View>
          ) : selectedTab === "scheduled" && items.length === 0 ? (
            <View
              style={[
                styles.emptyActiveCard,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              <ThemedText type="default" style={styles.emptyActiveTitle}>
                {"Chưa có chuyến đặt trước"}
              </ThemedText>
              <ThemedText type="small" style={styles.emptyActiveText}>
                {"Các chuyến hẹn lịch của bạn sẽ hiển thị tại đây."}
              </ThemedText>
            </View>
          ) : selectedTab === "scheduled" ? (
            <View style={styles.scheduledCards}>
              {items.map((item) => {
                const trip = getScheduledTripView(item);
                const canEditScheduledTrip = ![
                  "inprogress",
                  "completed",
                  "cancelled",
                ].includes(normalizeTripStatus(item.status));

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.scheduledJourneyCard,
                      { backgroundColor: theme.backgroundElement },
                    ]}
                  >
                    <View style={styles.scheduledJourneyTop}>
                      <View style={styles.scheduledJourneyInfo}>
                        <ThemedText
                          type="default"
                          style={styles.scheduledDestination}
                        >
                          {trip.destination}
                        </ThemedText>
                        <ThemedText type="small" style={styles.scheduledTime}>
                          {trip.time}
                        </ThemedText>
                      </View>
                      <View style={styles.hiddenScheduleMeta}>
                        <ThemedText
                          type="smallBold"
                          style={styles.scheduledStatusText}
                        >
                          ChÃ¡Â»Â tÃƒÂ i xÃ¡ÂºÂ¿
                        </ThemedText>
                      </View>
                      <View style={styles.scheduledStatusBadge}>
                        <ThemedText
                          type="smallBold"
                          style={styles.scheduledStatusText}
                        >
                          {trip.statusLabel}
                        </ThemedText>
                      </View>
                    </View>

                    <View style={styles.scheduledMetaGroup}>
                      <ThemedText type="default" style={styles.scheduledMetaLine}>
                        Ã°Å¸â€œÂ Ã„ÂiÃ¡Â»Æ’m Ã„â€˜ÃƒÂ³n:{" "}
                        <ThemedText
                          type="default"
                          style={styles.scheduledMetaStrong}
                        >
                          {trip.pickup}
                        </ThemedText>
                      </ThemedText>
                      <ThemedText type="default" style={styles.scheduledMetaLine}>
                        {item.icon} {trip.vehicle}
                      </ThemedText>
                      {Boolean(item.distanceText || item.durationText) && (
                        <ThemedText type="default" style={styles.scheduledMetaLine}>
                          {"Qu\u00e3ng \u0111\u01b0\u1eddng: "}
                          <ThemedText
                            type="default"
                            style={styles.scheduledMetaStrong}
                          >
                            {[item.distanceText, item.durationText]
                              .filter(Boolean)
                              .join(" \u2022 ")}
                          </ThemedText>
                        </ThemedText>
                      )}
                    </View>

                    <View style={styles.scheduledJourneyBottom}>
                      <ThemedText type="default" style={styles.scheduledPrice}>
                        {trip.price}
                      </ThemedText>
                      <View style={styles.scheduledActionColumn}>
                        <Pressable
                          style={[
                            styles.scheduledEditButton,
                            !canEditScheduledTrip && styles.hiddenScheduleMeta,
                          ]}
                          onPress={() => handlePrimaryAction(item)}
                        >
                          <ThemedText
                            type="smallBold"
                            style={styles.scheduledEditText}
                          >
                            ChÃ¡Â»â€°nh sÃ¡Â»Â­a
                          </ThemedText>
                        </Pressable>
                        <Pressable
                          style={styles.scheduledCancelButton}
                          onPress={() => handleSecondaryAction(item)}
                        >
                          <ThemedText
                            type="smallBold"
                            style={styles.scheduledCancelText}
                          >
                            HÃ¡Â»Â§y
                          </ThemedText>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : selectedTab === "history" && isHistoryLoading ? (
            <View
              style={[
                styles.emptyActiveCard,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              <ThemedText type="default" style={styles.emptyActiveTitle}>
                {"Đang tải lịch sử chuyến đi"}
              </ThemedText>
              <ThemedText type="small" style={styles.emptyActiveText}>
                {"Hệ thống đang lấy dữ liệu chuyến đi từ DB."}
              </ThemedText>
            </View>
          ) : selectedTab === "history" && items.length === 0 ? (
            <View
              style={[
                styles.emptyActiveCard,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              <ThemedText type="default" style={styles.emptyActiveTitle}>
                {"Chưa có lịch sử chuyến đi"}
              </ThemedText>
              <ThemedText type="small" style={styles.emptyActiveText}>
                {"Các chuyến đã hoàn thành hoặc đã hủy sẽ hiển thị tại đây."}
              </ThemedText>
            </View>
          ) : (
            <>
              <ThemedView
                style={[styles.listCard, { backgroundColor: theme.backgroundElement }]}
              >
              {items.map((item, index) => {
              const savedRating = ratingsByTripId[item.id]?.rating;
              const displayRating = savedRating ?? item.rating;
              const hasRated = typeof savedRating === "number";
              const hasReported = Boolean(reportsByTripId[item.id]);

              return (
                <View
                  key={item.id}
                  style={[
                    styles.tripRow,
                    index < items.length - 1 && styles.tripRowBorder,
                  ]}
                >
                  <View style={styles.tripLeft}>
                    <View style={styles.iconWrap}>
                      <ThemedText type="default">{item.icon}</ThemedText>
                    </View>

                    <View style={styles.tripInfo}>
                      <ThemedText type="default" style={styles.routeText}>
                        {item.route}
                      </ThemedText>
                      <ThemedText type="small" style={styles.metaText}>
                        {item.meta}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.tripRight}>
                    <Pressable
                      style={[
                        styles.outlineAction,
                        hasRated && selectedTab === "history" && styles.outlineActionDisabled,
                      ]}
                      hitSlop={8}
                      onPress={() => {
                        if (!(hasRated && selectedTab === "history")) {
                          handlePrimaryAction(item);
                        }
                      }}
                    >
                      <ThemedText
                        type="small"
                        style={[
                          styles.outlineActionText,
                          hasRated &&
                            selectedTab === "history" &&
                            styles.outlineActionTextDisabled,
                        ]}
                      >
                        {selectedTab === "scheduled"
                          ? "S\u1EEDa"
                          : hasRated
                            ? "\u0110\u00E3 \u0111\u00E1nh gi\u00E1"
                            : item.actionPrimary}
                      </ThemedText>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.outlineAction,
                        hasReported && styles.outlineActionDisabled,
                      ]}
                      hitSlop={8}
                      onPress={() => {
                        if (!hasReported) {
                          handleSecondaryAction(item);
                        }
                      }}
                    >
                      <ThemedText
                        type="small"
                        style={[
                          styles.outlineActionText,
                          hasReported && styles.outlineActionTextDisabled,
                        ]}
                      >
                        {selectedTab === "scheduled"
                          ? "H\u1EE7y"
                          : hasReported
                            ? "\u0110\u00E3 b\u00E1o c\u00E1o"
                            : item.actionSecondary}
                      </ThemedText>
                    </Pressable>

                    {typeof displayRating === "number" && (
                      <ThemedText type="smallBold" style={styles.ratingText}>
                        {"\u2605"} {displayRating}
                      </ThemedText>
                    )}
                  </View>
                </View>
              );
              })}
              </ThemedView>
              {selectedTab === "history" && sortedHistoryItems.length > HISTORY_PAGE_SIZE ? (
                <View style={styles.historyPaginationRow}>
                  <Pressable
                    style={[
                      styles.historyPageButton,
                      currentHistoryPage === 1 && styles.historyPageButtonDisabled,
                    ]}
                    disabled={currentHistoryPage === 1}
                    onPress={() => setHistoryPage((current) => Math.max(1, current - 1))}
                  >
                    <ThemedText
                      type="smallBold"
                      style={[
                        styles.historyPageButtonText,
                        currentHistoryPage === 1 && styles.historyPageButtonTextDisabled,
                      ]}
                    >
                      {"Tr\u01b0\u1edbc"}
                    </ThemedText>
                  </Pressable>

                  <ThemedText type="smallBold" style={styles.historyPageInfo}>
                    {`Trang ${currentHistoryPage}/${totalHistoryPages}`}
                  </ThemedText>

                  <Pressable
                    style={[
                      styles.historyPageButton,
                      currentHistoryPage === totalHistoryPages &&
                        styles.historyPageButtonDisabled,
                    ]}
                    disabled={currentHistoryPage === totalHistoryPages}
                    onPress={() =>
                      setHistoryPage((current) =>
                        Math.min(totalHistoryPages, current + 1)
                      )
                    }
                  >
                    <ThemedText
                      type="smallBold"
                      style={[
                        styles.historyPageButtonText,
                        currentHistoryPage === totalHistoryPages &&
                          styles.historyPageButtonTextDisabled,
                      ]}
                    >
                      {"Sau"}
                    </ThemedText>
                  </Pressable>
                </View>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={chatModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setChatModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.chatCard,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            <View style={styles.chatHeader}>
              <View style={styles.activeDriverAvatar}>
                <ThemedText type="default">{"\uD83D\uDC68"}</ThemedText>
              </View>
              <View style={styles.chatHeaderInfo}>
                <ThemedText type="default" style={styles.chatTitle}>
                  {"Nguy\u1EC5n V\u0103n T\u00E0i"}
                </ThemedText>
                <ThemedText type="small" style={styles.chatSubtitle}>
                  {"\u0110ang ho\u1EA1t \u0111\u1ED9ng \u00B7 0901 234 567"}
                </ThemedText>
              </View>
              <Pressable
                style={styles.chatCloseButton}
                onPress={() => setChatModalVisible(false)}
              >
                <ThemedText type="default" style={styles.chatCloseText}>
                  x
                </ThemedText>
              </Pressable>
            </View>

            <ScrollView
              style={styles.chatMessages}
              contentContainerStyle={styles.chatMessagesContent}
            >
              {chatMessages.map((message) => {
                const isUser = message.sender === "user";

                return (
                  <View
                    key={message.id}
                    style={[
                      styles.chatBubble,
                      isUser ? styles.chatBubbleUser : styles.chatBubbleDriver,
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={[
                        styles.chatBubbleText,
                        isUser && styles.chatBubbleTextUser,
                      ]}
                    >
                      {message.text}
                    </ThemedText>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.chatInputRow}>
              <TextInput
                placeholder={"Nh\u1EAFn tin v\u1EDBi t\u00E0i x\u1EBF..."}
                placeholderTextColor={MUTED}
                style={[
                  styles.chatInput,
                  {
                    color: theme.text,
                    backgroundColor: theme.background,
                  },
                ]}
                value={chatInput}
                onChangeText={setChatInput}
                onSubmitEditing={handleSendChatMessage}
              />
              <Pressable
                style={styles.chatSendButton}
                onPress={handleSendChatMessage}
              >
                <ThemedText type="smallBold" style={styles.chatSendText}>
                  {"G\u1EEDi"}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={ratingModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRatingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            <ThemedText type="default" style={styles.modalTitle}>
              {"\u0110\u00E1nh gi\u00E1 chuy\u1EBFn \u0111i"}
            </ThemedText>
            <ThemedText type="small" style={styles.metaText}>
              {selectedTrip?.route}
            </ThemedText>

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  style={styles.starButton}
                  onPress={() => setRatingDraft(star)}
                >
                  <ThemedText
                    type="default"
                    style={[
                      styles.starText,
                      star <= ratingDraft && styles.starTextActive,
                    ]}
                  >
                    {"\u2605"}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <TextInput
              multiline
              placeholder={"Nh\u1EADn x\u00E9t chuy\u1EBFn \u0111i"}
              placeholderTextColor={MUTED}
              style={[
                styles.reviewInput,
                {
                  color: theme.text,
                  backgroundColor: theme.background,
                },
              ]}
              value={reviewDraft}
              onChangeText={setReviewDraft}
            />

            <View style={styles.modalButtonRow}>
              <Pressable
                style={[
                  styles.modalSecondaryButton,
                  { backgroundColor: theme.background },
                ]}
                onPress={() => setRatingModalVisible(false)}
              >
                <ThemedText type="smallBold">{"H\u1EE7y"}</ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.modalPrimaryButton,
                  isSubmittingReview && styles.modalButtonDisabled,
                ]}
                disabled={isSubmittingReview}
                onPress={handleSubmitRating}
              >
                <ThemedText
                  type="smallBold"
                  style={styles.modalPrimaryButtonText}
                >
                  {isSubmittingReview ? "\u0110ang g\u1EEDi..." : "G\u1EEDi \u0111\u00E1nh gi\u00E1"}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={reportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            <View style={styles.reportIcon}>
              <ThemedText type="default" style={styles.reportIconText}>
                !
              </ThemedText>
            </View>
            <ThemedText type="default" style={styles.modalTitle}>
              BÃƒÂ¡o cÃƒÂ¡o chuyÃ¡ÂºÂ¿n Ã„â€˜i
            </ThemedText>
            <ThemedText type="small" style={styles.metaText}>
              {selectedTrip?.route}
            </ThemedText>

            <TextInput
              multiline
              placeholder="NhÃ¡ÂºÂ­p lÃƒÂ½ do bÃƒÂ¡o cÃƒÂ¡o, vÃƒÂ­ dÃ¡Â»Â¥: tÃƒÂ i xÃ¡ÂºÂ¿ Ã„â€˜Ã¡ÂºÂ¿n muÃ¡Â»â„¢n, thÃƒÂ¡i Ã„â€˜Ã¡Â»â„¢ khÃƒÂ´ng phÃƒÂ¹ hÃ¡Â»Â£p..."
              placeholderTextColor={MUTED}
              style={[
                styles.reviewInput,
                {
                  color: theme.text,
                  backgroundColor: theme.background,
                },
              ]}
              value={reportReason}
              onChangeText={(value) => {
                setReportReason(value);
                setFormError("");
              }}
            />

            {Boolean(formError) && (
              <ThemedText type="smallBold" style={styles.formError}>
                {formError}
              </ThemedText>
            )}

            <View style={styles.modalButtonRow}>
              <Pressable
                style={[styles.modalSecondaryButton, { backgroundColor: theme.background }]}
                onPress={() => {
                  setReportModalVisible(false);
                  setFormError("");
                }}
              >
                <ThemedText type="smallBold">Ã„ÂÃƒÂ³ng</ThemedText>
              </Pressable>
              <Pressable style={styles.modalDangerButton} onPress={handleSubmitReport}>
                <ThemedText type="smallBold" style={styles.modalPrimaryButtonText}>
                  GÃ¡Â»Â­i bÃƒÂ¡o cÃƒÂ¡o
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            <ThemedText type="default" style={styles.modalTitle}>
              SÃ¡Â»Â­a lÃ¡Â»â€¹ch Ã„â€˜Ã¡ÂºÂ·t xe
            </ThemedText>
            <ThemedText type="small" style={styles.metaText}>
              CÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t thÃƒÂ´ng tin chuyÃ¡ÂºÂ¿n Ã„â€˜ÃƒÂ£ hÃ¡ÂºÂ¹n trÃ†Â°Ã¡Â»â€ºc
            </ThemedText>

            <TextInput
              placeholder="Ã„ÂiÃ¡Â»Æ’m Ã„â€˜ÃƒÂ³n"
              placeholderTextColor={MUTED}
              style={[
                styles.formInput,
                { color: theme.text, backgroundColor: theme.background },
              ]}
              value={editDraft.from}
              onChangeText={(value) => {
                setEditDraft((current) => ({ ...current, from: value }));
                setFormError("");
              }}
            />
            <TextInput
              placeholder="Ã„ÂiÃ¡Â»Æ’m Ã„â€˜Ã¡ÂºÂ¿n"
              placeholderTextColor={MUTED}
              style={[
                styles.formInput,
                { color: theme.text, backgroundColor: theme.background },
              ]}
              value={editDraft.to}
              onChangeText={(value) => {
                setEditDraft((current) => ({ ...current, to: value }));
                setFormError("");
              }}
            />
            <Pressable
              style={styles.scheduleSummaryButton}
              onPress={() => setSchedulePickerVisible(true)}
            >
              <View style={styles.scheduleIconCard}>
                <ThemedText type="smallBold" style={styles.scheduleIconMonth}>
                  {selectedDateOption.monthLabel}
                </ThemedText>
                <ThemedText type="default" style={styles.scheduleIconDay}>
                  {selectedDateOption.dayLabel}
                </ThemedText>
              </View>
              <View style={styles.scheduleSummaryInfo}>
                <ThemedText type="smallBold" style={styles.scheduleSummaryTitle}>
                  Xe Ã„â€˜ÃƒÂ³n lÃƒÂºc {editDraft.time}
                </ThemedText>
                <ThemedText type="small" style={styles.scheduleSummaryMeta}>
                  {editDraft.dateDisplay} ({editDraft.dateLabel})
                </ThemedText>
              </View>
              <ThemedText type="smallBold" style={styles.scheduleChangeText}>
                ChÃ¡Â»Ân
              </ThemedText>
            </Pressable>

            <View style={styles.lockedPriceBox}>
              <ThemedText type="small" style={styles.lockedPriceLabel}>
                GiÃƒÂ¡ chuyÃ¡ÂºÂ¿n Ã„â€˜i
              </ThemedText>
              <ThemedText type="smallBold" style={styles.lockedPriceText}>
                {editDraft.price}
              </ThemedText>
            </View>

            {Boolean(formError) && (
              <ThemedText type="smallBold" style={styles.formError}>
                {formError}
              </ThemedText>
            )}

            <View style={styles.modalButtonRow}>
              <Pressable
                style={[styles.modalSecondaryButton, { backgroundColor: theme.background }]}
                onPress={() => setEditModalVisible(false)}
              >
                <ThemedText type="smallBold">Ã„ÂÃƒÂ³ng</ThemedText>
              </Pressable>
              <Pressable
                style={styles.modalPrimaryButton}
                onPress={handleUpdateScheduledTrip}
              >
                <ThemedText type="smallBold" style={styles.modalPrimaryButtonText}>
                  LÃ†Â°u thay Ã„â€˜Ã¡Â»â€¢i
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
              paddingTop: safeAreaInsets.top + Spacing.three,
              paddingBottom: safeAreaInsets.bottom + Spacing.three,
            },
          ]}
        >
          <View style={styles.scheduleHeader}>
            <Pressable
              style={styles.scheduleBackButton}
              onPress={() => setSchedulePickerVisible(false)}
            >
              <ThemedText type="default" style={styles.scheduleBackIcon}>
                Ã¢â€ Â
              </ThemedText>
            </Pressable>
            <ThemedText type="default" style={styles.scheduleTitle}>
              HÃ¡ÂºÂ¹n giÃ¡Â»Â
            </ThemedText>
            <View style={styles.scheduleBackButton} />
          </View>

          <View style={styles.scheduleCalendarCard}>
            <ThemedText type="default" style={styles.scheduleCalendarMonth}>
              {selectedDateOption.monthLabel}
            </ThemedText>
            <ThemedText type="default" style={styles.scheduleCalendarDay}>
              {selectedDateOption.dayLabel}
            </ThemedText>
          </View>

          <View style={styles.scheduleIntro}>
            <ThemedText type="default" style={styles.scheduleQuestion}>
              BÃ¡ÂºÂ¡n muÃ¡Â»â€˜n xe Ã„â€˜ÃƒÂ³n lÃƒÂºc nÃƒÂ o?
            </ThemedText>
            <ThemedText type="default" style={styles.scheduleHint}>
              ChÃ¡Â»Ân thÃ¡Â»Âi gian trong vÃƒÂ²ng tÃ¡Â»â€˜i Ã„â€˜a 7 ngÃƒÂ y kÃ¡Â»Æ’ tÃ¡Â»Â« hiÃ¡Â»â€¡n tÃ¡ÂºÂ¡i.
            </ThemedText>
          </View>

          <View style={styles.schedulePickerPanel}>
            <ScrollView
              style={styles.scheduleDateColumn}
              showsVerticalScrollIndicator={false}
            >
              {scheduleDateOptions.map((option) => {
                const isSelected = option.value === selectedDateOption.value;

                return (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.schedulePickerRow,
                      isSelected && styles.schedulePickerRowActive,
                    ]}
                    onPress={() => {
                      setEditDraft((current) =>
                        normalizeScheduleDraft({
                          ...current,
                          date: option.value,
                          dateLabel: option.label,
                          dateDisplay: option.display,
                        })
                      );
                      setFormError("");
                    }}
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
                const isSelected = hour === editDraft.hour;

                return (
                  <Pressable
                    key={hour}
                    style={[
                      styles.scheduleTimeCell,
                      isSelected && styles.scheduleTimeCellActive,
                    ]}
                    onPress={() => {
                      setEditDraft((current) =>
                        normalizeScheduleDraft({ ...current, hour })
                      );
                      setFormError("");
                    }}
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
                const isSelected = minute === editDraft.minute;

                return (
                  <Pressable
                    key={minute}
                    style={[
                      styles.scheduleTimeCell,
                      isSelected && styles.scheduleTimeCellActive,
                    ]}
                    onPress={() => {
                      setEditDraft((current) =>
                        normalizeScheduleDraft({ ...current, minute })
                      );
                      setFormError("");
                    }}
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
              Xe Ã„â€˜ÃƒÂ³n bÃ¡ÂºÂ¡n lÃƒÂºc {selectedScheduleText}
            </ThemedText>
            <ThemedText
              type="default"
              style={[styles.scheduleArrivalText, styles.hiddenScheduleMeta]}
            >
              Ã„ÂÃ¡ÂºÂ¿n nÃ†Â¡i lÃƒÂºc {pad(selectedArrivalDate.getHours())}:{pad(selectedArrivalDate.getMinutes())}
            </ThemedText>
            <ThemedText
              type="small"
              style={[styles.scheduleHint, styles.hiddenScheduleMeta]}
            >
              di chuyÃ¡Â»Æ’n khoÃ¡ÂºÂ£ng {MOCK_TRIP_DURATION_MINUTES} phÃƒÂºt
            </ThemedText>
          </View>

          <Pressable
            style={styles.scheduleConfirmButton}
            onPress={() => setSchedulePickerVisible(false)}
          >
            <ThemedText type="smallBold" style={styles.scheduleConfirmText}>
              XÃƒÂ¡c nhÃ¡ÂºÂ­n
            </ThemedText>
          </Pressable>
        </View>
      </Modal>

      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            <ThemedText type="default" style={styles.modalTitle}>
              HÃ¡Â»Â§y yÃƒÂªu cÃ¡ÂºÂ§u Ã„â€˜Ã¡ÂºÂ·t xe
            </ThemedText>
            <ThemedText type="small" style={styles.metaText}>
              {selectedTrip?.route}
            </ThemedText>

            <TextInput
              multiline
              placeholder="NhÃ¡ÂºÂ­p lÃƒÂ½ do hÃ¡Â»Â§y yÃƒÂªu cÃ¡ÂºÂ§u..."
              placeholderTextColor={MUTED}
              style={[
                styles.reviewInput,
                {
                  color: theme.text,
                  backgroundColor: theme.background,
                },
              ]}
              value={cancelReason}
              onChangeText={(value) => {
                setCancelReason(value);
                setFormError("");
              }}
            />

            {Boolean(formError) && (
              <ThemedText type="smallBold" style={styles.formError}>
                {formError}
              </ThemedText>
            )}

            <View style={styles.modalButtonRow}>
              <Pressable
                style={[styles.modalSecondaryButton, { backgroundColor: theme.background }]}
                disabled={isCancellingTrip}
                onPress={() => setCancelModalVisible(false)}
              >
                <ThemedText type="smallBold">Ã„ÂÃƒÂ³ng</ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.modalDangerButton,
                  isCancellingTrip && styles.modalButtonDisabled,
                ]}
                disabled={isCancellingTrip}
                onPress={handleCancelTrip}
              >
                <ThemedText type="smallBold" style={styles.modalPrimaryButtonText}>
                  XÃƒÂ¡c nhÃ¡ÂºÂ­n hÃ¡Â»Â§y
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
  screenTitle: {
    ...ScreenTitleStyle,
  },
  tabRow: {
    flexDirection: "row",
    gap: Spacing.two,
    alignSelf: "flex-start",
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F4F4F5",
    alignItems: "center",
    justifyContent: "center",
  },
  tabButtonActive: {
    backgroundColor: BRAND,
  },
  tabText: {
    color: "#3F3F46",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  historyFilterRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  historyFilterButton: {
    minHeight: 38,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FFD2AE",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  historyFilterButtonActive: {
    backgroundColor: BRAND,
    borderColor: BRAND,
  },
  historyFilterText: {
    color: "#C75B00",
  },
  historyFilterTextActive: {
    color: "#FFFFFF",
  },
  activeJourney: {
    gap: Spacing.three,
  },
  activeJourneyTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "800",
  },
  activeMapCard: {
    minHeight: 230,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#FFF3EA",
    borderWidth: 1,
    borderColor: "#FED7AA",
    shadowColor: "#9A3412",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  activeMapImage: {
    width: "100%",
    height: "100%",
  },
  activeMapFallback: {
    flex: 1,
    minHeight: 230,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
  },
  activeMapFallbackIcon: {
    fontSize: 34,
  },
  activeMapFallbackText: {
    color: "#9A3412",
  },
  activeMapBadge: {
    position: "absolute",
    left: Spacing.three,
    right: Spacing.three,
    bottom: Spacing.three,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: "center",
  },
  activeMapBadgeText: {
    color: "#9A3412",
  },
  emptyActiveCard: {
    minHeight: 170,
    borderRadius: 18,
    padding: Spacing.four,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  emptyActiveTitle: {
    color: "#111827",
    textAlign: "center",
    fontSize: 20,
    fontWeight: "800",
  },
  emptyActiveText: {
    color: "#6B7280",
    textAlign: "center",
  },
  activeEtaCard: {
    minHeight: 118,
    borderRadius: 18,
    backgroundColor: "#FFF3EA",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  activeEtaStatus: {
    color: "#6B7280",
  },
  activeEtaNumber: {
    color: "#111827",
    fontSize: 36,
    fontWeight: "900",
    lineHeight: 42,
  },
  activeEtaDistance: {
    color: "#6B7280",
  },
  activeRouteCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    padding: Spacing.three,
    gap: 4,
  },
  activeRouteLabel: {
    color: "#9A3412",
    marginTop: Spacing.one,
  },
  activeRouteValue: {
    color: "#111827",
    fontWeight: "800",
  },
  activeDriverCard: {
    minHeight: 72,
    borderRadius: 18,
    paddingHorizontal: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  activeDriverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  activeDriverInfo: {
    flex: 1,
    gap: 2,
  },
  activeDriverName: {
    color: "#111827",
    fontWeight: "800",
    fontSize: 18,
  },
  activeDriverMeta: {
    color: "#6B7280",
  },
  activeDriverPhone: {
    color: "#4B5563",
  },
  activeMessageButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND,
  },
  activeMessageIcon: {
    color: "#FFFFFF",
    fontSize: 22,
  },
  activePaymentCard: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: "#FFF7ED",
    paddingHorizontal: Spacing.three,
    justifyContent: "center",
  },
  activePaymentText: {
    color: "#B45309",
  },
  scheduledCards: {
    gap: Spacing.three,
  },
  scheduledJourneyCard: {
    borderRadius: 18,
    borderLeftWidth: 5,
    borderLeftColor: BRAND,
    padding: Spacing.three,
    gap: Spacing.two,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  scheduledJourneyTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  scheduledJourneyInfo: {
    flex: 1,
    gap: 4,
  },
  scheduledDestination: {
    color: "#C2410C",
    fontSize: 22,
    fontWeight: "900",
  },
  scheduledTime: {
    color: "#6B7280",
  },
  scheduledStatusBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#FFF7ED",
  },
  scheduledStatusText: {
    color: "#B45309",
  },
  scheduledMetaGroup: {
    gap: 6,
  },
  scheduledMetaLine: {
    color: "#4B5563",
  },
  scheduledMetaStrong: {
    color: "#111827",
    fontWeight: "800",
  },
  scheduledJourneyBottom: {
    marginTop: Spacing.one,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  scheduledPrice: {
    color: BRAND,
    fontSize: 22,
    fontWeight: "900",
  },
  scheduledActionColumn: {
    alignItems: "flex-end",
    gap: 8,
  },
  scheduledEditButton: {
    minWidth: 92,
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D97706",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.two,
  },
  scheduledEditText: {
    color: "#B45309",
  },
  scheduledCancelButton: {
    minWidth: 92,
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.two,
  },
  scheduledCancelText: {
    color: "#DC2626",
  },
  listCard: {
    borderRadius: 18,
    overflow: "hidden",
  },
  tripRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.two,
    paddingVertical: 18,
    paddingHorizontal: 8,
  },
  tripRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tripLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  iconWrap: {
    width: 34,
    alignItems: "center",
  },
  tripInfo: {
    flex: 1,
    gap: 2,
  },
  routeText: {
    color: "#111827",
    fontWeight: "700",
  },
  metaText: {
    color: MUTED,
  },
  tripRight: {
    alignItems: "flex-end",
    gap: 6,
    minWidth: 84,
  },
  outlineAction: {
    minWidth: 74,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#F5B17B",
    alignItems: "center",
  },
  outlineActionText: {
    color: "#D97706",
  },
  outlineActionDisabled: {
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
  },
  outlineActionTextDisabled: {
    color: "#9CA3AF",
  },
  ratingText: {
    color: "#EAB308",
  },
  historyPaginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  historyPageButton: {
    minHeight: 38,
    minWidth: 88,
    borderRadius: 999,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.three,
  },
  historyPageButtonDisabled: {
    backgroundColor: "#F3F4F6",
  },
  historyPageButtonText: {
    color: "#FFFFFF",
  },
  historyPageButtonTextDisabled: {
    color: "#9CA3AF",
  },
  historyPageInfo: {
    color: "#374151",
  },
  chatCard: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    borderRadius: 22,
    overflow: "hidden",
  },
  chatHeader: {
    minHeight: 72,
    paddingHorizontal: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  chatHeaderInfo: {
    flex: 1,
    gap: 2,
  },
  chatTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
  },
  chatSubtitle: {
    color: "#6B7280",
  },
  chatCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  chatCloseText: {
    color: "#6B7280",
    fontSize: 28,
    lineHeight: 30,
  },
  chatMessages: {
    maxHeight: 320,
  },
  chatMessagesContent: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  chatBubble: {
    maxWidth: "82%",
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chatBubbleDriver: {
    alignSelf: "flex-start",
    backgroundColor: "#F3F4F6",
  },
  chatBubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: BRAND,
  },
  chatBubbleText: {
    color: "#111827",
  },
  chatBubbleTextUser: {
    color: "#FFFFFF",
  },
  chatInputRow: {
    padding: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  chatInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: Spacing.three,
  },
  chatSendButton: {
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.three,
  },
  chatSendText: {
    color: "#FFFFFF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    justifyContent: "center",
    paddingHorizontal: Spacing.three,
  },
  modalCard: {
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  modalTitle: {
    ...ScreenTitleStyle,
    fontSize: 24,
  },
  reportIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    backgroundColor: "#FEF2F2",
  },
  reportIconText: {
    color: "#EF4444",
    fontSize: 30,
    fontWeight: "900",
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.two,
  },
  starButton: {
    padding: Spacing.one,
  },
  starText: {
    fontSize: 30,
    color: "#D1D5DB",
  },
  starTextActive: {
    color: "#FACC15",
  },
  reviewInput: {
    minHeight: 110,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: Spacing.three,
    textAlignVertical: "top",
  },
  formInput: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: Spacing.three,
  },
  pickerGroup: {
    gap: Spacing.two,
  },
  pickerTitle: {
    color: "#111827",
  },
  pickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  pickerChip: {
    minWidth: 78,
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.two,
    backgroundColor: "#FFFFFF",
  },
  pickerChipActive: {
    borderColor: BRAND,
    backgroundColor: BRAND,
  },
  pickerChipText: {
    color: "#374151",
  },
  pickerChipTextActive: {
    color: "#FFFFFF",
  },
  lockedPriceBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FED7AA",
    padding: Spacing.three,
    backgroundColor: "#FFF7ED",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  lockedPriceLabel: {
    color: "#9A3412",
  },
  lockedPriceText: {
    color: "#C2410C",
  },
  scheduleSummaryButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#FED7AA",
    padding: Spacing.three,
    backgroundColor: "#FFF7ED",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  scheduleIconCard: {
    width: 56,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#F4F4F5",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  scheduleIconMonth: {
    textAlign: "center",
    color: "#FFFFFF",
    backgroundColor: "#111113",
    paddingVertical: 4,
  },
  scheduleIconDay: {
    textAlign: "center",
    color: "#111113",
    fontSize: 24,
    fontWeight: "800",
    paddingVertical: 6,
  },
  scheduleSummaryInfo: {
    flex: 1,
    gap: 2,
  },
  scheduleSummaryTitle: {
    color: "#0F172A",
  },
  scheduleSummaryMeta: {
    color: "#C2410C",
  },
  scheduleChangeText: {
    color: BRAND,
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
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleBackIcon: {
    color: "#111113",
    fontSize: 32,
  },
  scheduleTitle: {
    color: "#111113",
    fontSize: 28,
    fontWeight: "900",
  },
  scheduleCalendarCard: {
    width: 96,
    alignSelf: "center",
    marginTop: Spacing.four,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#F4F4F5",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  scheduleCalendarMonth: {
    textAlign: "center",
    color: "#FFFFFF",
    backgroundColor: "#09090B",
    paddingVertical: 8,
    fontSize: 20,
    fontWeight: "900",
  },
  scheduleCalendarDay: {
    textAlign: "center",
    color: "#09090B",
    paddingVertical: 18,
    fontSize: 42,
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
    fontSize: 30,
    fontWeight: "900",
  },
  scheduleHint: {
    color: "#9CA3AF",
    textAlign: "center",
  },
  schedulePickerPanel: {
    marginTop: "auto",
    minHeight: 190,
    borderRadius: 42,
    backgroundColor: "#FFF7ED",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  scheduleDateColumn: {
    flex: 1.45,
    maxHeight: 180,
  },
  scheduleTimeColumn: {
    flex: 0.65,
    maxHeight: 180,
  },
  schedulePickerRow: {
    minHeight: 54,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.two,
  },
  schedulePickerRowActive: {
    backgroundColor: "#FED7AA",
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
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleTimeCellActive: {
    backgroundColor: "#FED7AA",
  },
  scheduleTimeText: {
    color: "#3F3F46",
    fontSize: 22,
    fontWeight: "800",
  },
  scheduleColon: {
    color: BRAND,
    fontSize: 26,
    fontWeight: "900",
  },
  scheduleResultCard: {
    marginTop: Spacing.four,
    borderRadius: 24,
    backgroundColor: "#F4F4F5",
    padding: Spacing.four,
    gap: Spacing.two,
  },
  scheduleResultTitle: {
    color: "#09090B",
    textAlign: "center",
    fontSize: 22,
    fontWeight: "900",
  },
  scheduleArrivalText: {
    color: "#111113",
    textAlign: "center",
    fontSize: 20,
    fontWeight: "800",
  },
  hiddenScheduleMeta: {
    display: "none",
  },
  scheduleConfirmButton: {
    minHeight: 60,
    borderRadius: 18,
    marginTop: "auto",
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleConfirmText: {
    color: "#FFFFFF",
    fontSize: 20,
  },
  formError: {
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
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  modalPrimaryButton: {
    flex: 1.4,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
  },
  modalDangerButton: {
    flex: 1.4,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonDisabled: {
    opacity: 0.65,
  },
  modalPrimaryButtonText: {
    color: "#FFFFFF",
  },
});

