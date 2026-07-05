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

export default function TripsScreen() {
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const [selectedTab, setSelectedTab] = useState("history");
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [ratingDraft, setRatingDraft] = useState(5);
  const [reviewDraft, setReviewDraft] = useState("");
  const [ratingsByTripId, setRatingsByTripId] = useState({});

  const items = tripSections[selectedTab] ?? [];

  function handlePrimaryAction(item) {
    if (item.actionPrimary !== "Đánh giá") {
      return;
    }

    setSelectedTrip(item);
    setRatingDraft(item.rating ?? 5);
    setReviewDraft("");
    setRatingModalVisible(true);
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
                      onPress={() => handlePrimaryAction(item)}
                    >
                      <ThemedText type="small" style={styles.outlineActionText}>
                        {item.actionPrimary}
                      </ThemedText>
                    </Pressable>

                    <Pressable style={styles.outlineAction}>
                      <ThemedText type="small" style={styles.outlineActionText}>
                        {item.actionSecondary}
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
  modalPrimaryButtonText: {
    color: "#FFFFFF",
  },
});
