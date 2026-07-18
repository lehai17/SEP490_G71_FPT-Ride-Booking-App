import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/hooks/use-theme";

const BRAND = "#FF7A00";
const BRAND_DARK = "#C75B00";
const INPUT_BORDER = "#E3E6EA";
const SOFT_BG = "#FFF4EA";
const SUCCESS_BG = "#E9F8EE";

const EMPTY_LOGIN_FORM = {
  email: "",
  password: "",
};

const EMPTY_REGISTER_FORM = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
};

function formatDate(value) {
  if (!value) {
    return "Chua co";
  }

  return new Date(value).toLocaleDateString("vi-VN");
}

export default function ProfileScreen() {
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const {
    session,
    isAuthenticated,
    isSubmitting,
    isRefreshingProfile,
    login,
    register,
    saveProfile,
    logout,
  } = useAuth();
  const [authMode, setAuthMode] = useState("login");
  const [loginForm, setLoginForm] = useState(EMPTY_LOGIN_FORM);
  const [registerForm, setRegisterForm] = useState(EMPTY_REGISTER_FORM);
  const [editVisible, setEditVisible] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: "",
    phoneNumber: "",
    avatarUrl: "",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!successMessage) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setSuccessMessage("");
    }, 5000);

    return () => clearTimeout(timeoutId);
  }, [successMessage]);

  async function handleLogin() {
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await login(loginForm);
      setLoginForm(EMPTY_LOGIN_FORM);
      setSuccessMessage("Dang nhap thanh cong.");
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleRegister() {
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await register(registerForm);
      setRegisterForm(EMPTY_REGISTER_FORM);
      setLoginForm(EMPTY_LOGIN_FORM);
      setSuccessMessage("Dang ky thanh cong va da dang nhap.");
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleSaveProfile() {
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await saveProfile(editForm);
      setEditVisible(false);
      setSuccessMessage("Cap nhat ho so thanh cong.");
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  function handleLogout() {
    logout();
    setSuccessMessage("Da dang xuat.");
    setErrorMessage("");
    setAuthMode("login");
  }

  function openEditProfile() {
    setEditForm({
      fullName: session?.fullName ?? "",
      phoneNumber: session?.phoneNumber ?? "",
      avatarUrl: session?.avatarUrl ?? "",
    });
    setEditVisible(true);
  }

  const displayInitial = session?.fullName?.charAt(0)?.toUpperCase() ?? "U";

  return (
    <>
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={[
          styles.container,
          { paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.wrapper, { maxWidth: MaxContentWidth }]}>
          <ThemedText type="default" style={styles.screenTitle}>
            Tai khoan
          </ThemedText>

          {errorMessage ? (
            <View style={styles.messageError}>
              <ThemedText type="smallBold" style={styles.messageErrorText}>
                {errorMessage}
              </ThemedText>
            </View>
          ) : null}

          {successMessage ? (
            <View style={styles.messageSuccess}>
              <ThemedText type="smallBold" style={styles.messageSuccessText}>
                {successMessage}
              </ThemedText>
            </View>
          ) : null}

          {isAuthenticated ? (
            <>
              <ThemedView
                style={[
                  styles.header,
                  { backgroundColor: theme.backgroundElement },
                ]}
              >
                <View style={styles.rowTop}>
                  <View style={styles.avatarPlaceholder}>
                    <ThemedText type="subtitle">{displayInitial}</ThemedText>
                  </View>
                  <View style={styles.headerText}>
                    <ThemedText type="subtitle">{session.fullName}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {session.role || "Customer"}
                    </ThemedText>
                  </View>
                  <Pressable
                    style={styles.editButton}
                    onPress={openEditProfile}
                  >
                    <ThemedText type="smallBold">Sua</ThemedText>
                  </Pressable>
                </View>
              </ThemedView>

              <ThemedView
                style={[
                  styles.section,
                  { backgroundColor: theme.backgroundElement },
                ]}
              >
                <ThemedText type="smallBold">Thong tin lien he</ThemedText>
                <View style={styles.infoRow}>
                  <ThemedText type="small">Email</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {session.email}
                  </ThemedText>
                </View>
                <View style={styles.infoRow}>
                  <ThemedText type="small">So dien thoai</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {session.phoneNumber || "Chua cap nhat"}
                  </ThemedText>
                </View>
                <View style={styles.infoRow}>
                  <ThemedText type="small">Ngay tao</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatDate(session.createdAt)}
                  </ThemedText>
                </View>
              </ThemedView>

              <ThemedView
                style={[
                  styles.section,
                  { backgroundColor: theme.backgroundElement },
                ]}
              >
                <View style={styles.sectionHeader}>
                  <ThemedText type="smallBold">Tai khoan cua ban</ThemedText>
                  {isRefreshingProfile ? (
                    <ActivityIndicator size="small" color={BRAND} />
                  ) : null}
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  Quan ly thong tin ca nhan va phien dang nhap tren ung dung.
                </ThemedText>
                <Pressable style={styles.logoutButton} onPress={handleLogout}>
                  <ThemedText type="smallBold" style={styles.logoutText}>
                    Dang xuat
                  </ThemedText>
                </Pressable>
              </ThemedView>
            </>
          ) : (
            <ThemedView
              style={[
                styles.authCard,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              <ThemedText type="subtitle">Dang nhap vao FPT Ride</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Dat xe nhanh hon va theo doi cac chuyen di cua ban.
              </ThemedText>

              <View style={styles.segmentedRow}>
                <Pressable
                  style={[
                    styles.segmentButton,
                    authMode === "login" && styles.segmentButtonActive,
                  ]}
                  onPress={() => setAuthMode("login")}
                >
                  <ThemedText
                    type="smallBold"
                    style={[
                      styles.segmentLabel,
                      authMode === "login" && styles.segmentLabelActive,
                    ]}
                  >
                    Dang nhap
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[
                    styles.segmentButton,
                    authMode === "register" && styles.segmentButtonActive,
                  ]}
                  onPress={() => setAuthMode("register")}
                >
                  <ThemedText
                    type="smallBold"
                    style={[
                      styles.segmentLabel,
                      authMode === "register" && styles.segmentLabelActive,
                    ]}
                  >
                    Dang ky
                  </ThemedText>
                </Pressable>
              </View>

              {authMode === "login" ? (
                <View style={styles.formBlock}>
                  <ThemedText type="small">Email</ThemedText>
                  <TextInput
                    style={[
                      styles.input,
                      { color: theme.text, backgroundColor: theme.background },
                    ]}
                    value={loginForm.email}
                    onChangeText={(value) =>
                      setLoginForm((current) => ({ ...current, email: value }))
                    }
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="nhap@email.com"
                    placeholderTextColor={theme.textSecondary}
                  />

                  <ThemedText type="small">Mat khau</ThemedText>
                  <TextInput
                    style={[
                      styles.input,
                      { color: theme.text, backgroundColor: theme.background },
                    ]}
                    value={loginForm.password}
                    onChangeText={(value) =>
                      setLoginForm((current) => ({
                        ...current,
                        password: value,
                      }))
                    }
                    secureTextEntry
                    placeholder="Toi thieu 6 ky tu"
                    placeholderTextColor={theme.textSecondary}
                  />

                  <Pressable
                    style={styles.primaryButton}
                    onPress={handleLogin}
                    disabled={isSubmitting}
                  >
                    <ThemedText type="smallBold" style={styles.primaryButtonText}>
                      {isSubmitting ? "Dang dang nhap..." : "Dang nhap"}
                    </ThemedText>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.formBlock}>
                  <ThemedText type="small">Ho va ten</ThemedText>
                  <TextInput
                    style={[
                      styles.input,
                      { color: theme.text, backgroundColor: theme.background },
                    ]}
                    value={registerForm.fullName}
                    onChangeText={(value) =>
                      setRegisterForm((current) => ({
                        ...current,
                        fullName: value,
                      }))
                    }
                    placeholder="Nguyen Van A"
                    placeholderTextColor={theme.textSecondary}
                  />

                  <ThemedText type="small">Email</ThemedText>
                  <TextInput
                    style={[
                      styles.input,
                      { color: theme.text, backgroundColor: theme.background },
                    ]}
                    value={registerForm.email}
                    onChangeText={(value) =>
                      setRegisterForm((current) => ({ ...current, email: value }))
                    }
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="nhap@email.com"
                    placeholderTextColor={theme.textSecondary}
                  />

                  <ThemedText type="small">Mat khau</ThemedText>
                  <TextInput
                    style={[
                      styles.input,
                      { color: theme.text, backgroundColor: theme.background },
                    ]}
                    value={registerForm.password}
                    onChangeText={(value) =>
                      setRegisterForm((current) => ({
                        ...current,
                        password: value,
                      }))
                    }
                    secureTextEntry
                    placeholder="Toi thieu 6 ky tu"
                    placeholderTextColor={theme.textSecondary}
                  />

                  <ThemedText type="small">Nhap lai mat khau</ThemedText>
                  <TextInput
                    style={[
                      styles.input,
                      { color: theme.text, backgroundColor: theme.background },
                    ]}
                    value={registerForm.confirmPassword}
                    onChangeText={(value) =>
                      setRegisterForm((current) => ({
                        ...current,
                        confirmPassword: value,
                      }))
                    }
                    secureTextEntry
                    placeholder="Nhap lai mat khau"
                    placeholderTextColor={theme.textSecondary}
                  />

                  <Pressable
                    style={styles.primaryButton}
                    onPress={handleRegister}
                    disabled={isSubmitting}
                  >
                    <ThemedText type="smallBold" style={styles.primaryButtonText}>
                      {isSubmitting ? "Dang dang ky..." : "Tao tai khoan"}
                    </ThemedText>
                  </Pressable>
                </View>
              )}
            </ThemedView>
          )}
        </View>
      </ScrollView>

      <Modal visible={editVisible} animationType="slide" transparent={false}>
        <ScrollView
          style={{ backgroundColor: theme.background }}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.wrapper, { maxWidth: MaxContentWidth }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">Chinh sua ho so</ThemedText>
              <Pressable
                onPress={() => setEditVisible(false)}
                style={styles.closeButton}
              >
                <ThemedText type="subtitle">x</ThemedText>
              </Pressable>
            </View>

            <ThemedView
              style={[
                styles.section,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              <ThemedText type="small">Ho va ten</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.background },
                ]}
                value={editForm.fullName}
                onChangeText={(value) =>
                  setEditForm((current) => ({ ...current, fullName: value }))
                }
                placeholderTextColor={theme.textSecondary}
              />

              <ThemedText type="small">So dien thoai</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.background },
                ]}
                value={editForm.phoneNumber}
                onChangeText={(value) =>
                  setEditForm((current) => ({ ...current, phoneNumber: value }))
                }
                keyboardType="phone-pad"
                placeholder="0912345678"
                placeholderTextColor={theme.textSecondary}
              />

              <ThemedText type="small">Avatar URL</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.background },
                ]}
                value={editForm.avatarUrl}
                onChangeText={(value) =>
                  setEditForm((current) => ({ ...current, avatarUrl: value }))
                }
                autoCapitalize="none"
                placeholder="https://example.com/avatar.jpg"
                placeholderTextColor={theme.textSecondary}
              />

              <Pressable
                style={styles.primaryButton}
                onPress={handleSaveProfile}
                disabled={isSubmitting}
              >
                <ThemedText type="smallBold" style={styles.primaryButtonText}>
                  {isSubmitting ? "Dang luu..." : "Luu thay doi"}
                </ThemedText>
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
  messageError: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    backgroundColor: "#FDECEC",
    borderWidth: 1,
    borderColor: "#F5B7B7",
  },
  messageErrorText: {
    color: "#B42318",
  },
  messageSuccess: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    backgroundColor: SUCCESS_BG,
    borderWidth: 1,
    borderColor: "#A9D8B6",
  },
  messageSuccessText: {
    color: "#166534",
  },
  authCard: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  segmentedRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  segmentButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: Spacing.five,
    borderWidth: 1,
    borderColor: "#FFD2AE",
    backgroundColor: "#FFF8F2",
    alignItems: "center",
    justifyContent: "center",
  },
  segmentButtonActive: {
    backgroundColor: BRAND,
    borderColor: BRAND,
  },
  segmentLabel: {
    color: BRAND_DARK,
  },
  segmentLabelActive: {
    color: "#FFFFFF",
  },
  formBlock: {
    gap: Spacing.two,
  },
  input: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    marginBottom: Spacing.one,
  },
  primaryButton: {
    marginTop: Spacing.two,
    minHeight: 48,
    borderRadius: Spacing.five,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
  },
  header: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.four,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: SOFT_BG,
  },
  headerText: {
    flex: 1,
  },
  editButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    backgroundColor: SOFT_BG,
    justifyContent: "center",
    alignItems: "center",
  },
  section: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.one,
    gap: Spacing.three,
  },
  logoutButton: {
    marginTop: Spacing.two,
    minHeight: 44,
    borderRadius: Spacing.five,
    borderWidth: 1,
    borderColor: "#F5B7B7",
    backgroundColor: "#FFF5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: {
    color: "#B42318",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.one,
  },
  closeButton: {
    padding: Spacing.two,
  },
});
