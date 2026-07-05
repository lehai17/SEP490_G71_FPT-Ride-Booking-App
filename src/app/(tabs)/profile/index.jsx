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

export default function ProfileScreen() {
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const [editVisible, setEditVisible] = useState(false);

  // This screen is a full UI scaffold — backend should supply `user` object
  const [user, setUser] = useState({
    name: "Lê Nguyễn Đăng Hải",
    studentId: "HE182237",
    email: "hai.ln@example.com",
    phone: "+84 912 345 678",
    avatarUrl: null,
  });

  const [editForm, setEditForm] = useState(user);

  function handleSave() {
    console.log("Saved profile", editForm);
    setUser(editForm);
    setEditVisible(false);
  }

  return (
    <>
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={[
          styles.container,
          { paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four },
        ]}
      >
        <View style={[styles.wrapper, { maxWidth: MaxContentWidth }]}>
          <ThemedText type="default" style={styles.screenTitle}>
            Cá nhân
          </ThemedText>

          <ThemedView
            style={[
              styles.header,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            <View style={styles.rowTop}>
              <View style={styles.avatarPlaceholder}>
                <ThemedText type="subtitle">
                  {user.name?.charAt(0) ?? "U"}
                </ThemedText>
              </View>
              <View style={styles.headerText}>
                <ThemedText type="subtitle">{user.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  MSSV: {user.studentId}
                </ThemedText>
              </View>
              <Pressable
                style={styles.editButton}
                onPress={() => {
                  setEditForm(user);
                  setEditVisible(true);
                }}
              >
                <ThemedText type="smallBold">Sửa</ThemedText>
              </Pressable>
            </View>
          </ThemedView>

          <ThemedView
            style={[
              styles.section,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            <ThemedText type="smallBold">Thông tin liên hệ</ThemedText>
            <View style={styles.infoRow}>
              <ThemedText type="small">Email</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {user.email}
              </ThemedText>
            </View>
            <View style={styles.infoRow}>
              <ThemedText type="small">Số điện thoại</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {user.phone}
              </ThemedText>
            </View>
          </ThemedView>

          <ThemedView
            style={[
              styles.section,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            <ThemedText type="smallBold">Tùy chọn tài khoản</ThemedText>
            <Pressable style={styles.actionRow}>
              <ThemedText type="small">Ngôn ngữ</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Tiếng Việt
              </ThemedText>
            </Pressable>
            <Pressable style={styles.actionRow}>
              <ThemedText type="small" style={{ color: "#FF3B30" }}>
                Đăng xuất
              </ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </ScrollView>

      <Modal visible={editVisible} animationType="slide" transparent={false}>
        <ScrollView
          style={{ backgroundColor: theme.background }}
          contentContainerStyle={styles.container}
        >
          <View style={[styles.wrapper, { maxWidth: MaxContentWidth }]}>
            <View style={styles.headerRow}>
              <ThemedText type="subtitle">Chỉnh sửa hồ sơ</ThemedText>
              <Pressable
                onPress={() => setEditVisible(false)}
                style={styles.closeButton}
              >
                <ThemedText type="subtitle">✕</ThemedText>
              </Pressable>
            </View>

            <ThemedView
              style={[
                styles.section,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              <ThemedText type="small">Họ và tên</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.background },
                ]}
                value={editForm.name}
                onChangeText={(val) => setEditForm({ ...editForm, name: val })}
                placeholderTextColor={theme.textSecondary}
              />

              <ThemedText type="small">MSSV</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.background },
                ]}
                value={editForm.studentId}
                onChangeText={(val) =>
                  setEditForm({ ...editForm, studentId: val })
                }
                placeholderTextColor={theme.textSecondary}
              />

              <ThemedText type="small">Email</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.background },
                ]}
                value={editForm.email}
                onChangeText={(val) => setEditForm({ ...editForm, email: val })}
                keyboardType="email-address"
                placeholderTextColor={theme.textSecondary}
              />

              <ThemedText type="small">Số điện thoại</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.background },
                ]}
                value={editForm.phone}
                onChangeText={(val) => setEditForm({ ...editForm, phone: val })}
                keyboardType="phone-pad"
                placeholderTextColor={theme.textSecondary}
              />

              <Pressable style={styles.saveButton} onPress={handleSave}>
                <ThemedText type="smallBold">Lưu</ThemedText>
              </Pressable>
            </ThemedView>
          </View>
        </ScrollView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingTop: ScreenHeaderTop,
  },
  wrapper: {
    width: "100%",
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  screenTitle: {
    ...ScreenTitleStyle,
  },
  header: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  rowTop: { flexDirection: "row", alignItems: "center", gap: Spacing.four },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
  },
  headerText: { flex: 1 },
  editButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    backgroundColor: "#E6F0FF",
    justifyContent: "center",
    alignItems: "center",
  },
  section: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.one,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.two,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.four,
  },
  closeButton: {
    padding: Spacing.two,
  },
  input: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: "#E3E6EA",
    marginBottom: Spacing.two,
  },
  saveButton: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.five,
    backgroundColor: "#FF7A00",
    alignItems: "center",
  },
});
