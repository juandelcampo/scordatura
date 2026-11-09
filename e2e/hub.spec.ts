// Página principal, consigna como hub, sonido de armonía y drone.
import { expect, test, type Page } from '@playwright/test';
import { clicks, countSounds, goto, openSection, plucks, riskPicker, watchErrors } from './fixtures/helpers';

test.use({ viewport: { width: 1280, height: 800 } });

const row = (page: Page, id: string) => page.locator(`[data-row="${id}"]`);

test.describe('acerca de', () => {
  test('explica la idea, se lee sin JavaScript y lleva a la consigna', async ({ page, request }) => {
    const html = await (await request.get('/acerca')).text();
    expect(html).toContain('Tus canciones se parecen entre sí');
    expect(html).toContain('No compone por vos');

    const errors = watchErrors(page);
    await goto(page, '/acerca');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('canciones');
    await expect(riskPicker(page)).toHaveCount(0);
    await page.getByTestId('cta').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Consigna');
    expect(errors).toEqual([]);
  });

  test('llega a cada herramienta y el logo vuelve a la consigna', async ({ page }) => {
    await goto(page, '/herramientas');
    await page.getByRole('main').getByRole('link', { name: 'Drone' }).click();
    await expect(page).toHaveURL(/\/drone/);
    await openSection(page, 'Scordatura');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Consigna');
  });
});

test.describe('consigna como hub', () => {
  test.beforeEach(async ({ page }) => {
    await countSounds(page);
  });

  test('todo se escucha sin salir de la pantalla', async ({ page }) => {
    const errors = watchErrors(page);
    await goto(page, '/consigna');
    await expect(page).toHaveURL(/\?t=/);
    const url = () => new URL(page.url()).pathname;

    await page.getByRole('button', { name: 'Oír la afinación arpegiada' }).click();
    await expect.poll(() => plucks(page), { timeout: 4000 }).toBe(6);

    await page.getByRole('button', { name: 'Oír la progresión' }).click();
    await expect.poll(() => plucks(page), { timeout: 4000 }).toBeGreaterThan(6 + 8);

    const before = await plucks(page);
    await page.getByRole('button', { name: 'Oír un ejemplo de melodía' }).click();
    await expect.poll(() => plucks(page)).toBeGreaterThan(before);

    const clicksBefore = await clicks(page);
    await page.getByRole('button', { name: 'Oír el ritmo' }).click();
    await expect.poll(() => clicks(page), { timeout: 4000 }).toBeGreaterThan(clicksBefore);
    await page.getByRole('button', { name: 'Parar el ritmo' }).first().click();

    await page.getByRole('button', { name: 'Sostener el drone' }).click();
    await expect(page.getByTestId('dock-drone')).toBeVisible();
    await page.getByRole('button', { name: 'Parar el drone' }).first().click();

    expect(url()).toBe('/consigna');
    expect(errors).toEqual([]);
  });

  test('cada cuerda se oye por separado', async ({ page }) => {
    await goto(page, '/consigna');
    await page.getByRole('button', { name: /^Oír cuerda 6/ }).click();
    await expect.poll(() => plucks(page)).toBe(1);
  });

  test('la progresión muestra trastes de la afinación de la consigna', async ({ page }) => {
    await goto(page, '/consigna');
    await expect(row(page, 'armonia').getByTestId('mini-frets').first()).toBeVisible();
  });

  test('la letra se cuenta ahí mismo y se guarda en la sección', async ({ page }) => {
    await goto(page, '/consigna');
    await page.getByTestId('mini-lyric').fill('En un lugar de la Mancha');
    await expect(page.getByTestId('mini-lyric-count')).toContainText('8');
    await openSection(page, 'Letras');
    await expect(page.getByTestId('lyric-text')).toHaveValue('En un lugar de la Mancha');
  });

  test('la forma de la consigna es la de tu canción', async ({ page }) => {
    await goto(page, '/consigna');
    const value = (await row(page, 'forma').locator('p').first().textContent())!;
    // Abre la herramienta en un modal encima de la consigna.
    await row(page, 'forma').getByRole('link', { name: 'Abrir Forma' }).click();
    await expect(page.getByRole('dialog', { name: 'Forma' }).getByRole('heading', { level: 1 })).toHaveText(
      value.replaceAll(' ', ''),
    );
    // Y queda guardada: la página de Forma muestra la misma.
    await goto(page, '/forma');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(value.replaceAll(' ', ''));
  });

  test('un link de cuando no había drone se sigue abriendo', async ({ page }) => {
    const errors = watchErrors(page);
    await goto(page, '/consigna?t=1.a.b.c.d.e.f.g');
    await expect(row(page, 'drone')).toBeVisible();
    await expect.poll(() => page.url()).toContain('t=1.a.b.c.d.e.f.g');
    expect(errors).toEqual([]);
  });
});

