import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useState } from "react";

import * as authApi from "@/services/auth-api";

const AuthContext = createContext(null);

const SESSION_STORAGE_KEY = "fpt-ride.auth.session";

function buildSession(loginResponse, profileResponse) {
  return {
    accessToken: loginResponse.accessToken,
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
  await SecureStore.setItemAsync(
    SESSION_STORAGE_KEY,
    JSON.stringify(session ?? null)
  );
}

async function clearPersistedSession() {
  await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [rememberSession, setRememberSession] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const storedSession = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);

        if (!storedSession) {
          if (isMounted) {
            setRememberSession(false);
          }
          return;
        }

        const parsedSession = JSON.parse(storedSession);

        if (!parsedSession?.accessToken || !parsedSession?.userId) {
          await clearPersistedSession();

          if (isMounted) {
            setRememberSession(false);
          }

          return;
        }

        if (!isMounted) {
          return;
        }

        setSession(parsedSession);
        setRememberSession(true);

        try {
          const profile = await authApi.getProfile(
            parsedSession.userId,
            parsedSession.accessToken
          );
          const refreshedSession = buildSession(parsedSession, profile);

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

  async function login(credentials, options = {}) {
    const shouldRemember = Boolean(options.rememberSession);

    setIsSubmitting(true);

    try {
      const loginResponse = await authApi.login(credentials);
      const nextSession = buildSession(loginResponse);

      setSession(nextSession);
      setRememberSession(shouldRemember);

      const profile = await refreshProfile(nextSession, shouldRemember);
      const resolvedSession = buildSession(loginResponse, profile);

      setSession(resolvedSession);

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
      return await authApi.sendVerifyEmailOtp({ email });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifyEmailOtp(payload) {
    setIsSubmitting(true);

    try {
      return await authApi.verifyEmailOtp(payload);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function forgotPassword(email) {
    setIsSubmitting(true);

    try {
      return await authApi.forgotPassword({ email });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resetPasswordWithOtp(payload) {
    setIsSubmitting(true);

    try {
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

  function logout() {
    setSession(null);
    void clearPersistedSession();
  }

  async function changePassword(payload) {
    if (!session?.accessToken) {
      throw new Error("Bạn cần đăng nhập trước.");
    }

    setIsSubmitting(true);

    try {
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
    refreshProfile,
    saveProfile,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
