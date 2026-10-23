import Link from "next/link";
import { ScrollRevealText } from "@/components/ScrollRevealText";

type ProgramColor = "blue" | "violet" | "cyan";

const programs: {
  title: string;
  href: string;
  description: string;
  color: ProgramColor;
  icon: string;
}[] = [
  {
    title: "Cursos",
    href: "/cursos",
    description:
      "Programas cortos y prácticos para adquirir habilidades concretas en ciencias aplicadas y tecnología.",
    color: "blue",
    icon: "book",
  },
  {
    title: "Certificaciones",
    href: "/certificaciones",
    description:
      "Valida tus competencias con certificaciones reconocidas y respaldadas por IINICIA.",
    color: "violet",
    icon: "badge",
  },
  {
    title: "Diplomados",
    href: "/diplomados",
    description:
      "Formación especializada de mayor profundidad para impulsar tu carrera profesional.",
    color: "cyan",
    icon: "layers",
  },
];

const stats = [
  { value: "100%", label: "en línea" },
  { value: "+40", label: "programas" },
  { value: "24/7", label: "acceso al campus" },
  { value: "1000+", label: "estudiantes activos" },
];

export default function Home() {
  return (
    <>
      {/* ============================= HERO ============================= */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-aurora"
        />

        <div className="mx-auto max-w-5xl px-6 pb-20 pt-16 text-center sm:pb-28 sm:pt-24">
          <p className="text-[15px] font-semibold tracking-tight text-accent sm:text-[17px]">
            Instituto de Innovación y Ciencias Aplicadas
          </p>

          <ScrollRevealText
            as="h1"
            completeAt={0.5}
            className="mx-auto mt-4 block max-w-4xl text-balance text-[40px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[72px]"
          >
            Tu educación comienza hoy,
            <br className="hidden sm:block" /> estés donde estés.
          </ScrollRevealText>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-[19px] leading-snug text-muted sm:text-[24px]">
            El conocimiento que transforma tu vida está a tu alcance, en todo
            momento.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/registro"
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-6 py-3 text-[17px] font-medium text-white transition-transform active:scale-[0.97] hover:bg-accent-strong"
            >
              Comienza ahora
            </Link>
            <Link
              href="/universidad"
              className="inline-flex items-center gap-1 text-[17px] font-medium text-accent hover:underline"
            >
              Conoce IINICIA
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
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ============================= STATS ============================ */}
      <section className="border-y border-border">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-y-8 px-6 py-10 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[34px]">
                {stat.value}
              </p>
              <p className="mt-1 text-[13px] text-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* =========================== PROGRAMS =========================== */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[15px] font-semibold tracking-tight text-accent">
            Nuestros programas
          </p>

          <ScrollRevealText
            as="h2"
            completeAt={0.55}
            className="mt-3 block text-balance text-[32px] font-semibold leading-tight tracking-[-0.02em] sm:text-[44px]"
          >
            Aprende a tu ritmo, con propósito.
          </ScrollRevealText>

          <p className="mx-auto mt-4 max-w-xl text-pretty text-[17px] leading-relaxed text-muted sm:text-[19px]">
            Un modelo educativo flexible que combina rigor científico con
            aplicaciones reales, para que transformes lo que aprendes en
            resultados concretos.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center">
          {programs.map((program) => (
            <Link
              key={program.href}
              href={program.href}
              className={`program-card program-card--${program.color} w-full max-w-[340px] focus:outline-none`}
            >
              <span className="card-glow" aria-hidden />

              <div className="card-content w-[240px]">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/20 text-white">
                  <ProgramIcon name={program.icon} />
                </span>

                <h3 className="mt-4 text-[22px] font-semibold tracking-tight">
                  {program.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-white/85">
                  {program.description}
                </p>

                <span className="mt-4 inline-flex items-center gap-1 text-[14px] font-semibold text-white">
                  Explorar
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ============================= WHY ============================== */}
      <section className="bg-surface">
        <div className="mx-auto grid max-w-6xl gap-14 px-6 py-24 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-[15px] font-semibold tracking-tight text-accent">
              Por qué IINICIA
            </p>

            <ScrollRevealText
              as="h2"
              completeAt={0.55}
              className="mt-3 block text-balance text-[32px] font-semibold leading-tight tracking-[-0.02em] sm:text-[44px]"
            >
              Ciencia aplicada para el mundo real.
            </ScrollRevealText>

            <p className="mt-4 text-[17px] leading-relaxed text-muted sm:text-[19px]">
              En el Instituto de Innovación y Ciencias Aplicadas creemos que el
              conocimiento debe ser accesible, actual y directamente útil.
              Nuestros programas están diseñados por especialistas y centrados
              en la práctica.
            </p>

            <ul className="mt-8 space-y-4">
              {[
                "Contenido actualizado y basado en evidencia",
                "Docentes expertos en ciencia e innovación",
                "Flexibilidad total para estudiar en línea",
                "Certificación al completar cada programa",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  <span className="text-[15px] text-foreground sm:text-[17px]">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <div className="rounded-[32px] glass p-8 shadow-apple ring-1 ring-border">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-b from-[#0a84ff] to-[#0060df] text-white">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 3h6M10 3v5.5L5.5 17a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3L14 8.5V3" />
                    <path d="M7.5 14h9" />
                  </svg>
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-foreground">
                    Aprendizaje basado en proyectos
                  </p>
                  <p className="text-[13px] text-muted">
                    Ciencia, tecnología e innovación
                  </p>
                </div>
              </div>

              <div className="mt-7 space-y-3.5">
                {[70, 88, 55, 96].map((w, i) => (
                  <div
                    key={i}
                    className="h-2 rounded-full bg-accent-soft"
                    style={{ width: `${w}%` }}
                  />
                ))}
              </div>
              <p className="mt-6 text-[12px] text-muted">
                Progreso de ejemplo del campus virtual.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================== STATEMENT ========================== */}
      <section className="mx-auto max-w-5xl px-6 py-28 text-center sm:py-36">
        <ScrollRevealText
          as="h2"
          completeAt={0.6}
          className="mx-auto block max-w-4xl text-balance text-[40px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[80px]"
        >
          El conocimiento
          <br className="hidden sm:block" /> que transforma
          <br className="hidden sm:block" /> tu vida.
        </ScrollRevealText>
      </section>

      {/* ============================= CTA ============================== */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-[36px] bg-[#0b0b0f] px-8 py-20 text-center sm:px-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage:
                "radial-gradient(60% 60% at 50% 0%, rgba(10,132,255,0.9) 0%, transparent 70%)",
            }}
          />

          <div className="relative">
            <ScrollRevealText
              as="h2"
              completeAt={0.55}
              className="mx-auto block max-w-2xl text-balance text-[32px] font-semibold leading-tight tracking-[-0.02em] sm:text-[48px]"
            >
              Da el primer paso hacia tu futuro.
            </ScrollRevealText>

            <p className="mx-auto mt-4 max-w-xl text-pretty text-[17px] text-white/70 sm:text-[19px]">
              Regístrate hoy y accede a cursos, certificaciones y diplomados
              diseñados para transformar tu vida.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/registro"
                className="rounded-full bg-accent px-6 py-3 text-[17px] font-medium text-white transition-transform active:scale-[0.97] hover:bg-accent-strong"
              >
                Comienza ahora
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-white/20 px-6 py-3 text-[17px] font-medium text-white transition-colors hover:bg-white/10"
              >
                Iniciar sesión
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function ProgramIcon({ name }: { name: string }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (name === "book") {
    return (
      <svg {...common}>
        <path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5z" />
        <path d="M8 7h8M8 11h6" />
      </svg>
    );
  }
  if (name === "badge") {
    return (
      <svg {...common}>
        <circle cx="12" cy="9" r="5" />
        <path d="M8.5 13.5L7 22l5-2.5L17 22l-1.5-8.5" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 2l9 5-9 5-9-5 9-5z" />
      <path d="M3 12l9 5 9-5M3 17l9 5 9-5" />
    </svg>
  );
}