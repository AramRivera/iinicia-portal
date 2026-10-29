"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const linkGroups = [
  {
    title: "Programas",
    links: [
      { label: "Cursos", href: "/#cursos", id: "cursos" },
      { label: "Diplomados", href: "/#diplomados", id: "diplomados" },
      { label: "Certificaciones", href: "/#certificaciones", id: "certificaciones" },
    ],
  },
  {
    title: "Admisiones",
    links: [
      { label: "Proceso de admisión", href: "/#admisiones", id: "admisiones" },
      { label: "Requisitos de expediente", href: "/#admisiones", id: "admisiones" },
      { label: "Registro de aspirante", href: "/registro" },
    ],
  },
  {
    title: "Institución y Campus",
    links: [
      { label: "Universidad IINICIA", href: "/#universidad", id: "universidad" },
      { label: "Canales de contacto", href: "/#contacto", id: "contacto" },
      { label: "Portal de Alumnos", href: "/dashboard/estudiante" },
      { label: "Portal de Docentes", href: "/dashboard/docente" },
    ],
  },
];

export function SiteFooter() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string, id?: string) => {
    if (isHome && id) {
      e.preventDefault();
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        window.history.pushState(null, "", href);
      }
    }
  };

  return (
    <footer className="mt-20 border-t border-border bg-surface/50">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-[4px] bg-primary-action text-white text-xs font-bold">
                I
              </span>
              <p className="text-[17px] font-semibold tracking-tight text-foreground">
                IINICIA
              </p>
            </div>
            <p className="mt-2.5 max-w-xs text-[13px] leading-relaxed text-muted">
              Instituto de Innovación y Ciencias Aplicadas. Formación universitaria y continua en línea con integración transparente al Campus Virtual Moodle LMS.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs font-mono text-muted">
              <span className="h-2 w-2 rounded-full bg-accent-lime" />
              <span>Campus Virtual Activo • Ciclo 2026</span>
            </div>
          </div>

          {linkGroups.map((group) => (
            <div key={group.title}>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                {group.title}
              </p>
              <ul className="mt-4 space-y-3">
                {group.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      onClick={(e) => handleLinkClick(e, link.href, link.id)}
                      className="hover-underline text-[13px] text-foreground/80 hover:text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-2 border-t border-border pt-6 text-[12px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © 2026 Instituto de Innovación y Ciencias Aplicadas. Todos los derechos reservados.
          </p>
          <p>Aprende sin fronteras con Campus Tech OS.</p>
        </div>
      </div>
    </footer>
  );
}
