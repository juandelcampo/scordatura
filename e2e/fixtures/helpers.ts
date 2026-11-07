import { expect, type Page } from '@playwright/test';

/** Falla la prueba si la página tira un error, incluidos los de hidratación de React. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      !/youtube|ERR_FAILED|ERR_BLOCKED/i.test(`${message.text()} ${message.location().url}`)
    ) {
      errors.push(message.text());
    }
  });
  return errors;
}

/** Cuenta las notas y los clics que la app manda a sonar. */
export async function countSounds(page: Page) {
  await page.addInitScript(() => {
    const scope = window as unknown as { __plucks: number; __clicks: number };
    scope.__plucks = 0;
    scope.__clicks = 0;
    const startBuffer = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      scope.__plucks += 1;
      return startBuffer.apply(this, args);
    };
    const startOscillator = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...args) {
      scope.__clicks += 1;
      return startOscillator.apply(this, args);
    };
  });
}

export const plucks = (page: Page) =>
  page.evaluate(() => (window as unknown as { __plucks: number }).__plucks);
export const clicks = (page: Page) =>
  page.evaluate(() => (window as unknown as { __clicks: number }).__clicks);

/** Espera a que la página estática se vuelva interactiva. */
export async function waitForApp(page: Page) {
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
}

export async function goto(page: Page, path: string) {
  await page.goto(path);
  await waitForApp(page);
  await expect(page.locator('main')).toBeVisible();
}
