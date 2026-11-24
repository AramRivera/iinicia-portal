// IINICIA Portal · portal Next.js · layout.tsx
/** Define el documento común y monta los proveedores, la cabecera y el pie del portal. */
import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PortalHelpChat } from "@/components/PortalHelpChat";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

export const metadata: Metadata = {
  title: {
    default: "INICIA — Instituto de Innovación",
    template: "%s | INICIA",
  },
  description:
    "Plataforma de gestión universitaria y académica para estudiantes, docentes y administradores de INICIA.",
  icons: { icon: '/icon.svg' },
};

/** Monta los proveedores de sesión y tema, junto con la navegación y los elementos comunes a las páginas. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <body className="flex min-h-full flex-col bg-background text-foreground transition-colors duration-150">
        <ThemeProvider>
          <AuthProvider>
            <Suspense fallback={<div aria-hidden="true" className="h-16 border-b border-border bg-surface" />}>
              <SiteHeader />
            </Suspense>
            <main className="flex flex-1 flex-col">{children}</main>
            <Suspense fallback={null}>
              <SiteFooter />
            </Suspense>
            <PortalHelpChat />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
