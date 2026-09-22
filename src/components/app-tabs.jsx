import { Tabs } from "expo-router";
import { Text, useColorScheme } from "react-native";

import { Colors } from "@/constants/theme";
import { useNotifications } from "@/contexts/notification-context";

function formatBadgeCount(count) {
  if (!count) {
    return undefined;
  }

  return count > 99 ? "99+" : String(count);
}

function TabIcon({ children, color }) {
  return (
    <Text
      style={{
        color,
        fontSize: 22,
        lineHeight: 24,
        fontWeight: "700",
      }}
    >
      {children}
    </Text>
  );
}

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === "unspecified" ? "light" : scheme];
  const { unreadCount } = useNotifications();
  const notificationBadge = formatBadgeCount(unreadCount);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#FF7A00",
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
        tabBarStyle: {
          height: 72,
          paddingTop: 8,
          paddingBottom: 10,
          backgroundColor: colors.background,
          borderTopColor: "#E5E7EB",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Trang chủ",
          tabBarIcon: ({ color }) => <TabIcon color={color}>⌂</TabIcon>,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Tìm xe",
          tabBarIcon: ({ color }) => <TabIcon color={color}>⌕</TabIcon>,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: "Hành trình",
          tabBarIcon: ({ color }) => <TabIcon color={color}>◷</TabIcon>,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Thông báo",
          tabBarBadge: notificationBadge,
          tabBarIcon: ({ color }) => <TabIcon color={color}>!</TabIcon>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Cá nhân",
          tabBarIcon: ({ color }) => <TabIcon color={color}>◉</TabIcon>,
        }}
      />
    </Tabs>
  );
}
