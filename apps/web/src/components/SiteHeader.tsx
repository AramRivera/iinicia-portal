"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { IconSun, IconMoon } from "@/components/campus-tech/Icons";

const navItems = [
  { label: "Inicio", href: "/#inicio", id: "inicio" },
  { label: "Universidad", href: "/#universidad", id: "universidad" },
  { label: "Licenciaturas", href: "/#licenciaturas", id: "licenciaturas" },
  { label: "Cursos", href: "/#cursos", id: "cursos" },
  { label: "Diplomados", href: "/#diplomados", id: "diplomados" },
  { label: "Certificaciones", href: "/#certificaciones", id: "certificaciones" },
  { label: "Admisiones", href: "/#admisiones", id: "admisiones" },
  { label: "Contacto", href: "/#contacto", id: "contacto" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("inicio");
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const { user, logout, getDefaultDashboardPath } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const isHome = pathname === "/";
  const dashboardPath = user ? getDefaultDashboardPath() : "/login";
  const primaryRole =
    user?.roles?.find((r) => r === "superadministrador") ||
    user?.roles?.find((r) => r === "administrador") ||
    user?.roles?.find((r) => r === "coordinador") ||
    user?.roles?.find((r) => r === "profesor") ||
    user?.roles?.find((r) => r === "estudiante") ||
    user?.roles?.[0] ||
    "aspirante";

  // Intersection observer & scroll detection according to Apple HIG Functional Layer
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setIsScrolled(scrollY > 16);

      if (!isHome) return;

      const sectionIds = navItems.map((item) => item.id);
      const offset = 120;

      for (let i = sectionIds.length - 1; i >= 0; i--) {
        const section = document.getElementById(sectionIds[i]);
        if (section) {
          const top = section.offsetTop;
          if (scrollY >= top - offset) {
            setActiveSection(sectionIds[i]);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isHome]);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    if (isHome) {
      e.preventDefault();
      setOpen(false);
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
        window.history.pushState(null, "", `/#${id}`);
        setActiveSection(id);
      }
    } else {
      setOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 transition-all duration-300 px-3 sm:px-6 pt-2 pb-1.5 pointer-events-none">
      <nav
        className={`mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-3.5 sm:px-5 pointer-events-auto rounded-2xl transition-all duration-300 ${
          isScrolled
            ? "bg-surface/80 backdrop-blur-xl border border-border/80 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.35)]"
            : "bg-surface/40 backdrop-blur-md border border-border/40 shadow-none"
        }`}
      >
        {/* Brand / Logo */}
        <Link
          href="/#inicio"
          onClick={(e) => handleNavClick(e, "inicio")}
          className="group flex items-center gap-2.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xl"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-welcome-panel p-1.5 shadow-sm ring-1 ring-white/15 transition-transform duration-200 group-hover:scale-[1.03] active:scale-[0.98]">
            <Image
              src="/inicia-nav-wordmark.png"
              alt="Logotipo INICIA"
              width={1563}
              height={1563}
              priority
              className="h-full w-full object-contain"
            />
          </span>
          <div className="hidden sm:flex flex-col">
            <span className="text-xs font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
              IINICIA
            </span>
            <span className="text-[10px] text-muted tracking-tight font-medium">
              Campus Digital
            </span>
          </div>
        </Link>

        {/* Desktop Navigation - Pill Segmented Capsule (Apple HIG Tab / Segmented Bar) */}
        <div className="hidden items-center p-1 rounded-full bg-surface-muted/60 dark:bg-surface-muted/40 border border-border/60 backdrop-blur-md lg:flex shadow-inner">
          <ul className="flex items-center gap-0.5">
            {navItems.map((item) => {
              const isActive = isHome && activeSection === item.id;
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={(e) => handleNavClick(e, item.id)}
                    className={`relative px-3 py-1.5 text-[12.5px] tracking-tight font-medium transition-all duration-200 rounded-full flex items-center justify-center ${
                      isActive
                        ? "text-foreground font-semibold bg-surface shadow-sm ring-1 ring-border/80 dark:bg-surface-elevated"
                        : "text-foreground/70 hover:text-foreground hover:bg-surface/40 active:scale-[0.97]"
                    }`}
                  >
                    {item.label}
                    {isActive && (
                      <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Right Actions / Profile / Theme Switcher */}
        <div className="hidden items-center gap-2.5 lg:flex">
          {/* Theme switcher */}
          <button
            type="button"
            onClick={toggleTheme}
            className="h-9 w-9 rounded-full border border-border/60 bg-surface/60 hover:bg-surface text-foreground flex items-center justify-center transition-all duration-200 shadow-sm active:scale-95"
            title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          >
            {theme === "dark" ? (
              <IconSun className="w-4 h-4 text-accent-lime" />
            ) : (
              <IconMoon className="w-4 h-4 text-primary" />
            )}
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              <Link
                href={dashboardPath}
                className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 hover:bg-primary/20 px-3.5 py-1.5 text-xs font-semibold text-primary transition-all duration-200 shadow-sm active:scale-95"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-accent-lime animate-pulse" />
                <span className="capitalize">{primaryRole}</span>
              </Link>
              <button
                type="button"
                onClick={logout}
                className="text-xs font-medium text-muted hover:text-danger px-2 py-1.5 transition-colors rounded-lg"
              >
                Salir
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Link
                href="/login"
                className="text-xs font-medium text-foreground/80 hover:text-foreground transition-colors px-3 py-1.5 rounded-full hover:bg-surface/50"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/registro"
                className="rounded-full bg-primary-action px-4 py-1.5 text-xs font-semibold text-white transition-all duration-200 hover:opacity-95 hover:shadow-md active:scale-95 shadow-sm"
              >
                Registrarse
              </Link>
            </div>
          )}
        </div>

        {/* Mobile controls */}
        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={toggleTheme}
            className="h-8 w-8 rounded-full border border-border/60 bg-surface/70 text-foreground flex items-center justify-center shadow-sm"
            title="Cambiar tema"
          >
            {theme === "dark" ? (
              <IconSun className="w-4 h-4 text-accent-lime" />
            ) : (
              <IconMoon className="w-4 h-4 text-primary" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Abrir menú"
            aria-expanded={open}
            className="grid h-8 w-8 place-items-center rounded-full border border-border/60 bg-surface/70 text-foreground hover:bg-surface shadow-sm active:scale-95"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
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

      {/* Mobile drawer (Liquid Glass sheet) */}
      {open && (
        <div className="mx-auto mt-2 max-w-6xl rounded-2xl border border-border/80 bg-surface/95 backdrop-blur-2xl p-4 lg:hidden shadow-xl animate-in slide-in-from-top-2 duration-200 pointer-events-auto">
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = isHome && activeSection === item.id;
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={(e) => handleNavClick(e, item.id)}
                    className={`block px-3.5 py-2 text-sm font-medium rounded-xl transition-all ${
                      isActive
                        ? "text-primary font-semibold bg-primary/10"
                        : "text-foreground/80 hover:text-foreground hover:bg-surface-muted/60"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li className="mt-2 flex flex-col gap-2 border-t border-border/60 pt-3">
              {user ? (
                <>
                  <Link
                    href={dashboardPath}
                    onClick={() => setOpen(false)}
                    className="rounded-xl bg-primary-action px-4 py-2 text-center text-xs font-semibold text-white shadow-sm"
                  >
                    Ir al Panel ({primaryRole})
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      logout();
                    }}
                    className="rounded-xl border border-danger/30 px-4 py-2 text-center text-xs font-medium text-danger hover:bg-danger/10"
                  >
                    Cerrar sesión
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="rounded-xl border border-border px-4 py-2 text-center text-xs font-medium text-foreground"
                  >
                    Iniciar sesión
                  </Link>
                  <Link
                    href="/registro"
                    onClick={() => setOpen(false)}
                    className="rounded-xl bg-primary-action px-4 py-2 text-center text-xs font-semibold text-white shadow-sm"
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
