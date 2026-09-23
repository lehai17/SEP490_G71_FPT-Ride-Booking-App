// NOTIFICATIONS SCREEN - Màn danh sách thông báo của khách
// ================================================================
// Comment tiếng Việt được đặt phía trên từng khối để giải thích vai trò code.
// Logic hiện tại được giữ nguyên, chỉ bổ sung mô tả cho dễ đọc/bảo trì.
// ================================================================

import { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
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
import { useNotifications } from "@/contexts/notification-context";
import { useTheme } from "@/hooks/use-theme";

// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const TITLE_TRANSLATIONS = {
  "Trip created": "Đã tạo chuyến",
  "Scheduled trip created": "Đã đặt lịch chuyến",
  "Trip cancelled": "Chuyến đi đã hủy",
  "Looking for a driver": "Đang tìm tài xế",
  "Driver accepted your trip": "Tài xế đã nhận chuyến",
  "Driver has arrived": "Tài xế đã đến điểm đón",
  "Trip started": "Chuyến đi đã bắt đầu",
  "Trip completed": "Chuyến đi hoàn thành",
  "Scheduled trip reminder": "Nhắc chuyến đặt lịch",
  "No driver found": "Không tìm được tài xế",
  "Ride sharing request created": "Đã tạo yêu cầu đi ghép",
  "Ride sharing request cancelled": "Yêu cầu đi ghép đã hủy",
  "Ride sharing group found": "Đã tìm được nhóm ghép",
  "Joined ride sharing group": "Đã tham gia nhóm ghép",
  "Left ride sharing group": "Đã rời nhóm ghép",
  "Driver accepted shared ride": "Tài xế đã nhận chuyến ghép",
  "Driver cancelled shared ride": "Tài xế đã hủy chuyến ghép",
  "Shared ride cancelled": "Chuyến ghép đã hủy",
  "Driver is heading to pickup": "Tài xế đang đến điểm đón",
  "You have been picked up": "Bạn đã được đón",
  "Shared ride started": "Chuyến ghép đã bắt đầu",
  "Shared ride completed": "Chuyến ghép hoàn thành",
};

// getDisplayTitle: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getDisplayTitle(title) {
  return TITLE_TRANSLATIONS[title] ?? title ?? "Thông báo";
}

// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const MESSAGE_TRANSLATIONS = {
  "Trip created":
    "Đã tạo chuyến xe lẻ tức thì. Hệ thống đang tìm tài xế cho bạn.",
  "Scheduled trip created": "Đã đặt chuyến xe lẻ hẹn lịch thành công.",
  "Trip cancelled": "Chuyến đi đã được hủy.",
  "Looking for a driver":
    "Chuyến xe lẻ hẹn lịch của bạn đã đến giờ tìm tài xế.",
  "Driver accepted your trip":
    "Tài xế đã nhận chuyến xe lẻ của bạn và đang di chuyển.",
  "Driver has arrived": "Tài xế đã đến điểm đón cho chuyến xe lẻ của bạn.",
  "Trip started": "Chuyến xe lẻ của bạn đã bắt đầu.",
  "Trip completed": "Chuyến xe lẻ của bạn đã hoàn thành.",
  "Scheduled trip reminder":
    "Chuyến xe lẻ hẹn lịch của bạn sắp đến giờ khởi hành.",
  "No driver found":
    "Không tìm thấy tài xế cho chuyến xe lẻ của bạn. Bạn có thể đặt lại chuyến khác.",
  "Ride sharing request created":
    "Yêu cầu đi ghép đã được tạo. Hệ thống đang tìm nhóm phù hợp cho bạn.",
  "Ride sharing request cancelled": "Yêu cầu đi ghép của bạn đã được hủy.",
  "Ride sharing group found":
    "Yêu cầu đi ghép của bạn đã được ghép vào một nhóm phù hợp.",
  "Joined ride sharing group": "Bạn đã tham gia nhóm xe ghép thành công.",
  "Left ride sharing group": "Bạn đã rời khỏi nhóm xe ghép.",
  "Driver accepted shared ride": "Tài xế đã nhận chuyến xe ghép của bạn.",
  "Driver cancelled shared ride":
    "Tài xế đã hủy chuyến xe ghép. Hệ thống đang tìm tài xế khác.",
  "Shared ride cancelled":
    "Chuyến xe ghép đã bị hủy vì không còn đủ hành khách.",
  "Driver is heading to pickup": "Tài xế đang di chuyển đến điểm đón.",
  "You have been picked up": "Bạn đã được tài xế đón.",
  "Shared ride started": "Chuyến xe ghép đã bắt đầu.",
  "Shared ride completed": "Chuyến xe ghép đã hoàn thành.",
};

