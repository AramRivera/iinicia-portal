'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi, getToken, removeToken } from '@/lib/api';
import type { RoleSlug, UserProfile } from '@/types';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserProfile>;
  register: (payload: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
  }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  hasRole: (role: RoleSlug) => boolean;
  hasPermission: (permission: string) => boolean;
  getDefaultDashboardPath: (roles?: RoleSlug[]) => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

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
    } catch {
      removeToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const login = async (email: string, password: string): Promise<UserProfile> => {
    setLoading(true);
    try {
      await authApi.login({ email, password });
      const profile = await authApi.getMe();
      setUser(profile);
      return profile;
    } finally {
      setLoading(false);
    }
  };

  const register = async (payload: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
  }): Promise<void> => {
    setLoading(true);
    try {
      await authApi.register(payload);
      const profile = await authApi.getMe();
      setUser(profile);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    authApi.logout();
    setUser(null);
    window.location.href = '/login';
  };

  const refreshUser = async () => {
    await fetchProfile();
  };

  const hasRole = (role: RoleSlug): boolean => {
    if (!user) return false;
    return user.roles.includes(role);
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.roles.includes('superadministrador')) return true;
    return Boolean(user.permissions && user.permissions.includes(permission));
  };

  const getDefaultDashboardPath = (customRoles?: RoleSlug[]): string => {
    const r = customRoles || user?.roles || [];
    if (r.includes('superadministrador') || r.includes('administrador') || r.includes('coordinador')) {
      return '/dashboard/admin';
    }
    if (r.includes('profesor')) {
      return '/dashboard/docente';
    }
    if (r.includes('estudiante')) {
      return '/dashboard/estudiante';
    }
    return '/dashboard/aspirante';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
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

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
