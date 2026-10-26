"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { label: "Inicio", href: "/" },
  { label: "Cursos", href: "/cursos" },
  { label: "Certificaciones", href: "/certificaciones" },
  { label: "Diplomados", href: "/diplomados" },
  { label: "Universidad IINICIA", href: "/universidad" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { user, logout, getDefaultDashboardPath } = useAuth();

  const dashboardPath = user ? getDefaultDashboardPath() : "/login";
  const primaryRole = user?.roles?.[0] || "aspirante";

  return (
    <header className="sticky top-0 z-50 glass border-b border-border">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-[52px] sm:px-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <LogoMark />
          <span className="text-[17px] font-semibold tracking-tight text-foreground">
            IINICIA
          </span>
        </Link>

        <ul className="hidden items-center gap-7 lg:flex">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="hover-underline text-[13px] font-medium text-foreground/80 transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-4 lg:flex">
          {user ? (
            <div className="flex items-center gap-3">
              <Link
                href={dashboardPath}
                className="flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3.5 py-1.5 text-[13px] font-medium text-accent hover:bg-accent/20 transition-colors"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Panel ({primaryRole})</span>
              </Link>
              <button
                type="button"
                onClick={logout}
                className="text-[13px] font-medium text-foreground/70 hover:text-red-400 transition-colors"
              >
                Cerrar sesión
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-5">
              <Link
                href="/login"
                className="hover-underline text-[13px] font-medium text-foreground/80 transition-colors hover:text-foreground"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/registro"
                className="rounded-full bg-accent px-4 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-accent-strong"
              >
                Registrarse
              </Link>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Abrir menú"
          aria-expanded={open}
          className="grid h-9 w-9 place-items-center rounded-full text-foreground transition-colors hover:bg-foreground/5 lg:hidden"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </nav>

      {open && (
        <div className="border-t border-border bg-background/95 backdrop-blur-xl lg:hidden">
          <ul className="flex flex-col px-3 py-3">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-2xl px-4 py-3 text-[15px] font-medium text-foreground transition-colors hover:bg-foreground/5"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="mt-2 flex flex-col gap-2 border-t border-border px-1 pt-3">
              {user ? (
                <>
                  <Link
                    href={dashboardPath}
                    onClick={() => setOpen(false)}
                    className="rounded-full bg-accent px-4 py-2.5 text-center text-[15px] font-semibold text-white"
                  >
                    Mi Panel ({primaryRole})
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      logout();
                    }}
                    className="rounded-full border border-red-500/30 px-4 py-2.5 text-center text-[15px] font-medium text-red-400 hover:bg-red-500/10"
                  >
                    Cerrar sesión
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="rounded-full border border-border px-4 py-2.5 text-center text-[15px] font-medium text-foreground"
                  >
                    Iniciar sesión
                  </Link>
                  <Link
                    href="/registro"
                    onClick={() => setOpen(false)}
                    className="rounded-full bg-accent px-4 py-2.5 text-center text-[15px] font-semibold text-white"
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
    <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-b from-[#0a84ff] to-[#0060df] text-white shadow-[0_2px_6px_rgba(0,113,227,0.4)]">
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2l8 4.5v9L12 20l-8-4.5v-9L12 2z" />
        <path d="M12 2v9l8 4.5M12 11l-8 4.5" />
      </svg>
    </span>
  );
}