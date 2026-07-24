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
import { useAuth } from "@/contexts/auth-context";
import { rideGroups } from "@/constants/ride-data";
import { useTheme } from "@/hooks/use-theme";

const BRAND = "#FF7A00";
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
const sharedSlotOptions = [
  { id: "slot-1", label: "Slot 1", time: "07:30" },
  { id: "slot-2", label: "Slot 2", time: "10:00" },
  { id: "slot-3", label: "Slot 3", time: "12:50" },
  { id: "slot-4", label: "Slot 4", time: "15:20" },
];

const defaultSharedForm = {
  tripType: sharedTripTypes[0],
  vehicleIndex: 0,
  maxSeats: "",
  location: "",
  slotId: "",
  date: "",
};

const defaultAddressForm = {
  label: "",
};

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
    routeSteps: [
      `1. ${startPoint}`,
      `2. ${ride.driver.split(" ").slice(-2).join(" ") || "Khách"} - ${endPoint}`,
      "3. Bạn - Mê Trì",
    ],
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
  const { isAuthenticated } = useAuth();
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
  const [savedAddresses, setSavedAddresses] = useState(initialSavedAddresses);
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [addressForm, setAddressForm] = useState(defaultAddressForm);
  const [editingAddressId, setEditingAddressId] = useState("");
  const [addressFormError, setAddressFormError] = useState("");
  const [openAddressMenuId, setOpenAddressMenuId] = useState("");
  const suggestedSharedRides = sharedRides.filter(
    (ride) => ride.participantCount > 1
  );

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
  const selectedSharedDate = scheduleDateOptions.find(
    (option) => option.value === sharedForm.date
  );
  const selectedSharedSlot = sharedSlotOptions.find(
    (option) => option.id === sharedForm.slotId
  );
  const isSharedTripToFpt = sharedForm.tripType.startsWith("Chuyến đi");
  const sharedLocationLabel = isSharedTripToFpt ? "Điểm đón" : "Điểm đến";
  const sharedLocationPlaceholder = isSharedTripToFpt
    ? "VD: Trạm xe, Đường XYZ..."
    : "VD: Bến xe Mỹ Đình, Xuân Mai...";
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

  const requireLogin = () => {
    if (isAuthenticated) {
      return true;
    }

    router.push("/profile");
    return false;
  };

  const showConfirmationStep = () => {
    if (!requireLogin()) {
      return;
    }

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
    if (!requireLogin()) {
      return;
    }

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
    if (!requireLogin()) {
      return;
    }

    if (!sharedForm.tripType) {
      setSharedFormError("Vui lòng chọn loại chuyến");
      return;
    }

    if (!sharedForm.maxSeats) {
      setSharedFormError("Vui lòng chọn số người tối đa");
      return;
    }

    if (!sharedForm.location.trim()) {
      setSharedFormError(`Vui lòng nhập ${sharedLocationLabel.toLowerCase()}`);
      return;
    }

    if (!selectedSharedSlot) {
      setSharedFormError("Vui lòng chọn slot đi");
      return;
    }

    if (!selectedSharedDate) {
      setSharedFormError("Vui lòng chọn ngày đi");
      return;
    }

    const selectedVehicle = sharedVehicleOptions[sharedForm.vehicleIndex];
    const route = isSharedTripToFpt
      ? `${sharedForm.location.trim()} → Đại học FPT`
      : `Đại học FPT → ${sharedForm.location.trim()}`;
    const scheduleText = `${selectedSharedSlot.label} (${selectedSharedSlot.time}) • ${selectedSharedDate.display}`;

    setSharedRides((current) => [
      {
        id: `shared-created-${Date.now()}`,
        route,
        vehicle: selectedVehicle.vehicle,
        price: selectedVehicle.price,
        distance: "18 km",
        seats: `1/${sharedForm.maxSeats} thành viên`,
        note: scheduleText,
        scheduleText,
        date: selectedSharedDate.value,
        slotId: selectedSharedSlot.id,
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

  const fillAddressToFocusedField = (address) => {
    if (focusedField === "from") {
      setFrom(address.label);
    } else {
      setTo(address.label);
    }

    setAlertMessage("");
    setOpenAddressMenuId("");
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

            <Pressable
              style={styles.bookButton}
              onPress={() => {
                if (requireLogin()) {
                  router.push("/trips?activeRide=1");
                }
              }}
            >
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
              <View style={styles.savedHeader}>
                <ThemedText type="smallBold">Địa chỉ đã lưu</ThemedText>
                <Pressable onPress={openCreateAddressModal}>
                  <ThemedText type="smallBold" style={styles.saveAddressButtonText}>
                    + Lưu địa chỉ
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
                        (from === item.label || to === item.label) &&
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
                      ⋯
                    </ThemedText>
                  </Pressable>

                  {openAddressMenuId === item.id && (
                    <View style={styles.savedMiniMenu}>
                      <Pressable
                        style={styles.savedMiniAction}
                        onPress={() => openEditAddressModal(item)}
                      >
                        <ThemedText type="smallBold" style={styles.savedEditText}>
                          Sửa
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={styles.savedMiniAction}
                        onPress={() => deleteAddress(item.id)}
                      >
                        <ThemedText type="smallBold" style={styles.savedDeleteText}>
                          Xóa
                        </ThemedText>
                      </Pressable>
                    </View>
                  )}
                </View>
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
                Đề xuất nhóm ghép sẵn có
              </ThemedText>
              <Pressable
                onPress={() => {
                  if (requireLogin()) {
                    setCreateSharedVisible(true);
                  }
                }}
              >
                <ThemedText type="smallBold" style={styles.createButtonText}>
                  + Tạo
                </ThemedText>
              </Pressable>
            </View>

            {suggestedSharedRides.length === 0 ? (
              <View style={styles.emptySharedCard}>
                <ThemedText type="smallBold" style={styles.emptySharedTitle}>
                  Chưa có nhóm ghép phù hợp
                </ThemedText>
                <ThemedText type="small" style={styles.emptySharedText}>
                  Nhóm chỉ có một người sẽ chưa được đề xuất. Khi có thêm người tham gia, hệ thống sẽ hiển thị tại đây.
                </ThemedText>
              </View>
            ) : null}

            {suggestedSharedRides.map((ride) => {
              const proposal = getSharedProposal(ride);

              return (
                <View key={ride.id} style={styles.proposalCard}>
                  <View style={styles.proposalHeader}>
                    <ThemedText type="default" style={styles.proposalHeaderText}>
                      ĐỀ XUẤT THAM GIA NHÓM
                    </ThemedText>
                  </View>

                  <View style={styles.proposalBody}>
                    <View style={styles.proposalInfoCard}>
                      <ThemedText type="smallBold" style={styles.proposalVehicle}>
                        {ride.vehicle}
                      </ThemedText>
                      <ThemedText type="smallBold" style={styles.savingText}>
                        Tiết kiệm {proposal.savingPrice}
                      </ThemedText>

                      <View style={styles.priceLine}>
                        <ThemedText type="smallBold" style={styles.priceLabel}>
                          Đi lẻ:
                        </ThemedText>
                        <ThemedText type="smallBold" style={styles.soloPriceText}>
                          {proposal.soloPrice}
                        </ThemedText>
                      </View>
                      <View style={styles.priceLine}>
                        <ThemedText type="smallBold" style={styles.priceLabel}>
                          Đi ghép:
                        </ThemedText>
                        <ThemedText type="smallBold" style={styles.sharedPriceText}>
                          {proposal.sharedPrice}
                        </ThemedText>
                      </View>

                      <View style={styles.proposalDivider} />

                      <ThemedText type="small" style={styles.proposalMuted}>
                        Thời gian đón dự kiến: {proposal.expectedPickup}
                      </ThemedText>
                      <ThemedText type="small" style={styles.proposalMuted}>
                        Dự kiến đến nơi lúc: {proposal.expectedArrival}
                      </ThemedText>
                      <ThemedText type="small" style={styles.proposalMuted}>
                        Hạn ghép xe: 15p
                      </ThemedText>
                      <ThemedText type="small" style={styles.proposalMuted}>
                        Nhóm: {ride.participantCount}/{ride.capacity} người
                      </ThemedText>

                      <View style={styles.proposalDivider} />

                      <ThemedText type="smallBold" style={styles.proposalSectionTitle}>
                        Lộ trình nhóm
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

                      <View style={styles.proposalFooterLine}>
                        <ThemedText type="smallBold" style={styles.proposalVehicle}>
                          {ride.vehicle}
                        </ThemedText>
                        <ThemedText type="default" style={styles.proposalTotal}>
                          {proposal.sharedPrice}
                        </ThemedText>
                      </View>
                      <ThemedText type="small" style={styles.proposalMuted}>
                        Đón trong 5 phút
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
                        Tham gia nhóm
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      style={styles.backProposalButton}
                      onPress={() => setMode("now")}
                    >
                      <ThemedText type="smallBold" style={styles.backProposalText}>
                        Quay lại
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
                {editingAddressId ? "Sửa địa chỉ" : "Lưu địa chỉ"}
              </ThemedText>
              <Pressable style={styles.addressCloseButton} onPress={closeAddressModal}>
                <ThemedText type="default" style={styles.addressCloseText}>
                  ×
                </ThemedText>
              </Pressable>
            </View>

            <View style={styles.addressField}>
              <ThemedText type="smallBold" style={styles.addressLabel}>
                Tên địa chỉ
              </ThemedText>
              <TextInput
                placeholder="VD: Đại học FPT, Bến xe Mỹ Đình..."
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
                <ThemedText type="smallBold">Hủy</ThemedText>
              </Pressable>
              <Pressable style={styles.addressPrimaryButton} onPress={saveAddress}>
                <ThemedText type="smallBold" style={styles.addressPrimaryText}>
                  Lưu địa chỉ
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
                  {sharedLocationLabel}
                  <ThemedText type="small" style={styles.requiredMark}>*</ThemedText>
                </ThemedText>
                <TextInput
                  placeholder={sharedLocationPlaceholder}
                  placeholderTextColor="#A1A1AA"
                  style={styles.createInput}
                  value={sharedForm.location}
                  onChangeText={(value) => updateSharedForm("location", value)}
                />
              </View>

              <View style={styles.createField}>
                <ThemedText type="small" style={styles.createLabel}>
                  Slot
                  <ThemedText type="small" style={styles.requiredMark}>*</ThemedText>
                </ThemedText>
                <Pressable
                  style={styles.createSelect}
                  onPress={() =>
                    setOpenSharedDropdown((current) =>
                      current === "slot" ? "" : "slot"
                    )
                  }
                >
                  <ThemedText
                    type="default"
                    style={[
                      styles.createSelectText,
                      !selectedSharedSlot && styles.createPlaceholderText,
                    ]}
                  >
                    {selectedSharedSlot
                      ? `${selectedSharedSlot.label} (${selectedSharedSlot.time})`
                      : "-- Chọn Slot đi --"}
                  </ThemedText>
                  <ThemedText type="default" style={styles.createSelectArrow}>
                    ⌄
                  </ThemedText>
                </Pressable>
                {openSharedDropdown === "slot" && (
                  <View style={styles.createDropdown}>
                    {sharedSlotOptions.map((slot) => (
                      <Pressable
                        key={slot.id}
                        style={[
                          styles.createDropdownItem,
                          sharedForm.slotId === slot.id &&
                            styles.createDropdownItemActive,
                        ]}
                        onPress={() => {
                          updateSharedForm("slotId", slot.id);
                          setOpenSharedDropdown("");
                        }}
                      >
                        <ThemedText
                          type="smallBold"
                          style={[
                            styles.createDropdownText,
                            sharedForm.slotId === slot.id &&
                              styles.createDropdownTextActive,
                          ]}
                        >
                          {slot.label} - {slot.time}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.createField}>
                <ThemedText type="small" style={styles.createLabel}>
                  Ngày đi
                  <ThemedText type="small" style={styles.requiredMark}>*</ThemedText>
                </ThemedText>
                <Pressable
                  style={styles.createSelect}
                  onPress={() =>
                    setOpenSharedDropdown((current) =>
                      current === "date" ? "" : "date"
                    )
                  }
                >
                  <ThemedText
                    type="default"
                    style={[
                      styles.createSelectText,
                      !selectedSharedDate && styles.createPlaceholderText,
                    ]}
                  >
                    {selectedSharedDate
                      ? `${selectedSharedDate.display} (${selectedSharedDate.label})`
                      : "-- Chọn ngày đi --"}
                  </ThemedText>
                  <ThemedText type="default" style={styles.createSelectArrow}>
                    ⌄
                  </ThemedText>
                </Pressable>
                {openSharedDropdown === "date" && (
                  <View style={styles.createDropdown}>
                    {scheduleDateOptions.map((date) => (
                      <Pressable
                        key={date.value}
                        style={[
                          styles.createDropdownItem,
                          sharedForm.date === date.value &&
                            styles.createDropdownItemActive,
                        ]}
                        onPress={() => {
                          updateSharedForm("date", date.value);
                          setOpenSharedDropdown("");
                        }}
                      >
                        <ThemedText
                          type="smallBold"
                          style={[
                            styles.createDropdownText,
                            sharedForm.date === date.value &&
                              styles.createDropdownTextActive,
                          ]}
                        >
                          {date.display} - {date.label}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                )}
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
                  Gửi yêu cầu
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
  proposalMuted: {
    color: "#9CA3AF",
  },
  proposalSectionTitle: {
    color: "#6B7280",
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
