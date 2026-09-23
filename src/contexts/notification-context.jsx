// NOTIFICATION CONTEXT - Quản lý danh sách thông báo và số chưa đọc
// ================================================================
// Comment tiếng Việt được đặt phía trên từng khối để giải thích vai trò code.
// Logic hiện tại được giữ nguyên, chỉ bổ sung mô tả cho dễ đọc/bảo trì.
// ================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getMyNotifications,
  markNotificationAsRead,
} from "@/features/notifications/services/notification-api";
import { useAuth } from "@/contexts/auth-context";

const NotificationContext = createContext(null);

// normalizeNotification: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function normalizeNotification(notification) {
  return {
    id: String(notification.id),
    rawId: notification.id,
    title: notification.title ?? "",
    message: notification.message ?? "",
    isRead: Boolean(notification.isRead),
    createdAt: notification.createdAt ?? null,
  };
}

// NotificationProvider: Provider tải thông báo và đồng bộ trạng thái đã đọc
export function NotificationProvider({ children }) {
  const { session } = useAuth();
  const accessToken = session?.accessToken ?? null;
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const didInitialLoadRef = useRef(false);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications]
  );

  const refreshNotifications = useCallback(
    async ({ silent = false } = {}) => {
      if (!accessToken) {
        setNotifications([]);
        setError(null);
        didInitialLoadRef.current = false;
        return [];
      }

      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        // refreshNotifications: NHẬN danh sách thông báo của user từ BE.
        // Gửi accessToken lên notification API, nhận array notification thô.
        // Sau đó normalize field id/title/message/isRead để màn Notifications render thống nhất.
        const response = await getMyNotifications(accessToken);
        const nextNotifications = Array.isArray(response)
          ? response.map(normalizeNotification)
          : [];

        // Đẩy danh sách đã chuẩn hóa vào state; unreadCount phía trên tự tính lại từ state này.
        setNotifications(nextNotifications);
        setError(null);
        didInitialLoadRef.current = true;
        return nextNotifications;
      } catch (requestError) {
        setError(
          requestError?.message ||
            "Không tải được thông báo. Vui lòng thử lại."
        );
        return [];
      } finally {
        if (silent) {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [accessToken]
  );

  const markAsRead = useCallback(
    async (notificationId) => {
      if (!accessToken) {
        return false;
      }

      const id = String(notificationId);
      const current = notifications.find(
        (notification) => notification.id === id
      );

      if (!current || current.isRead) {
        return true;
      }

      // Optimistic update: đổi UI sang đã đọc ngay để người dùng thấy phản hồi nhanh.
      setNotifications((items) =>
        items.map((notification) =>
          notification.id === id
            ? { ...notification, isRead: true }
            : notification
        )
      );

      try {
        // Gửi rawId thật của BE lên API mark-read; id render có thể đã được normalize thành string.
        await markNotificationAsRead(current.rawId, accessToken);
        setError(null);
        return true;
      } catch (requestError) {
        // Nếu BE báo lỗi, rollback lại trạng thái chưa đọc để UI không sai dữ liệu.
        setNotifications((items) =>
          items.map((notification) =>
            notification.id === id
              ? { ...notification, isRead: false }
              : notification
          )
        );
        setError(
          requestError?.message ||
            "Không đánh dấu đã đọc được. Vui lòng thử lại."
        );
        return false;
      }
    },
    [accessToken, notifications]
  );

  useEffect(() => {
    if (!accessToken) {
      Promise.resolve().then(() => {
        setNotifications([]);
        setError(null);
        didInitialLoadRef.current = false;
      });
      return;
    }

    if (!didInitialLoadRef.current) {
      void refreshNotifications();
    }
  }, [accessToken, refreshNotifications]);

  const value = {
    notifications,
    unreadCount,
    isLoading,
    isRefreshing,
    error,
    refreshNotifications,
    markAsRead,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

// useNotifications: Hook lấy notification context, bắt lỗi nếu dùng ngoài Provider
export function useNotifications() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }

  return context;
}
