
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePortalAuth } from "@/components/PortalAuthProvider";

type Course = Record<string, unknown>;

type RequestStatus = "idle" | "loading" | "success" | "error";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "")
  .trim()
  .replace(/\/+$/, "");

// Identificamos una lista de cursos sin asumir
// que Swagger haya documentado su estructura.
function extractCourses(data: unknown): Course[] | null {
  let list: unknown = data;

  if (!Array.isArray(list) && typeof list === "object" && list !== null) {
    const result = list as Record<string, unknown>;

    if (Array.isArray(result.data)) {
      list = result.data;
    } else if (Array.isArray(result.items)) {
      list = result.items;
    } else if (Array.isArray(result.courses)) {
      list = result.courses;
    } else if (
      typeof result.data === "object" &&
      result.data !== null
    ) {
      const nested = result.data as Record<string, unknown>;
      list = nested.items ?? nested.courses ?? nested.data;
    }
  }

  if (!Array.isArray(list)) {
    return null;
  }

  if (
    !list.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        !Array.isArray(item)
    )
  ) {
    return null;
  }

  return list as Course[];
}

// Busca el nombre entre los campos más habituales.
// Lo ajustaremos cuando confirmemos la respuesta real.
function getCourseName(course: Course, index: number): string {
  const fields = [
    "name",
    "title",
    "fullname",
    "course_name",
    "courseName",
  ];

  for (const field of fields) {
    const value = course[field];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return `Curso ${index + 1}`;
}

export default function MisCursosPage() {
  const { session, loading: authLoading } = usePortalAuth();

  const [courses, setCourses] = useState<Course[]>([]);
  const [status, setStatus] = useState<RequestStatus>("idle");
  const [requestError, setRequestError] = useState("");
  const [responseFields, setResponseFields] = useState<string[]>([]);

  const accessToken = session?.accessToken;
  const isStudent =
    session?.profile.roles.includes("estudiante") ?? false;

  useEffect(() => {
    if (authLoading || !accessToken || !isStudent) {
      return;
    }

    const controller = new AbortController();

    async function loadCourses() {
      setStatus("loading");
      setRequestError("");
      setCourses([]);
      setResponseFields([]);

      if (!API_URL) {
        setRequestError("No está configurada la URL de la API.");
        setStatus("error");
        return;
      }

      try {
        const response = await fetch(`${API_URL}/courses`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `No se pudieron consultar los cursos. Código HTTP: ${response.status}`
          );
        }

        const data: unknown = await response.json();

        const courseList = extractCourses(data);

        if (!courseList) {
          setResponseFields(
            typeof data === "object" && data !== null
              ? Object.keys(data)
              : []
          );

          throw new Error(
            "La API respondió correctamente, pero utiliza un formato de cursos que aún no hemos identificado."
          );
        }

        setCourses(courseList);
        setStatus("success");
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setRequestError(
          error instanceof Error
            ? error.message
            : "Ocurrió un error al consultar los cursos."
        );

        setStatus("error");
      }
    }

    void loadCourses();

    return () => {
      controller.abort();
    };
  }, [authLoading, accessToken, isStudent]);

  // Comprobamos que la sesión sea válida.
  if (authLoading) {
    return (
      <main className="min-h-[65vh] px-5 py-16 text-center">
        <p className="text-foreground/65">
          Verificando tu sesión...
        </p>
      </main>
    );
  }

  // Bloqueamos la sección sin sesión.
  if (!session) {
    return (
      <main className="min-h-[65vh] px-5 py-16 text-center">
        <h1 className="text-2xl font-bold">
          Inicia sesión para ver tus cursos
        </h1>

        <p className="mt-3 text-foreground/65">
          Necesitas iniciar sesión para acceder a esta sección.
        </p>

        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-lime-300 px-6 py-3 font-semibold text-slate-900"
        >
          Ir al inicio
        </Link>
      </main>
    );
  }

  // Comprobamos el rol.
  if (!isStudent) {
    return (
      <main className="min-h-[65vh] px-5 py-16 text-center">
        <h1 className="text-2xl font-bold">
          Acceso restringido
        </h1>

        <p className="mt-3 text-foreground/65">
          Esta sección es exclusiva para estudiantes.
        </p>

        <Link
          href="/"
          className="mt-6 inline-block text-lime-600 hover:underline"
        >
          Volver al inicio
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-5 py-12 text-foreground">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/estudiante"
          className="text-sm font-semibold text-lime-600 hover:underline"
        >
          ← Volver al panel del estudiante
        </Link>

        <p className="mt-8 text-sm font-bold uppercase tracking-widest text-lime-600">
          IINICIA / Portal del estudiante
        </p>

        <h1 className="mt-3 text-4xl font-bold">
          📚 Mis cursos
        </h1>

        <p className="mt-4 max-w-2xl text-foreground/65">
          Consulta los cursos autorizados para tu cuenta.
          Próximamente también podrás acceder a sus aulas virtuales.
        </p>

        <section className="mt-10 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-8">
          <h2 className="text-xl font-semibold">
            Tus cursos
          </h2>

          {status === "idle" || status === "loading" ? (
            <p className="mt-5 text-sm text-foreground/65">
              Consultando tus cursos en IINICIA...
            </p>
          ) : null}

          {status === "error" && (
            <div role="alert" className="mt-5">
              <p className="font-semibold text-red-500">
                No fue posible cargar los cursos
              </p>

              <p className="mt-2 text-sm text-foreground/65">
                {requestError}
              </p>

              {responseFields.length > 0 && (
                <p className="mt-3 text-xs text-foreground/50">
                  Campos principales de la respuesta:{" "}
                  {responseFields.join(", ")}
                </p>
              )}
            </div>
          )}

          {status === "success" && courses.length === 0 && (
            <div className="mt-5">
              <p className="font-semibold">
                Todavía no tienes cursos disponibles
              </p>

              <p className="mt-2 text-sm text-foreground/65">
                No se encontraron cursos autorizados para tu cuenta.
              </p>
            </div>
          )}

          {status === "success" && courses.length > 0 && (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {courses.map((course, index) => (
                <article
                  key={
                    typeof course.id === "string" ||
                    typeof course.id === "number"
                      ? String(course.id)
                      : index
                  }
                  className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5"
                >
                  <div className="mb-3 text-2xl">
                    📖
                  </div>

                  <h3 className="text-lg font-bold">
                    {getCourseName(course, index)}
                  </h3>

                  {typeof course.description === "string" &&
                    course.description && (
                      <p className="mt-3 text-sm text-foreground/65">
                        {course.description}
                      </p>
                    )}

                  <p className="mt-4 text-xs font-semibold text-lime-600">
                    Curso disponible en IINICIA
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
