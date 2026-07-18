import { FlatList, StyleSheet, View } from "react-native";
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
import { useTheme } from "@/hooks/use-theme";

export default function NotificationsScreen() {
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const items = [];

  return (
    <ThemedView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.content}>
        <ThemedText type="default" style={styles.screenTitle}>
          Thong bao
        </ThemedText>
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: Spacing.two,
            paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four,
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <ThemedText type="smallBold" style={styles.emptyTitle}>
                Chua co thong bao
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Cac cap nhat ve chuyen di se xuat hien tai day.
              </ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.item}>
              <View style={styles.dot} />
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold">{item.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.body}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {item.date}
              </ThemedText>
            </View>
          )}
        />
      </View>
    </ThemedView>
  );
}

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
  },
  emptyTitle: {
    color: "#374151",
  },
  item: {
    flexDirection: "row",
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 6,
    backgroundColor: "#FF7A00",
    marginRight: Spacing.two,
  },
});
