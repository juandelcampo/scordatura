// Lo responsive es un requisito: cada pantalla se comprueba en cada tamaño.
import { expect, test, type Page } from '@playwright/test';
import { goto, watchErrors } from './fixtures/helpers';

const VIEWPORTS = [
  { name: 'celular chico', width: 320, height: 568 },
  { name: 'celular', width: 360, height: 740 },
  { name: 'iPhone', width: 390, height: 844 },
  { name: 'celular grande', width: 430, height: 932 },
  { name: 'celular apaisado', width: 844, height: 390 },
  { name: 'tablet chica', width: 600, height: 960 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'límite del menú', width: 899, height: 700 },
  { name: 'límite de la barra', width: 900, height: 700 },
  { name: 'notebook chica', width: 1024, height: 768 },
  { name: 'notebook', width: 1280, height: 800 },
  { name: 'escritorio', width: 1920, height: 1080 },
];

const ROUTES = [
  '/',
  '/consigna',
  '/estudio',
  '/drone',
  '/drone?n=Ds2,A2,D3,G3,B3,F4',
  '/afinador',
  '/afinador/fsharp',
  '/afinador/dadgdfs',
  '/afinador/tuya',
  '/ritmo',
  '/ritmo?m=euclid&bpm=90&k=7&n=32&r=0',
  '/ritmo?m=poly&bpm=90&a=16&b=15',
  '/ritmo?m=mutante&bpm=120&s=2%2B2%2B3/8_3%2B3%2B3%2B2/8_1%2B1%2B1%2B1/4&c=1',
  '/armonia',
  '/armonia?c=Am,F7,Bbsus2,Ebmaj7',
  '/melodia',
  '/letras',
  '/ritmo?m=drum&bpm=110&n=32&p=10000000100000001000000010000000_10000000100000001000000010000000_10000000100000001000000010000000_10000000100000001000000010000000_10000000100000001000000010000000_10000000100000001000000010000000&l=80_80_80_80_80_80',
  '/cartas',
  '/cartas?c=13',
  '/afinador/tuya?n=Ds2,A2,D3,G3,B3,F4',
  '/forma',
  '/forma?f=ABCDEFGHABCDEFGH',
  '/diario',
];

const MIN_TARGET = { height: 40, width: 30 };

interface Problem {
  element: string;
  detail: string;
}