const EXPLICIT_TRIP_LABEL_PATTERN = /chuyến xe (lẻ|ghép) (tức thì|hẹn lịch)/i;
const GUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";
const TIME_ZONE_PATTERN = /(z|[+-]\d{2}:?\d{2})$/i;

function parseApiDate(value) {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value !== "string") {
    return new Date(value);
  }

  const trimmedValue = value.trim();
  const normalizedValue = TIME_ZONE_PATTERN.test(trimmedValue)
    ? trimmedValue
    : `${trimmedValue}Z`;

  return new Date(normalizedValue);
}

// getDisplayMessage: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getDisplayMessage(notification) {
  const title = notification?.title ?? "";
  const message = notification?.message ?? "";

  if (EXPLICIT_TRIP_LABEL_PATTERN.test(message) && !GUID_PATTERN.test(message)) {
    return message;
  }

  if (MESSAGE_TRANSLATIONS[title]) {
    return MESSAGE_TRANSLATIONS[title];
  }

  if (/ride sharing request .* has been cancelled/i.test(message)) {
    return "Yêu cầu đi ghép của bạn đã được hủy.";
  }

  if (/ride sharing request .* has been created/i.test(message)) {
    return "Yêu cầu đi ghép đã được tạo. Hệ thống đang tìm nhóm phù hợp cho bạn.";
  }

  if (/has been matched into group/i.test(message)) {
    return "Yêu cầu đi ghép của bạn đã được ghép vào một nhóm phù hợp.";
  }

  if (/you have joined ride sharing group/i.test(message)) {
    return "Bạn đã tham gia nhóm xe ghép thành công.";
  }

  if (/you have left ride sharing group/i.test(message)) {
    return "Bạn đã rời khỏi nhóm xe ghép.";
  }

  if (/driver has accepted ride sharing group/i.test(message)) {
    return "Tài xế đã nhận chuyến xe ghép của bạn.";
  }

  if (/driver cancelled ride sharing group/i.test(message)) {
    return "Tài xế đã hủy chuyến xe ghép. Hệ thống đang tìm tài xế khác.";
  }

  if (/ride sharing group .* was cancelled because/i.test(message)) {
    return "Chuyến xe ghép đã bị hủy vì không còn đủ hành khách.";
  }

  return message || "Bạn có cập nhật mới.";
}

