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

const sharedTripTypes = [
  "Chuyến đi (Từ nơi khác đến FPT)",
  "Chuyến về (Từ FPT đi nơi khác)",
];

const sharedVehicleOptions = [
  { label: "🚗 Xe 4 chỗ", vehicle: "Xe 4 chỗ", capacity: 4, price: "30.000đ" },
  { label: "🚙 Xe 7 chỗ", vehicle: "Xe 7 chỗ", capacity: 7, price: "42.000đ" },
];

const sharedSeatOptions = ["2", "3", "4", "5", "6", "7"];

const defaultSharedForm = {
  tripType: sharedTripTypes[0],
  vehicleIndex: 0,
  maxSeats: "",
  location: "",
  note: "",
};

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
  const [schedulePickerVisible, setSchedulePickerVisible] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState(getDefaultBookingSchedule);
  const [scheduledRideTime, setScheduledRideTime] = useState("");
  const [sharedRides, setSharedRides] = useState(rideGroups);
  const [createSharedVisible, setCreateSharedVisible] = useState(false);
  const [sharedForm, setSharedForm] = useState(defaultSharedForm);
  const [openSharedDropdown, setOpenSharedDropdown] = useState("");
  const [sharedFormError, setSharedFormError] = useState("");

  const savedAddresses = [
    { id: "saved-from", label: "Đại học FPT, Thạch Hòa", target: "from" },
    { id: "saved-to", label: "Bến xe Mỹ Đình", target: "to" },
  ];

  const selectSingleRide = () => {
    setMode("now");
    setBookingStep("form");
    setScheduledRideTime("");
  };

  const selectSharedRide = () => {
    setMode("shared");
    setBookingStep("form");
    setAlertMessage("");
    setScheduledRideTime("");
  };

  const fromLabel = from.trim() || "Vị trí hiện tại";
  const toLabel = to.trim() || "Đại học FPT, Thạch Hòa";
  const scheduleDateOptions = createScheduleDateOptions();
  const selectedScheduleDate =
    scheduleDateOptions.find((option) => option.value === scheduleDraft.date) ??
    scheduleDateOptions[0];
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
    setScheduledRideTime("");
    setBookingStep("confirm");
  };

  const openSchedulePicker = () => {
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
    setSchedulePickerVisible(true);
  };

  const confirmSchedulePicker = () => {
    setScheduledRideTime(scheduleDisplayText);
    setSchedulePickerVisible(false);
    setBookingStep("confirm");
  };

  const updateSharedForm = (field, value) => {
    setSharedForm((current) => ({ ...current, [field]: value }));
    setSharedFormError("");
  };

  const closeCreateSharedModal = () => {
    setCreateSharedVisible(false);
    setOpenSharedDropdown("");
    setSharedFormError("");
  };

  const createSharedRide = () => {
    if (!sharedForm.tripType) {
      setSharedFormError("Vui lòng chọn loại chuyến");
      return;
    }

    if (!sharedForm.maxSeats) {
      setSharedFormError("Vui lòng chọn số người tối đa");
      return;
    }

    if (!sharedForm.location.trim()) {
      setSharedFormError("Vui lòng nhập điểm đón/điểm đến");
      return;
    }

    const selectedVehicle = sharedVehicleOptions[sharedForm.vehicleIndex];
    const isGoToFpt = sharedForm.tripType.startsWith("Chuyến đi");
    const route = isGoToFpt
      ? `${sharedForm.location.trim()} → Đại học FPT`
      : `Đại học FPT → ${sharedForm.location.trim()}`;
    const note =
      sharedForm.note.trim() || "Xe ghép mới tạo, cùng chia sẻ chuyến đi";

    setSharedRides((current) => [
      {
        id: `shared-created-${Date.now()}`,
        route,
        vehicle: selectedVehicle.vehicle,
        price: selectedVehicle.price,
        distance: "18 km",
        seats: `1/${sharedForm.maxSeats} thành viên`,
        note,
        status: "Đã tham gia",
        driver: "Lê Nguyễn Đại Hải",
        destination: route,
        participantCount: 1,
        capacity: Number(sharedForm.maxSeats),
        perPersonPrice: "15.000đ/người",
      },
      ...current,
    ]);
    setSharedForm(defaultSharedForm);
    closeCreateSharedModal();
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
              {Boolean(scheduledRideTime) && (
                <ThemedText type="default" style={styles.summaryText}>
                  Thời gian hẹn:{" "}
                  <ThemedText type="default" style={styles.summaryStrong}>
                    {scheduledRideTime}
                  </ThemedText>
                </ThemedText>
              )}
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
                onPress={openSchedulePicker}
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
              <Pressable onPress={() => setCreateSharedVisible(true)}>
                <ThemedText type="smallBold" style={styles.createButtonText}>
                  + Tạo
                </ThemedText>
              </Pressable>
            </View>

            {sharedRides.map((ride) => (
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
                ←
              </ThemedText>
            </Pressable>
            <ThemedText type="default" style={styles.scheduleTitle}>
              Hẹn giờ
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
              Bạn muốn xe đón lúc nào?
            </ThemedText>
            <ThemedText type="default" style={styles.scheduleHint}>
              Chọn thời gian trong vòng tối đa 7 ngày kể từ hiện tại.
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
              Xe đón bạn lúc {scheduleDisplayText}
            </ThemedText>
            <ThemedText type="default" style={styles.scheduleArrivalText}>
              Đến nơi lúc {padSchedule(arrivalDate.getHours())}:{padSchedule(arrivalDate.getMinutes())}
            </ThemedText>
            <ThemedText type="small" style={styles.scheduleHint}>
              di chuyển khoảng {MOCK_TRIP_DURATION_MINUTES} phút
            </ThemedText>
          </View>

          <Pressable
            style={styles.scheduleConfirmButton}
            onPress={confirmSchedulePicker}
          >
            <ThemedText type="smallBold" style={styles.scheduleConfirmText}>
              Xác nhận
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
                Tạo xe ghép
              </ThemedText>
              <Pressable
                style={styles.createSharedClose}
                onPress={closeCreateSharedModal}
              >
                <ThemedText type="default" style={styles.createSharedCloseText}>
                  ×
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
                  Loại chuyến
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
                  <ThemedText type="default" style={styles.createSelectArrow}>
                    ⌄
                  </ThemedText>
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
                  Loại xe
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
                  <ThemedText type="default" style={styles.createSelectArrow}>
                    ⌄
                  </ThemedText>
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
                            maxSeats:
                              Number(current.maxSeats) > item.capacity
                                ? ""
                                : current.maxSeats,
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
                  Số người tối đa
                  <ThemedText type="small" style={styles.requiredMark}>*</ThemedText>
                </ThemedText>
                <Pressable
                  style={styles.createSelect}
                  onPress={() =>
                    setOpenSharedDropdown(
                      openSharedDropdown === "seats" ? "" : "seats"
                    )
                  }
                >
                  <ThemedText
                    type="default"
                    style={[
                      styles.createSelectText,
                      !sharedForm.maxSeats && styles.createPlaceholderText,
                    ]}
                  >
                    {sharedForm.maxSeats
                      ? `${sharedForm.maxSeats} người`
                      : "-- Chọn số người --"}
                  </ThemedText>
                  <ThemedText type="default" style={styles.createSelectArrow}>
                    ⌄
                  </ThemedText>
                </Pressable>
                {openSharedDropdown === "seats" && (
                  <View style={styles.createDropdown}>
                    {sharedSeatOptions
                      .filter(
                        (seat) =>
                          Number(seat) <=
                          sharedVehicleOptions[sharedForm.vehicleIndex].capacity
                      )
                      .map((seat) => (
                        <Pressable
                          key={seat}
                          style={[
                            styles.createDropdownItem,
                            sharedForm.maxSeats === seat &&
                              styles.createDropdownItemActive,
                          ]}
                          onPress={() => {
                            updateSharedForm("maxSeats", seat);
                            setOpenSharedDropdown("");
                          }}
                        >
                          <ThemedText
                            type="smallBold"
                            style={[
                              styles.createDropdownText,
                              sharedForm.maxSeats === seat &&
                                styles.createDropdownTextActive,
                            ]}
                          >
                            {seat} người
                          </ThemedText>
                        </Pressable>
                      ))}
                  </View>
                )}
              </View>

              <View style={styles.createField}>
                <ThemedText type="small" style={styles.createLabel}>
                  Điểm đón/Điểm đến
                  <ThemedText type="small" style={styles.requiredMark}>*</ThemedText>
                </ThemedText>
                <TextInput
                  placeholder="VD: Trạm xe, Đường XYZ..."
                  placeholderTextColor="#A1A1AA"
                  style={styles.createInput}
                  value={sharedForm.location}
                  onChangeText={(value) => updateSharedForm("location", value)}
                />
              </View>

              <View style={styles.createField}>
                <ThemedText type="small" style={styles.createLabel}>
                  Mô tả chuyến
                </ThemedText>
                <TextInput
                  placeholder="VD: Có điều hòa, tài xế kinh nghiệm..."
                  placeholderTextColor="#A1A1AA"
                  style={styles.createInput}
                  value={sharedForm.note}
                  onChangeText={(value) => updateSharedForm("note", value)}
                />
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
                  Tạo nhóm xe
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
    fontSize: 20,
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
  createPlaceholderText: {
    color: "#111827",
  },
  createSelectArrow: {
    color: "#111827",
    fontSize: 22,
    lineHeight: 24,
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
    color: "#111827",
    backgroundColor: "#FFFFFF",
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
