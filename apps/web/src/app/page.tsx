/** Reúne el portal público, carga la oferta desde la API y conecta el catálogo con admisiones y contacto. */
'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { contactApi, coursesApi, enrollmentsApi, programsApi } from '@/lib/api';
import type { CourseOffering, AuthorizedCourse, EnrollmentRequest, Program } from '@/types';
import styles from './landing.module.css';
import {
  IconCheck,
  IconSearch,
  IconBookOpen,
  IconRefresh,
  IconAlertTriangle,
} from '@/components/campus-tech/Icons';

function CourseCover() {
  return (
    <div className={styles.courseCover} aria-hidden="true">
      <IconBookOpen className="size-9" />
    </div>
  );
}

function CertificationSection({ programs, loading, loadError }: {
  programs: Program[];
  loading: boolean;
  loadError: boolean;
}) {
  const status = loadError ? 'No pudimos cargar la oferta. Recarga la página para reintentar.' : 'Aún no hay certificaciones publicadas.';
  return (
    <section id="certificaciones" aria-labelledby="certificaciones-titulo" className={`${styles.section} ${styles.sectionTint} px-4 sm:px-6 lg:px-8`}>
      <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8">
        <h2 id="certificaciones-titulo" className={styles.sectionTitle}>Certificaciones</h2>
        {programs.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
            {programs.map((program) => {
              const description = program.short_description || program.description;
              const programTitleId = `certificacion-${program.id}-nombre`;
              const programActionId = `certificacion-${program.id}-accion`;
              const duration = program.duration_text || (program.duration_hours > 0 ? `${program.duration_hours} horas` : '');
              return (
                <li key={program.id}>
                  <Link href={`/programas/${program.slug}`} aria-labelledby={`${programActionId} ${programTitleId}`} className={`${styles.detailCard} ${styles.programCard}`}>
                    <h3 id={programTitleId} className={styles.programTitle}>{program.name}</h3>
                    {description && <p className="line-clamp-3 text-sm leading-relaxed text-muted">{description}</p>}
                    <div className="mt-auto pt-2">
                      {duration && <p className="text-sm font-medium text-muted">{duration}</p>}
                      <span id={programActionId} className={styles.programLink}>
                        Ver programa <span aria-hidden="true">→</span>
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p role="status" className={styles.emptyState}>{loading ? 'Cargando la oferta académica…' : status}</p>
        )}
      </div>
    </section>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();

  // Courses state
  const [offerings, setOfferings] = useState<CourseOffering[]>([]);
  const [myCourses, setMyCourses] = useState<AuthorizedCourse[]>([]);
  const [myEnrollments, setMyEnrollments] = useState<EnrollmentRequest[]>([]);
  const [publicCourses, setPublicCourses] = useState<Program[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [courseLoadError, setCourseLoadError] = useState(false);
  const [programLoadError, setProgramLoadError] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [enrollMessage, setEnrollMessage] = useState<string | null>(null);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  const [certificaciones, setCertificaciones] = useState<Program[]>([]);

  // Contact form state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactArea, setContactArea] = useState('admisiones');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  // Initial Hash scroll handler
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const id = window.location.hash.replace('#', '');
      const timer = setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, []);

  // Load dynamic course data
  useEffect(() => {
    async function loadData() {
      try {
        setCoursesLoading(true);
        setCourseLoadError(false);
        setProgramLoadError(false);
        const [offeringsData, authorized, enrollments, programs] = await Promise.all([
          user ? coursesApi.getOfferings().catch(() => { setCourseLoadError(true); return []; }) : Promise.resolve([]),
          user ? coursesApi.getAuthorizedCourses().catch(() => []) : Promise.resolve([]),
          user ? enrollmentsApi.getMyEnrollments().catch(() => []) : Promise.resolve([]),
          programsApi.getPrograms().catch(() => {
            setProgramLoadError(true);
            if (!user) setCourseLoadError(true);
            return [];
          }),
        ]);

        setOfferings(offeringsData);

        setMyCourses(authorized || []);
        setMyEnrollments(enrollments);
        setPublicCourses(programs.filter((program) => program.type === 'curso'));

        setCertificaciones(programs.filter((program) => program.type === 'certificacion'));
      } catch {
        setCourseLoadError(true);
        setOfferings([]);
        setPublicCourses([]);
        setCertificaciones([]);
      } finally {
        setCoursesLoading(false);
      }
    }

    loadData();
  }, [user]);

  const isEnrolled = (courseMappingId: string) => {
    return myCourses.some((c) => c.course_mapping_id === courseMappingId);
  };

  // Conecta la acción del catálogo con la solicitud de matrícula de la sesión.
  const handleEnroll = async (courseMappingId: string, courseName: string) => {
    if (!user) {
      router.push('/login');
      return;
    }

    try {
      setEnrollingId(courseMappingId);
      setEnrollMessage(null);
      setEnrollError(null);

      const enrollment = await enrollmentsApi.requestEnrollment(courseMappingId);
      setMyEnrollments((current) => [...current, enrollment]);
      setEnrollMessage(`Solicitud para "${courseName}" registrada. Un administrador revisará tu inscripción.`);
      
      const authorized = await coursesApi.getAuthorizedCourses().catch(() => []);
      setMyCourses(authorized);
    } catch (err: unknown) {
      setEnrollError(
        err instanceof Error
          ? err.message
          : 'No fue posible completar la inscripción.',
      );
    } finally {
      setEnrollingId(null);
    }
  };

  // Envía el formulario al servicio institucional y presenta el resultado del envío.
  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError(null);

    if (!contactName.trim() || !contactEmail.trim() || !contactMessage.trim()) {
      setContactError('Por favor completa todos los campos requeridos (*).');
      return;
    }

    setContactSubmitting(true);
    const contactDepartments: Record<string, string> = {
      admisiones: 'Admisiones y Convocatorias',
      soporte: 'Soporte Campus Virtual Moodle',
      escolar: 'Servicios Escolares y Certificados',
      vinculacion: 'Rectoría y Vinculación',
    };

    try {
      await contactApi.submitMessage({
        full_name: contactName.trim(),
        email: contactEmail.trim(),
        phone: contactPhone.trim() || undefined,
        subject: `Contacto web: ${contactDepartments[contactArea] ?? 'INICIA'}`,
        message: contactMessage.trim(),
      });
      setContactSuccess(true);
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      setContactMessage('');
    } catch (err: unknown) {
      setContactError(
        err instanceof Error
          ? err.message
          : 'No fue posible enviar tu mensaje. Inténtalo de nuevo.',
      );
    } finally {
      setContactSubmitting(false);
    }
  };

  const filteredCourses = offerings.filter((c) =>
    c.name.toLowerCase().includes(courseSearch.toLowerCase()) ||
    c.code.toLowerCase().includes(courseSearch.toLowerCase())
  );
  const filteredPublicCourses = publicCourses.filter((course) =>
    course.name.toLowerCase().includes(courseSearch.toLowerCase()) ||
    course.code.toLowerCase().includes(courseSearch.toLowerCase())
  );

  return (
    <div className="flex-1 bg-background text-foreground">
      <div className={styles.heroFrame}>
        <section id="inicio" aria-labelledby="inicio-titulo" className={styles.hero}>
          <Image
            src="/iinicia-landing-hero.webp"
            alt=""
            fill
            preload
            sizes="100vw"
            className={styles.heroImage}
          />
          <div className={styles.heroShade} />
          <div className={styles.heroContent}>
            <p className={styles.institute}>Instituto de Innovación y Ciencias Aplicadas</p>
            <h1 id="inicio-titulo" className={styles.heroTitle}>
              Tu educación comienza hoy, <span>estés donde estés.</span>
            </h1>
            <p className={styles.heroDescription}>
              Estudia a tu ritmo con cursos y certificaciones en el Campus Virtual de IINICIA.
            </p>
            <div className={styles.heroActions}>
              <Link href="/registro" className={styles.heroPrimary}>Comienza ahora</Link>
              <a href="#cursos" className={styles.heroSecondary}>Explorar cursos <span aria-hidden="true">↓</span></a>
            </div>
          </div>
        </section>
      </div>

      <section id="cursos" aria-labelledby="cursos-titulo" className={styles.catalog}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className={styles.catalogIntro}>
            <h2 id="cursos-titulo" className={styles.catalogTitle}>Todos nuestros cursos</h2>
            <p className="max-w-xl text-pretty text-base leading-relaxed">
              Explora la oferta de formación de IINICIA y encuentra un curso que se adapte a tus metas.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex justify-end">
              <label className="relative block w-full max-w-sm">
                <span className="sr-only">Buscar cursos por código o nombre</span>
                <input
                  type="search"
                  placeholder="Buscar por código o nombre"
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  className="h-11 w-full rounded-full border border-border bg-surface px-4 ps-10 text-sm text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                />
                <IconSearch aria-hidden="true" className="pointer-events-none absolute start-3.5 top-3.5 size-4 text-muted" />
              </label>
            </div>

            {/* Feedback banners */}
            {enrollMessage && (
              <div className="rounded-2xl border border-success/30 bg-success/10 backdrop-blur-md p-4 text-xs text-foreground flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="h-6 w-6 rounded-full bg-success/20 grid place-items-center shrink-0">
                    <IconCheck className="w-3.5 h-3.5 text-success" />
                  </div>
                  <span className="font-medium">{enrollMessage}</span>
                </div>
                <Link
                  href="/dashboard"
                  className="rounded-full bg-success text-white px-3 py-1.5 text-xs font-semibold shrink-0 shadow-xs hover:opacity-90 transition-opacity"
                >
                  Ver mi panel
                </Link>
              </div>
            )}

            {enrollError && (
              <div className="rounded-2xl border border-danger/30 bg-danger/10 backdrop-blur-md p-4 text-xs text-danger flex items-center gap-2.5 shadow-xs">
                <div className="h-6 w-6 rounded-full bg-danger/20 grid place-items-center shrink-0">
                  <IconAlertTriangle className="w-3.5 h-3.5 text-danger" />
                </div>
                <span className="font-medium">{enrollError}</span>
              </div>
            )}

            {/* Lista de cursos en Grid con estética Apple Card */}
            {coursesLoading ? (
              <div className="flex min-h-[220px] items-center justify-center rounded-3xl border border-border/60 bg-surface/40 backdrop-blur-md">
                <div className="flex items-center gap-3 text-xs text-muted font-medium">
                  <IconRefresh className="w-4 h-4 animate-spin text-primary" />
                  <span>Cargando catálogo curricular desde el servidor...</span>
                </div>
              </div>
            ) : !user && filteredPublicCourses.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredPublicCourses.map((course) => (
                  <div
                    key={course.id}
                    className={styles.courseCard}
                  >
                    <CourseCover />
                    <div className="flex-1 space-y-3 px-5 pt-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="rounded-md bg-surface-muted px-2.5 py-0.5 text-[11px] font-mono font-medium text-foreground border border-border/40">
                          {course.code}
                        </span>
                        {course.duration_text && (
                          <span className="text-[11px] font-medium text-muted">
                            {course.duration_text}
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-bold leading-snug text-foreground">
                        {course.name}
                      </h3>
                      {(course.short_description || course.description) && (
                        <p className="line-clamp-3 text-sm leading-relaxed text-muted">
                          {course.short_description || course.description}
                        </p>
                      )}
                    </div>

                    <div className="mx-5 my-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                      <Link
                        href={`/programas/${course.slug}`}
                        className="text-xs font-semibold text-primary hover:opacity-80 transition-opacity"
                      >
                        Ver detalles →
                      </Link>
                      <Link
                        href="/login"
                        className="rounded-full bg-primary-action px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:opacity-95 active:scale-95 transition-all"
                      >
                        Iniciar sesión
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredCourses.length === 0 ? (
              <div className="rounded-3xl border border-border/70 bg-surface/70 backdrop-blur-md p-12 text-center space-y-3 shadow-xs">
                <div className="h-10 w-10 mx-auto rounded-full bg-surface-muted grid place-items-center text-muted">
                  <IconSearch className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {courseLoadError
                    ? 'No fue posible cargar los cursos'
                    : (user ? offerings : publicCourses).length === 0
                      ? 'Aún no hay cursos publicados'
                      : 'No se encontraron cursos coincidentes'}
                </p>
                <p className="text-xs text-muted max-w-sm mx-auto">
                  {courseLoadError
                    ? 'Recarga la página para intentar de nuevo.'
                    : (user ? offerings : publicCourses).length === 0
                      ? 'Consulta el catálogo más tarde.'
                      : 'Intenta con otro término de búsqueda.'}
                </p>
                {!user && (
                  <Link
                    href="/login"
                    className="inline-block rounded-full bg-primary-action px-5 py-2 text-xs font-semibold text-white shadow-xs hover:opacity-95"
                  >
                    Iniciar sesión
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCourses.map((course) => {
                  const enrolled = isEnrolled(course.course_mapping_id);
                  const pending = myEnrollments.some(
                    (request) =>
                      request.course_mapping_id === course.course_mapping_id &&
                      request.status === 'pendiente',
                  );

                  return (
                    <div
                      key={course.id}
                      className={styles.courseCard}
                    >
                      <CourseCover />
                      <div className="flex-1 space-y-3 px-5 pt-5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded-md bg-surface-muted px-2.5 py-0.5 text-[11px] font-mono font-medium text-foreground border border-border/40">
                            {course.code}
                          </span>
                          {course.credits != null && (
                            <span className="text-[11px] font-medium text-muted">
                              {course.credits} créditos
                            </span>
                          )}
                        </div>
                        <h3 className="text-xl font-bold leading-snug text-foreground">
                          {course.name}
                        </h3>
                        <p className="line-clamp-3 text-sm leading-relaxed text-muted">
                          {course.course_description || 'Curso disponible en el catálogo de INICIA.'}
                        </p>
                      </div>

                      <div className="mx-5 my-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                        {course.programs?.slug ? (
                          <Link
                            href={`/programas/${course.programs.slug}`}
                            className="text-xs font-semibold text-primary hover:opacity-80 transition-opacity"
                          >
                            Detalles →
                          </Link>
                        ) : (
                          <span className="text-[11px] font-medium text-muted">Moodle LMS</span>
                        )}

                        {enrolled ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-[11px] font-semibold text-success border border-success/20">
                              Matriculado
                            </span>
                            <Link
                              href="/dashboard/estudiante"
                              className="rounded-full bg-primary-action text-white px-3 py-1 text-xs font-semibold hover:opacity-95 shadow-xs transition-opacity"
                            >
                              Entrar
                            </Link>
                          </div>
                        ) : pending ? (
                          <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary border border-primary/20">
                            Solicitud pendiente
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              handleEnroll(
                                course.course_mapping_id || course.id,
                                course.name,
                              )
                            }
                            disabled={
                              enrollingId ===
                              (course.course_mapping_id || course.id)
                            }
                            className="rounded-full bg-primary-action px-3.5 py-1.5 text-xs font-semibold text-white hover:opacity-95 transition-all shadow-xs disabled:opacity-50 active:scale-95"
                          >
                            {enrollingId === (course.course_mapping_id || course.id)
                              ? 'Solicitando...'
                              : user
                              ? 'Solicitar inscripción'
                              : 'Iniciar sesión'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="universidad" aria-labelledby="universidad-titulo" className={`${styles.section} px-4 sm:px-6 lg:px-8`}>
        <div className="mx-auto max-w-6xl space-y-10 sm:space-y-14">
          <div className={`${styles.universityIntro} grid items-center gap-6 md:grid-cols-[1.2fr_1fr]`}>
            <div className="space-y-4">
              <h2 id="universidad-titulo" className={styles.sectionTitle}>Universidad IINICIA</h2>
              <p className="max-w-md text-base leading-relaxed text-white/90">
                Formación universitaria en computación, tecnología y gestión académica.
              </p>
            </div>
            <Image
              src="/universidad-inicia-wordmark.png"
              alt=""
              width={1024}
              height={100}
              className="h-auto w-full max-w-xs md:justify-self-end"
            />
          </div>

          <div className="grid gap-8 md:grid-cols-2 md:gap-14">
            <div>
              <h3 className={styles.subheading}>Misión</h3>
              <p className="mt-2 max-w-md text-base leading-relaxed text-muted">
                Ampliar el acceso a la educación superior y a la formación tecnológica mediante la enseñanza en línea.
              </p>
            </div>
            <div>
              <h3 className={styles.subheading}>Visión</h3>
              <p className="mt-2 max-w-md text-base leading-relaxed text-muted">
                Ser un referente en educación virtual e innovación tecnológica en América Latina.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <h3 className={styles.subheading}>Cómo se estudia en IINICIA</h3>
            <ul className="grid gap-x-10 sm:grid-cols-2">
              {pilaresModelo.map((pilar) => (
                <li key={pilar.titulo} className="border-t border-border py-4">
                  <h4 className="font-semibold text-foreground">{pilar.titulo}</h4>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{pilar.descripcion}</p>
                </li>
              ))}
            </ul>
          </div>

          <details className={styles.disclosure}>
            <summary className={styles.disclosureSummary}>
              Autoridades y equipo académico <span aria-hidden="true">⌄</span>
            </summary>
            <ul className="grid gap-x-8 gap-y-5 border-t border-border px-5 py-6 sm:grid-cols-2 sm:px-6">
              {autoridades.map((persona) => (
                <li key={persona.nombre}>
                  <p className="font-semibold text-foreground">{persona.nombre}</p>
                  <p className="mt-1 text-sm text-muted">{persona.cargo}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{persona.semblanza}</p>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </section>

      <CertificationSection
        programs={certificaciones}
        loading={coursesLoading}
        loadError={programLoadError}
      />

      <section id="admisiones" aria-labelledby="admisiones-titulo" className={`${styles.section} px-4 sm:px-6 lg:px-8`}>
        <div className="mx-auto max-w-6xl space-y-10 sm:space-y-14">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <h2 id="admisiones-titulo" className={styles.sectionTitle}>Admisiones</h2>
            <Link href="/registro" className={styles.primaryAction}>Crear cuenta de aspirante</Link>
          </div>

          <ol className="grid gap-y-5 sm:grid-cols-2 lg:grid-cols-4" role="list">
            {pasosAdmision.map((paso, indice) => (
              <li key={paso.titulo} className={styles.stepCard}>
                <span className={styles.stepNumber} aria-hidden="true">{indice + 1}</span>
                <h3 className="mt-3 font-semibold text-foreground">{paso.titulo}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{paso.descripcion}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="contacto" aria-labelledby="contacto-titulo" className={`${styles.section} ${styles.sectionTint} px-4 sm:px-6 lg:px-8`}>
        <div className="mx-auto max-w-6xl space-y-12">
          <div className={styles.sectionHeading}>
            <h2 id="contacto-titulo" className={styles.sectionTitle}>Contacto</h2>
            <p className={styles.sectionDescription}>Envía una consulta o contacta directamente al departamento que necesitas.</p>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Interactive Message Form */}
            <div className="lg:col-span-7">
              <div className={`${styles.detailCard} space-y-5 p-6 sm:p-8`}>
                <div className="border-b border-border pb-3">
                  <h3 className={styles.subheading}>Enviar un mensaje</h3>
                </div>

                {contactSuccess ? (
                  <div role="status" className="rounded-[8px] border border-success/30 bg-success/10 p-6 text-center space-y-3">
                    <div className="mx-auto h-10 w-10 rounded-full bg-success/20 flex items-center justify-center text-success">
                      <IconCheck className="w-5 h-5 text-success" />
                    </div>
                    <h4 className="text-sm font-bold text-foreground">Mensaje recibido</h4>
                    <p className="text-xs text-muted max-w-sm mx-auto">
                      Te responderemos al correo que proporcionaste.
                    </p>
                    <button
                      type="button"
                      onClick={() => setContactSuccess(false)}
                      className="min-h-11 rounded-full border border-border bg-surface px-4 text-sm font-semibold text-primary hover:bg-surface-muted"
                    >
                      Enviar otro mensaje
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="space-y-4">
                    {contactError && (
                      <div role="alert" className="rounded-[6px] border border-danger/30 bg-danger/10 p-2.5 text-sm text-danger">
                        {contactError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label htmlFor="contacto-nombre" className="text-sm font-medium text-foreground">Nombre completo *</label>
                        <input
                          id="contacto-nombre"
                          autoComplete="name"
                          type="text"
                          required
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          className={styles.contactField}
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="contacto-correo" className="text-sm font-medium text-foreground">Correo electrónico *</label>
                        <input
                          id="contacto-correo"
                          autoComplete="email"
                          type="email"
                          required
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          className={styles.contactField}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label htmlFor="contacto-telefono" className="text-sm font-medium text-foreground">Teléfono (opcional)</label>
                        <input
                          id="contacto-telefono"
                          autoComplete="tel"
                          type="tel"
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          className={styles.contactField}
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="contacto-departamento" className="text-sm font-medium text-foreground">Departamento *</label>
                        <select
                          id="contacto-departamento"
                          required
                          value={contactArea}
                          onChange={(e) => setContactArea(e.target.value)}
                          className={styles.contactField}
                        >
                          <option value="admisiones">Admisiones y Convocatorias</option>
                          <option value="soporte">Soporte Campus Virtual Moodle</option>
                          <option value="escolar">Servicios Escolares y Certificados</option>
                          <option value="vinculacion">Rectoría y Vinculación</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="contacto-mensaje" className="text-sm font-medium text-foreground">Mensaje *</label>
                      <textarea
                        id="contacto-mensaje"
                        required
                        rows={4}
                        value={contactMessage}
                        onChange={(e) => setContactMessage(e.target.value)}
                        className={styles.contactField}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={contactSubmitting}
                      className={styles.primaryAction}
                    >
                      {contactSubmitting ? 'Enviando...' : 'Enviar mensaje'}
                    </button>
                  </form>
                )}
              </div>
            </div>
            <aside aria-labelledby="contacto-directorio" className="lg:col-span-5 lg:ps-4">
              <h3 id="contacto-directorio" className={styles.subheading}>Directorio</h3>
              <ul className="mt-4">
                {canalesAtencion.map((canal) => (
                  <li key={canal.email} className="border-t border-border py-4">
                    <h4 className="font-semibold text-foreground">{canal.departamento}</h4>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{canal.descripcion}</p>
                    <a href={`mailto:${canal.email}`} className={`${styles.programLink} text-sm`}>{canal.email}</a>
                    <p className="text-sm text-muted">{canal.horario}</p>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// DATA & CONSTANTS
// ============================================================================

const pilaresModelo = [
  {
    titulo: 'Aprendizaje práctico',
    descripcion: 'Aplica lo aprendido en proyectos y laboratorios virtuales.',
  },
  {
    titulo: 'Campus virtual',
    descripcion: 'Consulta materiales y evaluaciones en Moodle.',
  },
  {
    titulo: 'Acompañamiento docente',
    descripcion: 'Aprende con profesores que tienen experiencia en la industria.',
  },
  {
    titulo: 'Formación por módulos',
    descripcion: 'Organiza el estudio junto con tus demás actividades.',
  },
];

const autoridades = [
  {
    nombre: 'Dra. Elena Santillán Mora',
    cargo: 'Rectora Institucional',
    semblanza: 'Doctora en Innovación Educativa con más de 20 años de liderazgo en transformación universitaria.',
  },
  {
    nombre: 'Mtro. Roberto Vaca Elizondo',
    cargo: 'Director Académico y de Posgrados',
    semblanza: 'Especialista en diseño curricular por competencias, acreditaciones nacionales y tecnología educativa.',
  },
  {
    nombre: 'Dra. Claudia Rivas Téllez',
    cargo: 'Coordinadora de Campus Virtual',
    semblanza: 'Investigadora en analítica del aprendizaje, entornos virtuales Moodle LMS y educación distribuida.',
  },
  {
    nombre: 'Mtro. Héctor Domínguez Garza',
    cargo: 'Secretario General y Escolar',
    semblanza: 'Responsable de normatividad universitaria, admisiones, control escolar y convenios oficiales.',
  },
];

const pasosAdmision = [
  { titulo: 'Crea tu cuenta', descripcion: 'Regístrate como aspirante y confirma tu correo.' },
  { titulo: 'Envía tu postulación', descripcion: 'Elige un programa en tu panel de aspirante.' },
  { titulo: 'Consulta el dictamen', descripcion: 'Revisa el estado de tu solicitud en el portal.' },
  { titulo: 'Entra al aula', descripcion: 'Accede desde tu panel cuando se confirme tu matrícula en Moodle.' },
];

const canalesAtencion = [
  {
    departamento: 'Admisiones',
    email: 'admisiones@iinicia.org',
    horario: 'Lunes a viernes, 8:00–19:00',
    descripcion: 'Orientación vocacional, convocatorias abiertas y requisitos de ingreso.',
  },
  {
    departamento: 'Soporte de Moodle',
    email: 'soporte@iinicia.org',
    horario: 'Ticket y correo disponibles 24/7',
    descripcion: 'Incidencias con accesos, matriculación o navegación en el aula virtual.',
  },
  {
    departamento: 'Servicios escolares',
    email: 'escolar@iinicia.org',
    horario: 'Lunes a viernes, 9:00–17:00',
    descripcion: 'Constancias oficiales y actas de calificación.',
  },
];
