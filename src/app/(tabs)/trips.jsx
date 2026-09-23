// TRIPS SCREEN - Màn quản lý chuyến đặt trước và lịch sử chuyến
// ================================================================
// Comment tiếng Việt được đặt phía trên từng khối để giải thích vai trò code.
// Logic hiện tại được giữ nguyên, chỉ bổ sung mô tả cho dễ đọc/bảo trì.
// ================================================================

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
  createTripReport,
  getDriverRatingSummary,
  getDriverReviews,
  getMyReviews,
  getMyTripReports,
  getTripReviews,
} from "@/features/trip-history/services/review-api";
import { mapTripToHistoryItem } from "@/features/trip-history/utils/trip-history-mapper";

// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const BRAND = "#FF7A00";
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const BORDER = "#E9E9E9";
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const MUTED = "#6B7280";
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const HISTORY_PAGE_SIZE = 3;
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const SCHEDULED_PAGE_SIZE = 3;
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const PASSENGER_CANCEL_REASON_OTHER = 5;
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const EMPTY_TRIP_SECTIONS = {
  active: [],
  scheduled: [],
  history: [],
};

const tabs = [
  { key: "scheduled", label: "Đã đặt trước" },
  { key: "history", label: "Lịch sử", minWidth: 88 },
];

// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const MAX_SCHEDULE_DAYS = 7;
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const MIN_PICKUP_BUFFER_MINUTES = 30;
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const MINUTE_STEP = 5;

// pad: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function pad(value) {
  return String(value).padStart(2, "0");
}

// addMinutes: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

// addDays: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

// roundUpToStep: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function roundUpToStep(date, step) {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  const remainder = rounded.getMinutes() % step;

  if (remainder !== 0) {
    rounded.setMinutes(rounded.getMinutes() + step - remainder);
  }

  return rounded;
}

// getScheduleBounds: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getScheduleBounds() {
  const now = new Date();
  return {
    min: roundUpToStep(addMinutes(now, MIN_PICKUP_BUFFER_MINUTES), MINUTE_STEP),
    max: addDays(now, MAX_SCHEDULE_DAYS),
  };
}

// formatDateValue: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function formatDateValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// formatDateDisplay: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function formatDateDisplay(date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

// parseDateValue: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function parseDateValue(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// getDateLabel: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getDateLabel(date, index) {
  if (index === 0) {
    return "Hôm nay";
  }

  if (index === 1) {
    return "Ngày mai";
  }

  return formatDateDisplay(date);
}

// createDateOptions: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
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

// createScheduleDate: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function createScheduleDate(dateValue, hour, minute) {
  const date = parseDateValue(dateValue);
  date.setHours(Number(hour), Number(minute), 0, 0);
  return date;
}

// isWithinScheduleRange: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function isWithinScheduleRange(date) {
  const { min, max } = getScheduleBounds();
  return date >= min && date <= max;
}

// createHourOptions: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function createHourOptions(dateValue) {
  return Array.from({ length: 24 }, (_, hour) => pad(hour)).filter((hour) =>
    Array.from({ length: 60 / MINUTE_STEP }, (_, index) =>
      pad(index * MINUTE_STEP)
    ).some((minute) => isWithinScheduleRange(createScheduleDate(dateValue, hour, minute)))
  );
}

// createMinuteOptions: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function createMinuteOptions(dateValue, hour) {
  return Array.from({ length: 60 / MINUTE_STEP }, (_, index) =>
    pad(index * MINUTE_STEP)
  ).filter((minute) => isWithinScheduleRange(createScheduleDate(dateValue, hour, minute)));
}

// normalizeScheduleDraft: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
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

// getDefaultScheduleDraft: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getDefaultScheduleDraft() {
  const { min } = getScheduleBounds();
  const dateValue = formatDateValue(min);
  return normalizeScheduleDraft({
    date: dateValue,
    hour: pad(min.getHours()),
    minute: pad(min.getMinutes()),
  });
}

// getTripDraft: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getTripDraft(item) {
  const [from = "", to = ""] = item.route.split(/\s*(?:→|->|➝)\s*/);
  const [schedule = "", price = ""] = item.meta.split(/\s*[·•]\s*/);
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

// getScheduledTripView: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getScheduledTripView(item) {
  const [destination = item.route, pickup = "Vị trí hiện tại"] = item.route.split(/\s*(?:→|->|➝)\s*/);
  const [time = "", price = ""] = item.meta.split(/\s*[·•]\s*/);
  const vehicle = item.icon.includes("🛵") || item.icon.includes("🚗")
    ? "Xe máy"
    : "Xe 4 chỗ";

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
    statusLabel: getScheduledStatusLabel(item.status),
  };
}

// isScheduledTrip: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
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

// formatCurrencyVnd: Định dạng số tiền sang VND để hiển thị
function formatCurrencyVnd(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "--";
  }

  return `${Math.round(numberValue).toLocaleString("vi-VN")}đ`;
}

// formatDistanceKm: Định dạng khoảng cách theo km
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

// formatDurationMinute: Định dạng thời gian di chuyển theo phút
function formatDurationMinute(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "";
  }

  return `${Math.max(1, Math.round(numberValue))} phút`;
}

// getTripField: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getTripField(source, camelKey, pascalKey) {
  return source?.[camelKey] ?? source?.[pascalKey];
}

// normalizeTripStatus: Chuẩn hóa status chuyến từ số hoặc text về một dạng thống nhất
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

function getTripStatus(trip) {
  return normalizeTripStatus(getTripField(trip, "status", "Status"));
}

function isTerminalTripStatus(status) {
  const normalizedStatus = normalizeTripStatus(status);

  return (
    normalizedStatus === "completed" ||
    normalizedStatus === "cancelled" ||
    normalizedStatus === "nodriverfound"
  );
}

function isHistoryTrip(trip) {
  return isTerminalTripStatus(getTripStatus(trip));
}

function parseSortableTime(value) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) {
    return 0;
  }

  const normalizedValue = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(rawValue)
    ? rawValue
    : `${rawValue}Z`;
  const date = new Date(normalizedValue);

  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getScheduledSortTime(item) {
  return (
    item?.sortTimestamp ||
    parseSortableTime(item?.scheduledAt) ||
    parseSortableTime(item?.createdAt) ||
    0
  );
}

function getHistorySortTime(item) {
  return item?.sortTimestamp || parseSortableTime(item?.createdAt) || 0;
}

// getScheduledStatusLabel: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getScheduledStatusLabel(status) {
  const normalizedStatus = normalizeTripStatus(status);

  if (normalizedStatus === "pending" || normalizedStatus === "pendingdriverassignment") {
    return "Chờ tài xế";
  }

  switch (normalizedStatus) {
    case "pending":
      return "Đang tìm tài xế";
    case "pendingdriverassignment":
      return "Chờ tài xế";
    case "accepted":
      return "Tài xế đã nhận";
    case "driverarrived":
      return "Tài xế đã đến";
    case "inprogress":
      return "Đang di chuyển";
    case "completed":
      return "Hoàn thành";
    case "cancelled":
      return "Đã hủy";
    case "nodriverfound":
      return "Không tìm thấy tài xế";
    default:
      return "Chờ tài xế";
  }
}

