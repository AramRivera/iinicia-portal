
import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PortalThemeProvider } from "@/components/PortalThemeProvider";

export const metadata: Metadata = {
  title: {
    default: "IINICIA — Instituto de Innovación y Ciencias Aplicadas",
    template: "%s | IINICIA",
  },
  description:
    "Tu educación comienza hoy, estés donde estés. Cursos, certificaciones y diplomados en línea del Instituto de Innovación y Ciencias Aplicadas.",
};

// Recupera el tema antes de mostrar la página.
const themeScript = `
(function () {
  try {
    var saved = localStorage.getItem("iinicia-portal-theme");
    var theme = saved === "dark" ? "dark" : "light";
    document.documentElement.dataset.portalTheme = theme;
  } catch (error) {
    document.documentElement.dataset.portalTheme = "light";
  }
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <style>{`
          html[data-portal-theme="dark"] body:has(.academic-site) {
            background: #101710;
          }

          html[data-portal-theme="dark"] .academic-site:not([data-disco="true"]) {
            --portal-bg: #101710;
            --portal-surface: #192219;
            --portal-soft: #141e15;
            --portal-text: #edf5e7;
            --portal-muted: #bac8b1;
            --portal-border: #354632;
            --portal-tint: #25351b;
            --portal-accent: #c4ec89;
            color-scheme: dark;
          }
        `}</style>
      </head>

      <body className="flex min-h-full flex-col bg-background text-foreground">
        <PortalThemeProvider>
          <SiteHeader />
          <main className="flex flex-1 flex-col">{children}</main>
          <SiteFooter />
        </PortalThemeProvider>
      </body>
    </html>
  );
}
