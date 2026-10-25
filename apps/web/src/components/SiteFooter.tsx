"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const linkGroups = [
  {
    title: "Programas",
    links: [
      { label: "Cursos", href: "/cursos" },
      { label: "Certificaciones", href: "/certificaciones" },
      { label: "Diplomados", href: "/diplomados" },
    ],
  },
  {
    title: "Institución",
    links: [
      { label: "Universidad IINICIA", href: "/universidad" },
      { label: "Iniciar sesión", href: "/login" },
      { label: "Registrarse", href: "/registro" },
    ],
  },
];

export function SiteFooter() {
  const pathname = usePathname();
  // La portada tiene su propio footer, con el boton del modo ambiente.
  if (pathname === "/") return null;

  return (
    <footer className="portal-global-footer mt-12 border-t">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 sm:grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <p className="text-[17px] font-semibold tracking-[0.16em] text-[var(--portal-text)]">
              IINICIA
            </p>
            <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-[var(--portal-muted)]">
              Instituto de Innovación y Ciencias Aplicadas. Formación en línea
              que conecta el conocimiento científico con tu vida profesional.
            </p>
          </div>

          {linkGroups.map((group) => (
            <div key={group.title}>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--portal-muted)]">
                {group.title}
              </p>
              <ul className="mt-4 space-y-3">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="portal-global-nav-link text-[13px]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-2 border-t border-[var(--portal-border)] pt-6 text-[12px] text-[var(--portal-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © 2026 Instituto de Innovación y Ciencias
            Aplicadas. Todos los derechos reservados.
          </p>
          <p>Aprende sin fronteras.</p>
        </div>
      </div>
    </footer>
  );
}