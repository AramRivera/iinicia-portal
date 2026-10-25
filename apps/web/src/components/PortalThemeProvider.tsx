"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type PortalTheme = "light" | "dark";

type ThemeContextValue = {
  theme: PortalTheme;
  setTheme: (next: PortalTheme | ((previous: PortalTheme) => PortalTheme)) => void;
  toggleTheme: () => void;
};

const STORAGE_KEY = "iinicia-portal-theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function PortalThemeProvider({ children }: { children: React.ReactNode }) {
  // El servidor y el primer render del cliente comienzan con el mismo valor.
  const [theme, setThemeState] = useState<PortalTheme>("light");
  const [initialized, setInitialized] = useState(false);

  // Primero recuperamos la preferencia anterior; no la sobrescribimos durante este paso.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark") {
        setThemeState(saved);
      }
    } catch {
      // Si localStorage está bloqueado, el selector sigue funcionando en memoria.
    }
    setInitialized(true);
  }, []);

  // Guardamos el tema únicamente cuando la lectura inicial ha terminado.
  useEffect(() => {
    if (!initialized) return;

    document.documentElement.dataset.portalTheme = theme;
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // No se puede guardar en este navegador, pero se conserva durante la sesión.
    }
  }, [theme, initialized]);

  const setTheme = useCallback<ThemeContextValue["setTheme"]>((next) => {
    setThemeState((previous) =>
      typeof next === "function" ? next(previous) : next
    );
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((previous) => (previous === "light" ? "dark" : "light"));
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function usePortalTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("usePortalTheme debe utilizarse dentro de PortalThemeProvider");
  }
  return context;
}
