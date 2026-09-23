// PROFILE SCREEN - Màn đăng nhập, đăng ký, xác minh và hồ sơ khách
// ================================================================
// Comment tiếng Việt được đặt phía trên từng khối để giải thích vai trò code.
// Logic hiện tại được giữ nguyên, chỉ bổ sung mô tả cho dễ đọc/bảo trì.
// ================================================================

import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
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

// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const BRAND = "#FF7A00";
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const BRAND_DARK = "#C75B00";
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const INPUT_BORDER = "#E3E6EA";
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const SOFT_BG = "#FFF4EA";
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const SUCCESS_BG = "#E9F8EE";

// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const EMPTY_LOGIN_FORM = {
  email: "",
  password: "",
};

// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const EMPTY_REGISTER_FORM = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
};

// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const EMPTY_VERIFY_FORM = {
  email: "",
  otp: "",
  password: "",
};

// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const EMPTY_RESET_FORM = {
  email: "",
  otp: "",
  newPassword: "",
  confirmPassword: "",
};

// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const EMPTY_CHANGE_PASSWORD_FORM = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const LOGIN_MESSAGES = {
  emailRequired: "Vui lòng nhập email.",
  emailInvalid: "Email chưa đúng định dạng.",
  passwordRequired: "Vui lòng nhập mật khẩu.",
  passwordTooShort:
    "Mật khẩu phải có ít nhất 6 ký tự.",
  emailNotFound: "Email chưa được đăng ký.",
  incorrectPassword: "Mật khẩu không chính xác.",
  emailNotVerified: "Tài khoản chưa xác minh email.",
  invalidCredentials:
    "Email hoặc mật khẩu không chính xác.",
  loginFailed:
    "Đăng nhập không thành công. Vui lòng thử lại.",
};
// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const REGISTER_MESSAGES = {
  fullNameRequired: "Vui lòng nhập họ và tên.",
  emailRequired: "Vui lòng nhập email.",
  emailInvalid: "Email chưa đúng định dạng.",
  passwordRequired: "Vui lòng nhập mật khẩu.",
  passwordTooShort:
    "Mật khẩu phải có ít nhất 6 ký tự.",
  confirmPasswordRequired:
    "Vui lòng nhập lại mật khẩu.",
  passwordMismatch:
    "Mật khẩu nhập lại không khớp.",
  emailExists:
    "Email này đã được sử dụng. Vui lòng dùng email khác.",
  registerFailed:
    "Đăng ký không thành công. Vui lòng kiểm tra thông tin và thử lại.",
};

// validateLoginForm: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function validateLoginForm(form) {
  const email = form.email.trim();
  const password = form.password.trim();

  if (!email) {
    return LOGIN_MESSAGES.emailRequired;
  }

  if (!EMAIL_PATTERN.test(email)) {
    return LOGIN_MESSAGES.emailInvalid;
  }

  if (!password) {
    return LOGIN_MESSAGES.passwordRequired;
  }

  if (password.length < 6) {
    return LOGIN_MESSAGES.passwordTooShort;
  }

  return "";
}

// getLoginErrorMessage: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getLoginErrorMessage(error) {
  const message = String(error?.message || "");
  const normalizedMessage = message.toLowerCase();
  const isAmbiguousLoginError =
    normalizedMessage.includes("invalid email or password") &&
    normalizedMessage.includes("not verified");

  if (isAmbiguousLoginError) {
    return LOGIN_MESSAGES.invalidCredentials;
  }

  if (
    normalizedMessage.includes("email not found") ||
    normalizedMessage.includes("user not found") ||
    normalizedMessage.includes("email does not exist") ||
    normalizedMessage.includes("email is not registered") ||
    normalizedMessage.includes("email chưa được đăng ký") ||
    normalizedMessage.includes("email không tồn tại")
  ) {
    return LOGIN_MESSAGES.emailNotFound;
  }

  if (
    normalizedMessage.includes("incorrect password") ||
    normalizedMessage.includes("wrong password") ||
    normalizedMessage.includes("invalid password") ||
    normalizedMessage.includes("mật khẩu không chính xác") ||
    normalizedMessage.includes("sai mật khẩu")
  ) {
    return LOGIN_MESSAGES.incorrectPassword;
  }

  if (
    normalizedMessage.includes("email not verified") ||
    normalizedMessage.includes("not verified") ||
    normalizedMessage.includes("not confirmed") ||
    normalizedMessage.includes("chưa xác minh")
  ) {
    return LOGIN_MESSAGES.emailNotVerified;
  }

  if (
    error?.status === 401 ||
    normalizedMessage.includes("invalid email or password") ||
    normalizedMessage.includes("invalid credentials")
  ) {
    return LOGIN_MESSAGES.invalidCredentials;
  }

  return message || LOGIN_MESSAGES.loginFailed;
}

// validateRegisterForm: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function validateRegisterForm(form) {
  const fullName = form.fullName.trim();
  const email = form.email.trim();
  const password = form.password.trim();
  const confirmPassword = form.confirmPassword.trim();

  if (!fullName) {
    return REGISTER_MESSAGES.fullNameRequired;
  }

  if (!email) {
    return REGISTER_MESSAGES.emailRequired;
  }

  if (!EMAIL_PATTERN.test(email)) {
    return REGISTER_MESSAGES.emailInvalid;
  }

  if (!password) {
    return REGISTER_MESSAGES.passwordRequired;
  }

  if (password.length < 6) {
    return REGISTER_MESSAGES.passwordTooShort;
  }

  if (!confirmPassword) {
    return REGISTER_MESSAGES.confirmPasswordRequired;
  }

  if (password !== confirmPassword) {
    return REGISTER_MESSAGES.passwordMismatch;
  }

  return "";
}

