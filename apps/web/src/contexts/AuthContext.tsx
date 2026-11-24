// IINICIA Portal · portal Next.js · AuthContext.tsx
/** Mantiene el perfil autenticado y las acciones de sesión que comparten las pantallas. */
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { ApiError, authApi, getToken, removeToken, setToken } from '@/lib/api';
import type { LoginResponse, RegisterResponse, RoleSlug, UserProfile } from '@/types';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string, captchaToken?: string) => Promise<LoginResponse>;
  verifyLoginMfa: (mfaToken: string, factorId: string, code: string) => Promise<UserProfile>;
  register: (payload: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
    captcha_token?: string;
  }) => Promise<RegisterResponse>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  hasRole: (role: RoleSlug) => boolean;
  hasPermission: (permission: string) => boolean;
  getDefaultDashboardPath: (roles?: RoleSlug[]) => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Restaura la sesión del portal y comparte el perfil, los roles y las operaciones de identidad con los componentes descendientes. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Recupera el perfil desde la API y descarta el token cuando la sesión es rechazada.
  const fetchProfile = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const profile = await authApi.getMe();
      setUser(profile);
    } catch (error) {
      if (error instanceof ApiError && [401, 403].includes(error.statusCode)) {
        removeToken();
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Reconsulta el perfil al volver a la pestaña para recoger cambios de acceso.
  useEffect(() => {
    fetchProfile();
    const refreshOnFocus = () => { if (getToken()) void fetchProfile(); };
    window.addEventListener('focus', refreshOnFocus);
    return () => window.removeEventListener('focus', refreshOnFocus);
  }, [fetchProfile]);

  /** Inicia el primer paso y descarta la sesión anterior antes de pedir la siguiente acción al servidor. */
  const login = (email: string, password: string, captchaToken?: string): Promise<LoginResponse> => {
    removeToken();
    setUser(null);
    return authApi.login({ email, password, captcha_token: captchaToken });
  };

  // La sesión se guarda tras verificar TOTP y confirmar que la API acepta el token para consultar el perfil.
  const verifyLoginMfa = async (mfaToken: string, factorId: string, code: string): Promise<UserProfile> => {
    setLoading(true);
    try {
      const { access_token } = await authApi.verifyLoginMfa(mfaToken, factorId, code);
      const profile = await authApi.getMe(access_token);
      setToken(access_token);
      setUser(profile);
      return profile;
    } finally {
      setLoading(false);
    }
  };

  /** Mantiene pendiente el formulario mientras se registra la solicitud de confirmación de correo. */
  const register = async (payload: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
    captcha_token?: string;
  }): Promise<RegisterResponse> => {
    setLoading(true);
    try {
      return await authApi.register(payload);
    } finally {
      setLoading(false);
    }
  };

  /** Limpia el token y el perfil del navegador antes de volver a la página de ingreso. */
  const logout = () => {
    authApi.logout();
    setUser(null);
    window.location.href = '/login';
  };

  /** Vuelve a leer el perfil cuando el panel necesita reflejar cambios recientes de la cuenta. */
  const refreshUser = async () => {
    await fetchProfile();
  };

  /** Expone los roles del perfil para elegir qué elementos de interfaz se muestran. */
  const hasRole = (role: RoleSlug): boolean => {
    if (!user) return false;
    return user.roles.includes(role);
  };

  /** Controla la disponibilidad visual de una acción. La API vuelve a verificar el permiso al procesarla. */
  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.roles.includes('superadministrador')) return true;
    return Boolean(user.permissions && user.permissions.includes(permission));
  };

  // Resuelve el panel de entrada cuando una cuenta tiene varios roles.
  const getDefaultDashboardPath = (customRoles?: RoleSlug[]): string => {
    const r = customRoles || user?.roles || [];
    if (r.includes('superadministrador') || r.includes('administrador')) {
      return '/dashboard/admin';
    }
    if (r.includes('coordinador')) return '/dashboard/coordinador';
    if (r.includes('profesor')) {
      return '/dashboard/docente';
    }
    if (r.includes('estudiante')) {
      return '/dashboard/estudiante';
    }
    if (r.includes('soporte')) return '/dashboard/soporte';
    return '/dashboard/aspirante';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        verifyLoginMfa,
        register,
        logout,
        refreshUser,
        hasRole,
        hasPermission,
        getDefaultDashboardPath,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** Entrega el contexto que los componentes usan para consultar la sesión y ejecutar las operaciones de identidad. */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
