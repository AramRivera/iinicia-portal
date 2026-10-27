
"use client";

import Link from "next/link";
import { usePortalAuth } from "@/components/PortalAuthProvider";

const sections = [
  {
  icon: "📚",
  title: "Mis cursos",
  description: "Consulta los cursos en los que estás inscrito.",
  href: "/estudiante/cursos",
  },
  {
    icon: "📝",
    title: "Mis inscripciones",
    description: "Revisa el estado de tus solicitudes de inscripción.",
  },
  {
    icon: "🎓",
    title: "Campus virtual",
    description: "Accede a tus cursos autorizados de Moodle.",
  },
  {
    icon: "👤",
    title: "Mi perfil",
    description: "Consulta y actualiza tu información personal.",
  },
];

export default function EstudiantePage() {
  const { session, loading, error } = usePortalAuth();

  // Esperamos a que la API compruebe la sesión.
  if (loading) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center px-5">
        <p className="text-lg text-foreground/70">
          Verificando tu sesión...
        </p>
      </div>
    );
  }

  // Si no hay una sesión validada, no mostramos el panel.
  if (!session) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center px-5">
        <div className="w-full max-w-lg rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-8 text-center">
          <div className="mb-4 text-4xl">🔒</div>

          <h1 className="text-2xl font-bold">
            Inicia sesión para continuar
          </h1>

          <p className="mt-3 text-sm text-foreground/65">
            Necesitas una cuenta de estudiante para acceder
            a tu espacio de aprendizaje.
          </p>

          {error && (
            <p role="alert" className="mt-4 text-sm text-red-500">
              {error}
            </p>
          )}

          <Link
            href="/"
            className="mt-6 inline-flex rounded-xl bg-lime-300 px-6 py-3 font-semibold text-slate-900 hover:bg-lime-400"
          >
            Ir al inicio para iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  // Comprobamos que tenga el rol de estudiante.
  const isStudent = session.profile.roles.includes("estudiante");

  if (!isStudent) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center px-5">
        <div className="max-w-lg rounded-2xl border border-foreground/10 p-8 text-center">
          <div className="mb-4 text-4xl">🛡️</div>

          <h1 className="text-2xl font-bold">
            Acceso restringido
          </h1>

          <p className="mt-3 text-foreground/65">
            Tu cuenta no tiene el rol de estudiante.
            Este panel está destinado a los alumnos de IINICIA.
          </p>

          <Link
            href="/"
            className="mt-6 inline-flex rounded-xl bg-lime-300 px-6 py-3 font-semibold text-slate-900"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  // Panel visible solamente con una sesión de estudiante validada.
  const firstName = session.profile.first_name || "Estudiante";

  return (
    <div className="min-h-screen bg-background px-5 py-12 text-foreground">
      <div className="mx-auto max-w-6xl">
        <p className="mb-3 text-sm font-bold uppercase tracking-widest text-lime-600">
          IINICIA / Portal del estudiante
        </p>

        <h1 className="text-4xl font-bold">
          ¡Bienvenido, {firstName}!
        </h1>

        <p className="mt-4 max-w-2xl text-foreground/65">
          Este es tu espacio personal de aprendizaje.
          Consulta tus cursos, inscripciones y acceso al campus virtual.
        </p>

        <div className="mt-6 inline-flex rounded-full border border-lime-500/30 bg-lime-500/10 px-4 py-2 text-sm font-medium text-lime-600">
          Cuenta activa · Estudiante
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {sections.map((section) => (
            <article
              key={section.title}
              className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-6 shadow-sm"
            >
              <div className="mb-4 text-3xl">
                {section.icon}
              </div>

              <h2 className="text-xl font-semibold">
                {section.title}
              </h2>

              <p className="mt-2 text-sm text-foreground/65">
                {section.description}
              </p>

              {section.href ? (
  <Link
    href={section.href}
    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-lime-300 px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-lime-400"
  >
    Ver mis cursos
    <span aria-hidden="true">→</span>
  </Link>
) : (
  <p className="mt-5 text-xs font-semibold text-lime-600">
    Integración en preparación
  </p>
)}
            </article>
          ))}
        </div>

        <div className="mt-10">
          <Link
            href="/"
            className="inline-flex rounded-xl bg-lime-300 px-6 py-3 font-semibold text-slate-900 hover:bg-lime-400"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
