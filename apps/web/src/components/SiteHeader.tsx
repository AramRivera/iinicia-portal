"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { usePortalTheme } from "@/components/PortalThemeProvider";
import { usePortalAuth } from "@/components/PortalAuthProvider";


const navItems = [
  { label: "Inicio", href: "/" },
  { label: "Cursos", href: "/cursos" },
  { label: "Certificaciones", href: "/certificaciones" },
  { label: "Diplomados", href: "/diplomados" },
  { label: "Universidad", href: "/universidad" },
  { label: "Ayuda", href: "/#preguntas" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { theme, toggleTheme } = usePortalTheme();
  const { session, loading, logout } = usePortalAuth();
  const accountHref = session?.profile.roles.some((role) =>
    ["administrador", "superadministrador"].includes(role)
  ) ? "/admin" : "/estudiante";

  // La portada ya incluye su propio encabezado (modales y modo ambiente).
  // Evitamos duplicarlo; el encabezado global aparece en las demás rutas.
  if (pathname === "/") return null;

  return (
    <header className="portal-global-header sticky top-0 z-50 border-b px-4 backdrop-blur-xl sm:px-6 lg:px-10">
      <nav aria-label="Navegación principal" className="mx-auto flex h-[76px] max-w-7xl items-center justify-between gap-4">
        <Link href="/" onClick={() => setOpen(false)} aria-label="IINICIA, ir al inicio" className="flex shrink-0 items-center gap-3">
          <span className="portal-logo-mark relative flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm">
            <span className="text-sm font-semibold tracking-tight">I²</span>
            <span className="portal-logo-dot absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2" />
          </span>
          <span>
            <span className="block text-lg font-semibold tracking-[0.16em]">IINICIA</span>
            <span className="portal-muted -mt-0.5 block text-[9px] font-medium uppercase tracking-[0.23em]">Ciencias aplicadas</span>
          </span>
        </Link>

        <ul className="hidden items-center gap-5 text-[13px] font-medium xl:flex">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                className="portal-global-nav-link transition-colors"
              >{item.label}</Link>
            </li>
          ))}
        </ul>

        
<div className="hidden items-center gap-3 xl:flex">
  {loading ? (
    <span className="text-sm opacity-60">
      Comprobando sesión...
    </span>
  ) : session ? (
    <>
      <Link
        href={accountHref}
        className="portal-lime-button inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold shadow-sm"
      >
        Mi IINICIA
      </Link>

      <button
        type="button"
        onClick={logout}
        className="portal-global-nav-link rounded-lg border px-4 py-2.5 text-sm font-semibold"
      >
        Cerrar sesión
      </button>
    </>
  ) : (
    <>
      <Link
        href="/login"
        className="portal-global-nav-link rounded-lg px-4 py-2.5 text-sm font-semibold"
      >
        Iniciar sesión
      </Link>

      <Link
        href="/registro"
        className="portal-lime-button inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold shadow-sm"
      >
        Crear cuenta <span aria-hidden="true">↗</span>
      </Link>
    </>
  )}
</div>


        <button
          type="button"
          onClick={toggleTheme}
          className="portal-global-theme-toggle inline-flex shrink-0 items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold"
          aria-label={theme === "light" ? "Activar modo oscuro" : "Activar modo claro"}
          title={theme === "light" ? "Cambiar a oscuro" : "Cambiar a claro"}
        >
          <span aria-hidden="true" className="text-lg leading-none">{theme === "light" ? "☾" : "☀"}</span>
          <span className="hidden sm:inline">{theme === "light" ? "Oscuro" : "Claro"}</span>
        </button>

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          className="portal-global-theme-toggle rounded-lg border px-3 py-2 text-sm xl:hidden"
        >{open ? "Cerrar ✕" : "Menú ☰"}</button>
      </nav>

      {open && (
        <nav aria-label="Navegación móvil" className="portal-mobile-menu border-t py-3 xl:hidden">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="portal-mobile-link block rounded-lg px-3 py-3 text-sm">
              {item.label}
            </Link>
          ))}
          
<div className="mt-2 grid grid-cols-2 gap-2 border-t pt-3">
  {loading ? (
    <span className="col-span-2 py-3 text-center text-sm opacity-60">
      Comprobando sesión...
    </span>
  ) : session ? (
    <>
      <Link
        href={accountHref}
        onClick={() => setOpen(false)}
        className="portal-lime-button rounded-lg px-3 py-3 text-center text-sm font-semibold"
      >
        Mi IINICIA
      </Link>

      <button
        type="button"
        onClick={() => {
          logout();
          setOpen(false);
        }}
        className="portal-global-theme-toggle rounded-lg border px-3 py-3 text-center text-sm font-semibold"
      >
        Cerrar sesión
      </button>
    </>
  ) : (
    <>
      <Link
        href="/login"
        onClick={() => setOpen(false)}
        className="portal-global-theme-toggle rounded-lg border px-3 py-3 text-center text-sm font-semibold"
      >
        Iniciar sesión
      </Link>

      <Link
        href="/registro"
        onClick={() => setOpen(false)}
        className="portal-lime-button rounded-lg px-3 py-3 text-center text-sm font-semibold"
      >
        Crear cuenta
      </Link>
    </>
  )}
</div>

        </nav>
      )}
    </header>
  );
}
