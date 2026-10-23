
"use client";

import { useState } from "react";

export default function Page() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const goTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setMenuOpen(false);
  };

  const showComingSoon = (feature: string) => {
    setNotice(
      `${feature} estará disponible próximamente. Esta página es una demostración visual.`
    );
    setMenuOpen(false);
  };

  const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(
      "Inicio de sesión de demostración. Todavía no existe una conexión con el backend."
    );
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-neutral-950 font-sans text-neutral-200">
      {/* Fondo decorativo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[-10%] top-[-10%] h-96 w-96 rounded-full bg-red-700/20 blur-[120px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[-10%] top-[45%] h-96 w-96 rounded-full bg-red-900/10 blur-[120px]"
      />

      <div className="relative z-10">
        {/* ENCABEZADO */}
        <header className="sticky top-0 z-50 border-b border-red-600/30 bg-neutral-950/90 px-5 py-4 backdrop-blur-md md:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <a
              href="#inicio"
              onClick={() => setMenuOpen(false)}
              className="flex shrink-0 items-center gap-2"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-red-600">
                <span className="text-xs font-bold text-red-500">I²</span>
              </span>
              <span className="text-xl font-bold tracking-wider text-white">
                IINICIA
              </span>
            </a>

            {/* Navegación para computadora */}
            <nav
              aria-label="Navegación principal"
              className="hidden items-center gap-5 text-sm font-medium lg:flex xl:gap-6"
            >
              <a href="#inicio" className="hover:text-red-400">
                Inicio
              </a>
              <a href="#cursos" className="hover:text-red-400">
                Cursos
              </a>
              <a href="#certificaciones" className="hover:text-red-400">
                Certificaciones
              </a>
              <a href="#diplomados" className="hover:text-red-400">
                Diplomados
              </a>
              <a href="#universidad" className="hover:text-red-400">
                Universidad IINICIA
              </a>
            </nav>

            <div className="hidden items-center gap-3 text-sm font-medium sm:flex">
              <button
                type="button"
                onClick={() => showComingSoon("El registro de usuarios")}
                className="hover:text-red-400"
              >
                Regístrate
              </button>
              <button
                type="button"
                onClick={() => goTo("acceso")}
                className="rounded-md bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
              >
                Iniciar sesión
              </button>
            </div>

            {/* Botón del menú móvil */}
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
              className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-white hover:border-red-600 lg:hidden"
            >
              {menuOpen ? "Cerrar ✕" : "Menú ☰"}
            </button>
          </div>

          {/* Navegación para celulares */}
          {menuOpen && (
            <nav
              aria-label="Navegación móvil"
              className="mx-auto mt-4 flex max-w-7xl flex-col gap-1 border-t border-neutral-800 pt-3 lg:hidden"
            >
              <a
                href="#inicio"
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2 hover:bg-neutral-900 hover:text-red-400"
              >
                Inicio
              </a>
              <a
                href="#cursos"
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2 hover:bg-neutral-900 hover:text-red-400"
              >
                Cursos
              </a>
              <a
                href="#certificaciones"
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2 hover:bg-neutral-900 hover:text-red-400"
              >
                Certificaciones
              </a>
              <a
                href="#diplomados"
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2 hover:bg-neutral-900 hover:text-red-400"
              >
                Diplomados
              </a>
              <a
                href="#universidad"
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2 hover:bg-neutral-900 hover:text-red-400"
              >
                Universidad IINICIA
              </a>
              <button
                type="button"
                onClick={() => showComingSoon("El registro de usuarios")}
                className="rounded-md px-3 py-2 text-left hover:bg-neutral-900 hover:text-red-400"
              >
                Regístrate
              </button>
              <button
                type="button"
                onClick={() => goTo("acceso")}
                className="mt-1 rounded-md bg-red-600 px-3 py-2 text-left font-semibold text-white hover:bg-red-700"
              >
                Iniciar sesión
              </button>
            </nav>
          )}
        </header>

        {/* AVISOS */}
        {notice !== "" && (
          <div
            role="status"
            aria-live="polite"
            className="mx-auto mt-5 flex max-w-7xl items-start justify-between gap-4 px-5 md:px-8"
          >
            <p className="flex-1 rounded-lg border border-red-800/70 bg-red-950/60 px-4 py-3 text-sm text-red-100">
              {notice}
            </p>
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Cerrar aviso"
              className="rounded-md px-2 py-1 text-neutral-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        <main className="space-y-24 pb-20 md:space-y-32">
          {/* INICIO Y LOGIN */}
          <section
            id="inicio"
            className="mx-auto grid max-w-7xl scroll-mt-28 grid-cols-1 items-center gap-12 px-5 pt-14 md:px-8 md:pt-20 lg:grid-cols-2 lg:gap-16"
          >
            {/* Presentación */}
            <div className="space-y-8">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-red-500">
                Aprende. Crece. Transforma.
              </p>

              <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl">
                UNIVERSIDAD <span className="text-red-600">IINICIA</span>
              </h1>

              <div className="space-y-4 text-lg text-neutral-400">
                <p className="font-semibold text-white">
                  Tu educación comienza hoy, estés donde estés.
                </p>
                <p>
                  El conocimiento que transforma tu vida está a tu alcance,
                  en todo momento.
                </p>
              </div>

              <button
                type="button"
                onClick={() => goTo("cursos")}
                className="rounded-full bg-red-600 px-8 py-3 font-bold text-white shadow-[0_0_15px_rgba(220,38,38,0.4)] transition-all hover:bg-red-500"
              >
                COMIENZA AHORA
              </button>

              <div className="grid max-w-lg grid-cols-3 gap-4 border-t border-neutral-800 pt-6">
                <div>
                  <p className="text-2xl font-bold text-white">100%</p>
                  <p className="text-xs text-neutral-500 sm:text-sm">
                    Aprendizaje flexible
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">24/7</p>
                  <p className="text-xs text-neutral-500 sm:text-sm">
                    Acceso en línea
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">+ Cursos</p>
                  <p className="text-xs text-neutral-500 sm:text-sm">
                    Para tu desarrollo
                  </p>
                </div>
              </div>
            </div>

            {/* FORMULARIO DE ACCESO */}
            <div
              id="acceso"
              className="scroll-mt-28 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
            >
              <div
                aria-hidden="true"
                className="mb-6 h-1 w-full rounded-full bg-gradient-to-r from-red-900 via-red-600 to-red-900"
              />

              <div className="mb-8">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-red-500">
                  Mi cuenta
                </p>
                <h2 className="mb-2 text-2xl font-bold text-white">
                  Acceso al Portal
                </h2>
                <p className="text-sm text-neutral-400">
                  Ingresa tus credenciales para acceder a Mi IINICIA.
                </p>
              </div>

              <form className="space-y-5" onSubmit={handleLogin}>
                <div className="space-y-2">
                  <label
                    htmlFor="correo"
                    className="block text-sm font-medium text-neutral-300"
                  >
                    Correo electrónico
                  </label>
                  <input
                    id="correo"
                    name="correo"
                    type="email"
                    autoComplete="email"
                    placeholder="nombre@correo.com"
                    required
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 text-white outline-none transition placeholder:text-neutral-600 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-neutral-300"
                  >
                    Contraseña
                  </label>

                  <div className="flex items-center rounded-lg border border-neutral-700 bg-neutral-950 pr-3 focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-500">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Ingresa tu contraseña"
                      required
                      className="w-full rounded-lg bg-transparent px-4 py-3 text-white outline-none placeholder:text-neutral-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="shrink-0 text-xs font-medium text-neutral-400 hover:text-white"
                    >
                      {showPassword ? "Ocultar" : "Mostrar"}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <label className="flex cursor-pointer items-center gap-2 text-neutral-400">
                    <input
                      type="checkbox"
                      name="recordarme"
                      className="accent-red-600"
                    />
                    Recordarme
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      showComingSoon("La recuperación de contraseña")
                    }
                    className="text-red-400 hover:text-red-300"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-red-600 px-4 py-3 font-bold text-white shadow-lg shadow-red-950/30 transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-neutral-900"
                >
                  INICIAR SESIÓN
                </button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-neutral-800" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-neutral-900 px-3 text-xs text-neutral-500">
                      ¿AÚN NO TIENES CUENTA?
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => showComingSoon("El registro de usuarios")}
                  className="w-full rounded-lg border border-neutral-700 px-4 py-3 font-semibold text-white transition hover:border-red-600 hover:bg-red-950/30"
                >
                  Crear una cuenta
                </button>

                <p className="text-center text-xs text-neutral-500">
                  Portal de demostración · Acceso no conectado a un servidor
                </p>
              </form>
            </div>
          </section>

          {/* CURSOS */}
          <section id="cursos" className="scroll-mt-28 px-5 md:px-8">
            <div className="mx-auto max-w-7xl">
              <div className="mb-10">
                <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-red-500">
                  Aprende algo nuevo
                </p>
                <h2 className="text-3xl font-bold text-white sm:text-4xl">
                  Explora nuestros cursos
                </h2>
                <p className="mt-3 max-w-2xl text-neutral-400">
                  Desarrolla habilidades y adquiere conocimientos para tus
                  próximos retos.
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    number: "01",
                    title: "Tecnología e innovación",
                    text: "Descubre herramientas digitales y nuevas tecnologías.",
                  },
                  {
                    number: "02",
                    title: "Negocios y administración",
                    text: "Fortalece tus habilidades de organización y liderazgo.",
                  },
                  {
                    number: "03",
                    title: "Desarrollo personal",
                    text: "Impulsa tus capacidades y mejora tu aprendizaje.",
                  },
                ].map((course) => (
                  <article
                    key={course.number}
                    className="group rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 transition hover:-translate-y-1 hover:border-red-700/70"
                  >
                    <span className="mb-6 flex h-11 w-11 items-center justify-center rounded-lg bg-red-950 text-sm font-bold text-red-400">
                      {course.number}
                    </span>
                    <h3 className="mb-3 text-xl font-bold text-white">
                      {course.title}
                    </h3>
                    <p className="mb-6 text-sm leading-6 text-neutral-400">
                      {course.text}
                    </p>
                    <button
                      type="button"
                      onClick={() => showComingSoon(`El curso ${course.title}`)}
                      className="font-semibold text-red-400 transition group-hover:text-red-300"
                    >
                      Conocer más →
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* CERTIFICACIONES */}
          <section
            id="certificaciones"
            className="scroll-mt-28 border-y border-neutral-800 bg-neutral-900/40 px-5 py-16 md:px-8 md:py-20"
          >
            <div className="mx-auto grid max-w-7xl items-center gap-10 md:grid-cols-2">
              <div>
                <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-red-500">
                  Reconoce tus habilidades
                </p>
                <h2 className="text-3xl font-bold text-white sm:text-4xl">
                  Certificaciones para crecer
                </h2>
                <p className="mt-5 leading-7 text-neutral-400">
                  Fortalece tu perfil académico y profesional mediante
                  experiencias formativas enfocadas en conocimientos y
                  competencias.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    showComingSoon("La sección de certificaciones")
                  }
                  className="mt-7 rounded-lg bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-500"
                >
                  Explorar certificaciones
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-6">
                  <span className="text-3xl">✦</span>
                  <h3 className="mt-4 font-bold text-white">
                    Competencias digitales
                  </h3>
                  <p className="mt-2 text-sm text-neutral-400">
                    Conocimientos útiles para el entorno digital.
                  </p>
                </div>
                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-6 sm:mt-8">
                  <span className="text-3xl">✧</span>
                  <h3 className="mt-4 font-bold text-white">
                    Desarrollo profesional
                  </h3>
                  <p className="mt-2 text-sm text-neutral-400">
                    Habilidades orientadas al crecimiento laboral.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* DIPLOMADOS */}
          <section id="diplomados" className="scroll-mt-28 px-5 md:px-8">
            <div className="mx-auto max-w-7xl">
              <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-red-500">
                Especialízate
              </p>
              <h2 className="text-3xl font-bold text-white sm:text-4xl">
                Diplomados destacados
              </h2>
              <p className="mt-3 max-w-2xl text-neutral-400">
                Espacios de formación para profundizar en distintas áreas de
                conocimiento.
              </p>

              <div className="mt-8 grid gap-6 md:grid-cols-3">
                {[
                  "Innovación y tecnología",
                  "Gestión de proyectos",
                  "Liderazgo y emprendimiento",
                ].map((diploma, index) => (
                  <article
                    key={diploma}
                    className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6"
                  >
                    <p className="text-sm font-semibold text-red-500">
                      DIPLOMADO 0{index + 1}
                    </p>
                    <h3 className="mt-4 text-xl font-bold text-white">
                      {diploma}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-neutral-400">
                      Una propuesta de formación para ampliar tus
                      conocimientos y competencias.
                    </p>
                    <button
                      type="button"
                      onClick={() => showComingSoon(`El diplomado ${diploma}`)}
                      className="mt-6 text-sm font-semibold text-red-400 hover:text-red-300"
                    >
                      Ver detalles →
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* UNIVERSIDAD IINICIA */}
          <section
            id="universidad"
            className="scroll-mt-28 px-5 md:px-8"
          >
            <div className="mx-auto max-w-7xl overflow-hidden rounded-2xl border border-red-900/50 bg-gradient-to-br from-red-950/70 via-neutral-900 to-neutral-950 p-8 sm:p-12">
              <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-red-400">
                El siguiente paso comienza aquí
              </p>
              <h2 className="max-w-2xl text-3xl font-extrabold text-white sm:text-4xl">
                Tu futuro se construye con cada aprendizaje.
              </h2>
              <p className="mt-5 max-w-2xl leading-7 text-neutral-400">
                Explora las oportunidades de aprendizaje de IINICIA y encuentra
                nuevas formas de desarrollar tu potencial.
              </p>
              <button
                type="button"
                onClick={() => goTo("acceso")}
                className="mt-8 rounded-lg bg-red-600 px-6 py-3 font-bold text-white transition hover:bg-red-500"
              >
                Acceder al portal
              </button>
            </div>
          </section>
        </main>

        {/* PIE DE PÁGINA */}
        <footer className="border-t border-neutral-800 px-5 py-8 md:px-8">
          <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 text-sm text-neutral-500 sm:flex-row">
            <p>
              <span className="font-bold tracking-wider text-white">
                IINICIA
              </span>{" "}
              · Universidad y aprendizaje
            </p>
            <p>Demostración de frontend · Sin conexión a backend</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
