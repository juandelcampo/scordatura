import { defineConfig } from '@playwright/test';

// Por defecto corre contra el build real (las páginas estáticas). Con E2E_DEV corre contra el servidor
// de desarrollo: ahí React ejecuta los efectos dos veces, y eso destapa errores que el build no muestra.
const DEV_PORT = 5273;
const baseURL = process.env.E2E_DEV ? `http://localhost:${DEV_PORT}` : 'http://localhost:4173';

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
    command: process.env.E2E_DEV ? `npm run dev -- --port ${DEV_PORT}` : 'npm run preview',
    url: baseURL,
    reuseExistingServer: true,
  },
});