test.describe('sonido', () => {
  test('armonía suena con guitarra, sin elegir instrumento', async ({ page }) => {
    await countSounds(page);
    await goto(page, '/armonia?c=C,Am');
    await expect(page.getByRole('main').getByRole('button', { name: 'Piano' })).toHaveCount(0);
    await page.locator('#play-harmony').click();
    await expect.poll(() => plucks(page)).toBeGreaterThanOrEqual(5);
  });
});

test.describe('drone', () => {
  const level = (page: Page) =>
    page.getByTestId('scope').evaluate((canvas: HTMLCanvasElement) => Number(canvas.dataset.level));

  test('produce sonido de verdad, y al parar se apaga', async ({ page }) => {
    const errors = watchErrors(page);
    await goto(page, '/drone');
    await page.locator('#drone-toggle').click();
    await expect.poll(() => level(page), { timeout: 5000 }).toBeGreaterThan(0.01);
    await expect(page.locator('#drone-toggle')).toHaveText('■ Parar');
    await page.locator('#drone-toggle').click();
    await expect(page.getByTestId('dock-drone')).toHaveAttribute('data-running', 'false');
    await expect.poll(() => level(page), { timeout: 5000 }).toBe(0);
    expect(errors).toEqual([]);
  });

  test('sigue sonando al cambiar de herramienta y se para desde cualquiera', async ({ page }) => {
    await goto(page, '/drone');
    await page.locator('#drone-toggle').click();
    await openSection(page, 'Cartas');
    await expect(page.getByTestId('dock-drone')).toBeVisible();
    await page.getByRole('button', { name: 'Parar el drone' }).click();
    await expect(page.getByTestId('dock-drone')).toHaveAttribute('data-running', 'false');
  });

  test('cambia nota, pila y timbre mientras suena, sin errores', async ({ page }) => {
    const errors = watchErrors(page);
    await goto(page, '/drone');
    await page.locator('#drone-toggle').click();
    // Arranca en la tónica de la consigna; subirla a mano la suelta de ahí.
    const before = await page.getByTestId('drone-root').textContent();
    await page.getByRole('button', { name: 'Subir nota raíz' }).click();
    await expect(page.getByTestId('drone-root')).not.toHaveText(before!);
    await expect(page.getByTestId('drone-follow')).toContainText('a mano');
    await page.getByTestId('drone-stack').selectOption('menor');
    await expect(page.getByTestId('drone-rule')).toContainText('tercera menor');
    await page.getByRole('button', { name: 'Crudo' }).click();
    await page.getByLabel('Brillo').fill('0.9');
    await page.getByLabel('Movimiento').fill('0.8');
    await expect.poll(() => level(page), { timeout: 5000 }).toBeGreaterThan(0.01);
    await expect.poll(() => page.url()).toContain('s=menor');
    await page.locator('#drone-toggle').click();
    expect(errors).toEqual([]);
  });

  test('tirar usa el riesgo, y un link reproduce el drone', async ({ page }) => {
    await goto(page, '/drone?r=45&s=tritono&t=crudo&b=0.50&m=0.50&d=10');
    await expect(page.getByTestId('drone-root')).toHaveText('A2');
    await expect(page.getByTestId('drone-rule')).toContainText('tritono');
    await expect(page.getByTestId('drone-follow')).toContainText('a mano');
    await page.locator('#roll-drone').click();
    await expect(page.getByTestId('drone-voices')).not.toBeEmpty();
  });

  test('sostiene las cuerdas de una afinación', async ({ page }) => {
    await goto(page, '/afinador/dadgad');
    await page.getByRole('link', { name: 'Drone con estas cuerdas →' }).click();
    await expect(page).toHaveURL(/\/drone\?.*n=D2/);
    await expect(page.getByTestId('drone-voices')).toHaveText('D · A · D · G · A · D');
    await page.locator('#drone-unlink').click();
    await expect(page.getByTestId('drone-stack')).toBeVisible();
  });
});
