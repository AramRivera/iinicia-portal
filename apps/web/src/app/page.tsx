"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type AuthMode = "login" | "register" | "recover";

type Course = {
  id: number;
  title: string;
  category: string;
  level: string;
  duration: string;
  description: string;
  symbol: string;
  tag: string;
};

const courses: Course[] = [
  {
    id: 1,
    title: "Fundamentos de inteligencia artificial",
    category: "Tecnología",
    level: "Principiante",
    duration: "6 módulos",
    description:
      "Comprende los conceptos esenciales de la IA y descubre cómo se aplica en situaciones reales.",
    symbol: "✳",
    tag: "Tendencia",
  },
  {
    id: 2,
    title: "Análisis de datos para tomar decisiones",
    category: "Tecnología",
    level: "Intermedio",
    duration: "8 módulos",
    description:
      "Aprende a interpretar información, identificar patrones y comunicar hallazgos con claridad.",
    symbol: "⌁",
    tag: "Popular",
  },
  {
    id: 3,
    title: "Liderazgo y gestión de equipos",
    category: "Negocios",
    level: "Principiante",
    duration: "5 módulos",
    description:
      "Desarrolla herramientas para colaborar, organizar tareas y acompañar a un equipo.",
    symbol: "↗",
    tag: "Habilidades",
  },
  {
    id: 4,
    title: "Marketing digital desde cero",
    category: "Marketing",
    level: "Principiante",
    duration: "7 módulos",
    description:
      "Conoce los canales digitales, define audiencias y estructura una estrategia básica.",
    symbol: "◎",
    tag: "Nuevo",
  },
  {
    id: 5,
    title: "Organización y productividad personal",
    category: "Desarrollo personal",
    level: "Todos los niveles",
    duration: "4 módulos",
    description:
      "Crea mejores hábitos, prioriza actividades y administra tu tiempo con intención.",
    symbol: "◷",
    tag: "A tu ritmo",
  },
  {
    id: 6,
    title: "Fundamentos de gestión de proyectos",
    category: "Negocios",
    level: "Intermedio",
    duration: "6 módulos",
    description:
      "Conoce cómo planear objetivos, coordinar recursos y dar seguimiento a un proyecto.",
    symbol: "⌘",
    tag: "Práctico",
  },
];

const faqs = [
  {
    question: "¿Necesito una cuenta para explorar los cursos?",
    answer:
      "No para esta demostración. Puedes explorar las categorías y los cursos desde la página principal. El registro se presenta como una interfaz visual y todavía no crea usuarios reales.",
  },
  {
    question: "¿Los cursos ya están disponibles?",
    answer:
      "El catálogo que ves es contenido de muestra para diseñar y probar la experiencia. La publicación de cursos reales se podrá incorporar cuando exista una fuente de contenido conectada.",
  },
  {
    question: "¿Puedo estudiar desde el celular?",
    answer:
      "La interfaz está diseñada para adaptarse a pantallas grandes y pequeñas. La experiencia de aprendizaje real dependerá de la implementación de las funciones y los contenidos.",
  },
  {
    question: "¿El inicio de sesión ya valida mis datos?",
    answer:
      "No. El formulario permite probar la interacción visual, pero no autentica usuarios ni envía contraseñas a un servidor. No introduzcas contraseñas reales en esta versión.",
  },
];

