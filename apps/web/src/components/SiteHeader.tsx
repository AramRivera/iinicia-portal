"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { IconSun, IconMoon } from "@/components/campus-tech/Icons";

const navItems = [
  { label: "Inicio", href: "/" },
  { label: "Cursos", href: "/cursos" },
  { label: "Diplomados", href: "/diplomados" },
  { label: "Certificaciones", href: "/certificaciones" },
  { label: "Admisiones", href: "/admisiones" },
  { label: "Universidad", href: "/universidad" },
  { label: "Contacto", href: "/contacto" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { user, logout, getDefaultDashboardPath } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const dashboardPath = user ? getDefaultDashboardPath() : "/login";
  const primaryRole =
    user?.roles?.find((r) => r === "superadministrador") ||
    user?.roles?.find((r) => r === "administrador") ||
    user?.roles?.find((r) => r === "coordinador") ||
    user?.roles?.find((r) => r === "profesor") ||
    user?.roles?.find((r) => r === "estudiante") ||
    user?.roles?.[0] ||
    "aspirante";

  return (
    <header className="sticky top-0 z-50 bg-surface/90 backdrop-blur-md border-b border-border transition-colors">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-[52px] sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <LogoMark />
          <div className="flex items-center gap-1.5">
            <span className="text-[16px] font-bold tracking-tight text-foreground">
              IINICIA
            </span>
          </div>
        </Link>

        <ul className="hidden items-center gap-6 lg:flex">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="text-[13px] font-medium text-foreground/75 transition-colors hover:text-primary"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 lg:flex">
          {/* Theme switcher */}
          <button
            type="button"
            onClick={toggleTheme}
            className="h-8 w-8 rounded-[6px] border border-border bg-surface-muted/60 hover:bg-surface-muted text-foreground flex items-center justify-center transition-all"
            title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {theme === 'dark' ? (
              <IconSun className="w-4 h-4 text-accent-lime" />
            ) : (
              <IconMoon className="w-4 h-4 text-primary" />
            )}
          </button>

          {user ? (
            <div className="flex items-center gap-3">
              <Link
                href={dashboardPath}
                className="flex items-center gap-2 rounded-[6px] border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-all"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-accent-lime" />
                <span>Panel ({primaryRole})</span>
              </Link>
              <button
                type="button"
                onClick={logout}
                className="text-xs font-medium text-muted hover:text-danger transition-colors"
              >
                Cerrar sesión
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-xs font-medium text-foreground/80 hover:text-foreground transition-colors px-2 py-1.5"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/registro"
                className="rounded-[6px] bg-primary px-3.5 py-1.5 text-xs font-semibold text-white transition-all hover:bg-primary/90 shadow-minimal"
              >
                Registrarse
              </Link>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={toggleTheme}
            className="h-8 w-8 rounded-[6px] border border-border bg-surface-muted text-foreground flex items-center justify-center"
            title="Cambiar tema"
          >
            {theme === 'dark' ? <IconSun className="w-4 h-4 text-accent-lime" /> : <IconMoon className="w-4 h-4 text-primary" />}
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Abrir menú"
            aria-expanded={open}
            className="grid h-8 w-8 place-items-center rounded-[6px] border border-border text-foreground hover:bg-surface-muted"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            >
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-b border-border bg-surface px-4 py-4 lg:hidden animate-in slide-in-from-top-2 duration-150">
          <ul className="flex flex-col gap-3">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block py-1.5 text-sm font-medium text-foreground/80 hover:text-primary"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
              {user ? (
                <>
                  <Link
                    href={dashboardPath}
                    onClick={() => setOpen(false)}
                    className="rounded-[6px] bg-primary px-4 py-2 text-center text-xs font-semibold text-white"
                  >
                    Ir al Panel ({primaryRole})
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      logout();
                    }}
                    className="rounded-[6px] border border-danger/30 px-4 py-2 text-center text-xs font-medium text-danger hover:bg-danger/10"
                  >
                    Cerrar sesión
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="rounded-[6px] border border-border px-4 py-2 text-center text-xs font-medium text-foreground"
                  >
                    Iniciar sesión
                  </Link>
                  <Link
                    href="/registro"
                    onClick={() => setOpen(false)}
                    className="rounded-[6px] bg-primary px-4 py-2 text-center text-xs font-semibold text-white"
                  >
                    Registrarse
                  </Link>
                </>
              )}
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}

function LogoMark() {
  return (
    <span className="grid h-7 w-7 place-items-center rounded-[6px] bg-primary text-white shadow-minimal">
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2l8 4.5v9L12 20l-8-4.5v-9L12 2z" />
        <path d="M12 2v9l8 4.5M12 11l-8 4.5" />
      </svg>
    </span>
  );
}
