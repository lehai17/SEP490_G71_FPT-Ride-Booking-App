// AUTH CONTEXT - Quản lý đăng nhập, phiên người dùng và hồ sơ khách
// ================================================================
// Comment tiếng Việt được đặt phía trên từng khối để giải thích vai trò code.
// Logic hiện tại được giữ nguyên, chỉ bổ sung mô tả cho dễ đọc/bảo trì.
// ================================================================

import { createContext, useContext, useEffect, useState } from "react";

import * as authApi from "@/features/auth/services/auth-api";
import {
  deletePersistentItem,
  getPersistentItem,
  setPersistentItem,
} from "@/services/persistent-storage";

const AuthContext = createContext(null);

// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const SESSION_STORAGE_KEY = "fpt-ride.auth.session";

// buildSession: Gom login response và profile response thành session thống nhất
function buildSession(loginResponse, profileResponse) {
  return {
    accessToken: loginResponse.accessToken,
    refreshToken: loginResponse.refreshToken ?? null,
    expiresAt: loginResponse.expiresAt,
    userId: loginResponse.userId,
    fullName: profileResponse?.fullName ?? loginResponse.fullName,
    email: profileResponse?.email ?? loginResponse.email,
    phoneNumber: profileResponse?.phoneNumber ?? null,
    avatarUrl: profileResponse?.avatarUrl ?? loginResponse.avatarUrl ?? null,
    role: profileResponse?.role ?? loginResponse.role,
    createdAt: profileResponse?.createdAt ?? null,
  };
}

async function persistSession(session) {
  await setPersistentItem(
    SESSION_STORAGE_KEY,
    JSON.stringify(session ?? null)
  );
}

async function clearPersistedSession() {
  await deletePersistentItem(SESSION_STORAGE_KEY);
}

