
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type PortalProfile = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
  roles: string[];
  permissions: string[];
  moodle_user_id?: number | null;
  moodle_sync_status?: string | null;
};

type PortalSession = {
  accessToken: string;
  expiresAt: number;
  profile: PortalProfile;
};

type AuthContextValue = {
  session: PortalSession | null;
  loading: boolean;
  error: string | null;
  refreshSession: () => Promise<void>;
  logout: () => void;
};

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "")
  .trim()
  .replace(/\/+$/, "");

const SESSION_KEY = `iinicia.portal.session.v1:${API_URL}`;

const AuthContext = createContext<AuthContextValue | null>(null);

function isProfile(value: unknown): value is PortalProfile {
  if (typeof value !== "object" || value === null) return false;

  const profile = value as Record<string, unknown>;

  return (
    typeof profile.id === "string" &&
    typeof profile.email === "string" &&
    typeof profile.first_name === "string" &&
    typeof profile.last_name === "string" &&
    typeof profile.status === "string" &&
    Array.isArray(profile.roles) &&
    profile.roles.every((role) => typeof role === "string") &&
    Array.isArray(profile.permissions) &&
    profile.permissions.every((permission) => typeof permission === "string")
  );
}

export function PortalAuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [session, setSession] = useState<PortalSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    setError(null);
    window.dispatchEvent(new Event("iinicia:session-changed"));
  }, []);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const raw = sessionStorage.getItem(SESSION_KEY);

      if (!raw) {
        setSession(null);
        return;
      }

      const saved: unknown = JSON.parse(raw);

      if (
        typeof saved !== "object" ||
        saved === null ||
        !("accessToken" in saved) ||
        !("expiresAt" in saved) ||
        typeof saved.accessToken !== "string" ||
        typeof saved.expiresAt !== "number" ||
        !Number.isFinite(saved.expiresAt) ||
        saved.expiresAt <= Date.now()
      ) {
        sessionStorage.removeItem(SESSION_KEY);
        setSession(null);
        return;
      }

      if (!API_URL) {
        setSession(null);
        setError("Falta configurar NEXT_PUBLIC_API_URL.");
        return;
      }

      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${saved.accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem(SESSION_KEY);
        setSession(null);
        return;
      }

      if (!response.ok) {
        throw new Error("No se pudo consultar el perfil del usuario.");
      }

      const profile: unknown = await response.json();

      if (!isProfile(profile)) {
        throw new Error("La API devolvió un perfil no válido.");
      }

      if (profile.status !== "activo") {
        setSession(null);
        setError("Tu cuenta no está activa.");
        return;
      }

      setSession({
        accessToken: saved.accessToken,
        expiresAt: saved.expiresAt,
        profile,
      });
    } catch {
      setSession(null);
      setError("No fue posible comprobar la sesión con la API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();

    const handleSessionChange = () => {
      void refreshSession();
    };

    window.addEventListener("iinicia:session-changed", handleSessionChange);

    return () => {
      window.removeEventListener(
        "iinicia:session-changed",
        handleSessionChange
      );
    };
  }, [refreshSession]);

  useEffect(() => {
    if (!session) return;

    const milliseconds = Math.max(0, session.expiresAt - Date.now());

    const timeout = window.setTimeout(() => {
      logout();
    }, milliseconds);

    return () => window.clearTimeout(timeout);
  }, [session, logout]);

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        error,
        refreshSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function usePortalAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "usePortalAuth debe utilizarse dentro de PortalAuthProvider"
    );
  }

  return context;
}
