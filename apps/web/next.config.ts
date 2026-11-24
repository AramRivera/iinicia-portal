// IINICIA Portal · portal Next.js · next.config.ts
/** Configura la compilación de Next.js y las reglas de Turbopack para los estilos. */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  /** Configura las cabeceras globales que limitan el encuadre, el envío del referente y la interpretación de tipos MIME. */
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    }];
  },
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      // La salida del loader es CSS global. Los módulos deben conservar su procesamiento nativo.
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
