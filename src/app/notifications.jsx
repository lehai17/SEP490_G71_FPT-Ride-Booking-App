import { FlatList, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export default function NotificationsScreen() {
  const theme = useTheme();

  const items = [
    {
      id: "1",
      title: "Tài xế đã đến",
      body: "Tài xế Minh đã đến đón bạn tại Cổng chính",
      date: "1 giờ trước",
    },
    {
      id: "2",
      title: "Khuyến mãi",
      body: "Giảm 20% cho hành khách FPTU hôm nay",
      date: "Hôm qua",
    },
  ];

  return (
    <ThemedView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.content}>
        <ThemedText type="subtitle">Thông báo</ThemedText>
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingTop: Spacing.two }}
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
    padding: Spacing.four,
    maxWidth: MaxContentWidth,
    width: "100%",
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