/** Revisa el DOM visible: desbordes, texto cortado y controles chicos para el dedo. */
function audit(page: Page): Promise<{ scroll: number; problems: Problem[] }> {
  return page.evaluate(
    ({ minTarget }) => {
      const problems: { element: string; detail: string }[] = [];
      const describe = (element: Element) =>
        `${element.tagName.toLowerCase()} "${(element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 30)}"`;
      const viewport = document.documentElement.clientWidth;

      const isVisible = (element: Element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 1 && box.height > 1;
      };

      for (const element of Array.from(document.body.querySelectorAll('*'))) {
        if (!isVisible(element) || element.closest('.sr-only') || element.tagName === 'SCRIPT') continue;
        const box = element.getBoundingClientRect();
        if (box.right > viewport + 1 || box.left < -1) {
          problems.push({
            element: describe(element),
            detail: `se sale de la pantalla: ${Math.round(box.left)}–${Math.round(box.right)} de ${viewport}`,
          });
        }
      }

      const controls = Array.from(
        document.querySelectorAll(
          'button, a[href], select, input:not([type="checkbox"]), textarea, summary, label:has(input[type="checkbox"])',
        ),
      );
      for (const element of controls) {
        if (!isVisible(element)) continue;
        // Los enlaces dentro de un texto siguen el tamaño del texto, como cualquier párrafo.
        if (element.tagName === 'A' && getComputedStyle(element).display === 'inline') continue;
        // El fader de la barra de abajo se arrastra a lo ancho: se le pide menos alto para ahorrar pantalla.
        if (element.matches('label[data-compact] input')) continue;
        const box = element.getBoundingClientRect();
        if (box.height < minTarget.height || box.width < minTarget.width) {
          problems.push({
            element: describe(element),
            detail: `muy chico para el dedo: ${Math.round(box.width)}×${Math.round(box.height)}`,
          });
        }
        if (
          element.scrollWidth > element.clientWidth + 2 &&
          element.tagName !== 'INPUT' &&
          element.tagName !== 'SELECT' &&
          element.tagName !== 'TEXTAREA'
        ) {
          problems.push({
            element: describe(element),
            detail: `texto cortado: ${element.scrollWidth} en ${element.clientWidth}`,
          });
        }
      }
      return { scroll: document.documentElement.scrollWidth - viewport, problems };
    },
    { minTarget: MIN_TARGET },
  );
}

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.name} (${viewport.width}×${viewport.height})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of ROUTES) {
      test(`nada se rompe en ${route}`, async ({ page }) => {
        const errors = watchErrors(page);
        await goto(page, route);
        await page.waitForTimeout(100);
        const { scroll, problems } = await audit(page);
        expect(problems, JSON.stringify(problems, null, 1)).toEqual([]);
        expect(scroll, 'desborde horizontal de la página').toBeLessThanOrEqual(0);
        expect(errors).toEqual([]);
      });
    }

    test('con la barra de abajo abierta, nada se rompe y todo queda a mano', async ({ page }) => {
      await goto(page, '/consigna');
      await page.locator('[data-row="ritmo"]').getByRole('button', { name: 'Oír el ritmo' }).click();
      await page.locator('[data-row="drone"]').getByRole('button', { name: 'Sostener el drone' }).click();
      await expect(page.getByTestId('dock-drone')).toBeVisible();
      await page.waitForTimeout(100);
      const { scroll, problems } = await audit(page);
      expect(problems, JSON.stringify(problems, null, 1)).toEqual([]);
      expect(scroll).toBeLessThanOrEqual(0);
      for (const name of ['Cerrar el ritmo', 'Cerrar el drone']) {
        await expect(page.getByRole('button', { name })).toBeInViewport();
      }
      await expect(page.locator('#roll')).toBeInViewport();
    });

    test('se llega a todas las herramientas', async ({ page }) => {
      await goto(page, '/consigna');
      const menu = page.getByRole('button', { name: 'Menú' });
      const hasMenu = viewport.width < 900;
      if (hasMenu) {
        await expect(menu).toBeVisible();
        await menu.click();
      } else {
        await expect(menu).toBeHidden();
      }
      const nav = page.getByRole('navigation', { name: 'Herramientas' });
      for (const name of [
        'Consigna',
        'Estudio',
        'Afinador',
        'Ritmo',
        'Armonía',
        'Melodía',
        'Letras',
        'Cartas',
        'Forma',
        'Diario',
      ]) {
        await nav.getByRole('link', { name }).scrollIntoViewIfNeeded();
        await expect(nav.getByRole('link', { name })).toBeInViewport();
      }
      await nav.getByRole('link', { name: 'Ritmo' }).click();
      await expect(page).toHaveURL(/\/ritmo/);
      if (hasMenu) await expect(nav).toBeHidden();
    });

    test('el botón de tirar queda a mano y no tapa el contenido', async ({ page }) => {
      await goto(page, '/consigna');
      const roll = page.locator('#roll');
      await expect(roll).toBeInViewport();
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expect(roll).toBeInViewport();
      // Al final de la página, la última fila se puede leer entera por encima del botón.
      const last = page.locator('[data-row="carta"]');
      await last.scrollIntoViewIfNeeded();
      const [rowBox, rollBox] = await Promise.all([last.boundingBox(), roll.boundingBox()]);
      expect(rowBox!.y).toBeLessThan(rollBox!.y);
    });
  });
}

test.describe('formularios en el celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('los campos no provocan zoom en iOS', async ({ page }) => {
    for (const route of ['/afinador', '/cartas', '/ritmo']) {
      await goto(page, route);
      if (route === '/afinador') await page.getByRole('button', { name: /Elegir entre/ }).click();
      const sizes = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll<HTMLElement>(
            'input:not([type="range"]):not([type="checkbox"]), select, textarea',
          ),
        )
          .filter((element) => element.getBoundingClientRect().width > 0)
          .map((element) => parseFloat(getComputedStyle(element).fontSize)),
      );
      expect(sizes.length, route).toBeGreaterThan(0);
      for (const size of sizes) expect(size, route).toBeGreaterThanOrEqual(16);
    }
  });

  test('la zona de rasgueo responde al tacto y el mástil deja desplazar la página', async ({ page }) => {
    await goto(page, '/afinador/dadgad');
    const touchAction = (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((element) => getComputedStyle(element).touchAction);
    expect(await touchAction('[data-testid="strum-zone"]')).toBe('none');
    expect(await touchAction('[class*="neck"]')).toBe('pan-y');
  });

  test('un celular angosto muestra 5 trastes más anchos', async ({ page }) => {
    await goto(page, '/afinador/dadgad');
    const visible = page.locator('[data-position]:visible[aria-pressed]');
    await expect(visible).toHaveCount(30);
    const box = await visible.first().boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(30);
  });
});

test.describe('modo oscuro', () => {
  test.use({ colorScheme: 'dark', viewport: { width: 390, height: 844 } });

  test('la página es negra y el texto, blanco', async ({ page }) => {
    await goto(page, '/consigna');
    const colors = await page.evaluate(() => {
      const style = getComputedStyle(document.body);
      return { background: style.backgroundColor, color: style.color };
    });
    expect(colors).toEqual({ background: 'rgb(0, 0, 0)', color: 'rgb(255, 255, 255)' });
  });
});