// getRegisterErrorMessage: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getRegisterErrorMessage(error) {
  const message = String(error?.message || "");
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("full name is required") ||
    normalizedMessage.includes("full name:") ||
    normalizedMessage.includes("họ và tên")
  ) {
    return REGISTER_MESSAGES.fullNameRequired;
  }

  if (
    normalizedMessage.includes("email is required") ||
    normalizedMessage.includes("email required") ||
    normalizedMessage.includes("vui lòng nhập email")
  ) {
    return REGISTER_MESSAGES.emailRequired;
  }

  if (
    normalizedMessage.includes("invalid email format") ||
    normalizedMessage.includes("email is not a valid email address") ||
    normalizedMessage.includes("email chưa đúng định dạng")
  ) {
    return REGISTER_MESSAGES.emailInvalid;
  }

  if (
    normalizedMessage.includes("password is required") ||
    normalizedMessage.includes("password required") ||
    normalizedMessage.includes("vui lòng nhập mật khẩu")
  ) {
    return REGISTER_MESSAGES.passwordRequired;
  }

  if (
    normalizedMessage.includes("password must be at least 6 characters") ||
    normalizedMessage.includes("password too short") ||
    normalizedMessage.includes("mật khẩu phải có ít nhất 6 ký tự")
  ) {
    return REGISTER_MESSAGES.passwordTooShort;
  }

  if (
    normalizedMessage.includes("confirm password is required") ||
    normalizedMessage.includes("confirm password required") ||
    normalizedMessage.includes("vui lòng nhập lại mật khẩu")
  ) {
    return REGISTER_MESSAGES.confirmPasswordRequired;
  }

  if (
    normalizedMessage.includes("password and confirm password do not match") ||
    normalizedMessage.includes("confirm password does not match") ||
    normalizedMessage.includes("password mismatch") ||
    normalizedMessage.includes("mật khẩu nhập lại không khớp")
  ) {
    return REGISTER_MESSAGES.passwordMismatch;
  }

  if (
    normalizedMessage.includes("already") ||
    normalizedMessage.includes("duplicate") ||
    normalizedMessage.includes("email exists") ||
    normalizedMessage.includes("đã tồn tại")
  ) {
    return REGISTER_MESSAGES.emailExists;
  }

  if (error?.status === 400 || normalizedMessage.includes("/auth/register")) {
    return REGISTER_MESSAGES.registerFailed;
  }

  return message || REGISTER_MESSAGES.registerFailed;
}

// getDisplayRole: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getDisplayRole(role) {
  return role === "Customer" ? "Khách hàng" : role;
}

// formatDate: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function formatDate(value) {
  if (!value) {
    return "Chưa có";
  }

  return new Date(value).toLocaleDateString("vi-VN");
}

// EyeToggleIcon: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function EyeToggleIcon({ visible }) {
  return (
    /* Khối eye icon: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */
    <View style={styles.eyeIcon}>
      {/* Khối eye outline: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
      <View style={styles.eyeOutline} />
      {/* Khối eye pupil: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
      <View style={styles.eyePupil} />
      {visible ? null : <View style={styles.eyeSlash} />}
    </View>
  );
}

// BasicInput: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function BasicInput(props) {
  return (
    /* TextInput: Ô nhập dữ liệu người dùng, thường đi kèm validate và state form. */
    <TextInput
      contextMenuHidden={false}
      caretHidden={false}
      selectTextOnFocus={false}
      {...props}
    />
  );
}

// PasswordInput: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function PasswordInput({
  label,
  value,
  onChangeText,
  placeholder,
  theme,
  visible,
  onToggle,
  inputTestID,
  toggleTestID,
}) {
  return (
    /* Khối password field block: Nhóm label, input và lỗi validate của một trường form. */
    <View style={styles.passwordFieldBlock}>
      <ThemedText type="small">{label}</ThemedText>
      {/* Khối password input wrap: Bao ô nhập và nút phụ như xóa nhanh hoặc chọn gợi ý. */}
      <View
        style={[
          styles.passwordInputWrap,
          {
            backgroundColor: theme.background,
            borderColor: INPUT_BORDER,
          },
        ]}
      >
        <BasicInput
          testID={inputTestID}
          style={[styles.passwordInput, { color: theme.text }]}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
        />
        {/* Pressable: Vùng bấm xử lý thao tác người dùng trong UI. */}
        <Pressable
          testID={toggleTestID}
          style={styles.passwordToggle}
          onPress={onToggle}
          hitSlop={8}
        >
          <EyeToggleIcon visible={visible} />
        </Pressable>
      </View>
    </View>
  );
}