export default function Page() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [favorites, setFavorites] = useState<number[]>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [newsletterSent, setNewsletterSent] = useState(false);
  const [contactSent, setContactSent] = useState(false);

  const categories = [
    "Todos",
    "Tecnología",
    "Negocios",
    "Marketing",
    "Desarrollo personal",
  ];

  const visibleCourses = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return courses.filter((course) => {
      const matchesCategory =
        activeCategory === "Todos" || course.category === activeCategory;
      const matchesSearch =
        normalizedQuery.length === 0 ||
        `${course.title} ${course.category} ${course.description}`
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  // Las secciones y tarjetas aparecen al entrar en pantalla y se desvanecen
  // al salir. Al desplazarse de regreso, vuelven a aparecer.
  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (typeof IntersectionObserver === "undefined") {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          } else {
            entry.target.classList.remove("is-visible");
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -35px 0px" }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [activeCategory, searchQuery, openFaq]);

  useEffect(() => {
    if (!authOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAuthOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [authOpen]);

  const goTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setMenuOpen(false);
  };

  const openAuth = (mode: AuthMode) => {
    setAuthMode(mode);
    setShowPassword(false);
    setAuthOpen(true);
    setMenuOpen(false);
    setNotice("");
  };

  const showComingSoon = (feature: string) => {
    setNotice(
      `${feature}: esta función es una demostración visual y estará disponible cuando se implemente el sistema completo.`
    );
    setMenuOpen(false);
    window.setTimeout(() => setNotice(""), 6500);
  };

  const handleAuthSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message =
      authMode === "login"
        ? "Formulario de acceso probado. No se inició sesión porque todavía no hay backend conectado."
        : authMode === "register"
          ? "Formulario de registro probado. No se creó ninguna cuenta porque todavía no hay backend conectado."
          : "Formulario de recuperación probado. Aún no se envían correos porque no hay backend conectado.";
    setAuthOpen(false);
    setNotice(message);
    window.setTimeout(() => setNotice(""), 7000);
  };

  const toggleFavorite = (courseId: number) => {
    setFavorites((current) =>
      current.includes(courseId)
        ? current.filter((id) => id !== courseId)
        : [...current, courseId]
    );
  };

  const handleNewsletter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNewsletterSent(true);
  };

  const handleContact = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setContactSent(true);
  };

  return (
    <div className="iinicia-site relative min-h-screen overflow-x-hidden bg-[#09090b] font-sans text-zinc-200 selection:bg-red-500/30 selection:text-white">
      <style jsx global>{`
        html {
          scroll-behavior: smooth;
          scroll-padding-top: 96px;
        }
        body {
          background: #09090b;
        }
        .reveal {
          opacity: 0;
          transform: translate3d(0, 28px, 0);
          transition: opacity 650ms ease, transform 650ms cubic-bezier(.2,.7,.2,1);
          will-change: opacity, transform;
        }
        .reveal.is-visible {
          opacity: 1;
          transform: translate3d(0, 0, 0);
        }
        .reveal-delay-1 { transition-delay: 90ms; }
        .reveal-delay-2 { transition-delay: 160ms; }
        .reveal-delay-3 { transition-delay: 230ms; }
        .iinicia-grid {
          background-image: linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: linear-gradient(to bottom, black, transparent 92%);
        }
        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
          .reveal, .reveal.is-visible {
            opacity: 1;
            transform: none;
            transition: none;
          }
        }
      `}</style>

      {/* Decorative background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[680px] overflow-hidden"
      >
        <div className="iinicia-grid absolute inset-0 opacity-60" />
        <div className="absolute left-[-9rem] top-[-10rem] h-[26rem] w-[26rem] rounded-full bg-red-700/20 blur-[130px]" />
        <div className="absolute right-[-8rem] top-32 h-[28rem] w-[28rem] rounded-full bg-rose-900/15 blur-[140px]" />
      </div>

      {/* Announcement strip */}
      <div className="relative z-30 border-b border-white/5 bg-red-950/35 px-4 py-2 text-center text-xs text-red-100/90 sm:text-sm">
        <span className="mr-2 inline-flex rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300">
          IINICIA
        </span>
        Una nueva forma de aprender, explorar y crecer.
        <button
          type="button"
          onClick={() => { window.location.href = "/cursos"; }}
          className="ml-2 font-semibold text-white underline decoration-red-500 underline-offset-4 hover:text-red-200"
        >
          Explorar cursos →
        </button>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#09090b]/85 px-4 backdrop-blur-2xl sm:px-6 lg:px-10">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between gap-4">
          <a
            href="#inicio"
            onClick={() => setMenuOpen(false)}
            className="flex shrink-0 items-center gap-3"
            aria-label="IINICIA, ir al inicio"
          >
            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/70 bg-red-500/10 shadow-[0_0_28px_rgba(220,38,38,.14)]">
              <span className="text-sm font-black tracking-tight text-red-400">I²</span>
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#09090b] bg-red-500" />
            </span>
            <span>
              <span className="block text-lg font-black tracking-[0.16em] text-white">IINICIA</span>
              <span className="-mt-0.5 block text-[9px] font-medium uppercase tracking-[0.23em] text-zinc-500">Aprendizaje digital</span>
            </span>
          </a>

          <nav aria-label="Navegación principal" className="hidden items-center gap-7 text-[13px] font-medium text-zinc-400 lg:flex">
            <a href="#inicio" className="transition hover:text-white">Inicio</a>
            <a href="/cursos" className="transition hover:text-white">Cursos</a>
            <a href="#rutas" className="transition hover:text-white">Rutas de aprendizaje</a>
            <a href="#nosotros" className="transition hover:text-white">Nosotros</a>
            <a href="#preguntas" className="transition hover:text-white">Ayuda</a>
          </nav>

          <div className="hidden items-center gap-3 sm:flex">
            <button
              type="button"
              onClick={() => openAuth("login")}
              className="rounded-lg px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:text-white"
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => openAuth("register")}
              className="group inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-950/40 transition hover:bg-red-500"
            >
              Crear cuenta <span className="transition group-hover:translate-x-0.5">↗</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white sm:hidden"
          >
            {menuOpen ? "Cerrar ✕" : "Menú ☰"}
          </button>
        </div>

        {menuOpen && (
          <nav aria-label="Navegación móvil" className="border-t border-white/10 py-3 sm:hidden">
            {[
              ["Inicio", "inicio"],
              ["Cursos", "cursos"],
              ["Rutas de aprendizaje", "rutas"],
              ["Nosotros", "nosotros"],
              ["Preguntas frecuentes", "preguntas"],
              ["Contacto", "contacto"],
            ].map(([label, id]) => (
              <button
                key={id}
                type="button"
                onClick={() => { if (id === "cursos") { window.location.href = "/cursos"; } else { goTo(id); } }}
                className="block w-full rounded-lg px-3 py-3 text-left text-sm text-zinc-300 hover:bg-white/5 hover:text-white"
              >
                {label}
              </button>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
              <button type="button" onClick={() => openAuth("login")} className="rounded-lg border border-white/10 px-3 py-3 text-sm font-semibold text-white">Iniciar sesión</button>
              <button type="button" onClick={() => openAuth("register")} className="rounded-lg bg-red-600 px-3 py-3 text-sm font-bold text-white">Crear cuenta</button>
            </div>
          </nav>
        )}
      </header>

      {/* Inline notices */}
      {notice && (
        <div role="status" aria-live="polite" className="fixed right-4 top-24 z-[70] flex max-w-md items-start gap-3 rounded-xl border border-red-400/30 bg-[#181012] p-4 shadow-2xl shadow-black/40">
          <span className="mt-0.5 text-red-400">✦</span>
          <p className="flex-1 text-sm leading-6 text-zinc-200">{notice}</p>
          <button type="button" onClick={() => setNotice("")} aria-label="Cerrar aviso" className="text-zinc-500 hover:text-white">✕</button>
        </div>
      )}

      <main className="relative z-10">
        {/* Hero */}
        <section id="inicio" className="scroll-mt-28 px-4 pb-20 pt-14 sm:px-6 sm:pb-28 sm:pt-20 lg:px-10 lg:pt-24">
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.02fr_.98fr] lg:gap-12">
            <div data-reveal className="reveal">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-red-500/25 bg-red-500/[0.08] px-3.5 py-2 text-xs font-semibold text-red-200">
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-50" /><span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" /></span>
                APRENDE. CRECE. TRANSFORMA.
              </div>
              <h1 className="max-w-3xl text-4xl font-black leading-[1.08] tracking-tight text-white sm:text-5xl md:text-6xl xl:text-7xl">
                El siguiente paso de tu futuro <span className="bg-gradient-to-r from-red-400 via-red-500 to-rose-700 bg-clip-text text-transparent">comienza aquí.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-400 sm:text-lg">
                Explora nuevas habilidades, descubre áreas de conocimiento y construye tu propio camino de aprendizaje con una experiencia digital pensada para ti.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={() => { window.location.href = "/cursos"; }} className="group inline-flex items-center justify-center gap-3 rounded-xl bg-red-600 px-6 py-4 text-sm font-extrabold text-white shadow-xl shadow-red-950/40 transition hover:-translate-y-0.5 hover:bg-red-500">
                  Explorar cursos <span className="transition group-hover:translate-x-1">→</span>
                </button>
                <button type="button" onClick={() => openAuth("register")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-4 text-sm font-bold text-white transition hover:border-white/20 hover:bg-white/[0.06]">
                  Crear cuenta gratis <span className="text-red-400">↗</span>
                </button>
              </div>
              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-zinc-500">
                <span className="inline-flex items-center gap-2"><span className="text-red-400">✓</span> Aprende a tu ritmo</span>
                <span className="inline-flex items-center gap-2"><span className="text-red-400">✓</span> Explora distintas áreas</span>
                <span className="inline-flex items-center gap-2"><span className="text-red-400">✓</span> Desde cualquier dispositivo</span>
              </div>
            </div>

            {/* Visual dashboard mockup */}
            <div data-reveal className="reveal reveal-delay-2 relative mx-auto w-full max-w-xl">
              <div aria-hidden="true" className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-red-600/20 via-transparent to-rose-900/20 blur-2xl" />
              <div className="relative overflow-hidden rounded-[1.7rem] border border-white/10 bg-[#111113]/95 p-4 shadow-2xl shadow-black/50 sm:p-6">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                    <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Mi espacio de aprendizaje</span>
                  <span className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-zinc-400">Vista previa</span>
                </div>
                <div className="grid gap-4 pt-5 sm:grid-cols-[1.1fr_.9fr]">
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
                    <p className="text-xs font-medium text-zinc-500">TU PRÓXIMO OBJETIVO</p>
                    <h2 className="mt-3 text-2xl font-bold leading-tight text-white">Aprender algo que te impulse.</h2>
                    <p className="mt-3 text-sm leading-6 text-zinc-400">Organiza tus intereses y empieza a explorar nuevas posibilidades.</p>
                    <div className="mt-6 flex items-center gap-3 rounded-xl bg-red-500/[0.08] p-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-xl text-red-400">✳</span>
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">Inteligencia artificial</p><p className="mt-1 text-xs text-zinc-500">Ruta de aprendizaje</p></div>
                      <span className="text-red-400">↗</span>
                    </div>
                  </div>
                  <div className="grid gap-4">
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
                      <div className="flex items-center justify-between"><p className="text-xs text-zinc-500">Tu actividad</p><span className="text-lg text-red-400">⌁</span></div>
                      <p className="mt-3 text-xl font-bold text-white">A tu ritmo</p>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">Avanza según tus objetivos y disponibilidad.</p>
                      <div className="mt-4 flex h-10 items-end gap-1.5">{[35, 52, 42, 76, 57, 88, 66, 100, 72, 91, 58, 80].map((height, index) => <span key={index} className={`flex-1 rounded-t-sm ${index === 7 ? "bg-red-500" : "bg-red-500/25"}`} style={{ height: `${height}%` }} />)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-red-950/60 to-white/[0.02] p-4">
                      <p className="text-xs font-medium text-zinc-500">DESCUBRE</p>
                      <p className="mt-2 text-lg font-bold text-white">Tu próximo tema favorito</p>
                      <p className="mt-2 text-xs leading-5 text-zinc-400">Tecnología, negocios, creatividad y mucho más.</p>
                      <button type="button" onClick={() => goTo("categorias")} className="mt-3 text-xs font-bold text-red-300 hover:text-white">Ver categorías →</button>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3">
                  <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">✓</span><div><p className="text-xs font-semibold text-white">Tu aprendizaje, tu camino</p><p className="mt-1 text-[10px] text-zinc-500">Interfaz de demostración</p></div></div>
                  <span className="text-xs text-zinc-500">IINICIA / 01</span>
                </div>
              </div>
              <div className="absolute -bottom-5 -left-4 hidden rounded-xl border border-white/10 bg-[#151517] px-4 py-3 shadow-xl sm:block"><p className="text-[10px] uppercase tracking-widest text-zinc-500">Explora</p><p className="mt-1 text-sm font-bold text-white">Conocimiento sin límites</p></div>
            </div>
          </div>
        </section>

        {/* Benefits ribbon */}
        <section className="border-y border-white/[0.07] bg-white/[0.018] px-4 py-6 sm:px-6 lg:px-10">
          <div className="mx-auto grid max-w-7xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["◷", "A tu propio ritmo", "Organiza tu aprendizaje"],
              ["⌘", "Contenido por áreas", "Encuentra lo que te interesa"],
              ["↗", "Enfoque práctico", "Conecta ideas con objetivos"],
              ["◎", "Diseño adaptable", "En computadora o móvil"],
            ].map(([icon, title, desc], index) => (
              <div key={title} data-reveal className={`reveal flex items-center gap-3 ${index > 0 ? "lg:border-l lg:border-white/[0.08] lg:pl-6" : ""}`}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-500/15 bg-red-500/[0.07] text-xl text-red-400">{icon}</span>
                <div><p className="text-sm font-bold text-white">{title}</p><p className="mt-1 text-xs text-zinc-500">{desc}</p></div>
              </div>
            ))}
          </div>
        </section>

        {/* Categories */}
        <section id="categorias" className="scroll-mt-28 px-4 py-20 sm:px-6 sm:py-24 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div data-reveal className="reveal flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div><p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-red-400">Encuentra tu área</p><h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Conocimiento para cada interés.</h2><p className="mt-4 max-w-2xl leading-7 text-zinc-400">Explora temas que te ayuden a descubrir habilidades, fortalecer tus conocimientos y abrir nuevas posibilidades.</p></div>
              <a href="/cursos" className="shrink-0 self-start rounded-lg border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:border-red-500/50 hover:bg-red-500/[0.06] md:self-auto">Ver todo el catálogo ↗</a>
            </div>
            <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { name: "Tecnología", description: "IA, datos y herramientas digitales", icon: "⌘", color: "from-red-500/20" },
                { name: "Negocios", description: "Liderazgo, proyectos y estrategia", icon: "↗", color: "from-orange-500/15" },
                { name: "Marketing", description: "Audiencias, contenido y marcas", icon: "◎", color: "from-fuchsia-500/15" },
                { name: "Desarrollo personal", description: "Hábitos, habilidades y enfoque", icon: "✧", color: "from-rose-500/15" },
              ].map((category, index) => (
                <button key={category.name} type="button" onClick={() => { setActiveCategory(category.name); goTo("cursos"); }} data-reveal className={`reveal ${index === 1 ? "reveal-delay-1" : index === 2 ? "reveal-delay-2" : index === 3 ? "reveal-delay-3" : ""} group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br ${category.color} to-transparent p-6 text-left transition duration-300 hover:-translate-y-1 hover:border-red-500/40`}>
                  <div className="absolute right-4 top-3 text-5xl font-light text-white/[0.06]">{category.icon}</div>
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-2xl text-red-300">{category.icon}</span>
                  <h3 className="mt-6 text-lg font-bold text-white">{category.name}</h3>
                  <p className="mt-2 min-h-10 text-sm leading-6 text-zinc-400">{category.description}</p>
                  <span className="mt-5 inline-block text-sm font-bold text-red-300 transition group-hover:translate-x-1">Explorar área →</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Course catalog */}
        <section id="cursos" className="scroll-mt-28 border-y border-white/[0.07] bg-[#0d0d10] px-4 py-20 sm:px-6 sm:py-24 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div data-reveal className="reveal flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div><p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-red-400">Catálogo de aprendizaje</p><h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Empieza por algo que te inspire.</h2><p className="mt-4 max-w-2xl leading-7 text-zinc-400">Busca por tema, filtra por categoría y guarda los cursos que quieras revisar después.</p></div>
              <div className="flex flex-wrap gap-2 text-xs text-zinc-400"><span className="rounded-full border border-white/10 px-3 py-2">{courses.length} cursos de muestra</span><span className="rounded-full border border-white/10 px-3 py-2">{favorites.length} guardados</span></div>
            </div>

            <div className="mt-9 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-sm"><label htmlFor="course-search" className="sr-only">Buscar cursos</label><span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-zinc-500">⌕</span><input id="course-search" type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar cursos o temas..." className="w-full rounded-xl border border-white/10 bg-black/30 py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-red-500/70 focus:ring-1 focus:ring-red-500/30" /></div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {categories.map((category) => <button key={category} type="button" onClick={() => setActiveCategory(category)} aria-pressed={activeCategory === category} className={`whitespace-nowrap rounded-full border px-4 py-2.5 text-xs font-semibold transition ${activeCategory === category ? "border-red-500 bg-red-600 text-white" : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-white"}`}>{category}</button>)}
              </div>
            </div>

            {visibleCourses.length > 0 ? (
              <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {visibleCourses.map((course, index) => (
                  <article key={course.id} data-reveal className={`reveal ${index % 3 === 1 ? "reveal-delay-1" : index % 3 === 2 ? "reveal-delay-2" : ""} group flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111114] transition duration-300 hover:-translate-y-1 hover:border-red-500/35`}>
                    <div className="relative flex min-h-40 items-end overflow-hidden bg-gradient-to-br from-red-950/80 via-[#171114] to-[#101013] p-5">
                      <div aria-hidden="true" className="absolute -right-4 -top-12 h-44 w-44 rounded-full border border-white/[0.07]" /><div aria-hidden="true" className="absolute -right-1 -top-5 h-32 w-32 rounded-full border border-red-300/10" /><div aria-hidden="true" className="absolute bottom-[-4rem] left-20 h-36 w-36 rounded-full bg-red-600/20 blur-3xl" />
                      <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-red-400/20 bg-black/30 text-3xl text-red-300">{course.symbol}</span>
                      <span className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-red-200">{course.tag}</span>
                      <button type="button" onClick={() => toggleFavorite(course.id)} aria-label={favorites.includes(course.id) ? `Quitar ${course.title} de guardados` : `Guardar ${course.title}`} aria-pressed={favorites.includes(course.id)} className={`absolute bottom-5 right-4 flex h-10 w-10 items-center justify-center rounded-full border text-lg transition ${favorites.includes(course.id) ? "border-red-500/50 bg-red-500/20 text-red-300" : "border-white/10 bg-black/20 text-zinc-400 hover:text-white"}`}>{favorites.includes(course.id) ? "♥" : "♡"}</button>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500"><span>{course.category}</span><span className="text-zinc-700">•</span><span>{course.level}</span></div>
                      <h3 className="mt-3 text-lg font-bold leading-snug text-white">{course.title}</h3>
                      <p className="mt-3 flex-1 text-sm leading-6 text-zinc-400">{course.description}</p>
                      <div className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-4"><span className="text-xs text-zinc-500">▤ {course.duration}</span><button type="button" onClick={() => showComingSoon(`El programa “${course.title}”`)} className="text-xs font-bold text-red-300 transition hover:text-white">Ver programa ↗</button></div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-7 rounded-2xl border border-dashed border-white/15 px-6 py-14 text-center"><span className="text-3xl text-zinc-600">⌕</span><h3 className="mt-3 font-bold text-white">No encontramos resultados</h3><p className="mt-2 text-sm text-zinc-500">Prueba con otra palabra o cambia la categoría seleccionada.</p><button type="button" onClick={() => { setSearchQuery(""); setActiveCategory("Todos"); }} className="mt-5 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-500">Limpiar filtros</button></div>
            )}
            <p className="mt-5 text-center text-xs text-zinc-600">Los cursos de esta sección son ejemplos de contenido para la maqueta visual.</p>
          </div>
        </section>

        {/* Learning paths */}
        <section id="rutas" className="scroll-mt-28 px-4 py-20 sm:px-6 sm:py-24 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div data-reveal className="reveal mx-auto max-w-3xl text-center"><p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-red-400">Una ruta clara</p><h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">No solo tomes cursos. Construye un camino.</h2><p className="mt-4 leading-7 text-zinc-400">Agrupa tus intereses y avanza con una estructura que te ayude a convertir objetivos amplios en pasos manejables.</p></div>
            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {[
                { no: "01", name: "Ruta digital", title: "Comprende la tecnología", detail: "Conceptos digitales, herramientas de trabajo y pensamiento basado en datos.", tags: ["Tecnología", "Datos", "Innovación"] },
                { no: "02", name: "Ruta profesional", title: "Desarrolla habilidades de trabajo", detail: "Comunicación, liderazgo y organización para proyectos y equipos.", tags: ["Liderazgo", "Proyectos", "Comunicación"] },
                { no: "03", name: "Ruta creativa", title: "Comunica ideas con intención", detail: "Estrategia de contenido, marketing y resolución creativa de problemas.", tags: ["Marketing", "Creatividad", "Estrategia"] },
              ].map((path, index) => <article key={path.no} data-reveal className={`reveal ${index === 1 ? "reveal-delay-1" : index === 2 ? "reveal-delay-2" : ""} relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-7`}><span className="absolute right-5 top-3 text-6xl font-black text-white/[0.035]">{path.no}</span><p className="text-xs font-bold uppercase tracking-[0.2em] text-red-400">{path.name}</p><h3 className="mt-4 text-xl font-bold text-white">{path.title}</h3><p className="mt-3 min-h-[72px] text-sm leading-6 text-zinc-400">{path.detail}</p><div className="mt-5 flex flex-wrap gap-2">{path.tags.map((tag) => <span key={tag} className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] text-zinc-400">{tag}</span>)}</div><button type="button" onClick={() => showComingSoon(`La ${path.name.toLowerCase()}`)} className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-white hover:text-red-300">Explorar ruta <span className="text-red-400">→</span></button></article>)}
            </div>
          </div>
        </section>

        {/* About / Why */}
        <section id="nosotros" className="scroll-mt-28 border-y border-white/[0.07] bg-[#0d0d10] px-4 py-20 sm:px-6 sm:py-24 lg:px-10">
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[.9fr_1.1fr]">
            <div data-reveal className="reveal">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-red-400">La experiencia IINICIA</p>
              <h2 className="text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">Aprender debe sentirse como avanzar, no como detenerse.</h2>
              <p className="mt-5 leading-7 text-zinc-400">Por eso la experiencia está organizada para ayudarte a explorar, elegir un tema, revisar opciones y dar el siguiente paso con claridad. Esta maqueta muestra la estructura visual propuesta para el portal.</p>
              <button type="button" onClick={() => goTo("contacto")} className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-red-300 hover:text-white">Conoce más sobre el proyecto <span>→</span></button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: "◈", title: "Diseño centrado en ti", copy: "Navegación sencilla, jerarquía visual y accesos claros." },
                { icon: "⌕", title: "Explora con facilidad", copy: "Búsqueda y filtros para encontrar temas de tu interés." },
                { icon: "♡", title: "Guarda tus favoritos", copy: "Marca cursos que quieras revisar después en esta sesión." },
                { icon: "↗", title: "Enfócate en tus metas", copy: "Descubre rutas y opciones para organizar tus próximos pasos." },
              ].map((item, index) => <div key={item.title} data-reveal className={`reveal ${index % 2 ? "reveal-delay-1" : ""} rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6`}><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 text-xl text-red-300">{item.icon}</span><h3 className="mt-5 font-bold text-white">{item.title}</h3><p className="mt-2 text-sm leading-6 text-zinc-400">{item.copy}</p></div>)}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="como-funciona" className="scroll-mt-28 px-4 py-20 sm:px-6 sm:py-24 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div data-reveal className="reveal text-center"><p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-red-400">Empieza en tres pasos</p><h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Tu próximo paso es más sencillo.</h2><p className="mx-auto mt-4 max-w-2xl leading-7 text-zinc-400">Una experiencia pensada para pasar de la curiosidad a un plan de aprendizaje.</p></div>
            <div className="relative mt-12 grid gap-8 md:grid-cols-3">
              <div aria-hidden="true" className="absolute left-[17%] right-[17%] top-8 hidden border-t border-dashed border-red-500/30 md:block" />
              {[
                { number: "01", title: "Explora", copy: "Recorre las áreas y encuentra temas relacionados con tus intereses." },
                { number: "02", title: "Elige", copy: "Revisa los cursos de muestra y guarda los que quieras consultar." },
                { number: "03", title: "Avanza", copy: "Define tus objetivos y prepárate para desarrollar tus habilidades." },
              ].map((step, index) => <div key={step.number} data-reveal className={`reveal ${index === 1 ? "reveal-delay-1" : index === 2 ? "reveal-delay-2" : ""} relative text-center`}><span className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/30 bg-[#140d0f] text-lg font-black text-red-300 shadow-[0_0_30px_rgba(220,38,38,.10)]">{step.number}</span><h3 className="mt-5 text-xl font-bold text-white">{step.title}</h3><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-zinc-400">{step.copy}</p></div>)}
            </div>
          </div>
        </section>

        {/* Featured CTA */}
        <section className="px-4 pb-20 sm:px-6 sm:pb-24 lg:px-10">
          <div data-reveal className="reveal relative mx-auto max-w-7xl overflow-hidden rounded-3xl border border-red-500/20 bg-gradient-to-br from-[#321015] via-[#170d10] to-[#0e0e11] p-7 sm:p-10 lg:p-14">
            <div aria-hidden="true" className="absolute -right-16 -top-24 h-72 w-72 rounded-full border border-red-300/10" /><div aria-hidden="true" className="absolute -right-4 -top-12 h-48 w-48 rounded-full border border-red-300/10" /><div aria-hidden="true" className="absolute bottom-[-7rem] right-1/4 h-56 w-56 rounded-full bg-red-600/10 blur-3xl" />
            <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.24em] text-red-300">Es tu momento</p><h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">Todo gran cambio empieza con una primera decisión.</h2><p className="mt-4 leading-7 text-zinc-300/75">Da el primer paso, explora las opciones y descubre nuevas oportunidades de aprendizaje.</p></div><div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row"><button type="button" onClick={() => { window.location.href = "/cursos"; }} className="rounded-xl bg-white px-6 py-3.5 text-sm font-extrabold text-black transition hover:bg-zinc-200">Explorar cursos</button><button type="button" onClick={() => openAuth("register")} className="rounded-xl border border-white/20 bg-black/20 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/10">Crear cuenta ↗</button></div></div>
          </div>
        </section>

        {/* FAQ */}
        <section id="preguntas" className="scroll-mt-28 border-y border-white/[0.07] bg-[#0d0d10] px-4 py-20 sm:px-6 sm:py-24 lg:px-10">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.7fr_1.3fr]">
            <div data-reveal className="reveal"><p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-red-400">¿Tienes dudas?</p><h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Preguntas frecuentes.</h2><p className="mt-4 leading-7 text-zinc-400">Respuestas sobre esta versión del portal y las funciones que puedes probar.</p><button type="button" onClick={() => goTo("contacto")} className="mt-6 text-sm font-bold text-red-300 hover:text-white">¿No encontraste tu respuesta? Escríbenos →</button></div>
            <div className="space-y-3">{faqs.map((faq, index) => <div key={faq.question} data-reveal className={`reveal overflow-hidden rounded-xl border ${openFaq === index ? "border-red-500/30 bg-red-500/[0.035]" : "border-white/[0.08] bg-white/[0.02]"}`}><button type="button" aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? null : index)} className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left"><span className="text-sm font-semibold text-white sm:text-base">{faq.question}</span><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-lg transition ${openFaq === index ? "rotate-45 border-red-500/40 text-red-300" : "border-white/10 text-zinc-400"}`}>+</span></button>{openFaq === index && <div className="px-5 pb-5"><p className="border-t border-white/[0.07] pt-4 text-sm leading-7 text-zinc-400">{faq.answer}</p></div>}</div>)}</div>
          </div>
        </section>

        {/* Contact and newsletter */}
        <section id="contacto" className="scroll-mt-28 px-4 py-20 sm:px-6 sm:py-24 lg:px-10">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.85fr_1.15fr]">
            <div data-reveal className="reveal">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-red-400">Hablemos</p><h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">¿Tienes una pregunta o una idea?</h2><p className="mt-4 max-w-lg leading-7 text-zinc-400">Este formulario es una muestra visual de la sección de contacto. Al enviarlo se mostrará una confirmación local, sin transmitir datos.</p>
              <div className="mt-8 space-y-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-red-300">✉</span><div><p className="text-sm font-semibold text-white">Contacto del proyecto</p><p className="mt-1 text-xs text-zinc-500">Formulario de demostración</p></div></div><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-red-300">◷</span><div><p className="text-sm font-semibold text-white">Consulta cuando lo necesites</p><p className="mt-1 text-xs text-zinc-500">La comunicación real se habilitará posteriormente</p></div></div></div>
            </div>
            <form onSubmit={handleContact} data-reveal className="reveal reveal-delay-1 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-7">
              {contactSent ? <div className="py-10 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-2xl text-emerald-400">✓</span><h3 className="mt-4 text-xl font-bold text-white">¡Formulario probado!</h3><p className="mt-2 text-sm leading-6 text-zinc-400">La demostración registró la interacción en pantalla. No se envió ningún mensaje a un servidor.</p><button type="button" onClick={() => setContactSent(false)} className="mt-5 text-sm font-bold text-red-300 hover:text-white">Enviar otra consulta</button></div> : <><div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="contact-name" className="mb-2 block text-xs font-semibold text-zinc-300">Nombre</label><input id="contact-name" name="name" required placeholder="Tu nombre" className="w-full rounded-lg border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-red-500/60" /></div><div><label htmlFor="contact-email" className="mb-2 block text-xs font-semibold text-zinc-300">Correo electrónico</label><input id="contact-email" name="email" type="email" required placeholder="tu@correo.com" className="w-full rounded-lg border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-red-500/60" /></div></div><div className="mt-4"><label htmlFor="contact-topic" className="mb-2 block text-xs font-semibold text-zinc-300">Tema de consulta</label><select id="contact-topic" name="topic" className="w-full rounded-lg border border-white/10 bg-[#111114] px-4 py-3 text-sm text-zinc-300 outline-none focus:border-red-500/60"><option>Información general</option><option>Oferta educativa</option><option>Acceso al portal</option><option>Comentarios sobre la página</option></select></div><div className="mt-4"><label htmlFor="contact-message" className="mb-2 block text-xs font-semibold text-zinc-300">Mensaje</label><textarea id="contact-message" name="message" required rows={4} placeholder="Cuéntanos cómo podemos ayudarte..." className="w-full resize-y rounded-lg border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-red-500/60" /></div><button type="submit" className="mt-5 w-full rounded-lg bg-red-600 px-5 py-3.5 text-sm font-extrabold text-white transition hover:bg-red-500">Probar formulario de contacto →</button><p className="mt-3 text-center text-[11px] leading-5 text-zinc-600">No se envían ni se almacenan tus datos en un servidor.</p></>}
            </form>
          </div>
        </section>

        {/* Newsletter */}
        <section className="px-4 pb-20 sm:px-6 lg:px-10">
          <div data-reveal className="reveal mx-auto flex max-w-7xl flex-col gap-7 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-red-400">Mantente al tanto</p><h2 className="mt-3 text-2xl font-bold text-white">Ideas para seguir aprendiendo.</h2><p className="mt-2 text-sm leading-6 text-zinc-400">Prueba la suscripción visual para novedades y recursos educativos.</p></div>
            {newsletterSent ? <div role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-5 py-4 text-sm text-emerald-200">✓ Suscripción de muestra completada. No se envió ningún correo.</div> : <form onSubmit={handleNewsletter} className="flex w-full flex-col gap-3 sm:flex-row lg:max-w-xl"><label htmlFor="newsletter-email" className="sr-only">Tu correo electrónico</label><input id="newsletter-email" type="email" required placeholder="Tu correo electrónico" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-4 py-3.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-red-500/60" /><button type="submit" className="rounded-xl bg-white px-5 py-3.5 text-sm font-extrabold text-black transition hover:bg-zinc-200">Quiero recibir novedades ↗</button></form>}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] bg-black/20 px-4 py-10 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_.7fr_.7fr_.9fr]">
            <div><a href="#inicio" className="inline-flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/50 bg-red-500/10 font-black text-red-400">I²</span><span className="text-lg font-black tracking-[0.16em] text-white">IINICIA</span></a><p className="mt-4 max-w-sm text-sm leading-6 text-zinc-500">Una propuesta de portal educativo digital para explorar conocimientos y descubrir nuevas oportunidades de aprendizaje.</p></div>
            <div><h3 className="text-sm font-bold text-white">Explorar</h3><div className="mt-4 space-y-3 text-sm text-zinc-500"><a href="/cursos" className="block hover:text-white">Cursos</a><button type="button" onClick={() => goTo("categorias")} className="block hover:text-white">Categorías</button><button type="button" onClick={() => goTo("rutas")} className="block hover:text-white">Rutas de aprendizaje</button></div></div>
            <div><h3 className="text-sm font-bold text-white">Portal</h3><div className="mt-4 space-y-3 text-sm text-zinc-500"><button type="button" onClick={() => openAuth("login")} className="block hover:text-white">Iniciar sesión</button><button type="button" onClick={() => openAuth("register")} className="block hover:text-white">Crear cuenta</button><button type="button" onClick={() => goTo("preguntas")} className="block hover:text-white">Preguntas frecuentes</button></div></div>
            <div><h3 className="text-sm font-bold text-white">Información</h3><div className="mt-4 space-y-3 text-sm text-zinc-500"><button type="button" onClick={() => showComingSoon("El aviso de privacidad")} className="block hover:text-white">Aviso de privacidad</button><button type="button" onClick={() => showComingSoon("Los términos de uso")} className="block hover:text-white">Términos de uso</button><button type="button" onClick={() => goTo("contacto")} className="block hover:text-white">Contacto</button></div></div>
          </div>
          <div className="mt-10 flex flex-col gap-3 border-t border-white/[0.07] pt-6 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} IINICIA · Proyecto de demostración visual.</p><p>Frontend de muestra · Sin autenticación ni envíos reales.</p><button type="button" onClick={() => goTo("inicio")} className="self-start font-semibold text-zinc-400 hover:text-white sm:self-auto">Volver al inicio ↑</button></div>
        </div>
      </footer>

      {/* Login / registration modal */}
      {authOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-md" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="auth-title" className="relative my-6 w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#111114] shadow-2xl shadow-black/60">
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-900 via-red-500 to-rose-800" />
            <button type="button" onClick={() => setAuthOpen(false)} aria-label="Cerrar ventana" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-zinc-400 transition hover:bg-white/5 hover:text-white">✕</button>
            <div className="px-6 pb-7 pt-8 sm:px-8">
              <div className="mb-6 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 font-black text-red-300">I²</span><div><p className="text-sm font-black tracking-[0.15em] text-white">IINICIA</p><p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">Portal de aprendizaje</p></div></div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-400">{authMode === "login" ? "Qué gusto verte" : authMode === "register" ? "Comienza tu camino" : "Recupera tu acceso"}</p>
              <h2 id="auth-title" className="mt-2 text-2xl font-black text-white">{authMode === "login" ? "Iniciar sesión" : authMode === "register" ? "Crear una cuenta" : "Recuperar contraseña"}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{authMode === "login" ? "Ingresa tus datos para probar la interfaz de acceso." : authMode === "register" ? "Completa los campos para probar la pantalla de registro." : "Ingresa tu correo para probar el flujo de recuperación."}</p>
              <form onSubmit={handleAuthSubmit} className="mt-6 space-y-4">
                {authMode === "register" && <div><label htmlFor="auth-name" className="mb-2 block text-xs font-semibold text-zinc-300">Nombre completo</label><input id="auth-name" name="name" type="text" autoComplete="name" required placeholder="Tu nombre" className="w-full rounded-lg border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-red-500/70" /></div>}
                <div><label htmlFor="auth-email" className="mb-2 block text-xs font-semibold text-zinc-300">Correo electrónico</label><input id="auth-email" name="email" type="email" autoComplete="email" required placeholder="nombre@correo.com" className="w-full rounded-lg border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-red-500/70" /></div>
                {authMode !== "recover" && <div><label htmlFor="auth-password" className="mb-2 block text-xs font-semibold text-zinc-300">Contraseña</label><div className="flex rounded-lg border border-white/10 bg-black/25 pr-3 focus-within:border-red-500/70"><input id="auth-password" name="password" type={showPassword ? "text" : "password"} autoComplete={authMode === "login" ? "current-password" : "new-password"} required minLength={6} placeholder="Mínimo 6 caracteres" className="w-full min-w-0 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} className="shrink-0 text-xs font-semibold text-zinc-500 hover:text-white">{showPassword ? "Ocultar" : "Mostrar"}</button></div></div>}
                {authMode === "login" && <div className="flex items-center justify-between gap-3 text-xs"><label className="flex cursor-pointer items-center gap-2 text-zinc-400"><input type="checkbox" name="remember" className="accent-red-600" /> Recordarme</label><button type="button" onClick={() => setAuthMode("recover")} className="font-semibold text-red-300 hover:text-white">¿Olvidaste tu contraseña?</button></div>}
                <button type="submit" className="w-full rounded-lg bg-red-600 px-4 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-red-950/30 transition hover:bg-red-500">{authMode === "login" ? "ENTRAR AL PORTAL" : authMode === "register" ? "CREAR CUENTA DE MUESTRA" : "PROBAR RECUPERACIÓN"}</button>
              </form>
              <div className="mt-6 border-t border-white/[0.08] pt-5 text-center text-xs text-zinc-500">{authMode === "login" ? <>¿Todavía no tienes cuenta? <button type="button" onClick={() => setAuthMode("register")} className="font-bold text-red-300 hover:text-white">Regístrate</button></> : authMode === "register" ? <>¿Ya tienes cuenta? <button type="button" onClick={() => setAuthMode("login")} className="font-bold text-red-300 hover:text-white">Inicia sesión</button></> : <>¿Recordaste tu contraseña? <button type="button" onClick={() => setAuthMode("login")} className="font-bold text-red-300 hover:text-white">Volver al acceso</button></>}</div>
              <p className="mt-5 rounded-lg border border-yellow-500/15 bg-yellow-500/[0.04] px-3 py-2.5 text-[10px] leading-5 text-yellow-100/60">Modo demostración: no se autentican usuarios, no se crean cuentas y no se envían correos. Usa datos ficticios.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