// AuthProvider: Provider giữ session, token và các hành động xác thực
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [rememberSession, setRememberSession] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // restoreSession: LUỒNG NHẬN DỮ LIỆU KHI MỞ APP
    // 1. Đọc session đã lưu trong SecureStore/localStorage bằng SESSION_STORAGE_KEY.
    // 2. Nếu có refreshToken thì gửi lên /auth/refresh-token để nhận token mới.
    // 3. Dùng accessToken + userId gọi /auth/profile/{userId} để lấy hồ sơ mới nhất.
    // 4. Merge token + profile thành session rồi setSession để toàn app dùng.
    // 5. Nếu token/profile lỗi thì xóa cache và đưa app về trạng thái chưa đăng nhập.
    async function restoreSession() {
      try {
        const storedSession = await getPersistentItem(SESSION_STORAGE_KEY);

        if (!storedSession) {
          if (isMounted) {
            setRememberSession(false);
          }
          return;
        }

        const parsedSession = JSON.parse(storedSession);

        if (
          (!parsedSession?.accessToken && !parsedSession?.refreshToken) ||
          !parsedSession?.userId
        ) {
          await clearPersistedSession();

          if (isMounted) {
            setRememberSession(false);
          }

          return;
        }

        if (!isMounted) {
          return;
        }

        let sessionToRestore = parsedSession;
        setRememberSession(true);

        if (parsedSession.refreshToken) {
          try {
            const refreshedAuth = await authApi.refreshToken(
              parsedSession.refreshToken
            );

            sessionToRestore = buildSession(refreshedAuth, parsedSession);
          } catch {
            sessionToRestore = parsedSession;
          }
        }

        setSession(sessionToRestore);

        try {
          const profile = await authApi.getProfile(
            sessionToRestore.userId,
            sessionToRestore.accessToken
          );
          const refreshedSession = buildSession(sessionToRestore, profile);

          if (isMounted) {
            setSession(refreshedSession);
          }

          await persistSession(refreshedSession);
        } catch {
          await clearPersistedSession();

          if (isMounted) {
            setSession(null);
            setRememberSession(false);
          }
        }
      } finally {
        if (isMounted) {
          setIsRestoringSession(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  async function refreshProfile(nextSession = session, shouldPersist = rememberSession) {
    if (!nextSession?.accessToken || !nextSession?.userId) {
      return null;
    }

    setIsRefreshingProfile(true);

    try {
      // Gửi userId + accessToken lên BE để nhận profile mới nhất.
      // Response profile sẽ được merge vào session hiện tại để Home/Profile hiển thị đúng tên, email, role.
      const profile = await authApi.getProfile(
        nextSession.userId,
        nextSession.accessToken
      );

      let updatedSession = null;

      setSession((currentSession) => {
        const activeSession =
          currentSession?.userId === nextSession.userId
            ? currentSession
            : nextSession;

        updatedSession = buildSession(activeSession, profile);
        return updatedSession;
      });

      if (shouldPersist && updatedSession) {
        await persistSession(updatedSession);
      }

      return profile;
    } finally {
      setIsRefreshingProfile(false);
    }
  }

  async function refreshSession() {
    const currentSession = session;

    if (!currentSession?.refreshToken) {
      throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    }

    // Gửi refreshToken đang có để nhận accessToken/refreshToken mới, không bắt user login lại.
    const refreshedAuth = await authApi.refreshToken(currentSession.refreshToken);
    const nextSession = buildSession(refreshedAuth, currentSession);

    setSession(nextSession);

    if (rememberSession) {
      await persistSession(nextSession);
    }

    return nextSession;
  }

  async function login(credentials, options = {}) {
    const shouldRemember = Boolean(options.rememberSession);

    setIsSubmitting(true);

    try {
      // GỬI credentials từ form đăng nhập sang /auth/login.
      // Response đầu tiên chứa token và thông tin cơ bản, chưa chắc đủ profile chi tiết.
      const loginResponse = await authApi.login(credentials);
      const nextSession = buildSession(loginResponse);

      // Set session tạm để app có token dùng ngay cho request lấy profile.
      setSession(nextSession);
      setRememberSession(shouldRemember);

      // NHẬN profile chi tiết từ BE, sau đó build lại session đầy đủ hơn.
      const profile = await refreshProfile(nextSession, shouldRemember);
      const resolvedSession = buildSession(loginResponse, profile);

      setSession(resolvedSession);

      // Nếu user chọn "ghi nhớ", lưu session xuống storage; nếu không thì đảm bảo cache cũ bị xóa.
      if (shouldRemember) {
        await persistSession(resolvedSession);
      } else {
        await clearPersistedSession();
      }

      return resolvedSession;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function register(registerPayload, options = {}) {
    setIsSubmitting(true);

    try {
      // GỬI dữ liệu đăng ký từ ProfileScreen sang /auth/register.
      // Response trả về cho screen quyết định chuyển sang bước nhập OTP/xác minh email.
      const result = await authApi.register(registerPayload);
      setRememberSession(Boolean(options.rememberSession));
      return result;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function sendVerifyEmailOtp(email) {
    setIsSubmitting(true);

    try {
      // GỬI email để BE gửi OTP mới; không cập nhật session vì user chưa xác minh xong.
      return await authApi.sendVerifyEmailOtp({ email });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifyEmailOtp(payload) {
    setIsSubmitting(true);

    try {
      // GỬI email + otp + password lên BE để xác minh; ProfileScreen sẽ login lại nếu verify thành công.
      return await authApi.verifyEmailOtp(payload);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function forgotPassword(email) {
    setIsSubmitting(true);

    try {
      // GỬI email để BE phát OTP reset password; response chỉ dùng để báo trạng thái cho UI.
      return await authApi.forgotPassword({ email });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resetPasswordWithOtp(payload) {
    setIsSubmitting(true);

    try {
      // GỬI email + otp + mật khẩu mới; nếu thành công, ProfileScreen chuyển về form login.
      return await authApi.resetPassword(payload);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function saveProfile(profilePayload) {
    if (!session?.accessToken || !session?.userId) {
      throw new Error("Bạn cần đăng nhập trước.");
    }

    setIsSubmitting(true);

    try {
      // GỬI profilePayload từ form sửa hồ sơ sang /auth/profile/{userId}.
      // Response profile mới được merge vào session để UI cập nhật ngay không cần reload app.
      const profile = await authApi.updateProfile(
        session.userId,
        profilePayload,
        session.accessToken
      );

      let updatedSession = null;

      setSession((currentSession) => {
        updatedSession = buildSession(currentSession, profile);
        return updatedSession;
      });

      if (rememberSession && updatedSession) {
        await persistSession(updatedSession);
      }

      return profile;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function logout() {
    const accessToken = session?.accessToken;

    // Xóa session local trước để UI thoát ngay, sau đó mới cố gắng báo BE logout.
    setSession(null);
    setRememberSession(false);
    void clearPersistedSession();

    if (!accessToken) {
      return;
    }

    try {
      // GỬI accessToken lên /auth/logout để BE vô hiệu hóa phiên phía server.
      await authApi.logout(accessToken);
    } catch {
      // Local logout must still succeed even if the server session is already expired.
    }
  }

  async function changePassword(payload) {
    if (!session?.accessToken) {
      throw new Error("Bạn cần đăng nhập trước.");
    }

    setIsSubmitting(true);

    try {
      // GỬI currentPassword/newPassword/confirmPassword kèm accessToken.
      // Response không cần merge session, chỉ cần báo thành công/thất bại cho ProfileScreen.
      return await authApi.changePassword(payload, session.accessToken);
    } finally {
      setIsSubmitting(false);
    }
  }

  const value = {
    session,
    isAuthenticated: Boolean(session?.accessToken),
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
    refreshSession,
    refreshProfile,
    saveProfile,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// useAuth: Hook lấy auth context, bắt lỗi nếu dùng ngoài AuthProvider
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
