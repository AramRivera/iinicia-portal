// IINICIA Portal · API NestJS · vitest.config.e2e.ts
/** Configura Vitest para ejecutar las suites que levantan la aplicación HTTP. */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});
