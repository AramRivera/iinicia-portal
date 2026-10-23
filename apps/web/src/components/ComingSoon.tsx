import Link from "next/link";

type ComingSoonProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function ComingSoon({ eyebrow, title, description }: ComingSoonProps) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-aurora"
      />

      <div className="mx-auto flex max-w-4xl flex-col items-center px-6 py-28 text-center sm:py-32">
        <p className="text-[15px] font-semibold tracking-tight text-accent">
          {eyebrow}
        </p>

        <h1 className="mt-3 text-balance text-[40px] font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-[64px]">
          {title}
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-pretty text-[19px] leading-snug text-muted sm:text-[24px]">
          {description}
        </p>

        <div className="mt-12 w-full max-w-md rounded-[32px] glass p-10 shadow-apple ring-1 ring-border">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 3h6M10 3v5.5L5.5 17a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3L14 8.5V3" />
              <path d="M7.5 14h9" />
            </svg>
          </span>
          <p className="mt-5 text-[21px] font-semibold tracking-tight text-foreground">
            Estamos trabajando para traerlo
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Estamos preparando esta sección con todo lo que necesitas. Vuelve
            pronto para descubrir las novedades de IINICIA.
          </p>
        </div>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <Link
            href="/"
            className="rounded-full bg-accent px-6 py-3 text-[17px] font-medium text-white transition-transform active:scale-[0.97] hover:bg-accent-strong"
          >
            Volver al inicio
          </Link>
          <Link
            href="/registro"
            className="inline-flex items-center gap-1 text-[17px] font-medium text-accent hover:underline"
          >
            Registrarme
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
  );
}