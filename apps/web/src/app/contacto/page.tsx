'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  IconCheck,
  IconClock,
  IconAudit,
  IconShield,
  IconAlertTriangle,
} from '@/components/campus-tech/Icons';

export default function ContactoPage() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [area, setArea] = useState('admisiones');
  const [mensaje, setMensaje] = useState('');

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nombre.trim() || !email.trim() || !mensaje.trim()) {
      setError('Por favor completa todos los campos requeridos marcados con asterisco (*).');
      return;
    }

    setLoading(true);
    // Simular envío de solicitud a soporte institucional
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 600);
  };

  const handleReset = () => {
    setNombre('');
    setEmail('');
    setTelefono('');
    setArea('admisiones');
    setMensaje('');
    setSubmitted(false);
    setError(null);
  };

  const canalesAtencion = [
    {
      departamento: 'Admisiones y Nuevos Aspirantes',
      email: 'admisiones@iinicia.org',
      horario: 'Lunes a Viernes: 8:00 a 19:00 hrs',
      descripcion: 'Información sobre carreras, diplomados, requisitos de ingreso y convocatorias abiertas.',
    },
    {
      departamento: 'Soporte Técnico de Campus Virtual',
      email: 'soporte@iinicia.org',
      horario: 'Atención 24/7 vía ticket y correo',
      descripcion: 'Incidencias con accesos a la plataforma Moodle LMS, matriculación o problemas técnicos.',
    },
    {
      departamento: 'Servicios Escolares y Certificaciones',
      email: 'escolar@iinicia.org',
      horario: 'Lunes a Viernes: 9:00 a 17:00 hrs',
      descripcion: 'Constancias de estudio, emisión de credenciales digitales, actas y certificados oficiales.',
    },
    {
      departamento: 'Rectoría y Vinculación Institucional',
      email: 'rectoria@iinicia.org',
      horario: 'Lunes a Viernes: 9:00 a 18:00 hrs',
      descripcion: 'Convenios empresariales, alianzas universitarias y proyectos de investigación aplicada.',
    },
  ];

  return (
    <div className="flex-1 bg-background text-foreground">
      {/* Hero Section */}
      <section className="relative border-b border-border bg-surface px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 rounded-[4px] bg-primary/10 px-3 py-1 text-xs font-mono font-semibold text-primary border border-primary/20">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-lime" />
            <span>Atención a la Comunidad y Aspirantes</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Canales de contacto y atención institucional
          </h1>

          <p className="mx-auto max-w-2xl text-sm sm:text-base text-muted leading-relaxed">
            Estamos a tu disposición para orientarte en tus dudas académicas, administrativas o técnicas relacionadas con el portal y el campus virtual.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8 space-y-12">
        {/* Canales Directos */}
        <div className="grid gap-4 sm:grid-cols-2">
          {canalesAtencion.map((canal, idx) => (
            <div
              key={idx}
              className="rounded-[10px] border border-border bg-surface p-5 hover:border-primary/40 transition-all shadow-minimal flex flex-col justify-between"
            >
              <div>
                <span className="text-[11px] font-mono text-primary font-semibold uppercase tracking-wider">
                  {canal.departamento}
                </span>
                <p className="mt-2 text-sm font-semibold text-foreground font-mono">
                  <a
                    href={`mailto:${canal.email}`}
                    className="hover:text-primary transition-colors hover:underline"
                  >
                    {canal.email}
                  </a>
                </p>
                <p className="mt-2 text-xs text-muted leading-relaxed">
                  {canal.descripcion}
                </p>
              </div>

              <div className="mt-4 border-t border-border pt-3 flex items-center gap-1.5 text-[11px] font-mono text-muted">
                <IconClock className="w-3.5 h-3.5 text-primary" />
                <span>{canal.horario}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Formulario y Horarios */}
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          {/* Formulario de Mensaje */}
          <div className="rounded-[14px] border border-border bg-surface p-6 sm:p-8 shadow-minimal">
            <div className="border-l-2 border-primary pl-4 mb-6">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Envíanos un mensaje
              </h2>
              <p className="text-xs text-muted mt-1">
                Recibirás una respuesta personalizada de nuestro equipo en un plazo no mayor a 24 horas hábiles.
              </p>
            </div>

            {submitted ? (
              <div className="rounded-[10px] border border-success/30 bg-success/10 p-6 text-center space-y-3">
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-success/20 text-success">
                  <IconCheck className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-foreground">
                  Mensaje recibido correctamente
                </h3>
                <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
                  Hemos canalizado tu solicitud al área correspondiente. Recibirás respuesta en la dirección de correo electrónico que registraste: <strong className="text-foreground">{email}</strong>.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="rounded-[6px] border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-all"
                  >
                    Enviar otro mensaje
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="rounded-[6px] border border-danger/30 bg-danger/10 p-3 text-xs font-medium text-danger flex items-center gap-2">
                    <IconAlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Nombre Completo *
                    </label>
                    <input
                      type="text"
                      required
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Ej. Sofía Hernández Vega"
                      className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Correo Electrónico *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu.correo@ejemplo.com"
                      className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Teléfono de contacto
                    </label>
                    <input
                      type="tel"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="+52 55 0000 0000"
                      className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Área de Interés *
                    </label>
                    <select
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3 py-2 text-xs text-foreground focus:border-primary focus:bg-surface focus:outline-none transition-all"
                    >
                      <option value="admisiones">Admisiones y Convocatoria 2026</option>
                      <option value="moodle">Soporte Campus Virtual Moodle</option>
                      <option value="escolar">Servicios Escolares y Constancias</option>
                      <option value="diplomados">Diplomados y Certificaciones</option>
                      <option value="otro">Otras consultas generales</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Mensaje o Consulta Detallada *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={mensaje}
                    onChange={(e) => setMensaje(e.target.value)}
                    placeholder="Describe tu consulta, duda o trámite con la mayor precisión posible..."
                    className="w-full rounded-[6px] border border-border bg-surface-muted/40 p-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-[6px] bg-primary px-5 py-2.5 text-xs font-semibold text-white shadow-minimal hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  {loading ? 'Enviando mensaje...' : 'Enviar consulta institucional'}
                </button>
              </form>
            )}
          </div>

          {/* Sede e Información de Modalidad */}
          <div className="space-y-4">
            <div className="rounded-[14px] border border-border bg-surface p-6 shadow-minimal space-y-4">
              <span className="text-[11px] font-mono text-primary font-semibold uppercase tracking-wider">
                Modalidad Institucional
              </span>
              <h3 className="text-base font-bold text-foreground">
                Campus 100% en Línea
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                El Instituto de Innovación y Ciencias Aplicadas opera con cobertura nacional e internacional. Toda la gestión docente, académica y de evaluación se realiza a través del entorno virtual de aprendizaje Moodle LMS.
              </p>
              <div className="border-t border-border pt-4 space-y-2 text-xs text-muted">
                <div>
                  <strong className="text-foreground">Sede de Operaciones:</strong> Ciudad de México, México.
                </div>
                <div>
                  <strong className="text-foreground">Zona Horaria:</strong> Tiempo del Centro de México (UTC-6).
                </div>
                <div>
                  <strong className="text-foreground">Disponibilidad de Aulas:</strong> 24 horas al día, los 365 días del año.
                </div>
              </div>
            </div>

            <div className="rounded-[14px] border border-border bg-surface-muted/40 p-6 shadow-minimal space-y-3">
              <h4 className="text-xs font-mono uppercase tracking-wider text-muted font-semibold">
                ¿Ya eres estudiante o profesor?
              </h4>
              <p className="text-xs text-muted leading-relaxed">
                Si cuentas con usuario activo, puedes acceder directamente a tus materias o reportar incidencias desde tu panel de control.
              </p>
              <div className="pt-1">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  <span>Iniciar sesión en el campus</span>
                  <span>→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
