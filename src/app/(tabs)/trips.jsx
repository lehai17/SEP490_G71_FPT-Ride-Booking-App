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
import { ThemedView } from "@/components/themed-view";
import {
  BottomTabInset,
  MaxContentWidth,
  ScreenHeaderTop,
  ScreenTitleStyle,
  Spacing,
} from "@/constants/theme";
import { tripSections } from "@/constants/ride-data";
import { useTheme } from "@/hooks/use-theme";

const BRAND = "#FF7A00";
const BORDER = "#E9E9E9";
const MUTED = "#6B7280";

const tabs = [
  { key: "active", label: "Đang đi" },
  { key: "scheduled", label: "Đã đặt trước" },
  { key: "history", label: "Lịch sử", minWidth: 88 },
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
    return "Hôm nay";
  }

  if (index === 1) {
    return "Ngày mai";
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
  const [from = "", to = ""] = item.route.split(/\s*→\s*/);
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

export default function TripsScreen() {
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const [selectedTab, setSelectedTab] = useState("scheduled");
  const [tripsBySection, setTripsBySection] = useState(tripSections);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [schedulePickerVisible, setSchedulePickerVisible] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [ratingDraft, setRatingDraft] = useState(5);
  const [reviewDraft, setReviewDraft] = useState("");
  const [reportReason, setReportReason] = useState("");
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

  const items = tripsBySection[selectedTab] ?? [];
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
  const selectedScheduleText = `${editDraft.time} • ${editDraft.dateDisplay} (${editDraft.dateLabel})`;

  function handlePrimaryAction(item) {
    if (selectedTab === "scheduled") {
      setSelectedTrip(item);
      setEditDraft(getTripDraft(item));
      setFormError("");
      setEditModalVisible(true);
      return;
    }

    if (item.actionPrimary !== "Đánh giá") {
      return;
    }

    setSelectedTrip(item);
    setRatingDraft(item.rating ?? 5);
    setReviewDraft("");
    setRatingModalVisible(true);
  }

  function handleSecondaryAction(item) {
    if (selectedTab === "scheduled" || selectedTab === "active") {
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

  function handleCancelTrip() {
    if (!cancelReason.trim()) {
      setFormError("Vui lòng nhập lý do hủy");
      return;
    }

    setTripsBySection((current) => ({
      ...current,
      [selectedTab]: current[selectedTab].filter(
        (trip) => trip.id !== selectedTrip?.id
      ),
    }));
    setCancelModalVisible(false);
    setSelectedTrip(null);
    setCancelReason("");
    setFormError("");
  }

  function handleSubmitRating() {
    if (!selectedTrip) {
      return;
    }

    setRatingsByTripId((current) => ({
      ...current,
      [selectedTrip.id]: {
        rating: ratingDraft,
        review: reviewDraft.trim(),
      },
    }));
    setRatingModalVisible(false);
    setSelectedTrip(null);
    setReviewDraft("");
  }

  function handleSubmitReport() {
    if (!selectedTrip) {
      return;
    }

    if (!reportReason.trim()) {
      setFormError("Vui lòng nhập nội dung báo cáo");
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
            Hành trình
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
                onPress={() => setSelectedTab(tab.key)}
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

          <ThemedView
            style={[styles.listCard, { backgroundColor: theme.backgroundElement }]}
          >
            {items.map((item, index) => {
              const savedRating = ratingsByTripId[item.id]?.rating;
              const displayRating = savedRating ?? item.rating;
              const hasReported = Boolean(reportsByTripId[item.id]);
              const primaryLabel =
                selectedTab === "scheduled" ? "Sửa" : item.actionPrimary;
              const secondaryLabel =
                selectedTab === "scheduled"
                  ? "Hủy"
                  : hasReported
                    ? "Đã báo cáo"
                    : item.actionSecondary;

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
                      style={styles.outlineAction}
                      hitSlop={8}
                      onPress={() => handlePrimaryAction(item)}
                    >
                      <ThemedText type="small" style={styles.outlineActionText}>
                        {primaryLabel}
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
                        {secondaryLabel}
                      </ThemedText>
                    </Pressable>

                    {typeof displayRating === "number" && (
                      <ThemedText type="smallBold" style={styles.ratingText}>
                        ★ {displayRating}
                      </ThemedText>
                    )}
                  </View>
                </View>
              );
            })}
          </ThemedView>
        </View>
      </ScrollView>

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
              Đánh giá chuyến đi
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
                    ★
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <TextInput
              multiline
              placeholder="Nhận xét chuyến đi"
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
                style={[styles.modalSecondaryButton, { backgroundColor: theme.background }]}
                onPress={() => setRatingModalVisible(false)}
              >
                <ThemedText type="smallBold">Hủy</ThemedText>
              </Pressable>
              <Pressable
                style={styles.modalPrimaryButton}
                onPress={handleSubmitRating}
              >
                <ThemedText type="smallBold" style={styles.modalPrimaryButtonText}>
                  Gửi đánh giá
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
              Báo cáo chuyến đi
            </ThemedText>
            <ThemedText type="small" style={styles.metaText}>
              {selectedTrip?.route}
            </ThemedText>

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

            <View style={styles.modalButtonRow}>
              <Pressable
                style={[styles.modalSecondaryButton, { backgroundColor: theme.background }]}
                onPress={() => {
                  setReportModalVisible(false);
                  setFormError("");
                }}
              >
                <ThemedText type="smallBold">Đóng</ThemedText>
              </Pressable>
              <Pressable style={styles.modalDangerButton} onPress={handleSubmitReport}>
                <ThemedText type="smallBold" style={styles.modalPrimaryButtonText}>
                  Gửi báo cáo
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
              Sửa lịch đặt xe
            </ThemedText>
            <ThemedText type="small" style={styles.metaText}>
              Cập nhật thông tin chuyến đã hẹn trước
            </ThemedText>

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

            <View style={styles.modalButtonRow}>
              <Pressable
                style={[styles.modalSecondaryButton, { backgroundColor: theme.background }]}
                onPress={() => setEditModalVisible(false)}
              >
                <ThemedText type="smallBold">Đóng</ThemedText>
              </Pressable>
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
              {selectedDateOption.monthLabel}
            </ThemedText>
            <ThemedText type="default" style={styles.scheduleCalendarDay}>
              {selectedDateOption.dayLabel}
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
              Xe đón bạn lúc {selectedScheduleText}
            </ThemedText>
            <ThemedText type="default" style={styles.scheduleArrivalText}>
              Đến nơi lúc {pad(selectedArrivalDate.getHours())}:{pad(selectedArrivalDate.getMinutes())}
            </ThemedText>
            <ThemedText type="small" style={styles.scheduleHint}>
              di chuyển khoảng {MOCK_TRIP_DURATION_MINUTES} phút
            </ThemedText>
          </View>

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
              Hủy yêu cầu đặt xe
            </ThemedText>
            <ThemedText type="small" style={styles.metaText}>
              {selectedTrip?.route}
            </ThemedText>

            <TextInput
              multiline
              placeholder="Nhập lý do hủy yêu cầu..."
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
                onPress={() => setCancelModalVisible(false)}
              >
                <ThemedText type="smallBold">Đóng</ThemedText>
              </Pressable>
              <Pressable style={styles.modalDangerButton} onPress={handleCancelTrip}>
                <ThemedText type="smallBold" style={styles.modalPrimaryButtonText}>
                  Xác nhận hủy
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
  modalPrimaryButtonText: {
    color: "#FFFFFF",
  },
});