// ProfileScreen: Component chính của tab Hồ sơ/xác thực
export default function ProfileScreen() {
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const {
    session,
    isAuthenticated,
    isSubmitting,
    isRefreshingProfile,
    isRestoringSession,
    rememberSession,
    login,
    register,
    sendVerifyEmailOtp,
    verifyEmailOtp,
    forgotPassword,
    resetPasswordWithOtp,
    changePassword,
    saveProfile,
    logout,
  } = useAuth();

  const [authMode, setAuthMode] = useState("login");
  const [loginForm, setLoginForm] = useState(EMPTY_LOGIN_FORM);
  const [registerForm, setRegisterForm] = useState(EMPTY_REGISTER_FORM);
  const [verifyForm, setVerifyForm] = useState(EMPTY_VERIFY_FORM);
  const [resetPasswordForm, setResetPasswordForm] = useState(EMPTY_RESET_FORM);
  const [changePasswordForm, setChangePasswordForm] = useState(
    EMPTY_CHANGE_PASSWORD_FORM
  );
  const [rememberMe, setRememberMe] = useState(rememberSession);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] =
    useState(false);
  const [showVerifyPassword, setShowVerifyPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [showChangeCurrentPassword, setShowChangeCurrentPassword] =
    useState(false);
  const [showChangeNewPassword, setShowChangeNewPassword] = useState(false);
  const [showChangeConfirmPassword, setShowChangeConfirmPassword] =
    useState(false);
  const [authStep, setAuthStep] = useState("default");
  const [editVisible, setEditVisible] = useState(false);
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [isSendingForgotOtp, setIsSendingForgotOtp] = useState(false);
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
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [successMessage]);

  function openVerificationStep(payload = {}) {
    setVerifyForm({
      email: payload.email ?? "",
      otp: "",
      password: payload.password ?? "",
    });
    setAuthStep("verify-email");
    setShowVerifyPassword(false);
    setErrorMessage("");
    setSuccessMessage("");
  }

  function openResetPasswordStep(prefillEmail = "") {
    setResetPasswordForm({
      email: prefillEmail,
      otp: "",
      newPassword: "",
      confirmPassword: "",
    });
    setAuthStep("reset-password");
    setShowResetPassword(false);
    setShowResetConfirmPassword(false);
    setErrorMessage("");
    setSuccessMessage("");
  }

  function closeAuthStep() {
    setAuthStep("default");
    setVerifyForm(EMPTY_VERIFY_FORM);
    setResetPasswordForm(EMPTY_RESET_FORM);
    setShowVerifyPassword(false);
    setShowResetPassword(false);
    setShowResetConfirmPassword(false);
  }

  async function handleLogin() {
    Keyboard.dismiss();
    setErrorMessage("");
    setSuccessMessage("");

    // handleLogin: LUỒNG GỬI FORM ĐĂNG NHẬP
    // Input lấy từ loginForm trong state, validate email/password trước khi gọi AuthContext.login.
    // AuthContext.login sẽ gửi /auth/login, nhận token, lấy profile, rồi setSession cho toàn app.
    const validationError = validateLoginForm(loginForm);

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const normalizedLoginForm = {
      email: loginForm.email.trim(),
      password: loginForm.password.trim(),
    };

    try {
      // Gửi email/password đã trim; rememberMe quyết định có lưu session xuống storage hay không.
      await login(normalizedLoginForm, { rememberSession: rememberMe });
      setLoginForm(EMPTY_LOGIN_FORM);
      setShowLoginPassword(false);
      setSuccessMessage("Đăng nhập thành công.");
    } catch (error) {
      const nextMessage = getLoginErrorMessage(error);
      const normalizedMessage = String(nextMessage).toLowerCase();
      const isAmbiguousLoginError =
        normalizedMessage.includes("invalid email or password") &&
        normalizedMessage.includes("not verified");
      const isNotVerified =
        (normalizedMessage.includes("not verified") ||
          normalizedMessage.includes("chưa xác minh")) &&
        !isAmbiguousLoginError;

      if (isNotVerified) {
        // Nếu BE báo chưa verify email, giữ lại email/password và chuyển UI sang bước nhập OTP.
        openVerificationStep({
          email: normalizedLoginForm.email,
          password: normalizedLoginForm.password,
        });
        setErrorMessage(
          "Tài khoản chưa xác minh email. Bấm Gửi lại OTP rồi nhập mã để hoàn tất xác minh."
        );
        return;
      }

      setErrorMessage(
        isNotVerified
          ? "Tài khoản chưa xác minh email. Mã OTP chỉ dùng một lần ở bước đăng ký ban đầu."
          : nextMessage
      );
    }
  }

  async function handleRegister() {
    Keyboard.dismiss();
    setErrorMessage("");
    setSuccessMessage("");

    // handleRegister: LUỒNG GỬI FORM ĐĂNG KÝ
    // Input lấy từ registerForm, validate đủ họ tên/email/password/confirmPassword.
    // Sau khi BE tạo tài khoản, UI chuyển sang bước verify OTP.
    const validationError = validateRegisterForm(registerForm);

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const normalizedRegisterForm = {
      fullName: registerForm.fullName.trim(),
      email: registerForm.email.trim(),
      password: registerForm.password.trim(),
      confirmPassword: registerForm.confirmPassword.trim(),
    };

    try {
      // Gửi payload đăng ký sang AuthContext.register -> /auth/register.
      await register(normalizedRegisterForm, { rememberSession: rememberMe });
      // Lưu email/password vào verifyForm để sau khi verify có thể login tự động.
      openVerificationStep({
        email: normalizedRegisterForm.email,
        password: normalizedRegisterForm.password,
      });
      setRegisterForm(EMPTY_REGISTER_FORM);
      setShowRegisterPassword(false);
      setShowRegisterConfirmPassword(false);
      setSuccessMessage(
        "Đăng ký thành công. Vui lòng nhập mã OTP đã gửi về email để xác minh tài khoản."
      );
    } catch (error) {
      setErrorMessage(getRegisterErrorMessage(error));
    }
  }

  async function handleVerifyOtp() {
    Keyboard.dismiss();
    setErrorMessage("");
    setSuccessMessage("");

    try {
      // Gửi email + otp sang BE để xác minh tài khoản.
      await verifyEmailOtp({
        email: verifyForm.email,
        otp: verifyForm.otp,
      });

      if (verifyForm.password) {
        // Nếu đang đi từ đăng ký/login chưa verify, dùng password đã lưu để login ngay sau verify.
        await login(
          {
            email: verifyForm.email,
            password: verifyForm.password,
          },
          { rememberSession: rememberMe }
        );
        setLoginForm(EMPTY_LOGIN_FORM);
        setSuccessMessage("Xác minh OTP thành công và đã đăng nhập.");
      } else {
        // Nếu không có password, chỉ prefill email để user tự đăng nhập.
        setLoginForm((current) => ({
          ...current,
          email: verifyForm.email,
        }));
        setSuccessMessage("Xác minh OTP thành công. Bạn có thể đăng nhập ngay.");
      }

      closeAuthStep();
      setAuthMode("login");
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleResendOtp() {
    Keyboard.dismiss();
    setErrorMessage("");
    setSuccessMessage("");

    try {
      // Gửi lại email lên BE để nhận OTP mới.
      await sendVerifyEmailOtp(verifyForm.email);
      setSuccessMessage("OTP mới đã được gửi về email của bạn.");
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleForgotPassword() {
    Keyboard.dismiss();
    setIsSendingForgotOtp(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      // Gửi email sang BE để phát OTP reset password; UI chỉ hiển thị thông báo bảo mật chung.
      await forgotPassword(resetPasswordForm.email);
      setSuccessMessage("Nếu email tồn tại, OTP đặt lại mật khẩu đã được gửi.");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSendingForgotOtp(false);
    }
  }

  async function handleResetPassword() {
    Keyboard.dismiss();
    setErrorMessage("");
    setSuccessMessage("");

    try {
      // Gửi email + otp + mật khẩu mới sang BE để đổi mật khẩu quên.
      await resetPasswordWithOtp(resetPasswordForm);
      // Sau khi reset thành công, đưa email về form login cho user đăng nhập lại.
      setLoginForm((current) => ({
        ...current,
        email: resetPasswordForm.email,
      }));
      closeAuthStep();
      setAuthMode("login");
      setSuccessMessage("Đặt lại mật khẩu thành công. Bạn có thể đăng nhập ngay.");
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleSaveProfile() {
    Keyboard.dismiss();
    setErrorMessage("");
    setSuccessMessage("");

    try {
      // Gửi editForm sang AuthContext.saveProfile; context nhận profile mới và merge vào session.
      await saveProfile(editForm);
      setEditVisible(false);
      setSuccessMessage("Cập nhật hồ sơ thành công.");
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleChangePassword() {
    Keyboard.dismiss();
    setErrorMessage("");
    setSuccessMessage("");

    try {
      // Gửi currentPassword/newPassword/confirmPassword kèm accessToken qua AuthContext.
      await changePassword(changePasswordForm);
      setChangePasswordForm(EMPTY_CHANGE_PASSWORD_FORM);
      setShowChangeCurrentPassword(false);
      setShowChangeNewPassword(false);
      setShowChangeConfirmPassword(false);
      setChangePasswordVisible(false);
      setSuccessMessage("Đổi mật khẩu thành công.");
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  function handleLogout() {
    // Xóa session trong AuthContext và reset các bước form về trạng thái đăng nhập.
    logout();
    setSuccessMessage("Đã đăng xuất.");
    setErrorMessage("");
    setAuthMode("login");
    closeAuthStep();
  }

  function openEditProfile() {
    setEditForm({
      fullName: session?.fullName ?? "",
      phoneNumber: session?.phoneNumber ?? "",
      avatarUrl: session?.avatarUrl ?? "",
    });
    setEditVisible(true);
  }

  function openChangePasswordModal() {
    setChangePasswordForm(EMPTY_CHANGE_PASSWORD_FORM);
    setShowChangeCurrentPassword(false);
    setShowChangeNewPassword(false);
    setShowChangeConfirmPassword(false);
    setChangePasswordVisible(true);
  }

  const displayInitial = session?.fullName?.charAt(0)?.toUpperCase() ?? "U";

  return (
    <>
      {/* ScrollView: Cho phép nội dung dài cuộn được trên màn hình nhỏ. */}
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={[
          styles.container,
          { paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four },
        ]}
        keyboardShouldPersistTaps="always"
      >
        {/* Khối wrapper: Bố cục bao ngoài, canh lề và giới hạn chiều rộng nội dung. */}
        <View style={[styles.wrapper, { maxWidth: MaxContentWidth }]}>
          <ThemedText type="default" style={styles.screenTitle}>
            Tài khoản
          </ThemedText>

          {errorMessage ? (
            /* Khối message error: Hiển thị lỗi để người dùng biết cần xử lý gì. */
            <View testID="auth-error-message" style={styles.messageError}>
              <ThemedText type="smallBold" style={styles.messageErrorText}>
                {errorMessage}
              </ThemedText>
            </View>
          ) : null}

          {successMessage ? (
            /* Khối message success: Hiển thị thông báo thành công sau thao tác. */
            <View style={styles.messageSuccess}>
              <ThemedText type="smallBold" style={styles.messageSuccessText}>
                {successMessage}
              </ThemedText>
            </View>
          ) : null}

          {isAuthenticated ? (
            <>
              {/* Khối header: Phần đầu của card/modal/màn hình, thường chứa tiêu đề và nút đóng. */}
              <ThemedView
                style={[
                  styles.header,
                  { backgroundColor: theme.backgroundElement },
                ]}
              >
                {/* Khối row top: Dàn các phần tử trên cùng một hàng. */}
                <View style={styles.rowTop}>
                  {/* Khối avatar placeholder: Hiển thị avatar/chữ cái đại diện của người dùng. */}
                  <View style={styles.avatarPlaceholder}>
                    <ThemedText type="subtitle">{displayInitial}</ThemedText>
                  </View>
                  {/* Khối header text: Phần đầu của card/modal/màn hình, thường chứa tiêu đề và nút đóng. */}
                  <View style={styles.headerText}>
                    <ThemedText testID="profile-full-name" type="subtitle">
                      {session.fullName}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {getDisplayRole(session.role) || "Khách hàng"}
                    </ThemedText>
                  </View>
                  {/* Pressable: Vùng bấm xử lý thao tác người dùng trong UI. */}
                  <Pressable style={styles.editButton} onPress={openEditProfile}>
                    <ThemedText type="smallBold">Sửa</ThemedText>
                  </Pressable>
                </View>
              </ThemedView>

              {/* Khối section: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
              <ThemedView
                style={[
                  styles.section,
                  { backgroundColor: theme.backgroundElement },
                ]}
              >
                <ThemedText type="smallBold">Thông tin liên hệ</ThemedText>
                {/* Khối info row: Dàn các phần tử trên cùng một hàng. */}
                <View style={styles.infoRow}>
                  <ThemedText type="small">Email</ThemedText>
                  <ThemedText
                    testID="profile-email"
                    type="small"
                    themeColor="textSecondary"
                  >
                    {session.email}
                  </ThemedText>
                </View>
                {/* Khối info row: Dàn các phần tử trên cùng một hàng. */}
                <View style={styles.infoRow}>
                  <ThemedText type="small">Số điện thoại</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {session.phoneNumber || "Chưa cập nhật"}
                  </ThemedText>
                </View>
                {/* Khối info row: Dàn các phần tử trên cùng một hàng. */}
                <View style={styles.infoRow}>
                  <ThemedText type="small">Ngày tạo</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatDate(session.createdAt)}
                  </ThemedText>
                </View>
              </ThemedView>

              {/* Khối section: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
              <ThemedView
                style={[
                  styles.section,
                  { backgroundColor: theme.backgroundElement },
                ]}
              >
                {/* Header section: Tiêu đề cho một nhóm nội dung trong màn hình. */}
                <View style={styles.sectionHeader}>
                  <ThemedText type="smallBold">Bảo mật tài khoản</ThemedText>
                  {isRefreshingProfile ? (
                    <ActivityIndicator size="small" color={BRAND} />
                  ) : null}
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  Quản lý mật khẩu và phiên đăng nhập trên ứng dụng.
                </ThemedText>

                {/* Nút hành động phụ: điều hướng hoặc đóng bước hiện tại mà không gửi form chính. */}
                <Pressable
                  style={styles.secondaryButton}
                  onPress={openChangePasswordModal}
                >
                  <ThemedText type="smallBold" style={styles.secondaryButtonText}>
                    Đổi mật khẩu
                  </ThemedText>
                </Pressable>

                {/* Pressable: Vùng bấm xử lý thao tác người dùng trong UI. */}
                <Pressable
                  testID="logout-button"
                  style={styles.logoutButton}
                  onPress={handleLogout}
                >
                  <ThemedText type="smallBold" style={styles.logoutText}>
                    Đăng xuất
                  </ThemedText>
                </Pressable>
              </ThemedView>
            </>
          ) : (
            /* Khối auth card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */
            <ThemedView
              style={[
                styles.authCard,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              <ThemedText type="subtitle">Đăng nhập vào FPT Ride</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Đặt xe nhanh hơn và theo dõi các chuyến đi của bạn.
              </ThemedText>

              {isRestoringSession ? (
                /* Khối restoring card: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */
                <View style={styles.restoringCard}>
                  <ActivityIndicator size="small" color={BRAND} />
                  <ThemedText type="small" themeColor="textSecondary">
                    Đang kiểm tra phiên đăng nhập đã ghi nhớ...
                  </ThemedText>
                </View>
              ) : null}

              {/* Khối segmented row: Nhóm lựa chọn dạng tab/segment để đổi chế độ hiển thị. */}
              <View style={styles.segmentedRow}>
                {/* Nút đóng modal/popup đang hiển thị. */}
                <Pressable
                  style={[
                    styles.segmentButton,
                    authMode === "login" && styles.segmentButtonActive,
                  ]}
                  onPress={() => {
                    setAuthMode("login");
                    closeAuthStep();
                  }}
                >
                  <ThemedText
                    type="smallBold"
                    style={[
                      styles.segmentLabel,
                      authMode === "login" && styles.segmentLabelActive,
                    ]}
                  >
                    Đăng nhập
                  </ThemedText>
                </Pressable>
                {/* Nút đóng modal/popup đang hiển thị. */}
                <Pressable
                  style={[
                    styles.segmentButton,
                    authMode === "register" && styles.segmentButtonActive,
                  ]}
                  onPress={() => {
                    setAuthMode("register");
                    closeAuthStep();
                  }}
                >
                  <ThemedText
                    type="smallBold"
                    style={[
                      styles.segmentLabel,
                      authMode === "register" && styles.segmentLabelActive,
                    ]}
                  >
                    Đăng ký
                  </ThemedText>
                </Pressable>
              </View>

              {authStep === "verify-email" ? (
                /* Khối form block: Nhóm label, input và lỗi validate của một trường form. */
                <View style={styles.formBlock}>
                  {/* Khối step header: Phần đầu của card/modal/màn hình, thường chứa tiêu đề và nút đóng. */}
                  <View style={styles.stepHeader}>
                    <ThemedText type="smallBold">Xác minh OTP</ThemedText>
                    {/* Nút hành động phụ: điều hướng hoặc đóng bước hiện tại mà không gửi form chính. */}
                    <Pressable onPress={closeAuthStep}>
                      <ThemedText type="smallBold" style={styles.secondaryLink}>
                        Quay lại
                      </ThemedText>
                    </Pressable>
                  </View>

                  <ThemedText type="small" themeColor="textSecondary">
                    Nhập mã OTP 6 số đã được gửi về email để hoàn tất xác minh tài khoản.
                  </ThemedText>

                  <ThemedText type="small">Email</ThemedText>
                  <BasicInput
                    style={[
                      styles.input,
                      { color: theme.text, backgroundColor: theme.background },
                    ]}
                    value={verifyForm.email}
                    onChangeText={(value) =>
                      setVerifyForm((current) => ({ ...current, email: value }))
                    }
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="nhap@email.com"
                    placeholderTextColor={theme.textSecondary}
                  />

                  <PasswordInput
                    label="Mật khẩu để đăng nhập sau xác minh"
                    value={verifyForm.password}
                    onChangeText={(value) =>
                      setVerifyForm((current) => ({
                        ...current,
                        password: value,
                      }))
                    }
                    placeholder="Bỏ trống nếu chỉ muốn xác minh email"
                    theme={theme}
                    visible={showVerifyPassword}
                    onToggle={() => setShowVerifyPassword((current) => !current)}
                  />

                  <ThemedText type="small">Mã OTP</ThemedText>
                  <BasicInput
                    style={[
                      styles.input,
                      { color: theme.text, backgroundColor: theme.background },
                    ]}
                    value={verifyForm.otp}
                    onChangeText={(value) =>
                      setVerifyForm((current) => ({
                        ...current,
                        otp: value.replace(/[^0-9]/g, "").slice(0, 6),
                      }))
                    }
                    keyboardType="number-pad"
                    placeholder="Nhập 6 số OTP"
                    placeholderTextColor={theme.textSecondary}
                  />

                  {/* Nút hành động chính: gửi dữ liệu người dùng đang nhập lên luồng xử lý. */}
                  <Pressable
                    style={styles.primaryButton}
                    onPress={handleVerifyOtp}
                    disabled={isSubmitting || isRestoringSession}
                  >
                    <ThemedText type="smallBold" style={styles.primaryButtonText}>
                      {isSubmitting ? "Đang xác minh..." : "Xác minh OTP"}
                    </ThemedText>
                  </Pressable>

                  {/* Nút hành động chính: gửi dữ liệu người dùng đang nhập lên luồng xử lý. */}
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={handleResendOtp}
                    disabled={isSubmitting || !verifyForm.email}
                  >
                    <ThemedText type="smallBold" style={styles.secondaryButtonText}>
                      Gửi lại OTP
                    </ThemedText>
                  </Pressable>
                </View>
              ) : authStep === "reset-password" ? (
                /* Khối form block: Nhóm label, input và lỗi validate của một trường form. */
                <View style={styles.formBlock}>
                  {/* Khối step header: Phần đầu của card/modal/màn hình, thường chứa tiêu đề và nút đóng. */}
                  <View style={styles.stepHeader}>
                    <ThemedText type="smallBold">Đặt lại mật khẩu</ThemedText>
                    {/* Nút hành động phụ: điều hướng hoặc đóng bước hiện tại mà không gửi form chính. */}
                    <Pressable onPress={closeAuthStep}>
                      <ThemedText type="smallBold" style={styles.secondaryLink}>
                        Quay lại
                      </ThemedText>
                    </Pressable>
                  </View>

                  <ThemedText type="small" themeColor="textSecondary">
                    Gửi OTP về email trước, sau đó nhập OTP và mật khẩu mới để hoàn tất.
                  </ThemedText>

                  <ThemedText type="small">Email</ThemedText>
                  <BasicInput
                    style={[
                      styles.input,
                      { color: theme.text, backgroundColor: theme.background },
                    ]}
                    value={resetPasswordForm.email}
                    onChangeText={(value) =>
                      setResetPasswordForm((current) => ({
                        ...current,
                        email: value,
                      }))
                    }
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="nhap@email.com"
                    placeholderTextColor={theme.textSecondary}
                  />

                  {/* Nút hành động chính: gửi dữ liệu người dùng đang nhập lên luồng xử lý. */}
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={handleForgotPassword}
                    disabled={
                      isSubmitting || isSendingForgotOtp || !resetPasswordForm.email
                    }
                  >
                    <ThemedText type="smallBold" style={styles.secondaryButtonText}>
                      {isSendingForgotOtp
                        ? "Đang gửi OTP..."
                        : "Gửi OTP quên mật khẩu"}
                    </ThemedText>
                  </Pressable>

                  <ThemedText type="small">Mã OTP</ThemedText>
                  <BasicInput
                    style={[
                      styles.input,
                      { color: theme.text, backgroundColor: theme.background },
                    ]}
                    value={resetPasswordForm.otp}
                    onChangeText={(value) =>
                      setResetPasswordForm((current) => ({
                        ...current,
                        otp: value.replace(/[^0-9]/g, "").slice(0, 6),
                      }))
                    }
                    keyboardType="number-pad"
                    placeholder="Nhập 6 số OTP"
                    placeholderTextColor={theme.textSecondary}
                  />

                  <PasswordInput
                    label="Mật khẩu mới"
                    value={resetPasswordForm.newPassword}
                    onChangeText={(value) =>
                      setResetPasswordForm((current) => ({
                        ...current,
                        newPassword: value,
                      }))
                    }
                    placeholder="Ít nhất 6 ký tự, có hoa, thường và số"
                    theme={theme}
                    visible={showResetPassword}
                    onToggle={() => setShowResetPassword((current) => !current)}
                  />

                  <PasswordInput
                    label="Nhập lại mật khẩu mới"
                    value={resetPasswordForm.confirmPassword}
                    onChangeText={(value) =>
                      setResetPasswordForm((current) => ({
                        ...current,
                        confirmPassword: value,
                      }))
                    }
                    placeholder="Nhập lại mật khẩu mới"
                    theme={theme}
                    visible={showResetConfirmPassword}
                    onToggle={() =>
                      setShowResetConfirmPassword((current) => !current)
                    }
                  />

                  {/* Nút hành động chính: gửi dữ liệu người dùng đang nhập lên luồng xử lý. */}
                  <Pressable
                    style={styles.primaryButton}
                    onPress={handleResetPassword}
                    disabled={isSubmitting || isRestoringSession}
                  >
                    <ThemedText type="smallBold" style={styles.primaryButtonText}>
                      {isSubmitting ? "Đang đặt lại..." : "Đặt lại mật khẩu"}
                    </ThemedText>
                  </Pressable>
                </View>
              ) : authMode === "login" ? (
                /* Khối form block: Nhóm label, input và lỗi validate của một trường form. */
                <View style={styles.formBlock}>
                  <ThemedText type="small">Email</ThemedText>
                  <BasicInput
                    testID="login-email-input"
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

                  <PasswordInput
                    inputTestID="login-password-input"
                    toggleTestID="login-password-toggle"
                    label="Mật khẩu"
                    value={loginForm.password}
                    onChangeText={(value) =>
                      setLoginForm((current) => ({
                        ...current,
                        password: value,
                      }))
                    }
                    placeholder="Tối thiểu 6 ký tự"
                    theme={theme}
                    visible={showLoginPassword}
                    onToggle={() => setShowLoginPassword((current) => !current)}
                  />

                  {/* Pressable: Vùng bấm xử lý thao tác người dùng trong UI. */}
                  <Pressable
                    style={styles.rememberRow}
                    onPress={() => setRememberMe((current) => !current)}
                  >
                    {/* Khối checkbox: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
                    <View
                      style={[
                        styles.checkbox,
                        rememberMe && styles.checkboxActive,
                      ]}
                    >
                      {rememberMe ? <View style={styles.checkboxDot} /> : null}
                    </View>
                    <ThemedText type="small">Ghi nhớ đăng nhập</ThemedText>
                  </Pressable>

                  {/* Nút hành động chính: gửi dữ liệu người dùng đang nhập lên luồng xử lý. */}
                  <Pressable
                    testID="login-submit-button"
                    style={styles.primaryButton}
                    onPress={handleLogin}
                    disabled={isSubmitting || isRestoringSession}
                  >
                    <ThemedText type="smallBold" style={styles.primaryButtonText}>
                      {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
                    </ThemedText>
                  </Pressable>

                  {/* Nút hành động phụ: điều hướng hoặc đóng bước hiện tại mà không gửi form chính. */}
                  <Pressable
                    style={styles.secondaryTextAction}
                    onPress={() => openResetPasswordStep(loginForm.email)}
                  >
                    <ThemedText type="smallBold" style={styles.secondaryLink}>
                      Quên mật khẩu?
                    </ThemedText>
                  </Pressable>
                </View>
              ) : (
                /* Khối form block: Nhóm label, input và lỗi validate của một trường form. */
                <View style={styles.formBlock}>
                  <ThemedText type="small">Họ và tên</ThemedText>
                  <BasicInput
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
                    placeholder="Nguyễn Văn A"
                    placeholderTextColor={theme.textSecondary}
                  />

                  <ThemedText type="small">Email</ThemedText>
                  <BasicInput
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

                  <PasswordInput
                    label="Mật khẩu"
                    value={registerForm.password}
                    onChangeText={(value) =>
                      setRegisterForm((current) => ({
                        ...current,
                        password: value,
                      }))
                    }
                    placeholder="Tối thiểu 6 ký tự"
                    theme={theme}
                    visible={showRegisterPassword}
                    onToggle={() =>
                      setShowRegisterPassword((current) => !current)
                    }
                  />

                  <PasswordInput
                    label="Nhập lại mật khẩu"
                    value={registerForm.confirmPassword}
                    onChangeText={(value) =>
                      setRegisterForm((current) => ({
                        ...current,
                        confirmPassword: value,
                      }))
                    }
                    placeholder="Nhập lại mật khẩu"
                    theme={theme}
                    visible={showRegisterConfirmPassword}
                    onToggle={() =>
                      setShowRegisterConfirmPassword((current) => !current)
                    }
                  />

                  {/* Pressable: Vùng bấm xử lý thao tác người dùng trong UI. */}
                  <Pressable
                    style={styles.rememberRow}
                    onPress={() => setRememberMe((current) => !current)}
                  >
                    {/* Khối checkbox: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
                    <View
                      style={[
                        styles.checkbox,
                        rememberMe && styles.checkboxActive,
                      ]}
                    >
                      {rememberMe ? <View style={styles.checkboxDot} /> : null}
                    </View>
                    <ThemedText type="small">Ghi nhớ đăng nhập</ThemedText>
                  </Pressable>

                  {/* Nút hành động chính: gửi dữ liệu người dùng đang nhập lên luồng xử lý. */}
                  <Pressable
                    style={styles.primaryButton}
                    onPress={handleRegister}
                    disabled={isSubmitting || isRestoringSession}
                  >
                    <ThemedText type="smallBold" style={styles.primaryButtonText}>
                      {isSubmitting ? "Đang đăng ký..." : "Tạo tài khoản"}
                    </ThemedText>
                  </Pressable>
                </View>
              )}
            </ThemedView>
          )}
        </View>
      </ScrollView>

      {/* Modal: Lớp giao diện nổi dùng để xác nhận, nhập form hoặc thông báo mà không rời màn hiện tại. */}
      <Modal visible={editVisible} animationType="slide" transparent={false}>
        {/* ScrollView: Cho phép nội dung dài cuộn được trên màn hình nhỏ. */}
        <ScrollView
          style={{ backgroundColor: theme.background }}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="always"
        >
          {/* Khối wrapper: Bố cục bao ngoài, canh lề và giới hạn chiều rộng nội dung. */}
          <View style={[styles.wrapper, { maxWidth: MaxContentWidth }]}>
            {/* Khối modal header: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">Chỉnh sửa hồ sơ</ThemedText>
              {/* Nút đóng modal/popup đang hiển thị. */}
              <Pressable
                onPress={() => setEditVisible(false)}
                style={styles.closeButton}
              >
                <ThemedText type="subtitle">×</ThemedText>
              </Pressable>
            </View>

            {/* Khối section: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
            <ThemedView
              style={[
                styles.section,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              <ThemedText type="small">Họ và tên</ThemedText>
              <BasicInput
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

              <ThemedText type="small">Số điện thoại</ThemedText>
              <BasicInput
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

              <ThemedText type="small">Đường dẫn ảnh đại diện</ThemedText>
              <BasicInput
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

              {/* Nút hành động chính: gửi dữ liệu người dùng đang nhập lên luồng xử lý. */}
              <Pressable
                style={styles.primaryButton}
                onPress={handleSaveProfile}
                disabled={isSubmitting}
              >
                <ThemedText type="smallBold" style={styles.primaryButtonText}>
                  {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
                </ThemedText>
              </Pressable>
            </ThemedView>
          </View>
        </ScrollView>
      </Modal>

      {/* Modal: Lớp giao diện nổi dùng để xác nhận, nhập form hoặc thông báo mà không rời màn hiện tại. */}
      <Modal
        visible={changePasswordVisible}
        animationType="slide"
        transparent={false}
      >
        {/* ScrollView: Cho phép nội dung dài cuộn được trên màn hình nhỏ. */}
        <ScrollView
          style={{ backgroundColor: theme.background }}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="always"
        >
          {/* Khối wrapper: Bố cục bao ngoài, canh lề và giới hạn chiều rộng nội dung. */}
          <View style={[styles.wrapper, { maxWidth: MaxContentWidth }]}>
            {/* Khối modal header: Lớp popup/modal nổi phía trên màn hình để nhập, xác nhận hoặc báo lỗi. */}
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">Đổi mật khẩu</ThemedText>
              {/* Nút đóng modal/popup đang hiển thị. */}
              <Pressable
                onPress={() => setChangePasswordVisible(false)}
                style={styles.closeButton}
              >
                <ThemedText type="subtitle">×</ThemedText>
              </Pressable>
            </View>

            {/* Khối section: Nhóm UI con để màn hình rõ bố cục và dễ chỉnh sửa. */}
            <ThemedView
              style={[
                styles.section,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              <PasswordInput
                label="Mật khẩu hiện tại"
                value={changePasswordForm.currentPassword}
                onChangeText={(value) =>
                  setChangePasswordForm((current) => ({
                    ...current,
                    currentPassword: value,
                  }))
                }
                placeholder="Nhập mật khẩu hiện tại"
                theme={theme}
                visible={showChangeCurrentPassword}
                onToggle={() =>
                  setShowChangeCurrentPassword((current) => !current)
                }
              />

              <PasswordInput
                label="Mật khẩu mới"
                value={changePasswordForm.newPassword}
                onChangeText={(value) =>
                  setChangePasswordForm((current) => ({
                    ...current,
                    newPassword: value,
                  }))
                }
                placeholder="Ít nhất 6 ký tự, có hoa, thường và số"
                theme={theme}
                visible={showChangeNewPassword}
                onToggle={() => setShowChangeNewPassword((current) => !current)}
              />

              <PasswordInput
                label="Nhập lại mật khẩu mới"
                value={changePasswordForm.confirmPassword}
                onChangeText={(value) =>
                  setChangePasswordForm((current) => ({
                    ...current,
                    confirmPassword: value,
                  }))
                }
                placeholder="Nhập lại mật khẩu mới"
                theme={theme}
                visible={showChangeConfirmPassword}
                onToggle={() =>
                  setShowChangeConfirmPassword((current) => !current)
                }
              />

              {/* Nút hành động chính: gửi dữ liệu người dùng đang nhập lên luồng xử lý. */}
              <Pressable
                style={styles.primaryButton}
                onPress={handleChangePassword}
                disabled={isSubmitting}
              >
                <ThemedText type="smallBold" style={styles.primaryButtonText}>
                  {isSubmitting ? "Đang đổi mật khẩu..." : "Xác nhận đổi mật khẩu"}
                </ThemedText>
              </Pressable>
            </ThemedView>
          </View>
        </ScrollView>
      </Modal>
    </>
  );
}

// styles: Gom toàn bộ style của màn hình/component ở cuối file
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
  restoringCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.one,
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
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  input: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    marginBottom: Spacing.one,
  },
  passwordFieldBlock: {
    gap: Spacing.two,
  },
  passwordInputWrap: {
    minHeight: 52,
    borderRadius: Spacing.two,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
    marginBottom: Spacing.one,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: Spacing.three,
  },
  passwordToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  eyeIcon: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  eyeOutline: {
    width: 18,
    height: 12,
    borderWidth: 1.6,
    borderColor: "#697586",
    borderRadius: 12,
  },
  eyePupil: {
    position: "absolute",
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#697586",
  },
  eyeSlash: {
    position: "absolute",
    width: 20,
    height: 1.8,
    backgroundColor: "#697586",
    transform: [{ rotate: "-35deg" }],
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#D0D5DD",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  checkboxActive: {
    borderColor: BRAND,
    backgroundColor: SOFT_BG,
  },
  checkboxDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BRAND,
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
  secondaryButton: {
    minHeight: 44,
    borderRadius: Spacing.five,
    borderWidth: 1,
    borderColor: "#FFD2AE",
    backgroundColor: "#FFF8F2",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: BRAND_DARK,
  },
  secondaryTextAction: {
    alignSelf: "flex-start",
    paddingTop: Spacing.one,
  },
  secondaryLink: {
    color: BRAND_DARK,
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
