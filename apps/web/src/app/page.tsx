"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePortalTheme } from "@/components/PortalThemeProvider";

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
  const { theme, setTheme } = usePortalTheme();
  const [disco, setDisco] = useState(false);
  const [ambienteError, setAmbienteError] = useState(false);
  const ambienteRef = useRef<HTMLAudioElement | null>(null);
  const ambienteIntento = useRef(0);
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

  // El audio se solicita únicamente al descubrir la sorpresa.
  const reproducirAmbiente = () => {
    const intento = ++ambienteIntento.current;
    setAmbienteError(false);
    if (!ambienteRef.current) {
      const audio = new Audio();
      audio.preload = "none";
      audio.loop = true;
      audio.volume = 0.3;
      audio.src = "/audio/ambiente.mp3";
      ambienteRef.current = audio;
    }
    // Iniciar dentro del clic permite la reproducción en el navegador.
    void ambienteRef.current.play().catch(() => {
      if (ambienteIntento.current === intento) setAmbienteError(true);
    });
  };

  const apagarAmbiente = () => {
    ambienteIntento.current += 1;
    ambienteRef.current?.pause();
    if (ambienteRef.current) ambienteRef.current.currentTime = 0;
    setAmbienteError(false);
    setDisco(false);
  };

  const alternarAmbiente = () => {
    if (disco) {
      apagarAmbiente();
    } else {
      setDisco(true);
      reproducirAmbiente();
    }
  };

  useEffect(() => {
    return () => {
      ambienteIntento.current += 1;
      const audio = ambienteRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      ambienteRef.current = null;
    };
  }, []);

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
    <div data-theme={theme} data-disco={disco ? "true" : "false"} className="iinicia-site academic-site relative isolate min-h-screen overflow-x-hidden bg-white font-sans text-slate-800 selection:bg-lime-400/30 selection:text-slate-900">
      <style>{`/* Academic identity: white surfaces, lime accents and dark readable text. */
:root { color-scheme: light; }
html { scroll-behavior: smooth; scroll-padding-top: 104px; }
body { margin: 0; }
button, a, input, select, textarea { -webkit-tap-highlight-color: transparent; }
button { cursor: pointer; }
:focus-visible { outline: 3px solid #56831e; outline-offset: 4px; }
input, textarea, select { color-scheme: light; }
.academic-site { color: #1f2c21; background: #fff; }
.academic-site h1, .academic-site h2, .academic-site h3 { color: #1f2c21; }
.academic-site h1 { letter-spacing: -.055em; font-weight: 600; }
.academic-site h2 { letter-spacing: -.035em; }
.academic-site header { box-shadow: 0 3px 24px #263b1b04; }
.academic-site header nav a { position: relative; }
.academic-site header nav a:hover { color: #456b19; }
.academic-site header nav a:hover::after { content: ""; height: 2px; background: #a3e635; position: absolute; left: 0; right: 0; bottom: -9px; }
.academic-hero { background: radial-gradient(ellipse at 85% 10%, #f2f9e7, transparent 65%); }
.academic-highlight { color: #456b19; background: linear-gradient(transparent 76%, #d9f99d 76%, #d9f99d 95%, transparent 95%); }
.academic-site .reveal { opacity: 1; transform: none; }
.academic-campus { position: relative; width: 100%; max-width: 560px; margin: auto; background: #edf5df; border: 1px solid #dce8cb; border-radius: 28px 28px 90px 28px; padding: 26px; }
.academic-campus-top { display: flex; justify-content: space-between; gap: 12px; font-size: 9px; font-weight: 700; letter-spacing: .13em; color: #4d6338; }
.academic-campus-art { position: relative; padding-top: 20px; }
.academic-campus-art svg { display: block; width: 100%; height: auto; }
.academic-campus-label { display: block; margin: 0 0 24px 10px; font-size: 25px; line-height: 1.25; font-weight: 600; letter-spacing: -.035em; color: #304528; }
.academic-campus-bottom { display: flex; align-items: center; gap: 13px; border: 1px solid #d8e2cb; padding: 16px; border-radius: 16px; background: white; }
.academic-number { display: grid; place-items: center; flex: 0 0 43px; height: 43px; background: #d9f99d; border-radius: 12px; font-weight: 700; color: #365314; }
.academic-campus-bottom strong { display: block; font-size: 12px; }
.academic-campus-bottom p { color: #58664b; margin-top: 4px; font-size: 10px; }
.academic-campus-bottom button { margin-left: auto; width: 32px; height: 32px; flex-shrink: 0; border: 1px solid #c7daaf; border-radius: 50%; color: #365314; }
.academic-campus-note { margin-top: 22px; margin-left: 4px; font-size: 8px; font-weight: 700; letter-spacing: .16em; color: #536746; }
.academic-site article { box-shadow: 0 5px 22px #263b1b04; }
.academic-site article:hover { box-shadow: 0 12px 32px #263b1b0b; }
.academic-site input, .academic-site select, .academic-site textarea { border-color: #dbe2d5; }
.academic-site [role="dialog"] { background: #fff; }
.academic-site footer { background: #f6f9f1; }
.portal-secondary-header { border-bottom: 1px solid #e2e8dc; padding: 20px max(24px, calc((100vw - 1280px)/2)); display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 20px; background: white; }
.portal-secondary-header>a { font-weight: 700; letter-spacing: .12em; }
.portal-secondary-header nav { display: flex; flex-wrap: wrap; gap: 20px; font-size: 13px; }
.portal-secondary-header nav a:hover { color: #456b19; text-decoration: underline; text-underline-offset: 5px; }
.portal-secondary-footer { border-top: 1px solid #e2e8dc; padding: 28px 24px; background: #f6f9f1; color: #536050; font-size: 12px; text-align: center; }
@media(max-width: 639px) {
 .academic-campus { padding: 20px; border-bottom-right-radius: 50px; }
 .academic-campus-label { font-size: 23px; }
 .academic-campus-top { font-size: 8px; letter-spacing: .07em; }
}
@media (prefers-reduced-motion: reduce) {
 html { scroll-behavior: auto; }
 .academic-site *, .academic-site *::before, .academic-site *::after { animation: none !important; transition: none !important; }
}
@media (prefers-reduced-motion: no-preference) {
 .academic-site .reveal.is-visible { animation: academic-enter .55s ease both; }
 .academic-site .reveal-delay-1 { animation-delay: .06s; }
 .academic-site .reveal-delay-2 { animation-delay: .12s; }
 .academic-site .reveal-delay-3 { animation-delay: .18s; }
}
@keyframes academic-enter { from { opacity: .35; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
.academic-site button.bg-white { border: 1px solid #d2dfc2; }
button, input, textarea, select { font-family: inherit; }

/* Everything below is limited to this page and is removed on navigation. */
body:has(.academic-site) { background: #fff; color: #1f2c21; }
body:has(.academic-site[data-theme="dark"]), body:has(.academic-site[data-disco="true"]) { background: #101710; }
/* Hide only the old layout navigation, keeping this page's own header. */
body:has(.academic-site) > header, body:has(.academic-site) > footer { display: none !important; }
.academic-site {
 --portal-bg: #fff; --portal-surface: #fff; --portal-soft: #f5f8ef;
 --portal-text: #1f2c21; --portal-muted: #536050; --portal-border: #dce5d2;
 --portal-tint: #eff8df; --portal-accent: #456b19; --portal-lime: #bef264;
 color-scheme: light; background: var(--portal-bg); color: var(--portal-text);
 font-family: 'Segoe UI', Arial, sans-serif;
}
.academic-site[data-theme="dark"] {
 --portal-bg: #101710; --portal-surface: #192219; --portal-soft: #141e15;
 --portal-text: #edf5e7; --portal-muted: #bac8b1; --portal-border: #354632;
 --portal-tint: #25351b; --portal-accent: #c4ec89; color-scheme: dark;
}
.academic-site[data-disco="true"] {
 --portal-bg: #140c25; --portal-surface: #221332; --portal-soft: #1b102b;
 --portal-text: #fff6ff; --portal-muted: #e1cbed; --portal-border: #835390;
 --portal-tint: #342046; --portal-accent: #f0abfc; --portal-lime: #e879f9;
 color-scheme: dark;
}
.academic-site header, .academic-site main, .academic-site footer { position: relative; z-index: 10; }
.academic-site > header { position: sticky; background: var(--portal-surface); border-color: var(--portal-border); }
.academic-site h1, .academic-site h2, .academic-site h3 { color: var(--portal-text); }
.academic-site [class~="text-slate-900"], .academic-site [class~="text-slate-800"], .academic-site [class~="text-slate-700"] { color: var(--portal-text); }
.academic-site [class~="text-slate-600"], .academic-site [class~="text-slate-500"], .academic-site [class~="text-slate-400"] { color: var(--portal-muted); }
.academic-site [class~="text-lime-800"], .academic-site header nav a:hover { color: var(--portal-accent); }
.academic-site [class~="bg-white"], .academic-site [role="dialog"] { background-color: var(--portal-surface); }
.academic-site [class~="bg-slate-50"], .academic-site [class*="bg-[#f5f8ef]"], .academic-site footer { background-color: var(--portal-soft); }
.academic-site [class*="border-slate-200"], .academic-site input, .academic-site select, .academic-site textarea { border-color: var(--portal-border); }
.academic-site [class*="bg-gradient-to-br"] { background-image: linear-gradient(135deg, var(--portal-tint), var(--portal-surface)); }
.academic-site [class*="bg-lime-400/"] { background-color: var(--portal-tint); }
.academic-site [class~="bg-lime-300"] { background-color: var(--portal-lime); color: #1f2c0b; }
.academic-site [class~="bg-lime-300"]:hover { filter: brightness(.95); }
.academic-site input, .academic-site select, .academic-site textarea { color-scheme: inherit; color: var(--portal-text); }
.academic-site input::placeholder, .academic-site textarea::placeholder { color: var(--portal-muted); opacity: .8; }
.academic-site input[type="checkbox"] { accent-color: #65a30d; }
.academic-site .academic-hero { background: radial-gradient(ellipse at 85% 10%, var(--portal-tint), transparent 65%); }
.academic-site .academic-highlight { color: var(--portal-accent); background: linear-gradient(transparent 78%, var(--portal-tint) 78%, var(--portal-tint) 95%, transparent 95%); }
.academic-site .academic-campus { background: var(--portal-tint); border-color: var(--portal-border); }
.academic-site .academic-campus-label, .academic-site .academic-campus-top, .academic-site .academic-campus-note { color: var(--portal-accent); }
.academic-site .academic-campus-bottom { background: var(--portal-surface); border-color: var(--portal-border); }
.academic-site .academic-campus-bottom p { color: var(--portal-muted); }
.academic-site .academic-campus-bottom button { color: var(--portal-accent); border-color: var(--portal-border); }
.academic-site :focus-visible { outline: 3px solid var(--portal-accent); outline-offset: 4px; }
.academic-site .portal-theme-toggle { display: inline-flex; align-items: center; justify-content: center; gap: 7px; flex-shrink: 0; border: 1px solid var(--portal-border); padding: 9px 11px; border-radius: 999px; background: var(--portal-soft); color: var(--portal-text); font-size: 12px; font-weight: 600; }
.academic-site .portal-theme-toggle>span:first-child { font-size: 18px; line-height: 1; }
.academic-site .portal-easter-egg { position: relative; z-index: 10; text-align: center; padding: 12px 0 0; }
.academic-site .portal-easter-egg button { color: var(--portal-muted); border-radius: 16px; padding: 8px 14px; opacity: .28; font-size: 13px; }
.academic-site .portal-easter-egg button:hover, .academic-site .portal-easter-egg button:focus-visible, .academic-site[data-disco="true"] .portal-easter-egg button { opacity: 1; }
.academic-site .portal-party-layer { position: fixed; inset: 0; z-index: 1; overflow: hidden; pointer-events: none; opacity: .62; background: radial-gradient(ellipse at 50% 44%, #080411 0%, #17082488 35%, transparent 75%); }
.academic-site .portal-party-wheel { position: absolute; width: 160vmax; height: 160vmax; top: 44%; left: 50%; margin-top: -80vmax; margin-left: -80vmax; border-radius: 50%; background: repeating-conic-gradient(from 0deg, #ff279522 0deg, #ff2795bb 12deg, transparent 23deg, #26f7ff99 36deg, transparent 45deg, #a3e635aa 58deg, transparent 72deg); filter: blur(9px); animation: portal-disco-spin 10s linear infinite; }
.academic-site .portal-party-wheel-small { width: 90vmax; height: 90vmax; top: 44%; left: 50%; margin: -45vmax; opacity: .5; filter: blur(18px); animation-direction: reverse; animation-duration: 15s; }
.academic-site .portal-tunnel-rings { position: absolute; inset: 0; animation: portal-light-pulse 2.6s ease-in-out infinite; }
.academic-site .portal-tunnel-ring { position: absolute; left: 50%; top: 44%; width: 56vmin; height: 56vmin; border-radius: 50%; border: 3px solid #e879f9; background: conic-gradient(from 0deg, #ff36a4, #ffb829, #c5ff36, #38ffd0, #34bfff, #b25bff, #ff36a4); mask-image: radial-gradient(closest-side, transparent 96%, #000 97%); box-shadow: 0 0 18px #d946ef88; animation: portal-tunnel-travel 6s linear infinite; will-change: transform, opacity; }
.academic-site[data-disco="true"] main > section { background: transparent; }
@keyframes portal-tunnel-travel {
  0% { transform: translate(-50%,-50%) scale(.08) rotate(0deg); opacity: 0; }
  12% { opacity: .5; }
  70% { opacity: .8; }
  100% { transform: translate(-50%,-50%) scale(6) rotate(135deg); opacity: 0; }
}
@keyframes portal-light-pulse { 0%,100% { opacity: .45; } 50% { opacity: .9; } }
.academic-site[data-disco="true"] .academic-hero { background: transparent; }
.academic-site[data-disco="true"] article, .academic-site[data-disco="true"] .academic-campus, .academic-site[data-disco="true"] [role="dialog"] { border: 1px solid transparent; background: linear-gradient(var(--portal-surface),var(--portal-surface)) padding-box, linear-gradient(120deg,#f472b6,#a78bfa,#22d3ee,#a3e635) border-box; box-shadow: 0 5px 28px #d946ef18; }
.academic-site[data-disco="true"] h1, .academic-site[data-disco="true"] h2 { background: linear-gradient(90deg,#f9a8d4,#fde68a,#bef264,#67e8f9,#c4b5fd,#f9a8d4); background-size: 250% 100%; background-clip: text; -webkit-background-clip: text; color: transparent; animation: portal-rainbow-flow 12s ease-in-out infinite alternate; }
.academic-site[data-disco="true"] .academic-highlight { color: inherit; background: none; }
.academic-site .portal-party-exit { position: fixed; z-index: 90; bottom: 18px; right: 18px; border: 1px solid #e9a4ff; background: #251333; color: #fff; border-radius: 999px; padding: 12px 18px; font-size: 13px; box-shadow: 0 0 22px #f0abfc30; }
.academic-site button, .academic-site input, .academic-site textarea, .academic-site select { font-family: 'Segoe UI', Arial, sans-serif; }
.academic-site [class*="hover:text-slate-900"]:hover { color: var(--portal-text); }
.academic-site [class*="hover:bg-white"]:hover { background-color: var(--portal-soft); }
.academic-site .portal-party-controls { position: fixed; right: 18px; bottom: 18px; z-index: 90; display: flex; flex-direction: column; align-items: flex-end; gap: 10px; max-width: min(340px, calc(100vw - 36px)); }
.academic-site .portal-party-controls .portal-party-exit { position: static; }
.academic-site .portal-audio-retry { border: 1px solid #b078c4; background: #251333; color: #fff; padding: 12px 16px; border-radius: 16px; font-size: 12px; line-height: 1.6; }
.academic-site .portal-audio-retry button { display: block; margin-top: 8px; padding: 6px 0; color: #f0abfc; font-weight: 600; }
@keyframes portal-disco-spin { to { transform: rotate(360deg); } }
@keyframes portal-rainbow-flow { to { background-position: 100% 50%; } }
@media (min-width: 1024px) and (max-width: 1279px) { .academic-site header nav { gap: 12px; font-size: 12px; } .academic-site header>div { gap: 10px; } .academic-site header .portal-theme-label { display: none; } }
@media (max-width: 639px) { .academic-site .portal-theme-label { display: none; } .academic-site .portal-theme-toggle { margin-left: auto; } }
@media (prefers-reduced-motion: reduce) { .academic-site .portal-party-wheel, .academic-site .portal-tunnel-ring, .academic-site .portal-tunnel-rings, .academic-site[data-disco="true"] h1, .academic-site[data-disco="true"] h2 { animation: none; } }
@media (prefers-reduced-motion: reduce) { .academic-site .portal-tunnel-ring { transform: translate(-50%,-50%) scale(1.8); opacity: .2; } }
`}</style>
      {disco && <><div className="portal-party-layer" aria-hidden="true"><div className="portal-party-wheel" /><div className="portal-party-wheel portal-party-wheel-small" /><div className="portal-tunnel-rings">{Array.from({ length: 9 }, (_, index) => <span key={index} className="portal-tunnel-ring" style={{ animationDelay: `${index * -0.67}s`, filter: `hue-rotate(${index * 40}deg)` }} />)}</div></div><div className="portal-party-controls">{ambienteError && <div className="portal-audio-retry"><p role="status">No se pudo reproducir el audio. Comprueba que ambiente.mp3 esté en public/audio.</p><button type="button" onClick={reproducirAmbiente}>♫ Reintentar música</button></div>}<button type="button" className="portal-party-exit" onClick={apagarAmbiente}>✦ Apagar discoteca</button></div></>}
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-xl sm:px-6 lg:px-10">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between gap-4">
          <a
            href="#inicio"
            onClick={() => setMenuOpen(false)}
            className="flex shrink-0 items-center gap-3"
            aria-label="IINICIA, ir al inicio"
          >
            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-lime-600/70 bg-lime-400/10 shadow-[0_0_28px_rgba(132,204,22,.12)]">
              <span className="text-sm font-semibold tracking-tight text-lime-800">I²</span>
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-lime-400" />
            </span>
            <span>
              <span className="block text-lg font-semibold tracking-[0.16em] text-slate-900">IINICIA</span>
              <span className="-mt-0.5 block text-[9px] font-medium uppercase tracking-[0.23em] text-slate-600">Ciencias aplicadas</span>
            </span>
          </a>

          <nav aria-label="Navegación principal" className="hidden items-center gap-5 text-[13px] font-medium text-slate-600 xl:flex">
            <a href="#inicio" className="transition hover:text-slate-900">Inicio</a>
            <a href="/cursos" className="transition hover:text-slate-900">Cursos</a>
            <a href="/certificaciones" className="transition hover:text-lime-800">Certificaciones</a>
            <a href="/diplomados" className="transition hover:text-lime-800">Diplomados</a>
            <a href="/universidad" className="transition hover:text-lime-800">Universidad</a>
            <a href="#preguntas" className="transition hover:text-slate-900">Ayuda</a>
          </nav>

          <div className="hidden items-center gap-3 xl:flex">
            <button
              type="button"
              onClick={() => openAuth("login")}
              className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:text-slate-900"
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => openAuth("register")}
              className="group inline-flex items-center gap-2 rounded-lg bg-lime-300 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-lg shadow-slate-900/5 transition hover:bg-lime-400"
            >
              Crear cuenta <span className="transition group-hover:translate-x-0.5">↗</span>
            </button>
          </div>

          <button type="button" className="portal-theme-toggle" onClick={() => { apagarAmbiente(); setTheme((current) => current === "light" ? "dark" : "light"); }} aria-label={theme === "light" ? "Activar modo oscuro" : "Activar modo claro"} title={theme === "light" ? "Cambiar a oscuro" : "Cambiar a claro"}>
            <span aria-hidden="true">{theme === "light" ? "☾" : "☀"}</span><span className="portal-theme-label">{theme === "light" ? "Oscuro" : "Claro"}</span>
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 xl:hidden"
          >
            {menuOpen ? "Cerrar ✕" : "Menú ☰"}
          </button>
        </div>

        {menuOpen && (
          <nav aria-label="Navegación móvil" className="border-t border-slate-200 py-3 xl:hidden">
            {[
              ["Inicio", "inicio"],
              ["Cursos", "cursos"],
              ["Certificaciones", "certificaciones"],
              ["Diplomados", "diplomados"],
              ["Universidad", "universidad"],
              ["Rutas de aprendizaje", "rutas"],
              ["Nosotros", "nosotros"],
              ["Preguntas frecuentes", "preguntas"],
              ["Contacto", "contacto"],
            ].map(([label, id]) => (
              <button
                key={id}
                type="button"
                onClick={() => { if (["cursos", "certificaciones", "diplomados", "universidad"].includes(id)) { window.location.href = `/${id}`; } else { goTo(id); } }}
                className="block w-full rounded-lg px-3 py-3 text-left text-sm text-slate-700 hover:bg-white hover:text-slate-900"
              >
                {label}
              </button>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-200 pt-3">
              <button type="button" onClick={() => openAuth("login")} className="rounded-lg border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-900">Iniciar sesión</button>
              <button type="button" onClick={() => openAuth("register")} className="rounded-lg bg-lime-300 px-3 py-3 text-sm font-bold text-slate-900">Crear cuenta</button>
            </div>
          </nav>
        )}
      </header>

      {/* Inline notices */}
      {notice && (
        <div role="status" aria-live="polite" className="fixed right-4 top-24 z-[70] flex max-w-md items-start gap-3 rounded-xl border border-lime-600/30 bg-white p-4 shadow-2xl shadow-slate-900/5">
          <span className="mt-0.5 text-lime-800">✦</span>
          <p className="flex-1 text-sm leading-6 text-slate-800">{notice}</p>
          <button type="button" onClick={() => setNotice("")} aria-label="Cerrar aviso" className="text-slate-600 hover:text-slate-900">✕</button>
        </div>
      )}

      <main className="relative z-10">
        {/* Hero */}
        <section id="inicio" className="academic-hero scroll-mt-28 px-4 pb-20 pt-14 sm:px-6 sm:pb-28 sm:pt-20 lg:px-10 lg:pt-24">
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.02fr_.98fr] lg:gap-12">
            <div data-reveal className="reveal">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-lime-600/25 bg-lime-400/[0.08] px-3.5 py-2 text-xs font-semibold text-lime-800">
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-400 opacity-50" /><span className="relative inline-flex h-2 w-2 rounded-full bg-lime-400" /></span>
                FORMACIÓN QUE ABRE POSIBILIDADES
              </div>
              <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl md:text-6xl xl:text-7xl">
                Conocimiento que <span className="academic-highlight">transforma</span> tu futuro.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                En IINICIA conectamos el conocimiento con tus metas. Explora nuestra oferta académica y encuentra una nueva forma de aprender, crecer y avanzar.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={() => { window.location.href = "/cursos"; }} className="group inline-flex items-center justify-center gap-3 rounded-xl bg-lime-300 px-6 py-4 text-sm font-bold text-slate-900 shadow-xl shadow-slate-900/5 transition hover:-translate-y-0.5 hover:bg-lime-400">
                  Explorar cursos <span className="transition group-hover:translate-x-1">→</span>
                </button>
                <button type="button" onClick={() => goTo("nosotros")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm font-bold text-slate-900 transition hover:border-slate-200 hover:bg-white">
                  Conoce la universidad <span className="text-lime-800">↗</span>
                </button>
              </div>
              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-slate-600">
                <span className="inline-flex items-center gap-2"><span className="text-lime-800">✓</span> Aprende a tu ritmo</span>
                <span className="inline-flex items-center gap-2"><span className="text-lime-800">✓</span> Explora distintas áreas</span>
                <span className="inline-flex items-center gap-2"><span className="text-lime-800">✓</span> Desde cualquier dispositivo</span>
              </div>
            </div>

            <div data-reveal className="reveal academic-campus" aria-label="Ilustración de la comunidad académica IINICIA">
              <div className="academic-campus-top"><span>COMUNIDAD IINICIA</span><span>EDUCACIÓN · INNOVACIÓN</span></div>
              <div className="academic-campus-art">
                <svg viewBox="0 0 540 310" role="img" aria-label="Biblioteca y espacios de aprendizaje ilustrados">
                  <circle cx="398" cy="105" r="86" fill="#c5ed7d" />
                  <path d="M32 270H510" stroke="#53713a" strokeWidth="2" />
                  <path d="M72 122L259 48L448 122" fill="#fff" stroke="#375232" strokeWidth="3" strokeLinejoin="round" />
                  <path d="M98 126H422V267H98Z" fill="#fff" stroke="#375232" strokeWidth="3" />
                  <path d="M86 118H435V139H86Z" fill="#d9f6a9" stroke="#375232" strokeWidth="3" />
                  {[126,197,268,339].map((x) => <g key={x}><rect x={x} y="157" width="42" height="63" rx="20" fill="#eff6e7" stroke="#375232" strokeWidth="2" /><path d={`M${x+21} 158V219M${x} 189H${x+42}`} stroke="#375232" strokeWidth="2" /><rect x={x-3} y="234" width="48" height="33" fill="#f4f8ef" stroke="#375232" strokeWidth="2" /></g>)}
                  <path d="M78 267H442V277H78Z" fill="#b2df67" stroke="#375232" strokeWidth="2" />
                  <path d="M66 269V211M65 234C26 219 37 182 65 191C97 172 107 216 65 234M474 269V191M474 220C434 209 439 167 474 179C505 157 524 206 474 220" fill="#b8db91" stroke="#375232" strokeWidth="2" />
                  <circle cx="260" cy="100" r="16" fill="#c5ed7d" stroke="#375232" strokeWidth="2" />
                  <path d="M252 100L258 106L269 94" fill="none" stroke="#375232" strokeWidth="2" />
                </svg>
                <span className="academic-campus-label">Un espacio para aprender.<br />Un camino para crecer.</span>
              </div>
              <div className="academic-campus-bottom"><span className="academic-number">I²</span><div><strong>Tu próxima etapa empieza aquí</strong><p>Explora las posibilidades de tu formación.</p></div><button type="button" onClick={() => goTo("categorias")} aria-label="Explorar áreas académicas">↗</button></div>
              <div className="academic-campus-note">APRENDER HOY. TRANSFORMAR MAÑANA.</div>
            </div>
          </div>
        </section>

        {/* Categories */}
        <section id="categorias" className="scroll-mt-28 px-4 py-20 sm:px-6 sm:py-24 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div data-reveal className="reveal flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div><p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-lime-800">Encuentra tu área</p><h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Conocimiento para cada interés.</h2><p className="mt-4 max-w-2xl leading-7 text-slate-600">Explora temas que te ayuden a descubrir habilidades, fortalecer tus conocimientos y abrir nuevas posibilidades.</p></div>
              <a href="/cursos" className="shrink-0 self-start rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:border-lime-600/50 hover:bg-lime-400/[0.06] md:self-auto">Ver todo el catálogo ↗</a>
            </div>
            <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { name: "Tecnología", description: "IA, datos y herramientas digitales", icon: "⌘", color: "from-lime-200" },
                { name: "Negocios", description: "Liderazgo, proyectos y estrategia", icon: "↗", color: "from-lime-100" },
                { name: "Marketing", description: "Audiencias, contenido y marcas", icon: "◎", color: "from-emerald-50" },
                { name: "Desarrollo personal", description: "Hábitos, habilidades y enfoque", icon: "✧", color: "from-lime-100" },
              ].map((category, index) => (
                <button key={category.name} type="button" onClick={() => { setActiveCategory(category.name); goTo("cursos"); }} data-reveal className={`reveal ${index === 1 ? "reveal-delay-1" : index === 2 ? "reveal-delay-2" : index === 3 ? "reveal-delay-3" : ""} group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br ${category.color} to-transparent p-6 text-left transition duration-300 hover:-translate-y-1 hover:border-lime-600/40`}>
                  <div className="absolute right-4 top-3 text-5xl font-light text-lime-900/10">{category.icon}</div>
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-2xl text-lime-800">{category.icon}</span>
                  <h3 className="mt-6 text-lg font-bold text-slate-900">{category.name}</h3>
                  <p className="mt-2 min-h-10 text-sm leading-6 text-slate-600">{category.description}</p>
                  <span className="mt-5 inline-block text-sm font-bold text-lime-800 transition group-hover:translate-x-1">Explorar área →</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Course catalog */}
        <section id="cursos" className="scroll-mt-28 border-y border-slate-200 bg-[#f5f8ef] px-4 py-20 sm:px-6 sm:py-24 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div data-reveal className="reveal flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div><p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-lime-800">Catálogo de aprendizaje</p><h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Empieza por algo que te inspire.</h2><p className="mt-4 max-w-2xl leading-7 text-slate-600">Busca por tema, filtra por categoría y guarda los cursos que quieras revisar después.</p></div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-600"><span className="rounded-full border border-slate-200 px-3 py-2">{courses.length} cursos de muestra</span><span className="rounded-full border border-slate-200 px-3 py-2">{favorites.length} guardados</span></div>
            </div>

            <div className="mt-9 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-sm"><label htmlFor="course-search" className="sr-only">Buscar cursos</label><span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-slate-600">⌕</span><input id="course-search" type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar cursos o temas..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-lime-600/70 focus:ring-1 focus:ring-lime-600/30" /></div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {categories.map((category) => <button key={category} type="button" onClick={() => setActiveCategory(category)} aria-pressed={activeCategory === category} className={`whitespace-nowrap rounded-full border px-4 py-2.5 text-xs font-semibold transition ${activeCategory === category ? "border-lime-600 bg-lime-300 text-slate-900" : "border-slate-200 bg-white text-slate-600 hover:border-slate-200 hover:text-slate-900"}`}>{category}</button>)}
              </div>
            </div>

            {visibleCourses.length > 0 ? (
              <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {visibleCourses.map((course, index) => (
                  <article key={course.id} data-reveal className={`reveal ${index % 3 === 1 ? "reveal-delay-1" : index % 3 === 2 ? "reveal-delay-2" : ""} group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition duration-300 hover:-translate-y-1 hover:border-lime-600/35`}>
                    <div className="relative flex min-h-40 items-end overflow-hidden bg-gradient-to-br from-lime-200 via-lime-50 to-lime-50 p-5">
                      <div aria-hidden="true" className="absolute -right-4 -top-12 h-44 w-44 rounded-full border border-slate-200" /><div aria-hidden="true" className="absolute -right-1 -top-5 h-32 w-32 rounded-full border border-lime-600/10" /><div aria-hidden="true" className="absolute bottom-[-4rem] left-20 h-36 w-36 rounded-full bg-lime-300/20 blur-3xl" />
                      <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-lime-600/20 bg-slate-50 text-3xl text-lime-800">{course.symbol}</span>
                      <span className="absolute right-4 top-4 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-lime-800">{course.tag}</span>
                      <button type="button" onClick={() => toggleFavorite(course.id)} aria-label={favorites.includes(course.id) ? `Quitar ${course.title} de guardados` : `Guardar ${course.title}`} aria-pressed={favorites.includes(course.id)} className={`absolute bottom-5 right-4 flex h-10 w-10 items-center justify-center rounded-full border text-lg transition ${favorites.includes(course.id) ? "border-lime-600/50 bg-lime-400/20 text-lime-800" : "border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900"}`}>{favorites.includes(course.id) ? "♥" : "♡"}</button>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600"><span>{course.category}</span><span className="text-slate-400">•</span><span>{course.level}</span></div>
                      <h3 className="mt-3 text-lg font-bold leading-snug text-slate-900">{course.title}</h3>
                      <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{course.description}</p>
                      <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4"><span className="text-xs text-slate-600">▤ {course.duration}</span><button type="button" onClick={() => showComingSoon(`El programa “${course.title}”`)} className="text-xs font-bold text-lime-800 transition hover:text-slate-900">Ver programa ↗</button></div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-7 rounded-2xl border border-dashed border-slate-200 px-6 py-14 text-center"><span className="text-3xl text-slate-500">⌕</span><h3 className="mt-3 font-bold text-slate-900">No encontramos resultados</h3><p className="mt-2 text-sm text-slate-600">Prueba con otra palabra o cambia la categoría seleccionada.</p><button type="button" onClick={() => { setSearchQuery(""); setActiveCategory("Todos"); }} className="mt-5 rounded-lg bg-lime-300 px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-lime-400">Limpiar filtros</button></div>
            )}
            <p className="mt-5 text-center text-xs text-slate-500">Los cursos de esta sección son ejemplos de contenido para la maqueta visual.</p>
          </div>
        </section>

        {/* Learning paths */}
        <section id="rutas" className="scroll-mt-28 px-4 py-20 sm:px-6 sm:py-24 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div data-reveal className="reveal mx-auto max-w-3xl text-center"><p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-lime-800">Una ruta clara</p><h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">No solo tomes cursos. Construye un camino.</h2><p className="mt-4 leading-7 text-slate-600">Agrupa tus intereses y avanza con una estructura que te ayude a convertir objetivos amplios en pasos manejables.</p></div>
            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {[
                { no: "01", name: "Ruta digital", title: "Comprende la tecnología", detail: "Conceptos digitales, herramientas de trabajo y pensamiento basado en datos.", tags: ["Tecnología", "Datos", "Innovación"] },
                { no: "02", name: "Ruta profesional", title: "Desarrolla habilidades de trabajo", detail: "Comunicación, liderazgo y organización para proyectos y equipos.", tags: ["Liderazgo", "Proyectos", "Comunicación"] },
                { no: "03", name: "Ruta creativa", title: "Comunica ideas con intención", detail: "Estrategia de contenido, marketing y resolución creativa de problemas.", tags: ["Marketing", "Creatividad", "Estrategia"] },
              ].map((path, index) => <article key={path.no} data-reveal className={`reveal ${index === 1 ? "reveal-delay-1" : index === 2 ? "reveal-delay-2" : ""} relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 sm:p-7`}><span className="absolute right-5 top-3 text-6xl font-semibold text-lime-900/10">{path.no}</span><p className="text-xs font-bold uppercase tracking-[0.2em] text-lime-800">{path.name}</p><h3 className="mt-4 text-xl font-bold text-slate-900">{path.title}</h3><p className="mt-3 min-h-[72px] text-sm leading-6 text-slate-600">{path.detail}</p><div className="mt-5 flex flex-wrap gap-2">{path.tags.map((tag) => <span key={tag} className="rounded-full border border-slate-200 px-3 py-1.5 text-[10px] text-slate-600">{tag}</span>)}</div><button type="button" onClick={() => showComingSoon(`La ${path.name.toLowerCase()}`)} className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-slate-900 hover:text-lime-800">Explorar ruta <span className="text-lime-800">→</span></button></article>)}
            </div>
          </div>
        </section>

        {/* About / Why */}
        <section id="nosotros" className="scroll-mt-28 border-y border-slate-200 bg-[#f5f8ef] px-4 py-20 sm:px-6 sm:py-24 lg:px-10">
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[.9fr_1.1fr]">
            <div data-reveal className="reveal">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-lime-800">La experiencia IINICIA</p>
              <h2 className="text-3xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-4xl">Educación, innovación y nuevas perspectivas.</h2>
              <p className="mt-5 leading-7 text-slate-600">Por eso la experiencia está organizada para ayudarte a explorar, elegir un tema, revisar opciones y dar el siguiente paso con claridad. Esta maqueta muestra la estructura visual propuesta para el portal.</p>
              <button type="button" onClick={() => goTo("contacto")} className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-lime-800 hover:text-slate-900">Conoce nuestra comunidad <span>→</span></button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: "◈", title: "Diseño centrado en ti", copy: "Navegación sencilla, jerarquía visual y accesos claros." },
                { icon: "⌕", title: "Explora con facilidad", copy: "Búsqueda y filtros para encontrar temas de tu interés." },
                { icon: "♡", title: "Guarda tus favoritos", copy: "Marca cursos que quieras revisar después en esta sesión." },
                { icon: "↗", title: "Enfócate en tus metas", copy: "Descubre rutas y opciones para organizar tus próximos pasos." },
              ].map((item, index) => <div key={item.title} data-reveal className={`reveal ${index % 2 ? "reveal-delay-1" : ""} rounded-2xl border border-slate-200 bg-white p-6`}><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-lime-400/10 text-xl text-lime-800">{item.icon}</span><h3 className="mt-5 font-bold text-slate-900">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{item.copy}</p></div>)}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="como-funciona" className="scroll-mt-28 px-4 py-20 sm:px-6 sm:py-24 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div data-reveal className="reveal text-center"><p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-lime-800">Empieza en tres pasos</p><h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Tu próximo paso es más sencillo.</h2><p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-600">Una experiencia pensada para pasar de la curiosidad a un plan de aprendizaje.</p></div>
            <div className="relative mt-12 grid gap-8 md:grid-cols-3">
              <div aria-hidden="true" className="absolute left-[17%] right-[17%] top-8 hidden border-t border-dashed border-lime-600/30 md:block" />
              {[
                { number: "01", title: "Explora", copy: "Recorre las áreas y encuentra temas relacionados con tus intereses." },
                { number: "02", title: "Elige", copy: "Revisa los cursos de muestra y guarda los que quieras consultar." },
                { number: "03", title: "Avanza", copy: "Define tus objetivos y prepárate para desarrollar tus habilidades." },
              ].map((step, index) => <div key={step.number} data-reveal className={`reveal ${index === 1 ? "reveal-delay-1" : index === 2 ? "reveal-delay-2" : ""} relative text-center`}><span className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-lime-600/30 bg-[#f5f8ef] text-lg font-semibold text-lime-800 shadow-[0_0_30px_rgba(132,204,22,.1)]">{step.number}</span><h3 className="mt-5 text-xl font-bold text-slate-900">{step.title}</h3><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-600">{step.copy}</p></div>)}
            </div>
          </div>
        </section>

        {/* Featured CTA */}
        <section className="px-4 pb-20 sm:px-6 sm:pb-24 lg:px-10">
          <div data-reveal className="reveal relative mx-auto max-w-7xl overflow-hidden rounded-3xl border border-lime-600/20 bg-gradient-to-br from-lime-100 via-lime-50 to-lime-50 p-7 sm:p-10 lg:p-14">
            <div aria-hidden="true" className="absolute -right-16 -top-24 h-72 w-72 rounded-full border border-lime-600/10" /><div aria-hidden="true" className="absolute -right-4 -top-12 h-48 w-48 rounded-full border border-lime-600/10" /><div aria-hidden="true" className="absolute bottom-[-7rem] right-1/4 h-56 w-56 rounded-full bg-lime-300/10 blur-3xl" />
            <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.24em] text-lime-800">Es tu momento</p><h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Todo gran cambio empieza con una primera decisión.</h2><p className="mt-4 leading-7 text-slate-700">Da el primer paso, explora las opciones y descubre nuevas oportunidades de aprendizaje.</p></div><div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row"><button type="button" onClick={() => { window.location.href = "/cursos"; }} className="rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-black transition hover:bg-zinc-200">Explorar cursos</button><button type="button" onClick={() => openAuth("register")} className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-3.5 text-sm font-bold text-slate-900 transition hover:bg-white">Crear cuenta ↗</button></div></div>
          </div>
        </section>

        {/* FAQ */}
        <section id="preguntas" className="scroll-mt-28 border-y border-slate-200 bg-[#f5f8ef] px-4 py-20 sm:px-6 sm:py-24 lg:px-10">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.7fr_1.3fr]">
            <div data-reveal className="reveal"><p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-lime-800">¿Tienes dudas?</p><h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Preguntas frecuentes.</h2><p className="mt-4 leading-7 text-slate-600">Respuestas sobre esta versión del portal y las funciones que puedes probar.</p><button type="button" onClick={() => goTo("contacto")} className="mt-6 text-sm font-bold text-lime-800 hover:text-slate-900">¿No encontraste tu respuesta? Escríbenos →</button></div>
            <div className="space-y-3">{faqs.map((faq, index) => <div key={faq.question} data-reveal className={`reveal overflow-hidden rounded-xl border ${openFaq === index ? "border-lime-600/30 bg-lime-400/[0.035]" : "border-slate-200 bg-white"}`}><button type="button" aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? null : index)} className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left"><span className="text-sm font-semibold text-slate-900 sm:text-base">{faq.question}</span><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-lg transition ${openFaq === index ? "rotate-45 border-lime-600/40 text-lime-800" : "border-slate-200 text-slate-600"}`}>+</span></button>{openFaq === index && <div className="px-5 pb-5"><p className="border-t border-slate-200 pt-4 text-sm leading-7 text-slate-600">{faq.answer}</p></div>}</div>)}</div>
          </div>
        </section>

        {/* Contact and newsletter */}
        <section id="contacto" className="scroll-mt-28 px-4 py-20 sm:px-6 sm:py-24 lg:px-10">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.85fr_1.15fr]">
            <div data-reveal className="reveal">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-lime-800">Hablemos</p><h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">¿Tienes una pregunta o una idea?</h2><p className="mt-4 max-w-lg leading-7 text-slate-600">Este formulario es una muestra visual de la sección de contacto. Al enviarlo se mostrará una confirmación local, sin transmitir datos.</p>
              <div className="mt-8 space-y-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-lime-800">✉</span><div><p className="text-sm font-semibold text-slate-900">Contacto del proyecto</p><p className="mt-1 text-xs text-slate-600">Formulario de demostración</p></div></div><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-lime-800">◷</span><div><p className="text-sm font-semibold text-slate-900">Consulta cuando lo necesites</p><p className="mt-1 text-xs text-slate-600">La comunicación real se habilitará posteriormente</p></div></div></div>
            </div>
            <form onSubmit={handleContact} data-reveal className="reveal reveal-delay-1 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
              {contactSent ? <div className="py-10 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-2xl text-emerald-700">✓</span><h3 className="mt-4 text-xl font-bold text-slate-900">¡Formulario probado!</h3><p className="mt-2 text-sm leading-6 text-slate-600">La demostración registró la interacción en pantalla. No se envió ningún mensaje a un servidor.</p><button type="button" onClick={() => setContactSent(false)} className="mt-5 text-sm font-bold text-lime-800 hover:text-slate-900">Enviar otra consulta</button></div> : <><div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="contact-name" className="mb-2 block text-xs font-semibold text-slate-700">Nombre</label><input id="contact-name" name="name" required placeholder="Tu nombre" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-lime-600/60" /></div><div><label htmlFor="contact-email" className="mb-2 block text-xs font-semibold text-slate-700">Correo electrónico</label><input id="contact-email" name="email" type="email" required placeholder="tu@correo.com" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-lime-600/60" /></div></div><div className="mt-4"><label htmlFor="contact-topic" className="mb-2 block text-xs font-semibold text-slate-700">Tema de consulta</label><select id="contact-topic" name="topic" className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-lime-600/60"><option>Información general</option><option>Oferta educativa</option><option>Acceso al portal</option><option>Comentarios sobre la página</option></select></div><div className="mt-4"><label htmlFor="contact-message" className="mb-2 block text-xs font-semibold text-slate-700">Mensaje</label><textarea id="contact-message" name="message" required rows={4} placeholder="Cuéntanos cómo podemos ayudarte..." className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-lime-600/60" /></div><button type="submit" className="mt-5 w-full rounded-lg bg-lime-300 px-5 py-3.5 text-sm font-bold text-slate-900 transition hover:bg-lime-400">Probar formulario de contacto →</button><p className="mt-3 text-center text-[11px] leading-5 text-slate-500">No se envían ni se almacenan tus datos en un servidor.</p></>}
            </form>
          </div>
        </section>

        {/* Newsletter */}
        <section className="px-4 pb-20 sm:px-6 lg:px-10">
          <div data-reveal className="reveal mx-auto flex max-w-7xl flex-col gap-7 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-lime-800">Mantente al tanto</p><h2 className="mt-3 text-2xl font-bold text-slate-900">Ideas para seguir aprendiendo.</h2><p className="mt-2 text-sm leading-6 text-slate-600">Prueba la suscripción visual para novedades y recursos educativos.</p></div>
            {newsletterSent ? <div role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-5 py-4 text-sm text-emerald-800">✓ Suscripción de muestra completada. No se envió ningún correo.</div> : <form onSubmit={handleNewsletter} className="flex w-full flex-col gap-3 sm:flex-row lg:max-w-xl"><label htmlFor="newsletter-email" className="sr-only">Tu correo electrónico</label><input id="newsletter-email" type="email" required placeholder="Tu correo electrónico" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-lime-600/60" /><button type="submit" className="rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-black transition hover:bg-zinc-200">Quiero recibir novedades ↗</button></form>}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 px-4 py-10 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_.7fr_.7fr_.9fr]">
            <div><a href="#inicio" className="inline-flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-lime-600/50 bg-lime-400/10 font-semibold text-lime-800">I²</span><span className="text-lg font-semibold tracking-[0.16em] text-slate-900">IINICIA</span></a><p className="mt-4 max-w-sm text-sm leading-6 text-slate-600">Una propuesta de portal educativo digital para explorar conocimientos y descubrir nuevas oportunidades de aprendizaje.</p></div>
            <div><h3 className="text-sm font-bold text-slate-900">Explorar</h3><div className="mt-4 space-y-3 text-sm text-slate-600"><a href="/cursos" className="block hover:text-slate-900">Cursos</a><button type="button" onClick={() => goTo("categorias")} className="block hover:text-slate-900">Categorías</button><button type="button" onClick={() => goTo("rutas")} className="block hover:text-slate-900">Rutas de aprendizaje</button></div></div>
            <div><h3 className="text-sm font-bold text-slate-900">Portal</h3><div className="mt-4 space-y-3 text-sm text-slate-600"><button type="button" onClick={() => openAuth("login")} className="block hover:text-slate-900">Iniciar sesión</button><button type="button" onClick={() => openAuth("register")} className="block hover:text-slate-900">Crear cuenta</button><button type="button" onClick={() => goTo("preguntas")} className="block hover:text-slate-900">Preguntas frecuentes</button></div></div>
            <div><h3 className="text-sm font-bold text-slate-900">Información</h3><div className="mt-4 space-y-3 text-sm text-slate-600"><button type="button" onClick={() => showComingSoon("El aviso de privacidad")} className="block hover:text-slate-900">Aviso de privacidad</button><button type="button" onClick={() => showComingSoon("Los términos de uso")} className="block hover:text-slate-900">Términos de uso</button><button type="button" onClick={() => goTo("contacto")} className="block hover:text-slate-900">Contacto</button></div></div>
          </div>
          <div className="mt-10 flex flex-col gap-3 border-t border-slate-200 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between"><p>© 2026 IINICIA · Proyecto de demostración visual.</p><p>Frontend de muestra · Sin autenticación ni envíos reales.</p><button type="button" onClick={() => goTo("inicio")} className="self-start font-semibold text-slate-600 hover:text-slate-900 sm:self-auto">Volver al inicio ↑</button></div>
        </div>
        <div className="portal-easter-egg"><button type="button" onClick={alternarAmbiente} aria-label={disco ? "Desactivar modo discoteca" : "Activar sorpresa de colores"} aria-pressed={disco} title={disco ? "Volver al diseño normal" : "¿Y esta estrellita?"}>{disco ? "✦ Salir del modo discoteca" : "✦"}</button></div>
      </footer>

      {/* Login / registration modal */}
      {authOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-md" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="auth-title" className="relative my-6 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/5">
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-lime-200 via-lime-200 to-lime-100" />
            <button type="button" onClick={() => setAuthOpen(false)} aria-label="Cerrar ventana" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-white hover:text-slate-900">✕</button>
            <div className="px-6 pb-7 pt-8 sm:px-8">
              <div className="mb-6 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl border border-lime-600/30 bg-lime-400/10 font-semibold text-lime-800">I²</span><div><p className="text-sm font-semibold tracking-[0.15em] text-slate-900">IINICIA</p><p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-600">Portal de aprendizaje</p></div></div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-lime-800">{authMode === "login" ? "Qué gusto verte" : authMode === "register" ? "Comienza tu camino" : "Recupera tu acceso"}</p>
              <h2 id="auth-title" tabIndex={-1} className="mt-2 text-2xl font-semibold text-slate-900">{authMode === "login" ? "Iniciar sesión" : authMode === "register" ? "Crear una cuenta" : "Recuperar contraseña"}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{authMode === "login" ? "Ingresa tus datos para probar la interfaz de acceso." : authMode === "register" ? "Completa los campos para probar la pantalla de registro." : "Ingresa tu correo para probar el flujo de recuperación."}</p>
              <form onSubmit={handleAuthSubmit} className="mt-6 space-y-4">
                {authMode === "register" && <div><label htmlFor="auth-name" className="mb-2 block text-xs font-semibold text-slate-700">Nombre completo</label><input id="auth-name" name="name" type="text" autoComplete="name" required placeholder="Tu nombre" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-lime-600/70" /></div>}
                <div><label htmlFor="auth-email" className="mb-2 block text-xs font-semibold text-slate-700">Correo electrónico</label><input id="auth-email" name="email" type="email" autoComplete="email" required placeholder="nombre@correo.com" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-lime-600/70" /></div>
                {authMode !== "recover" && <div><label htmlFor="auth-password" className="mb-2 block text-xs font-semibold text-slate-700">Contraseña</label><div className="flex rounded-lg border border-slate-200 bg-slate-50 pr-3 focus-within:border-lime-600/70"><input id="auth-password" name="password" type={showPassword ? "text" : "password"} autoComplete={authMode === "login" ? "current-password" : "new-password"} required minLength={6} placeholder="Mínimo 6 caracteres" className="w-full min-w-0 bg-transparent px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-500" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} className="shrink-0 text-xs font-semibold text-slate-600 hover:text-slate-900">{showPassword ? "Ocultar" : "Mostrar"}</button></div></div>}
                {authMode === "login" && <div className="flex items-center justify-between gap-3 text-xs"><label className="flex cursor-pointer items-center gap-2 text-slate-600"><input type="checkbox" name="remember" className="accent-lime-600" /> Recordarme</label><button type="button" onClick={() => setAuthMode("recover")} className="font-semibold text-lime-800 hover:text-slate-900">¿Olvidaste tu contraseña?</button></div>}
                <button type="submit" className="w-full rounded-lg bg-lime-300 px-4 py-3.5 text-sm font-bold text-slate-900 shadow-lg shadow-slate-900/5 transition hover:bg-lime-400">{authMode === "login" ? "ENTRAR AL PORTAL" : authMode === "register" ? "CREAR CUENTA DE MUESTRA" : "PROBAR RECUPERACIÓN"}</button>
              </form>
              <div className="mt-6 border-t border-slate-200 pt-5 text-center text-xs text-slate-600">{authMode === "login" ? <>¿Todavía no tienes cuenta? <button type="button" onClick={() => setAuthMode("register")} className="font-bold text-lime-800 hover:text-slate-900">Regístrate</button></> : authMode === "register" ? <>¿Ya tienes cuenta? <button type="button" onClick={() => setAuthMode("login")} className="font-bold text-lime-800 hover:text-slate-900">Inicia sesión</button></> : <>¿Recordaste tu contraseña? <button type="button" onClick={() => setAuthMode("login")} className="font-bold text-lime-800 hover:text-slate-900">Volver al acceso</button></>}</div>
              <p className="mt-5 rounded-lg border border-yellow-500/15 bg-yellow-500/[0.04] px-3 py-2.5 text-[10px] leading-5 text-amber-900">Modo demostración: no se autentican usuarios, no se crean cuentas y no se envían correos. Usa datos ficticios.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
