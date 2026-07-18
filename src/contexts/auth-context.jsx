import { createContext, useContext, useState } from "react";

import * as authApi from "@/services/auth-api";

const AuthContext = createContext(null);

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

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false);

  async function refreshProfile(nextSession = session) {
    if (!nextSession?.accessToken || !nextSession?.userId) {
      return null;
    }

    setIsRefreshingProfile(true);

    try {
      const profile = await authApi.getProfile(
        nextSession.userId,
        nextSession.accessToken
      );

      setSession((currentSession) => {
        const activeSession =
          currentSession?.userId === nextSession.userId
            ? currentSession
            : nextSession;

        return buildSession(activeSession, profile);
      });

      return profile;
    } finally {
      setIsRefreshingProfile(false);
    }
  }

  async function login(credentials) {
    setIsSubmitting(true);

    try {
      const loginResponse = await authApi.login(credentials);
      const nextSession = buildSession(loginResponse);

      setSession(nextSession);
      const profile = await refreshProfile(nextSession);

      return buildSession(loginResponse, profile);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function register(registerPayload) {
    setIsSubmitting(true);

    try {
      await authApi.register(registerPayload);
      return await login({
        email: registerPayload.email,
        password: registerPayload.password,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function saveProfile(profilePayload) {
    if (!session?.accessToken || !session?.userId) {
      throw new Error("Ban can dang nhap truoc.");
    }

    setIsSubmitting(true);

    try {
      const profile = await authApi.updateProfile(
        session.userId,
        profilePayload,
        session.accessToken
      );

      setSession((currentSession) => buildSession(currentSession, profile));

      return profile;
    } finally {
      setIsSubmitting(false);
    }
  }

  function logout() {
    setSession(null);
  }

  const value = {
    session,
    isAuthenticated: Boolean(session?.accessToken),
    isSubmitting,
    isRefreshingProfile,
    login,
    register,
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
