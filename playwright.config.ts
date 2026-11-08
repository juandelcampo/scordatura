import { defineConfig } from '@playwright/test';

// Por defecto corre contra el build real (las páginas estáticas). Con E2E_DEV corre contra el servidor
// de desarrollo: ahí React ejecuta los efectos dos veces, y eso destapa errores que el build no muestra.
// E2E_PORT sirve el build en otro puerto: varias sesiones en paralelo no se pisan el 4173.
const DEV_PORT = 5273;
const PORT = Number(process.env.E2E_PORT ?? 4173);
const baseURL = process.env.E2E_DEV ? `http://localhost:${DEV_PORT}` : `http://localhost:${PORT}`;

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/fixtures/setup.ts',
  fullyParallel: true,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL,
    channel: 'chrome',
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  webServer: {
    command: process.env.E2E_DEV
      ? `npm run dev -- --port ${DEV_PORT}`
      : `npx sirv build/client --port ${PORT} --single __spa-fallback.html`,
    url: baseURL,
    reuseExistingServer: true,
  },
});