// formatScheduledPickupText: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function formatScheduledPickupText(value) {
  const rawValue = String(value ?? "").trim();
  const normalizedValue =
    rawValue && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(rawValue)
      ? `${rawValue}Z`
      : rawValue;
  const utcDate = normalizedValue ? new Date(normalizedValue) : null;

  if (!utcDate || Number.isNaN(utcDate.getTime())) {
    return "";
  }

  const vietnamDate = new Date(utcDate.getTime() + 7 * 60 * 60 * 1000);
  const date = `${pad(vietnamDate.getUTCDate())}/${pad(
    vietnamDate.getUTCMonth() + 1
  )}`;
  const time = `${pad(vietnamDate.getUTCHours())}:${pad(
    vietnamDate.getUTCMinutes()
  )}`;

  return `${date} ${time}`;
}

// isSchedulePlaceholder: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function isSchedulePlaceholder(value) {
  return String(value ?? "").trim() === "Đã hẹn lịch";
}

// mapTripToScheduledItem: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function mapTripToScheduledItem(trip) {
  const scheduledAt = getTripField(trip, "scheduledAt", "ScheduledAt");
  const status = getTripField(trip, "status", "Status");
  const vehicleType = getTripField(trip, "vehicleType", "VehicleType");
  const createdAt = getTripField(trip, "createdAt", "CreatedAt");

  return toScheduledTripSectionItem({
    id: getTripField(trip, "id", "Id"),
    icon:
      String(vehicleType ?? "").toLowerCase().includes("bike") ||
      String(vehicleType ?? "") === "1"
        ? "🛵"
        : "🚗",
    route: `${getTripField(trip, "pickupAddress", "PickupAddress") || "Điểm đón"} → ${
      getTripField(trip, "destinationAddress", "DestinationAddress") || "Điểm đến"
    }`,
    pickup: getTripField(trip, "pickupAddress", "PickupAddress"),
    destination: getTripField(trip, "destinationAddress", "DestinationAddress"),
    estimatedFare: formatCurrencyVnd(getTripFare(trip)),
    scheduledAt,
    scheduledPickupText: formatScheduledPickupText(scheduledAt),
    status,
    createdAt,
    distanceText: formatDistanceKm(getTripField(trip, "estimatedDistanceKm", "EstimatedDistanceKm")),
    durationText: formatDurationMinute(getTripField(trip, "estimatedDurationMinute", "EstimatedDurationMinute")),
  });
}

async function safeLoadReviewData(loader) {
  try {
    return await loader();
  } catch {
    return null;
  }
}

// normalizeDriverRatingSummary: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function normalizeDriverRatingSummary(summary) {
  if (!summary) {
    return null;
  }

  const totalReviews = Number(summary.totalReviews ?? summary.TotalReviews ?? 0);
  const averageRating = Number(
    summary.averageRating ?? summary.AverageRating ?? 0
  );

  return {
    driverId: summary.driverId ?? summary.DriverId,
    driverName: summary.driverName ?? summary.DriverName,
    averageRating: Number.isFinite(averageRating) ? averageRating : 0,
    totalReviews: Number.isFinite(totalReviews) ? totalReviews : 0,
  };
}

