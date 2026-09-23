// APP TABS WEB - Thanh tab responsive cho web
// ================================================================
// Comment tiếng Việt được đặt phía trên từng khối để giải thích vai trò code.
// Logic hiện tại được giữ nguyên, chỉ bổ sung mô tả cho dễ đọc/bảo trì.
// ================================================================

import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
} from 'expo-router/ui';
import { SymbolView } from 'expo-symbols';
import { Pressable, useColorScheme, View, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useNotifications } from '@/contexts/notification-context';

const webTabs = [
  // href là route nội bộ của Expo Router; TabTrigger dùng href này để chuyển tab trên web.
  {
    name: 'home',
    href: '/',
    label: 'Trang chủ',
    icon: { ios: 'house.fill', web: 'home' },
  },
  {
    name: 'search',
    href: '/search',
    label: 'Tìm xe',
    icon: { ios: 'magnifyingglass', web: 'search' },
  },
  {
    name: 'trips',
    href: '/trips',
    label: 'Hành trình',
    icon: { ios: 'clock.fill', web: 'history' },
  },
  {
    name: 'notifications',
    href: '/notifications',
    label: 'Thông báo',
    icon: { ios: 'bell.fill', web: 'bell' },
  },
  {
    name: 'profile',
    href: '/profile',
    label: 'Cá nhân',
    icon: { ios: 'person.circle.fill', web: 'person' },
  },
];

// AppTabs: Cấu hình tab bar, icon và badge thông báo
export default function AppTabs() {
  const { unreadCount } = useNotifications();

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          {webTabs.map((tab) => (
            /* TabTrigger nhận href từ webTabs và điều hướng nội bộ, không gọi API. */
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton icon={tab.icon} badgeCount={tab.name === 'notifications' ? unreadCount : 0}>
                {tab.label}
              </TabButton>
            </TabTrigger>
          ))}
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

// TabButton: Nút tab web nhận props điều hướng từ TabTrigger.
// Khi bấm, Expo Router xử lý href ở TabTrigger; component này chỉ render icon, label và badge.
export function TabButton({ children, icon, isFocused, badgeCount = 0, ...props }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const tintColor = isFocused ? colors.text : colors.textSecondary;
  const badgeText = badgeCount > 99 ? '99+' : String(badgeCount || '');

  return (
    /* Nút tab web: onPress/href được TabTrigger truyền qua props để đổi route nội bộ. */
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      {/* Khối tab button view: Nhóm lựa chọn dạng tab/segment để đổi chế độ hiển thị. */}
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.tabButtonView}>
        {/* Khối icon wrap: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
        <View style={styles.iconWrap}>
          <SymbolView tintColor={tintColor} name={icon} size={17} />
          {Boolean(badgeText) && (
            /* Khối badge: Nhãn trạng thái nhỏ giúp người dùng quét thông tin nhanh. */
            <View style={styles.badge}>
              <ThemedText type="smallBold" style={styles.badgeText}>
                {badgeText}
              </ThemedText>
            </View>
          )}
        </View>
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

// CustomTabList: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
export function CustomTabList({ children, ...props }) {
  return (
    /* Khối tab list container: Bố cục bao ngoài, canh lề và giới hạn chiều rộng nội dung. */
    <View {...props} style={styles.tabListContainer}>
      {/* Khối inner container: Bố cục bao ngoài, canh lề và giới hạn chiều rộng nội dung. */}
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        <ThemedText type="smallBold" style={styles.brandText}>
          FPT Ride
        </ThemedText>

        {children}
      </ThemedView>
    </View>
  );
}

// styles: Gom toàn bộ style của màn hình/component ở cuối file
const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  brandText: {
    marginRight: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  iconWrap: {
    position: 'relative',
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -12,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF7A00',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    lineHeight: 12,
  },
});
