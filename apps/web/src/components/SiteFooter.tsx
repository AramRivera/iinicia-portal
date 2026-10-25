import Link from "next/link";

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
  return (
    <footer className="mt-20 border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 sm:grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <p className="text-[17px] font-semibold tracking-tight text-foreground">
              IINICIA
            </p>
            <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-muted">
              Instituto de Innovación y Ciencias Aplicadas. Formación en línea
              que conecta el conocimiento científico con tu vida profesional.
            </p>
          </div>

          {linkGroups.map((group) => (
            <div key={group.title}>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                {group.title}
              </p>
              <ul className="mt-4 space-y-3">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="hover-underline text-[13px] text-foreground/80"
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
            © {new Date().getFullYear()} Instituto de Innovación y Ciencias
            Aplicadas. Todos los derechos reservados.
          </p>
          <p>Aprende sin fronteras.</p>
        </div>
      </div>
    </footer>
  );
}