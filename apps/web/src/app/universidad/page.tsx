'use client';

import React from 'react';
import Link from 'next/link';
import {
  IconGroups,
  IconStudents,
  IconTeachers,
  IconGrades,
  IconAudit,
  IconExternalLink,
} from '@/components/campus-tech/Icons';

export default function UniversidadPage() {
  const autoridades = [
    {
      nombre: 'Dra. Elena Santillán Mora',
      cargo: 'Rectora Institucional',
      semblanza: 'Doctora en Innovación Educativa y Liderazgo Institucional con más de 20 años en transformación universitaria.',
    },
    {
      nombre: 'Mtro. Roberto Vaca Elizondo',
      cargo: 'Director Académico y de Posgrados',
      semblanza: 'Especialista en diseño curricular por competencias, acreditaciones nacionales y gestión de tecnología educativa.',
    },
    {
      nombre: 'Dra. Claudia Rivas Téllez',
      cargo: 'Coordinadora de Tecnologías y Campus Virtual',
      semblanza: 'Investigadora en analítica del aprendizaje, entornos virtuales Moodle LMS y arquitecturas de educación a distancia.',
    },
    {
      nombre: 'Mtro. Héctor Domínguez Garza',
      cargo: 'Secretario General y de Servicios Escolares',
      semblanza: 'Responsable de normatividad universitaria, admisiones, control escolar y convenios interinstitucionales.',
    },
  ];

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

  return (
    <div className="flex-1 bg-background text-foreground">
      {/* Hero Section */}
      <section className="relative border-b border-border bg-surface px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 rounded-[4px] bg-primary/10 px-3 py-1 text-xs font-mono font-semibold text-primary border border-primary/20">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-lime" />
            <span>Instituto de Innovación y Ciencias Aplicadas</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Universidad IINICIA
          </h1>
          <p className="mx-auto max-w-2xl text-sm sm:text-base text-muted leading-relaxed">
            Formamos profesionales y líderes tecnológicos a través de un modelo educativo contemporáneo, riguroso y profundamente articulado con las demandas de la sociedad digital.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <Link
              href="/cursos"
              className="rounded-[6px] bg-primary px-4 py-2 text-xs font-semibold text-white shadow-minimal hover:bg-primary/90 transition-all"
            >
              Conoce nuestra oferta académica
            </Link>
            <Link
              href="/admisiones"
              className="rounded-[6px] border border-border bg-surface hover:bg-surface-muted px-4 py-2 text-xs font-medium text-foreground transition-all"
            >
              Proceso de admisión
            </Link>
          </div>
        </div>
      </section>

      {/* Misión y Visión */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-[10px] border border-border bg-surface p-6 sm:p-8 shadow-minimal space-y-3">
            <div className="h-8 w-8 rounded-[6px] bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
              <IconAudit className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Nuestra Misión</h2>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              Brindar educación superior y continua de excelencia, democratizando el acceso al conocimiento tecnológico avanzado mediante metodologías pedagógicas innovadoras, infraestructura digital robusta y un claustro docente de primer nivel.
            </p>
          </div>

          <div className="rounded-[10px] border border-border bg-surface p-6 sm:p-8 shadow-minimal space-y-3">
            <div className="h-8 w-8 rounded-[6px] bg-accent-lime/20 text-foreground flex items-center justify-center font-bold text-xs">
              <IconGrades className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Nuestra Visión</h2>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              Consolidarnos como la institución universitaria referente en formación tecnológica e innovación en América Latina, reconocida por la empleabilidad sobresaliente de sus egresados, la calidad de sus programas académicos y su liderazgo en educación virtual.
            </p>
          </div>
        </div>

        {/* Modelo Educativo */}
        <div className="space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-1.5">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Modelo Educativo IINICIA</h2>
            <p className="text-xs sm:text-sm text-muted">
              Un enfoque centrado en el desarrollo de competencias prácticas reales y pensamiento analítico.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pilaresModelo.map((pilar, idx) => (
              <div
                key={idx}
                className="rounded-[10px] border border-border bg-surface p-5 shadow-minimal space-y-2.5"
              >
                <div className="h-6 w-6 rounded-[4px] bg-primary/10 text-primary flex items-center justify-center font-mono text-xs font-bold">
                  0{idx + 1}
                </div>
                <h3 className="text-sm font-semibold text-foreground">{pilar.titulo}</h3>
                <p className="text-xs text-muted leading-relaxed">{pilar.descripcion}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Autoridades y Claustro */}
        <div className="space-y-6 pt-6 border-t border-border">
          <div className="text-center max-w-2xl mx-auto space-y-1.5">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Autoridades y Claustro Académico</h2>
            <p className="text-xs sm:text-sm text-muted">
              Liderazgo institucional comprometido con la calidad académica y la gobernanza universitaria.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {autoridades.map((auth, idx) => (
              <div
                key={idx}
                className="rounded-[10px] border border-border bg-surface p-5 shadow-minimal space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="h-10 w-10 rounded-[6px] bg-primary/10 text-primary flex items-center justify-center font-bold text-sm mb-3">
                    <IconTeachers className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{auth.nombre}</h3>
                  <p className="text-[11px] font-mono font-medium text-primary mt-0.5">{auth.cargo}</p>
                  <p className="text-xs text-muted mt-2 leading-relaxed">{auth.semblanza}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Call to action */}
        <div className="rounded-[10px] border border-primary/30 bg-primary/5 p-8 text-center space-y-3">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Forma parte de la comunidad universitaria IINICIA
          </h2>
          <p className="text-xs sm:text-sm text-muted max-w-xl mx-auto">
            Inicia tu proceso de registro y accede a nuestras materias, programas académicos y aulas virtuales en Moodle LMS.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              href="/registro"
              className="rounded-[6px] bg-primary px-5 py-2 text-xs font-semibold text-white shadow-minimal hover:bg-primary/90 transition-all"
            >
              Registrarme como aspirante
            </Link>
            <Link
              href="/contacto"
              className="rounded-[6px] border border-border bg-surface hover:bg-surface-muted px-4 py-2 text-xs font-medium text-foreground transition-all"
            >
              Contactar a admisiones
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
