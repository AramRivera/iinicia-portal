'use client';

import React from 'react';
import Link from 'next/link';
import {
  IconCheck,
  IconClock,
  IconFileText,
  IconStudents,
  IconExternalLink,
  IconArrowRight,
  IconShield,
} from '@/components/campus-tech/Icons';
import { useAuth } from '@/contexts/AuthContext';

export default function AdmisionesPage() {
  const { user, getDefaultDashboardPath } = useAuth();

  const pasosAdmision = [
    {
      numero: '01',
      titulo: 'Creación de cuenta en la plataforma',
      descripcion:
        'Completa el registro con tu nombre, correo institucional o personal y contraseña para activar tu perfil de aspirante en el portal universitario.',
      tiempo: 'Inmediato (3 minutos)',
    },
    {
      numero: '02',
      titulo: 'Carga de expediente digital',
      descripcion:
        'Adjunta en formato PDF legible tu identificación oficial, comprobante de domicilio y certificado del último grado de estudios concluido.',
      tiempo: '1 a 2 días hábiles',
    },
    {
      numero: '03',
      titulo: 'Validación por Servicios Escolares',
      descripcion:
        'El comité de admisiones revisa tus documentos, aprueba tu expediente y emite tu matrícula institucional oficial de estudiante.',
      tiempo: '24 a 48 horas',
    },
    {
      numero: '04',
      titulo: 'Matriculación y acceso al Campus Virtual',
      descripcion:
        'Se habilitan tus cursos en la plataforma Moodle LMS, donde podrás ingresar a tus asignaturas, interactuar con docentes y consultar tu avance académico.',
      tiempo: 'Acceso 24/7',
    },
  ];

  const requisitosExpediente = [
    {
      nombre: 'Identificación Oficial Vigente',
      detalle: 'INE/IFE, Pasaporte vigente o Cédula Profesional (ambos lados en un solo archivo PDF).',
      obligatorio: true,
    },
    {
      nombre: 'Certificado de Estudios Previos',
      detalle: 'Certificado total de bachillerato (licenciaturas) o título y cédula (posgrados y diplomados).',
      obligatorio: true,
    },
    {
      nombre: 'Clave Única de Registro de Población (CURP)',
      detalle: 'Formato descargado directamente del portal oficial de RENAPO con fecha de emisión reciente.',
      obligatorio: true,
    },
    {
      nombre: 'Comprobante de Domicilio',
      detalle: 'Recibo de agua, luz o telefonía fija no mayor a 3 meses de antigüedad.',
      obligatorio: true,
    },
    {
      nombre: 'Fotografía Infantil Digital',
      detalle: 'Formato digital blanco y negro o color con fondo blanco, vestimenta formal.',
      obligatorio: false,
    },
  ];

  const calendarioFechas = [
    { periodo: 'Convocatoria Abierta', fecha: 'Todo el año', detalle: 'Ingreso continuo modular bimestral' },
    { periodo: 'Cierre de Periodo Actual', fecha: '15 de Mayo de 2026', detalle: 'Último día de recepción de documentos para el ciclo actual' },
    { periodo: 'Curso de Inducción al Campus Moodle', fecha: 'Viernes previo al inicio', detalle: 'Sesión sincrónica en línea para aspirantes admitidos' },
    { periodo: 'Inicio de Clases Ciclo 2026-B', fecha: '01 de Junio de 2026', detalle: 'Habilitación oficial de materias en el aula virtual' },
  ];

  return (
    <div className="flex-1 bg-background text-foreground">
      {/* Hero Section */}
      <section className="relative border-b border-border bg-surface px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 rounded-[4px] bg-primary/10 px-3 py-1 text-xs font-mono font-semibold text-primary border border-primary/20">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-lime" />
            <span>Proceso de Admisiones • Ciclo 2026</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Forma parte de la comunidad universitaria IINICIA
          </h1>

          <p className="mx-auto max-w-2xl text-sm sm:text-base text-muted leading-relaxed">
            Nuestro proceso de admisión es 100% digital, transparente y diseñado para que comiences tu formación académica superior sin trámites burocráticos presenciales.
          </p>

          <div className="pt-3 flex flex-wrap justify-center gap-3">
            {user ? (
              <Link
                href={getDefaultDashboardPath()}
                className="inline-flex items-center gap-2 rounded-[6px] bg-primary px-5 py-2.5 text-xs font-semibold text-white shadow-minimal hover:bg-primary/90 transition-all"
              >
                <span>Ir a mi panel ({user.roles?.[0] || 'usuario'})</span>
                <IconArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <Link
                href="/registro"
                className="inline-flex items-center gap-2 rounded-[6px] bg-primary px-5 py-2.5 text-xs font-semibold text-white shadow-minimal hover:bg-primary/90 transition-all"
              >
                <span>Registrarme como aspirante</span>
                <IconArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}

            <Link
              href="/contacto"
              className="inline-flex items-center gap-2 rounded-[6px] border border-border bg-surface-muted/60 px-4 py-2.5 text-xs font-medium text-foreground hover:bg-surface-muted transition-all"
            >
              <span>Solicitar asesoría personalizada</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 4 Pasos del Proceso */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8 space-y-8">
        <div className="border-l-2 border-primary pl-4">
          <p className="text-xs font-mono uppercase tracking-wider text-primary font-semibold">
            Ruta de Ingreso
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            El proceso en 4 pasos sencillos
          </h2>
          <p className="text-xs text-muted mt-1">
            Desde tu registro inicial hasta tu primera sesión en el campus virtual.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pasosAdmision.map((paso) => (
            <div
              key={paso.numero}
              className="relative flex flex-col justify-between rounded-[10px] border border-border bg-surface p-5 hover:border-primary/40 transition-all shadow-minimal"
            >
              <div>
                <span className="font-mono text-2xl font-black text-primary/70">
                  {paso.numero}
                </span>
                <h3 className="mt-2 text-sm font-semibold text-foreground">
                  {paso.titulo}
                </h3>
                <p className="mt-2 text-xs text-muted leading-relaxed">
                  {paso.descripcion}
                </p>
              </div>

              <div className="mt-5 border-t border-border pt-3 flex items-center gap-1.5 text-[11px] font-mono text-muted">
                <IconClock className="w-3.5 h-3.5 text-primary" />
                <span>{paso.tiempo}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Expediente y Documentación Requerida */}
      <section className="border-t border-border bg-surface-muted/30 px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="border-l-2 border-primary pl-4">
            <p className="text-xs font-mono uppercase tracking-wider text-primary font-semibold">
              Requisitos de Admisión
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Documentación digital requerida
            </h2>
            <p className="text-xs text-muted mt-1">
              Todos los documentos deben escanearse directamente del original en formato PDF (máximo 5MB por archivo).
            </p>
          </div>

          <div className="rounded-[10px] border border-border bg-surface overflow-hidden shadow-minimal">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-surface-muted/60 text-[11px] font-mono uppercase text-muted">
                  <tr>
                    <th className="px-5 py-3">Documento</th>
                    <th className="px-5 py-3">Especificaciones</th>
                    <th className="px-5 py-3 text-right">Carácter</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {requisitosExpediente.map((doc, idx) => (
                    <tr key={idx} className="hover:bg-foreground/[0.015] transition-colors">
                      <td className="px-5 py-4 font-semibold text-foreground flex items-center gap-2">
                        <IconFileText className="w-4 h-4 text-primary shrink-0" />
                        <span>{doc.nombre}</span>
                      </td>
                      <td className="px-5 py-4 text-muted leading-relaxed">
                        {doc.detalle}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {doc.obligatorio ? (
                          <span className="inline-flex items-center gap-1 rounded-[4px] bg-danger/10 px-2 py-0.5 text-[10px] font-mono font-semibold text-danger border border-danger/20">
                            Obligatorio
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-[4px] bg-surface-muted px-2 py-0.5 text-[10px] font-mono text-muted border border-border">
                            Opcional
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Calendario Escolar y Fechas Clave */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8 space-y-6">
        <div className="border-l-2 border-primary pl-4">
          <p className="text-xs font-mono uppercase tracking-wider text-primary font-semibold">
            Cronograma
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Fechas clave y convocatorias
          </h2>
          <p className="text-xs text-muted mt-1">
            Consulta los periodos de registro y el inicio de los módulos curriculares.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {calendarioFechas.map((item, idx) => (
            <div
              key={idx}
              className="rounded-[10px] border border-border bg-surface p-4 flex flex-col justify-between shadow-minimal hover:border-primary/40 transition-all"
            >
              <div>
                <span className="text-[11px] font-mono text-primary font-semibold">
                  {item.periodo}
                </span>
                <p className="mt-1 text-base font-bold text-foreground">
                  {item.fecha}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {item.detalle}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Final */}
      <section className="border-t border-border bg-surface px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center space-y-4">
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary border border-primary/20">
            <IconStudents className="w-5 h-5" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            ¿Listo para iniciar tu formación universitaria?
          </h2>
          <p className="mx-auto max-w-xl text-xs sm:text-sm text-muted">
            Crea tu perfil de aspirante hoy mismo y nuestro equipo de admisiones te contactará para guiarte en el proceso de inscripción.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <Link
              href="/registro"
              className="rounded-[6px] bg-primary px-5 py-2.5 text-xs font-semibold text-white shadow-minimal hover:bg-primary/90 transition-all"
            >
              Comenzar registro ahora
            </Link>
            <Link
              href="/contacto"
              className="rounded-[6px] border border-border bg-surface-muted/60 px-4 py-2.5 text-xs font-medium text-foreground hover:bg-surface-muted transition-all"
            >
              Contactar con admisiones
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
