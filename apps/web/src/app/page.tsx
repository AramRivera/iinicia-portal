'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { contactApi, coursesApi, enrollmentsApi, programsApi } from '@/lib/api';
import type { CourseOffering, AuthorizedCourse, EnrollmentRequest, Program } from '@/types';
import {
  IconGroups,
  IconAudit,
  IconGrades,
  IconCheck,
  IconSearch,
  IconShield,
  IconBookOpen,
  IconRefresh,
  IconAlertTriangle,
} from '@/components/campus-tech/Icons';

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
  const [courseSearch, setCourseSearch] = useState('');
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [enrollMessage, setEnrollMessage] = useState<string | null>(null);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  // Diplomados and Certificaciones state
  const [diplomados, setDiplomados] = useState<Program[]>([]);
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
        const [offeringsData, authorized, enrollments, programs] = await Promise.all([
          user ? coursesApi.getOfferings().catch(() => { setCourseLoadError(true); return []; }) : Promise.resolve([]),
          user ? coursesApi.getAuthorizedCourses().catch(() => []) : Promise.resolve([]),
          user ? enrollmentsApi.getMyEnrollments().catch(() => []) : Promise.resolve([]),
          programsApi.getPrograms().catch(() => []),
        ]);

        setOfferings(offeringsData);

        setMyCourses(authorized || []);
        setMyEnrollments(enrollments);
        setPublicCourses(programs.filter((program) => program.type === 'curso'));

        setDiplomados(programs.filter((program) => program.type === 'diplomado'));
        setCertificaciones(programs.filter((program) => program.type === 'certificacion'));
      } catch {
        setCourseLoadError(true);
        setOfferings([]);
        setPublicCourses([]);
        setDiplomados([]);
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
      {/* =================================================================== */}
      {/* SECTION 1: INICIO / HERO                                           */}
      {/* =================================================================== */}
      <section id="inicio" className="relative overflow-hidden border-b border-border bg-surface pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-aurora opacity-70" />

        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-mono font-medium text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-lime" />
            <span>Instituto de Innovación y Ciencias Aplicadas</span>
          </div>

          <h1 className="mx-auto max-w-4xl text-balance text-3xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Tu educación comienza hoy,{' '}
            <span className="text-primary">estés donde estés.</span>
          </h1>

          <p className="mx-auto max-w-2xl text-balance text-sm sm:text-base lg:text-lg text-muted leading-relaxed">
            Formación universitaria y continua de alta exigencia técnica. Accede a cursos, diplomados y certificaciones oficiales integradas con nuestro Campus Virtual Moodle LMS.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/registro"
              className="rounded-[6px] bg-primary-action px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-minimal hover:bg-primary-action/90 transition-all"
            >
              Comienza ahora
            </Link>
            <a
              href="#universidad"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('universidad')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="rounded-[6px] border border-border bg-surface hover:bg-surface-muted px-5 py-2.5 text-xs sm:text-sm font-medium text-foreground transition-all"
            >
              Conoce la Universidad
            </a>
            <a
              href="#cursos"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('cursos')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="rounded-[6px] border border-primary/30 bg-primary/5 hover:bg-primary/10 px-5 py-2.5 text-xs sm:text-sm font-medium text-primary transition-all"
            >
              Explorar Catálogo
            </a>
          </div>
        </div>

        {/* Institutional Statistics */}
        <div className="mx-auto mt-16 max-w-5xl px-4 sm:px-6">
          <div className="grid grid-cols-2 gap-4 rounded-[10px] border border-border bg-surface/70 p-6 shadow-minimal sm:grid-cols-4">
            <div className="text-center space-y-1 border-r border-border/50 last:border-r-0">
              <p className="text-2xl sm:text-3xl font-bold tracking-tight text-primary font-mono">100%</p>
              <p className="text-xs text-muted">Modalidad en línea</p>
            </div>
            <div className="text-center space-y-1 sm:border-r border-border/50 last:border-r-0">
              <p className="text-2xl sm:text-3xl font-bold tracking-tight text-primary font-mono">+40</p>
              <p className="text-xs text-muted">Programas académicos</p>
            </div>
            <div className="text-center space-y-1 border-r border-border/50 last:border-r-0">
              <p className="text-2xl sm:text-3xl font-bold tracking-tight text-primary font-mono">24/7</p>
              <p className="text-xs text-muted">Acceso a Campus Moodle</p>
            </div>
            <div className="text-center space-y-1">
              <p className="text-2xl sm:text-3xl font-bold tracking-tight text-primary font-mono">+1,000</p>
              <p className="text-xs text-muted">Alumnos y graduados</p>
            </div>
          </div>
        </div>

        {/* Quick jump cards */}
        <div className="mx-auto mt-8 max-w-5xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <a
              href="#cursos"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('cursos')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="group rounded-[10px] border border-border bg-surface p-5 shadow-minimal transition-all hover:border-primary/50 hover:bg-surface-muted/40 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="h-8 w-8 rounded-[6px] bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                  <IconBookOpen className="w-4 h-4 text-primary" />
                </span>
                <span className="text-[11px] font-mono text-muted group-hover:text-primary transition-colors">Ver sección</span>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-foreground group-hover:text-primary transition-colors">Cursos Prácticos</h3>
              <p className="mt-1 text-xs text-muted leading-relaxed">
                Asignaturas modulares y habilidades específicas con validez institucional.
              </p>
            </a>

            <a
              href="#diplomados"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('diplomados')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="group rounded-[10px] border border-border bg-surface p-5 shadow-minimal transition-all hover:border-primary/50 hover:bg-surface-muted/40 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="h-8 w-8 rounded-[6px] bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                  <IconGroups className="w-4 h-4 text-primary" />
                </span>
                <span className="text-[11px] font-mono text-muted group-hover:text-primary transition-colors">Ver sección</span>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-foreground group-hover:text-primary transition-colors">Diplomados de Especialización</h3>
              <p className="mt-1 text-xs text-muted leading-relaxed">
                Formación integral de 120 a 180 horas con proyectos aplicados de posgrado.
              </p>
            </a>

            <a
              href="#certificaciones"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('certificaciones')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="group rounded-[10px] border border-border bg-surface p-5 shadow-minimal transition-all hover:border-primary/50 hover:bg-surface-muted/40 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="h-8 w-8 rounded-[6px] bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                  <IconShield className="w-4 h-4 text-primary" />
                </span>
                <span className="text-[11px] font-mono text-muted group-hover:text-primary transition-colors">Ver sección</span>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-foreground group-hover:text-primary transition-colors">Certificaciones Oficiales</h3>
              <p className="mt-1 text-xs text-muted leading-relaxed">
                Acreditación de competencias técnicas evaluadas por docentes titulares.
              </p>
            </a>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* SECTION 2: UNIVERSIDAD                                              */}
      {/* =================================================================== */}
      <section id="universidad" className="border-b border-border py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-12">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-1.5 rounded-[4px] bg-primary/10 px-2.5 py-1 text-xs font-mono font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-lime" />
              <span>Identidad y Gobernanza Universitaria</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
              Universidad INICIA
            </h2>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              El Instituto de Innovación y Ciencias Aplicadas forma profesionales de vanguardia en ciencias de la computación, desarrollo tecnológico y gestión académica. Nuestro claustro combina excelencia investigadora y experiencia activa en la industria.
            </p>
          </div>

          {/* Misión y Visión */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-[10px] border border-border bg-surface p-6 shadow-minimal space-y-3">
              <div className="h-8 w-8 rounded-[6px] bg-primary/10 text-primary flex items-center justify-center">
                <IconAudit className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-lg font-bold tracking-tight text-foreground">Misión Institucional</h3>
              <p className="text-xs sm:text-sm text-muted leading-relaxed">
                Brindar educación superior y continua de excelencia, democratizando el acceso al conocimiento tecnológico avanzado mediante metodologías pedagógicas innovadoras, infraestructura digital robusta y un claustro docente de primer nivel.
              </p>
            </div>

            <div className="rounded-[10px] border border-border bg-surface p-6 shadow-minimal space-y-3">
              <div className="h-8 w-8 rounded-[6px] bg-accent-lime/20 text-foreground flex items-center justify-center">
                <IconGrades className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-lg font-bold tracking-tight text-foreground">Visión Institucional</h3>
              <p className="text-xs sm:text-sm text-muted leading-relaxed">
                Consolidarnos como la institución universitaria referente en formación tecnológica e innovación en América Latina, reconocida por la empleabilidad sobresaliente de sus egresados, la calidad de sus programas académicos y su liderazgo en educación virtual.
              </p>
            </div>
          </div>

          {/* Modelo Educativo (4 Pilares) */}
          <div className="space-y-6 pt-4">
            <div className="text-center max-w-xl mx-auto space-y-1">
              <h3 className="text-xl font-bold tracking-tight text-foreground">Modelo Educativo INICIA</h3>
              <p className="text-xs text-muted">Cuatro pilares estructurales diseñados para maximizar la efectividad del aprendizaje.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {pilaresModelo.map((pilar, idx) => (
                <div key={idx} className="rounded-[10px] border border-border bg-surface p-5 shadow-minimal space-y-2">
                  <span className="inline-block rounded-[4px] bg-primary/10 px-2 py-0.5 text-xs font-mono font-bold text-primary">
                    0{idx + 1}
                  </span>
                  <h4 className="text-sm font-semibold text-foreground">{pilar.titulo}</h4>
                  <p className="text-xs text-muted leading-relaxed">{pilar.descripcion}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Claustro Académico y Autoridades */}
          <div className="space-y-6 pt-6 border-t border-border">
            <div className="text-center max-w-xl mx-auto space-y-1">
              <h3 className="text-xl font-bold tracking-tight text-foreground">Autoridades y Claustro Académico</h3>
              <p className="text-xs text-muted">Equipo directivo responsable de la gobernanza académica y el rigor curricular.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {autoridades.map((auth, idx) => (
                <div key={idx} className="rounded-[10px] border border-border bg-surface p-5 shadow-minimal space-y-2">
                  <div className="h-8 w-8 rounded-full bg-surface-muted border border-border flex items-center justify-center font-mono text-xs font-bold text-foreground">
                    {auth.nombre.split(' ')[1]?.[0] || 'A'}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground leading-snug">{auth.nombre}</h4>
                    <p className="text-[11px] font-mono text-primary">{auth.cargo}</p>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">{auth.semblanza}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* SECTION 3: CURSOS Y ASIGNATURAS                                     */}
      {/* =================================================================== */}
      <section id="cursos" className="border-b border-border py-20 px-4 sm:px-6 lg:px-8 bg-surface-muted/20">
        <div className="mx-auto max-w-6xl space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-[4px] bg-primary/10 px-2.5 py-1 text-xs font-mono font-semibold text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-lime" />
                <span>Oferta académica</span>
              </div>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Cursos y Asignaturas
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-muted max-w-xl">
                Conoce los programas publicados y solicita acceso al iniciar sesión.
              </p>
            </div>

            {/* Course search */}
            <div className="relative w-full max-w-xs">
              <input
                type="text"
                placeholder="Buscar por código o materia..."
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                className="w-full rounded-[6px] border border-border bg-surface px-3 py-1.5 pl-8 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
              />
              <IconSearch className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted pointer-events-none" />
            </div>
          </div>

          {/* Feedback banners */}
          {enrollMessage && (
            <div className="rounded-[8px] border border-success/30 bg-success/10 p-3 text-xs text-foreground flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <IconCheck className="w-4 h-4 text-success shrink-0" />
                <span>{enrollMessage}</span>
              </div>
              <Link
                href="/dashboard"
                className="rounded-[4px] bg-success text-white px-2.5 py-1 text-xs font-semibold shrink-0"
              >
                Ver mi panel
              </Link>
            </div>
          )}

          {enrollError && (
            <div className="rounded-[8px] border border-danger/30 bg-danger/10 p-3 text-xs text-danger flex items-center gap-2">
              <IconAlertTriangle className="w-4 h-4 text-danger shrink-0" />
              <span>{enrollError}</span>
            </div>
          )}

          {/* Courses list */}
          {coursesLoading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <div className="flex items-center gap-2 text-xs text-muted">
                <IconRefresh className="w-4 h-4 animate-spin text-primary" />
                <span>Cargando catálogo curricular...</span>
              </div>
            </div>
          ) : !user && filteredPublicCourses.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPublicCourses.map((course) => (
                <div key={course.id} className="flex flex-col justify-between rounded-[10px] border border-border bg-surface p-5 shadow-minimal space-y-4 hover:border-primary/40 transition-all">
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded-[4px] bg-surface-muted px-2 py-0.5 text-[11px] font-mono font-medium text-foreground">{course.code}</span>
                      {course.duration_text && <span className="text-[11px] text-muted">{course.duration_text}</span>}
                    </div>
                    <h3 className="text-base font-semibold text-foreground leading-snug">{course.name}</h3>
                    {(course.short_description || course.description) && <p className="text-xs text-muted leading-relaxed">{course.short_description || course.description}</p>}
                  </div>
                  <div className="border-t border-border pt-3">
                    <Link href="/login" className="inline-block rounded-[6px] bg-primary-action px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-action/90">Iniciar sesión para solicitar acceso</Link>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="rounded-[10px] border border-border bg-surface p-12 text-center space-y-2">
              <p className="text-sm font-semibold text-foreground">{!user ? publicCourses.length === 0 ? 'Aún no hay cursos publicados' : 'No se encontraron cursos coincidentes' : courseLoadError ? 'No fue posible cargar los cursos' : offerings.length === 0 ? 'Aún no hay cursos publicados' : 'No se encontraron cursos coincidentes'}</p>
              <p className="text-xs text-muted">{!user ? publicCourses.length === 0 ? 'Consulta el catálogo más tarde.' : 'Intenta con otro término de búsqueda.' : courseLoadError ? 'Revisa la conexión con la API e inténtalo de nuevo.' : offerings.length === 0 ? 'Consulta el catálogo más tarde.' : 'Intenta con otro término de búsqueda.'}</p>
              {!user && <Link href="/login" className="inline-block rounded-md bg-primary-action px-4 py-2 text-xs font-semibold text-white">Iniciar sesión</Link>}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCourses.map((course) => {
                const enrolled = isEnrolled(course.course_mapping_id);
                const pending = myEnrollments.some((request) =>
                  request.course_mapping_id === course.course_mapping_id && request.status === 'pendiente');
                return (
                  <div
                    key={course.id}
                    className="flex flex-col justify-between rounded-[10px] border border-border bg-surface p-5 shadow-minimal space-y-4 hover:border-primary/40 transition-all"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-[4px] bg-surface-muted px-2 py-0.5 text-[11px] font-mono font-medium text-foreground">
                          {course.code}
                        </span>
                        {course.credits != null && (
                          <span className="text-[11px] font-mono text-muted">
                            {course.credits} créditos
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-semibold text-foreground leading-snug">{course.name}</h3>
                      <p className="text-xs text-muted leading-relaxed line-clamp-3">
                        {course.course_description || 'Curso disponible en el catálogo de INICIA.'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                      <div className="text-[11px] font-mono text-muted">
                        Moodle LMS
                      </div>

                      {enrolled ? (
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-[4px] bg-success/10 px-2 py-1 text-[11px] font-medium text-success border border-success/20">
                            Matriculado
                          </span>
                          <Link
                            href="/dashboard/estudiante"
                            className="rounded-[4px] bg-primary-action text-white px-2 py-1 text-[11px] font-medium hover:bg-primary-action/90"
                          >
                            Entrar
                          </Link>
                        </div>
                      ) : pending ? (
                        <span className="rounded-[4px] bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary border border-primary/20">
                          Solicitud pendiente
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleEnroll(course.course_mapping_id || course.id, course.name)}
                          disabled={enrollingId === (course.course_mapping_id || course.id)}
                          className="rounded-[6px] bg-primary-action px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-action/90 transition-all disabled:opacity-50"
                        >
                          {enrollingId === (course.course_mapping_id || course.id) ? 'Solicitando...' : user ? 'Solicitar inscripción' : 'Iniciar sesión para solicitar'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* =================================================================== */}
      {/* SECTION 4: DIPLOMADOS                                               */}
      {/* =================================================================== */}
      <section id="diplomados" className="border-b border-border py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-[4px] bg-primary/10 px-2.5 py-1 text-xs font-mono font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-lime" />
              <span>Formación de Posgrado y Continua</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
              Diplomados de Especialización
            </h2>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              Consulta la oferta de formación continua publicada por INICIA.
            </p>
          </div>

          {diplomados.length === 0 && !coursesLoading && (
            <p className="rounded-[10px] border border-border bg-surface p-6 text-center text-sm text-muted">Aún no hay diplomados publicados.</p>
          )}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {diplomados.map((dip) => (
              <div
                key={dip.id}
                className="flex flex-col justify-between rounded-[10px] border border-border bg-surface p-6 shadow-minimal space-y-5 hover:border-primary/40 transition-all"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-[4px] bg-primary/10 px-2.5 py-0.5 text-xs font-mono font-bold text-primary">
                      {dip.code}
                    </span>
                    <span className="rounded-[4px] border border-border bg-surface-muted px-2 py-0.5 text-[11px] font-mono text-muted">
                      {dip.duration_text || `${dip.duration_hours} hrs`}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-foreground leading-snug">{dip.name}</h3>
                  <p className="text-xs sm:text-sm text-muted leading-relaxed">{dip.description}</p>

                  <div className="space-y-1.5 pt-2">
                    <p className="text-[11px] font-mono uppercase tracking-wider text-muted">Competencias clave:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {getDipBadges(dip.code).map((tag, i) => (
                        <span key={i} className="rounded-[4px] bg-surface-muted px-2 py-0.5 text-[11px] text-foreground/80 border border-border/60">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent-lime" />
                    <span>Campus Virtual Moodle</span>
                  </div>
                  <Link
                    href="/registro"
                    className="rounded-[6px] bg-primary-action px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-action/90 transition-all"
                  >
                    Postularme
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* SECTION 5: CERTIFICACIONES                                          */}
      {/* =================================================================== */}
      <section id="certificaciones" className="border-b border-border py-20 px-4 sm:px-6 lg:px-8 bg-surface-muted/20">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-[4px] bg-primary/10 px-2.5 py-1 text-xs font-mono font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-lime" />
              <span>Acreditación Profesional de Competencias</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
              Certificaciones Técnicas Oficiales
            </h2>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              Exámenes y proyectos evaluados por pares y docentes titulares con emisión de credencial digital verificable.
            </p>
          </div>

          {certificaciones.length === 0 && !coursesLoading && (
            <p className="rounded-[10px] border border-border bg-surface p-6 text-center text-sm text-muted">Aún no hay certificaciones publicadas.</p>
          )}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {certificaciones.map((cert) => (
              <div
                key={cert.id}
                className="flex flex-col justify-between rounded-[10px] border border-border bg-surface p-5 shadow-minimal space-y-4 hover:border-primary/40 transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="rounded-[4px] bg-accent-lime/20 px-2 py-0.5 text-[11px] font-mono font-bold text-foreground">
                      {cert.code}
                    </span>
                    <span className="text-[11px] font-mono text-muted">{cert.duration_text || `${cert.duration_hours} hrs`}</span>
                  </div>
                  <h3 className="text-sm font-bold text-foreground leading-snug">{cert.name}</h3>
                  <p className="text-xs text-muted leading-relaxed line-clamp-3">{cert.description}</p>
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-[11px] font-mono text-muted">Evaluación continua</span>
                  <Link
                    href="/registro"
                    className="rounded-[6px] border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-all"
                  >
                    Inscribirme
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* SECTION 6: ADMISIONES                                               */}
      {/* =================================================================== */}
      <section id="admisiones" className="border-b border-border py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-[4px] bg-primary/10 px-2.5 py-1 text-xs font-mono font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-lime" />
              <span>Convocatoria Abierta Ciclo 2026</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
              Proceso de Admisión y Registro
            </h2>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              Un flujo de ingreso 100% digital, transparente y validado por la Dirección de Servicios Escolares.
            </p>
          </div>

          {/* Sequential 4-Step Process */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pasosAdmision.map((paso) => (
              <div
                key={paso.numero}
                className="relative rounded-[10px] border border-border bg-surface p-5 shadow-minimal space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-[4px] bg-primary-action px-2 py-0.5 text-xs font-mono font-bold text-white">
                    {paso.numero}
                  </span>
                  <span className="text-[11px] font-mono text-muted">{paso.tiempo}</span>
                </div>
                <h3 className="text-sm font-semibold text-foreground">{paso.titulo}</h3>
                <p className="text-xs text-muted leading-relaxed">{paso.descripcion}</p>
              </div>
            ))}
          </div>

          {/* Expediente digital checklist */}
          <div className="rounded-[10px] border border-border bg-surface p-6 sm:p-8 shadow-minimal space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
              <div>
                <h3 className="text-base font-bold text-foreground">Requisitos de Expediente Digital</h3>
                <p className="text-xs text-muted mt-0.5">Los documentos se suben en formato PDF desde tu panel de aspirante.</p>
              </div>
              <Link
                href="/registro"
                className="rounded-[6px] bg-primary-action px-4 py-2 text-xs font-semibold text-white hover:bg-primary-action/90 transition-all shrink-0 text-center"
              >
                Crear cuenta de aspirante
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {requisitosExpediente.map((req, i) => (
                <div key={i} className="rounded-[8px] border border-border/80 bg-surface-muted/40 p-4 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <IconCheck className="w-3.5 h-3.5 text-success shrink-0" />
                    <span>{req.nombre}</span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">{req.detalle}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* SECTION 7: CONTACTO Y CANALES                                       */}
      {/* =================================================================== */}
      <section id="contacto" className="py-20 px-4 sm:px-6 lg:px-8 bg-surface-muted/20">
        <div className="mx-auto max-w-6xl space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-[4px] bg-primary/10 px-2.5 py-1 text-xs font-mono font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-lime" />
              <span>Atención y Mesa de Ayuda</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
              Canales de Contacto Oficial
            </h2>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              Comunícate con nuestro equipo académico o técnico. Resolvemos solicitudes de admisión, soporte de aula Moodle y trámites escolares.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Contact directory */}
            <div className="space-y-4 lg:col-span-5">
              {canalesAtencion.map((canal, idx) => (
                <div
                  key={idx}
                  className="rounded-[10px] border border-border bg-surface p-4 shadow-minimal space-y-1.5"
                >
                  <h3 className="text-sm font-semibold text-foreground">{canal.departamento}</h3>
                  <p className="text-xs font-mono text-primary font-medium">{canal.email}</p>
                  <p className="text-[11px] font-mono text-muted">{canal.horario}</p>
                  <p className="text-xs text-muted pt-1 leading-relaxed">{canal.descripcion}</p>
                </div>
              ))}
            </div>

            {/* Interactive Message Form */}
            <div className="lg:col-span-7">
              <div className="rounded-[10px] border border-border bg-surface p-6 sm:p-8 shadow-minimal space-y-4">
                <div className="border-b border-border pb-3">
                  <h3 className="text-base font-bold text-foreground">Enviar Consulta a la Mesa de Ayuda</h3>
                  <p className="text-xs text-muted">Recibirás respuesta en tu correo institucional o personal.</p>
                </div>

                {contactSuccess ? (
                  <div className="rounded-[8px] border border-success/30 bg-success/10 p-6 text-center space-y-3">
                    <div className="mx-auto h-10 w-10 rounded-full bg-success/20 flex items-center justify-center text-success">
                      <IconCheck className="w-5 h-5 text-success" />
                    </div>
                    <h4 className="text-sm font-bold text-foreground">¡Mensaje recibido con éxito!</h4>
                    <p className="text-xs text-muted max-w-sm mx-auto">
                      Hemos canalizado tu solicitud al departamento correspondiente. Te responderemos en un plazo máximo de 24 horas hábiles.
                    </p>
                    <button
                      type="button"
                      onClick={() => setContactSuccess(false)}
                      className="rounded-[6px] border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
                    >
                      Enviar otro mensaje
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="space-y-4">
                    {contactError && (
                      <div className="rounded-[6px] border border-danger/30 bg-danger/10 p-2.5 text-xs text-danger">
                        {contactError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground">Nombre completo *</label>
                        <input
                          type="text"
                          required
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          placeholder="Ej. Sofía Hernández"
                          className="w-full rounded-[6px] border border-border bg-surface-muted/30 px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground">Correo electrónico *</label>
                        <input
                          type="email"
                          required
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder="correo@ejemplo.com"
                          className="w-full rounded-[6px] border border-border bg-surface-muted/30 px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground">Teléfono (opcional)</label>
                        <input
                          type="tel"
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          placeholder="+52 55 0000 0000"
                          className="w-full rounded-[6px] border border-border bg-surface-muted/30 px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground">Departamento destinatario *</label>
                        <select
                          value={contactArea}
                          onChange={(e) => setContactArea(e.target.value)}
                          className="w-full rounded-[6px] border border-border bg-surface-muted/30 px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                        >
                          <option value="admisiones">Admisiones y Convocatorias</option>
                          <option value="soporte">Soporte Campus Virtual Moodle</option>
                          <option value="escolar">Servicios Escolares y Certificados</option>
                          <option value="vinculacion">Rectoría y Vinculación</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">Mensaje o consulta *</label>
                      <textarea
                        required
                        rows={4}
                        value={contactMessage}
                        onChange={(e) => setContactMessage(e.target.value)}
                        placeholder="Detalla tu consulta o el asunto sobre el que requieres orientación..."
                        className="w-full rounded-[6px] border border-border bg-surface-muted/30 px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={contactSubmitting}
                      className="w-full rounded-[6px] bg-primary-action py-2.5 text-xs font-semibold text-white hover:bg-primary-action/90 transition-all disabled:opacity-50"
                    >
                      {contactSubmitting ? 'Enviando...' : 'Enviar mensaje'}
                    </button>
                  </form>
                )}
              </div>
            </div>
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
    titulo: 'Aprendizaje Práctico Aplicado',
    descripcion: 'Cada materia integra proyectos reales, laboratorios virtuales y retos del sector productivo para garantizar empleabilidad inmediata.',
  },
  {
    titulo: 'Campus Virtual Integrado',
    descripcion: 'Plataforma Moodle LMS de última generación con acceso transparente, evaluaciones formativas y recursos interactivos 24/7.',
  },
  {
    titulo: 'Acompañamiento Docente Titular',
    descripcion: 'Profesores con experiencia activa en la industria que guían de forma personalizada cada etapa de tu formación académica.',
  },
  {
    titulo: 'Flexibilidad Curricular Modular',
    descripcion: 'Estructura por créditos SATCA y módulos que te permiten avanzar a tu propio ritmo compatibilizando vida laboral y estudio.',
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
  {
    numero: '01',
    titulo: 'Creación de cuenta en el portal',
    descripcion: 'Completa tu registro con correo y contraseña para habilitar tu perfil de aspirante en el sistema.',
    tiempo: '3 minutos',
  },
  {
    numero: '02',
    titulo: 'Carga de expediente digital',
    descripcion: 'Adjunta en formato PDF tu identificación oficial, comprobante de domicilio y certificado de estudios.',
    tiempo: '1 a 2 días',
  },
  {
    numero: '03',
    titulo: 'Validación por Servicios Escolares',
    descripcion: 'El comité revisa tus documentos y emite tu matrícula oficial de estudiante.',
    tiempo: '24 a 48 hrs',
  },
  {
    numero: '04',
    titulo: 'Matriculación en Campus Moodle',
    descripcion: 'Acceso inmediato a tus asignaturas, contacto con docentes y seguimiento académico 24/7.',
    tiempo: 'Inmediato',
  },
];

const requisitosExpediente = [
  {
    nombre: 'Identificación Oficial',
    detalle: 'INE, Pasaporte o Cédula Profesional en formato PDF legible.',
  },
  {
    nombre: 'Certificado de Estudios',
    detalle: 'Bachillerato concluido para licenciaturas o título previo para diplomados.',
  },
  {
    nombre: 'CURP Certificada',
    detalle: 'Formato digital descargado del portal oficial de RENAPO.',
  },
  {
    nombre: 'Comprobante de Domicilio',
    detalle: 'Recibo reciente no mayor a tres meses de antigüedad.',
  },
];

const canalesAtencion = [
  {
    departamento: 'Admisiones y Nuevos Aspirantes',
    email: 'admisiones@iinicia.org',
    horario: 'Lunes a Viernes: 8:00 a 19:00 hrs',
    descripcion: 'Orientación vocacional, convocatorias abiertas y requisitos de ingreso.',
  },
  {
    departamento: 'Soporte Técnico Campus Moodle',
    email: 'soporte@iinicia.org',
    horario: 'Atención 24/7 vía ticket y correo',
    descripcion: 'Incidencias con accesos, matriculación o navegación en el aula virtual.',
  },
  {
    departamento: 'Servicios Escolares y Acreditación',
    email: 'escolar@iinicia.org',
    horario: 'Lunes a Viernes: 9:00 a 17:00 hrs',
    descripcion: 'Constancias oficiales, validación de expedientes y actas de calificación.',
  },
];

function getDipBadges(code: string): string[] {
  switch (code) {
    case 'DIP-FULLSTACK':
      return ['Next.js 15', 'NestJS', 'PostgreSQL', 'Docker', 'TypeScript'];
    case 'DIP-DATA-AI':
      return ['Python', 'Machine Learning', 'Pandas', 'Computer Vision', 'PyTorch'];
    case 'DIP-CYBERSEC':
      return ['Ethical Hacking', 'ISO 27001', 'Auditoría', 'OWASP Top 10'];
    case 'DIP-EDTECH':
      return ['Moodle 5.x', 'Web Services REST', 'SSO Userkey', 'Instrucción Digital'];
    default:
      return ['Ciencias Aplicadas', 'Innovación Digital'];
  }
}