// TripsScreen: Component chính của tab Chuyến đi
export default function TripsScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams();
  const router = useRouter();
  const safeAreaInsets = useSafeAreaInsets();
  const { isAuthenticated, session, refreshSession } = useAuth();
  const [selectedTab, setSelectedTab] = useState("scheduled");
  const [tripsBySection, setTripsBySection] = useState(EMPTY_TRIP_SECTIONS);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [scheduledSortOrder, setScheduledSortOrder] = useState("newest");
  const [scheduledPage, setScheduledPage] = useState(1);
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
      text: "Mình đang đến điểm đón, bạn chờ mình khoảng 1 phút nhé.",
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
  const [tripReviewsByTripId, setTripReviewsByTripId] = useState({});
  const [driverRatingSummariesById, setDriverRatingSummariesById] = useState({});
  const [driverReviewsById, setDriverReviewsById] = useState({});
  const [reportsByTripId, setReportsByTripId] = useState({});
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  useEffect(() => {
    if (params.tab === "history" || params.tab === "scheduled") {
      Promise.resolve().then(() => {
        setSelectedTab(params.tab);
      });
    }
  }, [params.tab]);

  useEffect(() => {
    if (!isAuthenticated || !session?.accessToken) {
      return undefined;
    }

    let isMounted = true;

    async function restoreBookedTrips() {
      // restoreBookedTrips: NHẬN dữ liệu local cache để tab Trips có card ngay sau khi đặt xe.
      // Nguồn dữ liệu: persistent storage do SearchScreen ghi bằng persistBookedTrip.
      // Chỉ đưa chuyến chưa completed/cancelled vào active hoặc scheduled.
      const bookedTrips = await loadBookedTrips();

      if (!isMounted || !bookedTrips.length) {
        return;
      }

      setTripsBySection((current) => {
        const nextActive = [...(current.active ?? [])];
        const nextScheduled = [...(current.scheduled ?? [])];

        bookedTrips.forEach((trip) => {
          if (isTerminalTripStatus(trip.status) || trip.status === "history") {
            return;
          }

          const isScheduled = isScheduledTrip(trip);
          // Map trip local thành item UI đúng section.
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
  }, [isAuthenticated, session?.accessToken]);

  useEffect(() => {
    if (!isAuthenticated || !session?.accessToken) {
      Promise.resolve().then(() => {
        setTripsBySection(EMPTY_TRIP_SECTIONS);
        setRatingsByTripId({});
        setTripReviewsByTripId({});
        setDriverRatingSummariesById({});
        setDriverReviewsById({});
        setReportsByTripId({});
        setIsHistoryLoading(false);
      });
      return;
    }

    let isMounted = true;

    async function loadTripHistoryFromDb() {
      setIsHistoryLoading(true);

      try {
        // loadTripHistoryFromDb: LUỒNG ĐỒNG BỘ TRIPS TỪ BE
        // 1. Đọc local cache để bổ sung field UI như scheduledPickupText/estimatedFare nếu BE thiếu.
        // 2. Gọi BE lấy trips theo role passenger/driver.
        // 3. Gọi thêm review/report để biết chuyến nào đã đánh giá hoặc báo cáo.
        // 4. Gọi review summary của driver để hiển thị thông tin rating tài xế.
        // 5. Map dữ liệu BE/local vào tripsBySection.scheduled và tripsBySection.history.
        const role = String(session.role ?? "").toLowerCase();
        const localBookedTrips = await loadBookedTrips();
        const localHistoryById = new Map(
          (localBookedTrips ?? []).map((trip) => [trip.id, trip])
        );
        // Gửi accessToken cho các API cá nhân; passenger lấy passenger trips, driver lấy driver trips.
        const [trips, myReviews, myReports] = await Promise.all([
          role === "driver"
            ? getDriverTrips(session.accessToken)
            : getPassengerTrips(session.accessToken),
          role === "driver" ? Promise.resolve([]) : getMyReviews(session.accessToken),
          role === "driver" ? Promise.resolve([]) : getMyTripReports(session.accessToken),
        ]);

        if (!isMounted) {
          return;
        }

        // Chuyển array review của tôi thành map theo tripId để UI biết chuyến nào đã đánh giá.
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

        // Chuyển array report của tôi thành map theo tripId để UI biết chuyến nào đã gửi báo cáo.
        const reportsMap = Array.isArray(myReports)
          ? myReports.reduce((accumulator, report) => {
              if (report?.tripId) {
                accumulator[report.tripId] = {
                  reason: report.reason ?? "",
                  submittedAt: report.createdAt,
                  isResolved: Boolean(report.isResolved),
                };
              }

              return accumulator;
            }, {})
          : {};

        setReportsByTripId(reportsMap);

        const tripList = Array.isArray(trips) ? trips : [];
        const tripIds = tripList
          .map((trip) => getTripField(trip, "id", "Id"))
          .filter(Boolean);
        const driverIds = [
          ...new Set(
            tripList
              .map((trip) => getTripField(trip, "driverId", "DriverId"))
              .filter(Boolean)
          ),
        ];

        // Lấy thêm review theo trip và rating tài xế để modal chi tiết có dữ liệu đầy đủ.
        const [tripReviewEntries, driverSummaryEntries, driverReviewEntries] =
          await Promise.all([
            Promise.all(
              tripIds.map(async (tripId) => [
                tripId,
                await safeLoadReviewData(() =>
                  getTripReviews(tripId, session.accessToken)
                ),
              ])
            ),
            Promise.all(
              driverIds.map(async (driverId) => [
                driverId,
                await safeLoadReviewData(() =>
                  getDriverRatingSummary(driverId, session.accessToken)
                ),
              ])
            ),
            Promise.all(
              driverIds.map(async (driverId) => [
                driverId,
                await safeLoadReviewData(() =>
                  getDriverReviews(driverId, session.accessToken)
                ),
              ])
            ),
          ]);

        if (!isMounted) {
          return;
        }

        setTripReviewsByTripId(
          Object.fromEntries(
            tripReviewEntries.map(([tripId, reviews]) => [
              tripId,
              Array.isArray(reviews) ? reviews : [],
            ])
          )
        );
        setDriverRatingSummariesById(
          Object.fromEntries(
            driverSummaryEntries
              .map(([driverId, summary]) => [
                driverId,
                normalizeDriverRatingSummary(summary),
              ])
              .filter(([, summary]) => Boolean(summary))
          )
        );
        setDriverReviewsById(
          Object.fromEntries(
            driverReviewEntries.map(([driverId, reviews]) => [
              driverId,
              Array.isArray(reviews) ? reviews : [],
            ])
          )
        );

        // Đưa dữ liệu đã chuẩn hóa vào state chính của màn Trips.
        setTripsBySection((current) => {
          const localScheduledById = new Map(
            (current.scheduled ?? []).map((trip) => [trip.id, trip])
          );
          const scheduled = Array.isArray(trips)
            ? trips.filter((trip) => isScheduledTrip(trip) && !isHistoryTrip(trip)).map((trip) => {
                const item = mapTripToScheduledItem(trip);
                const localItem = localScheduledById.get(item.id);

                const localScheduleText = localItem?.meta?.split(/\s*[·•]\s*/)?.[0] || "";

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
                  sortTimestamp:
                    getScheduledSortTime(item) ||
                    getScheduledSortTime(localItem) ||
                    0,
                };
              })
            : current.scheduled;

          return {
            ...current,
            scheduled,
            history: Array.isArray(trips)
              ? trips
                  .filter(isHistoryTrip)
                  .map((trip) =>
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
          const firstTime = getScheduledSortTime(firstTrip);
          const secondTime = getScheduledSortTime(secondTrip);

          return scheduledSortOrder === "newest"
            ? secondTime - firstTime
            : firstTime - secondTime;
        })
      : rawItems;
  const sortedHistoryItems =
    selectedTab === "history"
      ? [...rawItems].sort((firstTrip, secondTrip) => {
          const firstTime = getHistorySortTime(firstTrip);
          const secondTime = getHistorySortTime(secondTrip);

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
  const totalScheduledPages = Math.max(
    1,
    Math.ceil(sortedScheduledItems.length / SCHEDULED_PAGE_SIZE)
  );
  const currentScheduledPage = Math.min(scheduledPage, totalScheduledPages);
  const items =
    selectedTab === "history"
      ? sortedHistoryItems.slice(
          (currentHistoryPage - 1) * HISTORY_PAGE_SIZE,
          currentHistoryPage * HISTORY_PAGE_SIZE
        )
      : selectedTab === "scheduled"
        ? sortedScheduledItems.slice(
            (currentScheduledPage - 1) * SCHEDULED_PAGE_SIZE,
            currentScheduledPage * SCHEDULED_PAGE_SIZE
          )
      : rawItems;
  const hasActiveRide = params.activeRide === "1";
  const activePickup =
    typeof params.pickup === "string" && params.pickup
      ? params.pickup
      : "Cổng FPT";
  const activeDriverOrigin =
    typeof params.driverOrigin === "string" && params.driverOrigin
      ? params.driverOrigin
      : "Vị trí tài xế";
  const activeDestination =
    typeof params.destination === "string" && params.destination
      ? params.destination
      : "Vị trí của bạn";
  // NHẬN ROUTE PARAMS TỪ LEGACY BOOKING FLOW
  // SearchScreen có thể router.push({ pathname: "/trips", params: {...} }) sau khi đặt xe.
  // Các params pickup/destination/mapImageUrl/duration/distance giúp TripsScreen dựng nhanh active ride
  // trước khi dữ liệu BE/local cache được đồng bộ lại.
  const activeMapImageUrl =
    typeof params.mapImageUrl === "string" ? params.mapImageUrl : "";
  const activeDuration =
    typeof params.duration === "string" && params.duration ? params.duration : "1 phút";
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
  const selectedScheduleText = `${editDraft.time} • ${editDraft.dateDisplay} (${editDraft.dateLabel})`;

  function requireLogin() {
    if (isAuthenticated) {
      return true;
    }

    // Nếu user chưa đăng nhập mà bấm action chuyến đi, chuyển sang /profile để login trước.
    router.push("/profile");
    return false;
  }

  function handlePrimaryAction(item) {
    if (!requireLogin()) {
      return;
    }

    if (selectedTab === "scheduled") {
      // Action chính ở tab scheduled là chỉnh sửa: đưa item vào selectedTrip, map thành editDraft rồi mở modal.
      setSelectedTrip(item);
      setEditDraft(getTripDraft(item));
      setFormError("");
      setEditModalVisible(true);
      return;
    }

    if (item.actionPrimary !== "Đánh giá") {
      return;
    }

    // Action chính ở history là đánh giá: lưu item đang chọn và mở rating modal.
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
      // Action phụ ở scheduled/active là hủy: lưu selectedTrip và mở cancel modal để nhập lý do.
      setSelectedTrip(item);
      setCancelReason("");
      setFormError("");
      setCancelModalVisible(true);
      return;
    }

    if (item.actionSecondary !== "Báo cáo") {
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
      setFormError("Vui lòng nhập đầy đủ điểm đón và điểm đến");
      return;
    }

    if (!editDraft.date.trim() || !editDraft.time.trim()) {
      setFormError("Vui lòng chọn ngày và giờ hẹn");
      return;
    }

    setTripsBySection((current) => ({
      ...current,
      scheduled: current.scheduled.map((trip) =>
        trip.id === selectedTrip?.id
          ? {
              ...trip,
              route: `${editDraft.from.trim()} → ${editDraft.to.trim()}`,
              meta: `${editDraft.dateLabel} ${editDraft.time.trim()} · ${editDraft.price}`,
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
      setFormError("Không tìm thấy chuyến cần hủy");
      return;
    }

    if (!cancelReason.trim()) {
      setFormError("Vui lòng nhập lý do hủy");
      return;
    }

    // handleCancelTrip: GỬI yêu cầu hủy chuyến đặt trước/đang active.
    // Input: selectedTrip.id từ card người dùng chọn + cancelReason trên form.
    // Gửi: PUT /trips/{id}/cancel/passenger với cancelReason.
    // Nhận: BE đổi status; FE xóa cache local, remove card khỏi section, refresh history.
    setIsCancellingTrip(true);

    try {
      try {
        // Gửi hủy bằng accessToken hiện tại.
        await cancelTrip(
          selectedTrip.id,
          { cancelReason: PASSENGER_CANCEL_REASON_OTHER },
          session.accessToken
        );
      } catch (error) {
        if (error?.status !== 401) {
          throw error;
        }

        // Nếu token hết hạn, refresh session rồi gửi lại request hủy.
        const nextSession = await refreshSession();
        await cancelTrip(
          selectedTrip.id,
          { cancelReason: PASSENGER_CANCEL_REASON_OTHER },
          nextSession.accessToken
        );
      }
      // Xóa bản local để lần sau không hiện lại chuyến đã hủy.
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
          "Không thể hủy chuyến. Vui lòng thử lại."
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
      // handleSubmitRating: GỬI đánh giá chuyến đi lên BE.
      // Payload gồm tripId, rating, comment; response không cần reload toàn bộ, FE cập nhật ratingsByTripId tại chỗ.
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
        error?.message || "Không thể gửi đánh giá. Vui lòng thử lại."
      );
    } finally {
      setIsSubmittingReview(false);
    }
  }

  async function handleSubmitReport() {
    if (!requireLogin()) {
      return;
    }

    if (!selectedTrip?.id || !session?.accessToken || isSubmittingReport) {
      return;
    }

    if (!reportReason.trim()) {
      setFormError("Vui lòng nhập nội dung báo cáo");
      return;
    }

    setFormError("");
    setIsSubmittingReport(true);

    // Payload gửi báo cáo sự cố chuyến đi lên BE.
    const payload = {
      tripId: selectedTrip.id,
      reason: reportReason.trim(),
    };

    try {
      let reportResponse;

      try {
        // Gửi report bằng token hiện tại.
        reportResponse = await createTripReport(payload, session.accessToken);
      } catch (error) {
        if (error?.status !== 401) {
          throw error;
        }

        // Nếu 401 thì refresh session rồi gửi lại report.
        const nextSession = await refreshSession();
        reportResponse = await createTripReport(payload, nextSession.accessToken);
      }

      // Lưu report response vào map theo tripId để UI khóa/hiển thị trạng thái đã báo cáo.
      setReportsByTripId((current) => ({
        ...current,
        [selectedTrip.id]: {
          reason: reportResponse?.reason ?? payload.reason,
          submittedAt: reportResponse?.createdAt ?? new Date().toISOString(),
          isResolved: Boolean(reportResponse?.isResolved),
        },
      }));
      setReportModalVisible(false);
      setSelectedTrip(null);
      setReportReason("");
      setFormError("");
    } catch (error) {
      setFormError(
        error?.message || "Không thể gửi báo cáo. Vui lòng thử lại."
      );
    } finally {
      setIsSubmittingReport(false);
    }
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
          text: "Tài xế đã nhận tin nhắn, mình sẽ phản hồi ngay.",
        },
      ]);
    }, 700);
  }

  return (
    <>
      {/* ScrollView: Cho phép nội dung dài cuộn được trên màn hình nhỏ. */}
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
        {/* Khối content: Bố cục bao ngoài, canh lề và giới hạn chiều rộng nội dung. */}
        <View style={styles.content}>
          <ThemedText type="default" style={styles.screenTitle}>
            {"Hành trình"}
          </ThemedText>

          {/* Khối tab row: Nhóm lựa chọn dạng tab/segment để đổi chế độ hiển thị. */}
          <View style={styles.tabRow}>
            {tabs.map((tab) => {
              const isActive = tab.key === selectedTab;

              return (
                /* Nút tab/segment để đổi nhóm nội dung đang xem. */
                <Pressable
                testID={`trips-tab-${tab.key}`}
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
            /* Khối history filter row: Dàn các phần tử trên cùng một hàng. */
            <View style={styles.historyFilterRow}>
              {[
                { key: "newest", label: "Mới nhất" },
                { key: "oldest", label: "Cũ nhất" },
              ].map((option) => {
                const isActive = historySortOrder === option.key;

                return (
                  /* Pressable: Vùng bấm xử lý thao tác người dùng trong UI. */
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
            /* Khối history filter row: Dàn các phần tử trên cùng một hàng. */
            <View style={styles.historyFilterRow}>
              {[
                { key: "newest", label: "Mới nhất" },
                { key: "oldest", label: "Cũ nhất" },
              ].map((option) => {
                const isActive = scheduledSortOrder === option.key;

                return (
                  /* Pressable: Vùng bấm xử lý thao tác người dùng trong UI. */
                  <Pressable
                    key={option.key}
                    style={[
                      styles.historyFilterButton,
                      isActive && styles.historyFilterButtonActive,
                    ]}
                    onPress={() => {
                      setScheduledSortOrder(option.key);
                      setScheduledPage(1);
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

          {!isAuthenticated ? (
            /* Khối empty active card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */
            <View
              style={[
                styles.emptyActiveCard,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              <ThemedText type="default" style={styles.emptyActiveTitle}>
                Vui lòng đăng nhập
              </ThemedText>
              <ThemedText type="small" style={styles.emptyActiveText}>
                Vui lòng đăng nhập để hiển thị hành trình và lịch sử chuyến đi của bạn.
              </ThemedText>
            </View>
          ) : selectedTab === "active" ? (
            /* Khối active journey: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */
            <View style={styles.activeJourney}>
              {hasActiveRide ? (
                <>
                  <ThemedText type="default" style={styles.activeJourneyTitle}>
                    Hành trình của bạn
                  </ThemedText>

                  {/* Khối active map card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
                  <View style={styles.activeMapCard}>
                    {activeMapImageUrl ? (
                      /* Image: Hiển thị asset hình ảnh dùng trong UI. */
                      <Image
                        source={{ uri: activeMapImageUrl }}
                        style={styles.activeMapImage}
                        resizeMode="cover"
                      />
                    ) : (
                      /* Khối active map fallback: Khu vực bản đồ/preview tuyến đường cho chuyến đi. */
                      <View style={styles.activeMapFallback}>
                        <ThemedText type="default" style={styles.activeMapFallbackIcon}>
                          🗺️
                        </ThemedText>
                        <ThemedText type="smallBold" style={styles.activeMapFallbackText}>
                          Bản đồ hành trình
                        </ThemedText>
                      </View>
                    )}
                    {/* Khối active map badge: Khu vực bản đồ/preview tuyến đường cho chuyến đi. */}
                    <View style={styles.activeMapBadge}>
                      <ThemedText type="smallBold" style={styles.activeMapBadgeText}>
                        Google Maps • Driver → Khách
                      </ThemedText>
                    </View>
                  </View>

                  {/* Khối active eta card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
                  <View style={styles.activeEtaCard}>
                    <ThemedText type="small" style={styles.activeEtaStatus}>
                      🛵 Tài xế đang đến...
                    </ThemedText>
                    <ThemedText type="default" style={styles.activeEtaNumber}>
                      {activeDuration}
                    </ThemedText>
                    <ThemedText type="small" style={styles.activeEtaDistance}>
                      Khoảng cách {activeDistance}
                    </ThemedText>
                  </View>

                  {/* Khối active route card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
                  <View
                    style={[
                      styles.activeRouteCard,
                      { backgroundColor: theme.backgroundElement },
                    ]}
                  >
                    <ThemedText type="small" style={styles.activeRouteLabel}>
                      Điểm tài xế xuất phát
                    </ThemedText>
                    <ThemedText type="default" style={styles.activeRouteValue}>
                      {activeDriverOrigin}
                    </ThemedText>
                    <ThemedText type="small" style={styles.activeRouteLabel}>
                      Điểm đón khách
                    </ThemedText>
                    <ThemedText type="default" style={styles.activeRouteValue}>
                      {activePickup}
                    </ThemedText>
                    <ThemedText type="small" style={styles.activeRouteLabel}>
                      Điểm đến chuyến xe
                    </ThemedText>
                    <ThemedText type="default" style={styles.activeRouteValue}>
                      {activeDestination}
                    </ThemedText>
                  </View>

                  {/* Khối active driver card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
                  <View
                    style={[
                      styles.activeDriverCard,
                      { backgroundColor: theme.backgroundElement },
                    ]}
                  >
                    {/* Khối active driver avatar: Hiển thị avatar/chữ cái đại diện của người dùng. */}
                    <View style={styles.activeDriverAvatar}>
                      <ThemedText type="default">👨</ThemedText>
                    </View>
                    {/* Khối active driver info: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
                    <View style={styles.activeDriverInfo}>
                      <ThemedText type="default" style={styles.activeDriverName}>
                        Nguyễn Văn Tài
                      </ThemedText>
                      <ThemedText type="small" style={styles.activeDriverPhone}>
                        0901 234 567
                      </ThemedText>
                      <ThemedText type="small" style={styles.activeDriverMeta}>
                        59-X1 234.56 · ★ 4.8
                      </ThemedText>
                    </View>
                    {/* Pressable: Vùng bấm xử lý thao tác người dùng trong UI. */}
                    <Pressable
                      style={styles.activeMessageButton}
                      onPress={() => {
                        if (requireLogin()) {
                          setChatModalVisible(true);
                        }
                      }}
                    >
                      <ThemedText type="default" style={styles.activeMessageIcon}>
                        💬
                      </ThemedText>
                    </Pressable>
                  </View>

                  {/* Khối active payment card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
                  <View style={styles.activePaymentCard}>
                    <ThemedText type="small" style={styles.activePaymentText}>
                      💵 Trả tiền mặt: 25.000đ
                    </ThemedText>
                  </View>
                </>
              ) : (
                /* Khối empty active card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */
                <View
                  style={[
                    styles.emptyActiveCard,
                    { backgroundColor: theme.backgroundElement },
                  ]}
                >
                  <ThemedText type="default" style={styles.emptyActiveTitle}>
                    Chưa có chuyến xe được đặt hiện tại
                  </ThemedText>
                  <ThemedText type="small" style={styles.emptyActiveText}>
                    Khi bạn đặt xe thành công, thông tin chuyến đang đi sẽ hiển thị ở đây.
                  </ThemedText>
                </View>
              )}
            </View>
          ) : selectedTab === "scheduled" && items.length === 0 ? (
            /* Khối empty active card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */
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
            /* Khối scheduled cards: Thông tin chuyến đã đặt trước và trạng thái xử lý. */
            <View style={styles.scheduledCards}>
              {items.map((item) => {
                const trip = getScheduledTripView(item);
                const normalizedItemStatus = normalizeTripStatus(item.status);
                const canEditScheduledTrip = ![
                  "inprogress",
                  "completed",
                  "cancelled",
                ].includes(normalizedItemStatus);
                const canCancelScheduledTrip = ![
                  "completed",
                  "cancelled",
                ].includes(normalizedItemStatus);

                return (
                  /* Khối scheduled journey card: Thông tin chuyến đã đặt trước và trạng thái xử lý. */
                  <View
                    key={item.id}
                    style={[
                      styles.scheduledJourneyCard,
                      { backgroundColor: theme.backgroundElement },
                    ]}
                  >
                    {/* Khối scheduled journey top: Thông tin chuyến đã đặt trước và trạng thái xử lý. */}
                    <View style={styles.scheduledJourneyTop}>
                      {/* Khối scheduled journey info: Thông tin chuyến đã đặt trước và trạng thái xử lý. */}
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
                      {/* Khối hidden schedule meta: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
                      <View style={styles.hiddenScheduleMeta}>
                        <ThemedText
                          type="smallBold"
                          style={styles.scheduledStatusText}
                        >
                          {"Chờ tài xế"}
                        </ThemedText>
                      </View>
                      {/* Khối scheduled status badge: Thông tin chuyến đã đặt trước và trạng thái xử lý. */}
                      <View style={styles.scheduledStatusBadge}>
                        <ThemedText
                          type="smallBold"
                          style={styles.scheduledStatusText}
                        >
                          {trip.statusLabel}
                        </ThemedText>
                      </View>
                    </View>

                    {/* Khối scheduled meta group: Thông tin chuyến đã đặt trước và trạng thái xử lý. */}
                    <View style={styles.scheduledMetaGroup}>
                      <ThemedText type="default" style={styles.scheduledMetaLine}>
                        {"📍 Điểm đón: "}
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
                          {"Quãng đường: "}
                          <ThemedText
                            type="default"
                            style={styles.scheduledMetaStrong}
                          >
                            {[item.distanceText, item.durationText]
                              .filter(Boolean)
                              .join(" • ")}
                          </ThemedText>
                        </ThemedText>
                      )}
                    </View>

                    {/* Khối scheduled journey bottom: Thông tin chuyến đã đặt trước và trạng thái xử lý. */}
                    <View style={styles.scheduledJourneyBottom}>
                      <ThemedText type="default" style={styles.scheduledPrice}>
                        {trip.price}
                      </ThemedText>
                      {/* Khối scheduled action column: Thông tin chuyến đã đặt trước và trạng thái xử lý. */}
                      <View style={styles.scheduledActionColumn}>
                        {/* Nút chỉnh sửa lịch hẹn: truyền item vào handlePrimaryAction, mở edit modal với editDraft map từ trip. */}
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
                            {"Chỉnh sửa"}
                          </ThemedText>
                        </Pressable>
                        {canCancelScheduledTrip ? (
                          /* Nút hủy chuyến đặt trước: truyền item vào handleSecondaryAction, mở cancel modal rồi handleCancelTrip gọi BE. */
                          <Pressable
                            style={styles.scheduledCancelButton}
                            onPress={() => handleSecondaryAction(item)}
                          >
                            <ThemedText
                              type="smallBold"
                              style={styles.scheduledCancelText}
                            >
                              {"Hủy"}
                            </ThemedText>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })}
              {sortedScheduledItems.length > SCHEDULED_PAGE_SIZE ? (
                /* Khối history pagination row: Dàn các phần tử trên cùng một hàng. */
                <View style={styles.historyPaginationRow}>
                  {/* Phân trang scheduled: chỉ đổi state scheduledPage, không gọi API. */}
                  <Pressable
                    style={[
                      styles.historyPageButton,
                      currentScheduledPage === 1 && styles.historyPageButtonDisabled,
                    ]}
                    disabled={currentScheduledPage === 1}
                    onPress={() =>
                      setScheduledPage((current) => Math.max(1, current - 1))
                    }
                  >
                    <ThemedText
                      type="smallBold"
                      style={[
                        styles.historyPageButtonText,
                        currentScheduledPage === 1 &&
                          styles.historyPageButtonTextDisabled,
                      ]}
                    >
                      Trước
                    </ThemedText>
                  </Pressable>

                  <ThemedText type="smallBold" style={styles.historyPageInfo}>
                    {`Trang ${currentScheduledPage}/${totalScheduledPages}`}
                  </ThemedText>

                  {/* Phân trang scheduled: tăng scheduledPage trong giới hạn totalScheduledPages, không đổi dữ liệu gốc. */}
                  <Pressable
                    style={[
                      styles.historyPageButton,
                      currentScheduledPage === totalScheduledPages &&
                        styles.historyPageButtonDisabled,
                    ]}
                    disabled={currentScheduledPage === totalScheduledPages}
                    onPress={() =>
                      setScheduledPage((current) =>
                        Math.min(totalScheduledPages, current + 1)
                      )
                    }
                  >
                    <ThemedText
                      type="smallBold"
                      style={[
                        styles.historyPageButtonText,
                        currentScheduledPage === totalScheduledPages &&
                          styles.historyPageButtonTextDisabled,
                      ]}
                    >
                      Sau
                    </ThemedText>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : selectedTab === "history" && isHistoryLoading ? (
            /* Khối empty active card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */
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
            /* Khối empty active card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */
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
              {/* Khối list card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
              <ThemedView
                testID={`trips-${selectedTab}-list`}
                style={[styles.listCard, { backgroundColor: theme.backgroundElement }]}
              >
              {items.map((item, index) => {
              const savedRating = ratingsByTripId[item.id]?.rating;
              const displayRating = savedRating ?? item.rating;
              const hasRated = typeof savedRating === "number";
              const hasReported = Boolean(reportsByTripId[item.id]);
              const driverSummary = item.driverId
                ? driverRatingSummariesById[item.driverId]
                : null;
              const tripReviewCount = tripReviewsByTripId[item.id]?.length ?? 0;
              const driverReviewCount = item.driverId
                ? driverReviewsById[item.driverId]?.length ?? 0
                : 0;
              const shouldShowDriverRating =
                selectedTab === "history" &&
                driverSummary &&
                driverSummary.totalReviews > 0;

              return (
                /* Khối trip row: Dàn các phần tử trên cùng một hàng. */
                <View
                  testID={`trips-${selectedTab}-item-${index}`}
                  key={item.id}
                  style={[
                    styles.tripRow,
                    index < items.length - 1 && styles.tripRowBorder,
                  ]}
                >
                  {/* Khối trip left: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
                  <View style={styles.tripLeft}>
                    {/* Khối icon wrap: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
                    <View style={styles.iconWrap}>
                      <ThemedText type="default">{item.icon}</ThemedText>
                    </View>

                    {/* Khối trip info: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
                    <View style={styles.tripInfo}>
                      <ThemedText type="default" style={styles.routeText}>
                        {item.route}
                      </ThemedText>
                      <ThemedText type="small" style={styles.metaText}>
                        {item.meta}
                      </ThemedText>
                      {shouldShowDriverRating ? (
                        <ThemedText type="small" style={styles.driverRatingText}>
                          {`Tài xế: ${
                            driverSummary.driverName || item.driverName || "Tài xế"
                          } • ${driverSummary.averageRating.toFixed(1)}★ • ${
                            driverReviewCount || driverSummary.totalReviews
                          } đánh giá`}
                        </ThemedText>
                      ) : null}
                      {selectedTab === "history" && tripReviewCount > 0 ? (
                        <ThemedText type="small" style={styles.tripReviewText}>
                          {`Review chuyến: ${tripReviewCount} đánh giá`}
                        </ThemedText>
                      ) : null}
                    </View>
                  </View>

                  {/* Khối trip right: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
                  <View style={styles.tripRight}>
                    {/* Nút hành động chính: gửi dữ liệu người dùng đang nhập lên luồng xử lý. */}
                    <Pressable
                      testID={`trips-${selectedTab}-primary-${index}`}
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
                          ? "Sửa"
                          : hasRated
                            ? "Đã đánh giá"
                            : item.actionPrimary}
                      </ThemedText>
                    </Pressable>

                    {/* Pressable: Vùng bấm xử lý thao tác người dùng trong UI. */}
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
                          ? "Hủy"
                          : hasReported
                            ? "Đã báo cáo"
                            : item.actionSecondary}
                      </ThemedText>
                    </Pressable>

                    {typeof displayRating === "number" && (
                      <ThemedText type="smallBold" style={styles.ratingText}>
                        {"★"} {displayRating}
                      </ThemedText>
                    )}
                  </View>
                </View>
              );
              })}
              </ThemedView>
              {selectedTab === "history" && sortedHistoryItems.length > HISTORY_PAGE_SIZE ? (
                /* Khối history pagination row: Dàn các phần tử trên cùng một hàng. */
                <View style={styles.historyPaginationRow}>
                  {/* Pressable: Vùng bấm xử lý thao tác người dùng trong UI. */}
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
                      {"Trước"}
                    </ThemedText>
                  </Pressable>

                  <ThemedText type="smallBold" style={styles.historyPageInfo}>
                    {`Trang ${currentHistoryPage}/${totalHistoryPages}`}
                  </ThemedText>

                  {/* Pressable: Vùng bấm xử lý thao tác người dùng trong UI. */}
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

      {/* Modal: Lớp giao diện nổi dùng để xác nhận, nhập form hoặc thông báo mà không rời màn hiện tại. */}
      <Modal
        visible={chatModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setChatModalVisible(false)}
      >
        {/* Khối modal overlay: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
        <View style={styles.modalOverlay}>
          {/* Khối chat card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
          <View
            testID="trips-rating-modal"
            style={[
              styles.chatCard,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            {/* Khối chat header: Phần đầu của card/modal/màn hình, thường chứa tiêu đề và nút đóng. */}
            <View style={styles.chatHeader}>
              {/* Khối active driver avatar: Hiển thị avatar/chữ cái đại diện của người dùng. */}
              <View style={styles.activeDriverAvatar}>
                <ThemedText type="default">{"👨"}</ThemedText>
              </View>
              {/* Khối chat header info: Phần đầu của card/modal/màn hình, thường chứa tiêu đề và nút đóng. */}
              <View style={styles.chatHeaderInfo}>
                <ThemedText type="default" style={styles.chatTitle}>
                  {"Nguyễn Văn Tài"}
                </ThemedText>
                <ThemedText type="small" style={styles.chatSubtitle}>
                  {"Đang hoạt động · 0901 234 567"}
                </ThemedText>
              </View>
              {/* Nút đóng modal/popup đang hiển thị. */}
              <Pressable
                style={styles.chatCloseButton}
                onPress={() => setChatModalVisible(false)}
              >
                <ThemedText type="default" style={styles.chatCloseText}>
                  x
                </ThemedText>
              </Pressable>
            </View>

            {/* ScrollView: Cho phép nội dung dài cuộn được trên màn hình nhỏ. */}
            <ScrollView
              style={styles.chatMessages}
              contentContainerStyle={styles.chatMessagesContent}
            >
              {chatMessages.map((message) => {
                const isUser = message.sender === "user";

                return (
                  /* Khối chat bubble: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */
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

            {/* Khối chat input row: Bao ô nhập và nút phụ như xóa nhanh hoặc chọn gợi ý. */}
            <View style={styles.chatInputRow}>
              {/* TextInput: Ô nhập dữ liệu người dùng, thường đi kèm validate và state form. */}
              <TextInput
                placeholder={"Nhắn tin với tài xế..."}
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
              {/* Pressable: Vùng bấm xử lý thao tác người dùng trong UI. */}
              <Pressable
                style={styles.chatSendButton}
                onPress={handleSendChatMessage}
              >
                <ThemedText type="smallBold" style={styles.chatSendText}>
                  {"Gửi"}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Lớp giao diện nổi dùng để xác nhận, nhập form hoặc thông báo mà không rời màn hiện tại. */}
      <Modal
        visible={ratingModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRatingModalVisible(false)}
      >
        {/* Khối modal overlay: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
        <View style={styles.modalOverlay}>
          {/* Khối modal card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            <ThemedText type="default" style={styles.modalTitle}>
              {"Đánh giá chuyến đi"}
            </ThemedText>
            <ThemedText type="small" style={styles.metaText}>
              {selectedTrip?.route}
            </ThemedText>

            {/* Khối stars row: Dàn các phần tử trên cùng một hàng. */}
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                /* Pressable: Vùng bấm xử lý thao tác người dùng trong UI. */
                <Pressable
                  testID={`trips-rating-star-${star}`}
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
                    {"★"}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            {/* TextInput: Ô nhập dữ liệu người dùng, thường đi kèm validate và state form. */}
            <TextInput
              testID="trips-rating-comment-input"
              multiline
              placeholder={"Nhận xét chuyến đi"}
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

            {/* Khối modal button row: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
            <View style={styles.modalButtonRow}>
              {/* Nút hành động phụ: điều hướng hoặc đóng bước hiện tại mà không gửi form chính. */}
              <Pressable
                style={[
                  styles.modalSecondaryButton,
                  { backgroundColor: theme.background },
                ]}
                onPress={() => setRatingModalVisible(false)}
              >
                <ThemedText type="smallBold">{"Hủy"}</ThemedText>
              </Pressable>
              {/* Nút hành động chính: gửi dữ liệu người dùng đang nhập lên luồng xử lý. */}
              <Pressable
                testID="trips-rating-submit-button"
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
                  {isSubmittingReview ? "Đang gửi..." : "Gửi đánh giá"}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Lớp giao diện nổi dùng để xác nhận, nhập form hoặc thông báo mà không rời màn hiện tại. */}
      <Modal
        visible={reportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReportModalVisible(false)}
      >
        {/* Khối modal overlay: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
        <View style={styles.modalOverlay}>
          {/* Khối modal card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            {/* Khối report icon: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
            <View style={styles.reportIcon}>
              <ThemedText type="default" style={styles.reportIconText}>
                !
              </ThemedText>
            </View>
            <ThemedText type="default" style={styles.modalTitle}>
              Báo cáo chuyến đi
            </ThemedText>
            <ThemedText type="small" style={styles.metaText}>
              {selectedTrip?.route}
            </ThemedText>

            {/* TextInput: Ô nhập dữ liệu người dùng, thường đi kèm validate và state form. */}
            <TextInput
              multiline
              placeholder="Nhập lý do báo cáo, ví dụ: tài xế đến muộn, thái độ không phù hợp..."
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

            {/* Khối modal button row: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
            <View style={styles.modalButtonRow}>
              {/* Nút hành động phụ: điều hướng hoặc đóng bước hiện tại mà không gửi form chính. */}
              <Pressable
                style={[styles.modalSecondaryButton, { backgroundColor: theme.background }]}
                onPress={() => {
                  setReportModalVisible(false);
                  setFormError("");
                }}
              >
                <ThemedText type="smallBold">Đóng</ThemedText>
              </Pressable>
              {/* Nút hành động chính: gửi dữ liệu người dùng đang nhập lên luồng xử lý. */}
              <Pressable
                style={[
                  styles.modalDangerButton,
                  isSubmittingReport && styles.modalButtonDisabled,
                ]}
                disabled={isSubmittingReport}
                onPress={handleSubmitReport}
              >
                <ThemedText type="smallBold" style={styles.modalPrimaryButtonText}>
                  {isSubmittingReport ? "Đang gửi..." : "Gửi báo cáo"}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Lớp giao diện nổi dùng để xác nhận, nhập form hoặc thông báo mà không rời màn hiện tại. */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        {/* Khối modal overlay: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
        <View style={styles.modalOverlay}>
          {/* Khối modal card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            <ThemedText type="default" style={styles.modalTitle}>
              Sửa lịch đặt xe
            </ThemedText>
            <ThemedText type="small" style={styles.metaText}>
              Cập nhật thông tin chuyến đã hẹn trước
            </ThemedText>

            {/* TextInput: Ô nhập dữ liệu người dùng, thường đi kèm validate và state form. */}
            <TextInput
              placeholder="Điểm đón"
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
            {/* TextInput: Ô nhập dữ liệu người dùng, thường đi kèm validate và state form. */}
            <TextInput
              placeholder="Điểm đến"
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
            {/* Nút chọn ngày đặt chuyến trong khoảng thời gian hợp lệ. */}
            <Pressable
              style={styles.scheduleSummaryButton}
              onPress={() => setSchedulePickerVisible(true)}
            >
              {/* Khối schedule icon card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
              <View style={styles.scheduleIconCard}>
                <ThemedText type="smallBold" style={styles.scheduleIconMonth}>
                  {selectedDateOption.monthLabel}
                </ThemedText>
                <ThemedText type="default" style={styles.scheduleIconDay}>
                  {selectedDateOption.dayLabel}
                </ThemedText>
              </View>
              {/* Khối schedule summary info: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
              <View style={styles.scheduleSummaryInfo}>
                <ThemedText type="smallBold" style={styles.scheduleSummaryTitle}>
                  Xe đón lúc {editDraft.time}
                </ThemedText>
                <ThemedText type="small" style={styles.scheduleSummaryMeta}>
                  {editDraft.dateDisplay} ({editDraft.dateLabel})
                </ThemedText>
              </View>
              <ThemedText type="smallBold" style={styles.scheduleChangeText}>
                Chọn
              </ThemedText>
            </Pressable>

            {/* Khối locked price box: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
            <View style={styles.lockedPriceBox}>
              <ThemedText type="small" style={styles.lockedPriceLabel}>
                Giá chuyến đi
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

            {/* Khối modal button row: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
            <View style={styles.modalButtonRow}>
              {/* Nút hành động chính: gửi dữ liệu người dùng đang nhập lên luồng xử lý. */}
              <Pressable
                style={[styles.modalSecondaryButton, { backgroundColor: theme.background }]}
                onPress={() => setEditModalVisible(false)}
              >
                <ThemedText type="smallBold">Đóng</ThemedText>
              </Pressable>
              {/* Nút hành động chính: gửi dữ liệu người dùng đang nhập lên luồng xử lý. */}
              <Pressable
                style={styles.modalPrimaryButton}
                onPress={handleUpdateScheduledTrip}
              >
                <ThemedText type="smallBold" style={styles.modalPrimaryButtonText}>
                  Lưu thay đổi
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
              paddingTop: safeAreaInsets.top + Spacing.three,
              paddingBottom: safeAreaInsets.bottom + Spacing.three,
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
                ←
              </ThemedText>
            </Pressable>
            <ThemedText type="default" style={styles.scheduleTitle}>
              Hẹn giờ
            </ThemedText>
            {/* Khối schedule back button: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
            <View style={styles.scheduleBackButton} />
          </View>

          {/* Khối schedule calendar card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
          <View style={styles.scheduleCalendarCard}>
            <ThemedText type="default" style={styles.scheduleCalendarMonth}>
              {selectedDateOption.monthLabel}
            </ThemedText>
            <ThemedText type="default" style={styles.scheduleCalendarDay}>
              {selectedDateOption.dayLabel}
            </ThemedText>
          </View>

          {/* Khối schedule intro: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
          <View style={styles.scheduleIntro}>
            <ThemedText type="default" style={styles.scheduleQuestion}>
              Bạn muốn xe đón lúc nào?
            </ThemedText>
            <ThemedText type="default" style={styles.scheduleHint}>
              Chọn thời gian trong vòng tối đa 7 ngày kể từ hiện tại.
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
                const isSelected = option.value === selectedDateOption.value;

                return (
                  /* Pressable: Vùng bấm xử lý thao tác người dùng trong UI. */
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

            {/* ScrollView: Cho phép nội dung dài cuộn được trên màn hình nhỏ. */}
            <ScrollView
              style={styles.scheduleTimeColumn}
              showsVerticalScrollIndicator={false}
            >
              {scheduleHourOptions.map((hour) => {
                const isSelected = hour === editDraft.hour;

                return (
                  /* Pressable: Vùng bấm xử lý thao tác người dùng trong UI. */
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

            {/* ScrollView: Cho phép nội dung dài cuộn được trên màn hình nhỏ. */}
            <ScrollView
              style={styles.scheduleTimeColumn}
              showsVerticalScrollIndicator={false}
            >
              {scheduleMinuteOptions.map((minute) => {
                const isSelected = minute === editDraft.minute;

                return (
                  /* Pressable: Vùng bấm xử lý thao tác người dùng trong UI. */
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

          {/* Khối schedule result card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
          <View style={styles.scheduleResultCard}>
            <ThemedText type="default" style={styles.scheduleResultTitle}>
              Xe đón bạn lúc {selectedScheduleText}
            </ThemedText>
          </View>

          {/* Pressable: Vùng bấm xử lý thao tác người dùng trong UI. */}
          <Pressable
            style={styles.scheduleConfirmButton}
            onPress={() => setSchedulePickerVisible(false)}
          >
            <ThemedText type="smallBold" style={styles.scheduleConfirmText}>
              Xác nhận
            </ThemedText>
          </Pressable>
        </View>
      </Modal>

      {/* Modal: Lớp giao diện nổi dùng để xác nhận, nhập form hoặc thông báo mà không rời màn hiện tại. */}
      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelModalVisible(false)}
      >
        {/* Khối modal overlay: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
        <View style={styles.modalOverlay}>
          {/* Khối modal card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            <ThemedText type="default" style={styles.modalTitle}>
              {"Hủy yêu cầu đặt xe"}
            </ThemedText>
            <ThemedText type="small" style={styles.metaText}>
              {selectedTrip?.route}
            </ThemedText>

            {/* TextInput: Ô nhập dữ liệu người dùng, thường đi kèm validate và state form. */}
            <TextInput
              multiline
              placeholder={"Nhập lý do hủy yêu cầu..."}
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

            {/* Khối modal button row: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
            <View style={styles.modalButtonRow}>
              {/* Nút hủy thao tác hiện tại và đóng form/modal liên quan. */}
              <Pressable
                style={[styles.modalSecondaryButton, { backgroundColor: theme.background }]}
                disabled={isCancellingTrip}
                onPress={() => setCancelModalVisible(false)}
              >
                <ThemedText type="smallBold">{"Đóng"}</ThemedText>
              </Pressable>
              {/* Nút hủy thao tác hiện tại và đóng form/modal liên quan. */}
              <Pressable
                style={[
                  styles.modalDangerButton,
                  isCancellingTrip && styles.modalButtonDisabled,
                ]}
                disabled={isCancellingTrip}
                onPress={handleCancelTrip}
              >
                <ThemedText type="smallBold" style={styles.modalPrimaryButtonText}>
                  {"Xác nhận hủy"}
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
  driverRatingText: {
    color: "#0F766E",
    fontWeight: "700",
  },
  tripReviewText: {
    color: "#8B5CF6",
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

