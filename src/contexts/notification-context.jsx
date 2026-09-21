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
        const response = await getMyNotifications(accessToken);
        const nextNotifications = Array.isArray(response)
          ? response.map(normalizeNotification)
          : [];

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

      setNotifications((items) =>
        items.map((notification) =>
          notification.id === id
            ? { ...notification, isRead: true }
            : notification
        )
      );

      try {
        await markNotificationAsRead(current.rawId, accessToken);
        setError(null);
        return true;
      } catch (requestError) {
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

export function useNotifications() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }

  return context;
}
