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

export default function AppTabs() {
  const { unreadCount } = useNotifications();

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          {webTabs.map((tab) => (
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

export function TabButton({ children, icon, isFocused, badgeCount = 0, ...props }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const tintColor = isFocused ? colors.text : colors.textSecondary;
  const badgeText = badgeCount > 99 ? '99+' : String(badgeCount || '');

  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.tabButtonView}>
        <View style={styles.iconWrap}>
          <SymbolView tintColor={tintColor} name={icon} size={17} />
          {Boolean(badgeText) && (
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

export function CustomTabList({ children, ...props }) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        <ThemedText type="smallBold" style={styles.brandText}>
          FPT Ride
        </ThemedText>

        {children}
      </ThemedView>
    </View>
  );
}

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
