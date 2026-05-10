import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { setAccessToken } from "@/lib/api";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://lmsapi.suraksha.lk";

interface User {
  id: string;
  email: string;
  nameWithInitials?: string;
  firstName?: string;
  lastName?: string;
  userType: string;
  imageUrl: string | null;
}

interface SessionInfo {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number; // seconds
  refreshExpiresIn: number | null;
  expiresAt: number; // timestamp ms
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  sessionInfo: SessionInfo | null;
  authError: string | null;
  login: (identifier: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function parseExpiresIn(expiresIn: number): number {
  // expiresIn is in seconds from API
  return Date.now() + expiresIn * 1000;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem("auth_user");
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  // sessionInfo is memory-only — tokens never written to localStorage
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRefreshingRef = useRef(false);

  const clearSession = useCallback(() => {
    setUser(null);
    setSessionInfo(null);
    setAuthError(null);
    setAccessToken(null);
    localStorage.removeItem("auth_user");
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const scheduleTokenRefresh = useCallback((session: SessionInfo) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    // Refresh 60 seconds before expiry, or at half-life if less than 2 min
    const timeUntilExpiry = session.expiresAt - Date.now();
    const refreshDelay = Math.max(timeUntilExpiry - 60_000, timeUntilExpiry / 2, 5_000);

    refreshTimerRef.current = setTimeout(async () => {
      if (!isRefreshingRef.current) {
        isRefreshingRef.current = true;
        try {
          await doRefresh(session.refreshToken);
        } finally {
          isRefreshingRef.current = false;
        }
      }
    }, refreshDelay);
  }, []);

  const saveSession = useCallback((userData: User, session: SessionInfo) => {
    setUser(userData);
    setSessionInfo(session);
    setAccessToken(session.accessToken);
    // Only persist non-sensitive user profile — tokens are memory-only
    localStorage.setItem("auth_user", JSON.stringify(userData));
    scheduleTokenRefresh(session);
  }, [scheduleTokenRefresh]);

  const doRefresh = useCallback(async (refreshToken: string | null): Promise<boolean> => {
    try {
      const body: Record<string, string> = {};
      if (refreshToken) body.refresh_token = refreshToken;

      const response = await fetch(`${BASE_URL}/v2/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        clearSession();
        return false;
      }

      const data = await response.json();

      if (data.access_token) {
        const userData: User = {
          id: data.user?.id || user?.id || "",
          email: data.user?.email || user?.email || "",
          nameWithInitials: data.user?.nameWithInitials || user?.nameWithInitials,
          firstName: data.user?.firstName || user?.firstName,
          lastName: data.user?.lastName || user?.lastName,
          userType: data.user?.userType || user?.userType || "",
          imageUrl: data.user?.imageUrl || user?.imageUrl || null,
        };

        const session: SessionInfo = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || null,
          expiresIn: data.expires_in || 3600,
          refreshExpiresIn: data.refresh_expires_in || null,
          expiresAt: parseExpiresIn(data.expires_in || 3600),
        };

        saveSession(userData, session);
        return true;
      }

      clearSession();
      return false;
    } catch {
      clearSession();
      return false;
    }
  }, [user, clearSession, saveSession]);

  // Handle forced logout when api.ts detects a 401
  useEffect(() => {
    const handler = () => {
      clearSession();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    };
    window.addEventListener('auth:session-expired', handler);
    return () => window.removeEventListener('auth:session-expired', handler);
  }, [clearSession]);

  // Restore session on mount — tokens are memory-only, so attempt refresh via HttpOnly cookie
  useEffect(() => {
    const storedUser = localStorage.getItem("auth_user");
    if (storedUser) {
      try {
        // Optimistically restore profile so UI renders while refresh is in flight
        const parsedUser = JSON.parse(storedUser) as User;
        setUser(parsedUser);
        // Refresh using the HttpOnly cookie (credentials: "include")
        doRefresh(null).finally(() => setIsLoading(false));
      } catch {
        clearSession();
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (identifier: string, password: string, rememberMe = false): Promise<boolean> => {
    try {
      setAuthError(null);

      const normalizedIdentifier = identifier.includes("@")
        ? identifier.trim().toLowerCase()
        : identifier.trim();

      const response = await fetch(`${BASE_URL}/v2/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier: normalizedIdentifier, password, rememberMe }),
      });

      if (!response.ok) {
        let message = "Invalid credentials";
        try {
          const errorData = await response.json();
          message =
            errorData?.message ||
            errorData?.details?.message ||
            errorData?.details?.error ||
            message;
        } catch {
          // ignore parse errors
        }
        setAuthError(message);
        return false;
      }

      const data = await response.json();

      if (data.access_token && data.user) {
        const userData: User = {
          id: data.user.id,
          email: data.user.email,
          nameWithInitials: data.user.nameWithInitials,
          firstName: data.user.firstName,
          lastName: data.user.lastName,
          userType: data.user.userType,
          imageUrl: data.user.imageUrl,
        };

        const session: SessionInfo = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || null,
          expiresIn: data.expires_in || 3600,
          refreshExpiresIn: data.refresh_expires_in || null,
          expiresAt: parseExpiresIn(data.expires_in || 3600),
        };

        saveSession(userData, session);
        setAuthError(null);
        return true;
      }

      setAuthError("Invalid credentials");
      return false;
    } catch {
      setAuthError("Unable to reach authentication service");
      return false;
    }
  };

  const logout = async () => {
    try {
      const body: Record<string, string> = {};
      if (sessionInfo?.refreshToken) body.refresh_token = sessionInfo.refreshToken;

      await fetch(`${BASE_URL}/v2/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionInfo?.accessToken && { Authorization: `Bearer ${sessionInfo.accessToken}` }),
        },
        credentials: "include",
        body: JSON.stringify(body),
      }).catch(() => {});
    } finally {
      clearSession();
    }
  };

  const refreshSession = async (): Promise<boolean> => {
    if (isRefreshingRef.current) return false;
    isRefreshingRef.current = true;
    try {
      return await doRefresh(sessionInfo?.refreshToken || null);
    } finally {
      isRefreshingRef.current = false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user && !!sessionInfo,
        isLoading,
        accessToken: sessionInfo?.accessToken || null,
        sessionInfo,
        authError,
        login,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