// formatNotificationTime: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function formatNotificationTime(value) {
  if (!value) {
    return "";
  }

  const date = parseApiDate(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("vi-VN", {
    timeZone: VIETNAM_TIME_ZONE,
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const getPart = (type) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const day = getPart("day");
  const month = getPart("month");
  const hour = getPart("hour");
  const minute = getPart("minute");

  return `${day}/${month} ${hour}:${minute}`;
}

// NotificationsScreen: Component chính của tab Thông báo
export default function NotificationsScreen() {
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const {
    notifications,
    unreadCount,
    isLoading,
    isRefreshing,
    error,
    refreshNotifications,
    markAsRead,
  } = useNotifications();

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        // Khi tab Notifications được focus: gọi API silent refresh để nhận danh sách mới nhất từ BE.
        void refreshNotifications({ silent: true });
      }
    }, [isAuthenticated, refreshNotifications])
  );

  const handleRefresh = useCallback(() => {
    // Pull-to-refresh/nút retry: gọi lại getMyNotifications qua NotificationContext.
    void refreshNotifications({ silent: true });
  }, [refreshNotifications]);

  const handleMarkAsRead = useCallback(
    (notification) => {
      if (!notification.isRead) {
        // Gửi notification.id đã normalize vào context; context dùng rawId để gọi BE mark-read.
        void markAsRead(notification.id);
      }
    },
    [markAsRead]
  );

  const renderNotification = useCallback(
    ({ item }) => (
      /* Bấm notification: nếu chưa đọc thì gọi handleMarkAsRead, context optimistic update rồi gửi API mark-read. */
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${getDisplayTitle(item.title)}. ${
          item.isRead ? "Đã đọc" : "Chưa đọc"
        }`}
        onPress={() => handleMarkAsRead(item)}
        style={({ pressed }) => [
          styles.item,
          {
            backgroundColor: item.isRead ? "#FFFFFF" : "#FFF7ED",
            borderColor: item.isRead ? "#E5E7EB" : "#FDBA74",
            opacity: pressed ? 0.76 : 1,
          },
        ]}
      >
        {/* Khối dot: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
        <View
          style={[
            styles.dot,
            { opacity: item.isRead ? 0 : 1 },
          ]}
        />
        {/* Khối item body: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
        <View style={styles.itemBody}>
          {/* Khối item header: Phần đầu của card/modal/màn hình, thường chứa tiêu đề và nút đóng. */}
          <View style={styles.itemHeader}>
            <ThemedText type="smallBold" style={styles.itemTitle}>
              {getDisplayTitle(item.title)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatNotificationTime(item.createdAt)}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {getDisplayMessage(item)}
          </ThemedText>
          {/* Khối read action: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
          <View style={styles.readAction}>
            <ThemedText
              type="smallBold"
              style={[
                styles.readActionText,
                { color: item.isRead ? "#6B7280" : "#FF7A00" },
              ]}
            >
              {item.isRead ? "Đã đọc" : "Đánh dấu là đã đọc"}
            </ThemedText>
          </View>
        </View>
      </Pressable>
    ),
    [handleMarkAsRead]
  );

  return (
    /* Khối container: Bố cục bao ngoài, canh lề và giới hạn chiều rộng nội dung. */
    <ThemedView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      {/* Khối content: Bố cục bao ngoài, canh lề và giới hạn chiều rộng nội dung. */}
      <View style={styles.content}>
        {/* Khối header: Phần đầu của card/modal/màn hình, thường chứa tiêu đề và nút đóng. */}
        <View style={styles.header}>
          {/* Khối screen title: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
          <View>
            <ThemedText type="default" style={styles.screenTitle}>
              Thông báo
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {unreadCount > 0
                ? `${unreadCount} thông báo chưa đọc`
                : "Bạn đã đọc hết thông báo"}
            </ThemedText>
          </View>
        </View>

        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#FF7A00"
            />
          }
          contentContainerStyle={{
            flexGrow: 1,
            gap: Spacing.two,
            paddingTop: Spacing.three,
            paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four,
          }}
          ListEmptyComponent={
            <NotificationState
              error={error}
              isAuthenticated={isAuthenticated}
              isLoading={isLoading}
              onRetry={handleRefresh}
            />
          }
          renderItem={renderNotification}
        />
      </View>
    </ThemedView>
  );
}

// NotificationState: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function NotificationState({ error, isAuthenticated, isLoading, onRetry }) {
  if (isLoading) {
    return (
      /* Khối empty state: Trạng thái rỗng khi chưa có dữ liệu để hiển thị. */
      <View style={styles.emptyState}>
        <ActivityIndicator color="#FF7A00" />
        <ThemedText type="small" themeColor="textSecondary">
          Đang tải thông báo...
        </ThemedText>
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      /* Khối empty state: Trạng thái rỗng khi chưa có dữ liệu để hiển thị. */
      <View style={styles.emptyState}>
        <ThemedText type="smallBold" style={styles.emptyTitle}>
          Cần đăng nhập
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Đăng nhập để xem cập nhật về chuyến đi của bạn.
        </ThemedText>
      </View>
    );
  }

  if (error) {
    return (
      /* Khối empty state: Trạng thái rỗng khi chưa có dữ liệu để hiển thị. */
      <View style={styles.emptyState}>
        <ThemedText type="smallBold" style={styles.emptyTitle}>
          Chưa tải được thông báo
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {error}
        </ThemedText>
        {/* Retry notification API: gọi onRetry -> refreshNotifications({ silent: true }) để lấy lại dữ liệu từ BE. */}
        <Pressable onPress={onRetry} style={styles.retryButton}>
          <ThemedText type="smallBold" style={styles.retryButtonText}>
            Thử lại
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    /* Khối empty state: Trạng thái rỗng khi chưa có dữ liệu để hiển thị. */
    <View style={styles.emptyState}>
      <ThemedText type="smallBold" style={styles.emptyTitle}>
        Chưa có thông báo
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Các cập nhật về chuyến đi sẽ xuất hiện tại đây.
      </ThemedText>
    </View>
  );
}

// styles: Gom toàn bộ style của màn hình/component ở cuối file
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: ScreenHeaderTop,
    maxWidth: MaxContentWidth,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  screenTitle: {
    ...ScreenTitleStyle,
  },
  emptyState: {
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#D8DDE6",
    backgroundColor: "#FFFFFF",
    gap: Spacing.one,
    alignItems: "flex-start",
  },
  emptyTitle: {
    color: "#374151",
  },
  retryButton: {
    marginTop: Spacing.one,
    borderRadius: 999,
    backgroundColor: "#FF7A00",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  retryButtonText: {
    color: "#FFFFFF",
  },
  item: {
    flexDirection: "row",
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FF7A00",
    marginTop: 5,
  },
  itemBody: {
    flex: 1,
    gap: Spacing.one,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  itemTitle: {
    flex: 1,
    color: "#111827",
  },
  readAction: {
    paddingTop: Spacing.one,
    alignItems: "flex-start",
  },
  readActionText: {
    fontSize: 13,
  },
});
