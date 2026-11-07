import { expect, test } from '@playwright/test';
import { clicks, countSounds, goto, plucks, watchErrors } from './fixtures/helpers';

test.describe('escuchador', () => {
  test.beforeEach(async ({ page }) => {
    await countSounds(page);
  });

  test('toca arpegios, rasgueos y repeticiones, y se detiene', async ({ page }) => {
    const errors = watchErrors(page);
    await goto(page, '/afinador/dadgad');
    await page.locator('#play-toggle').click();
    await expect(page.locator('#play-toggle')).toHaveText('▶ Tocar', { timeout: 6000 });
    expect(await plucks(page)).toBe(6);

    await page.getByRole('button', { name: 'Rasgueado' }).click();
    await page.locator('#play-toggle').click();
    await expect(page.locator('#play-toggle')).toHaveText('▶ Tocar', { timeout: 6000 });
    expect(await plucks(page)).toBe(12);

    await page.locator('#loop').check();
    await page.locator('#pattern').selectOption('folk');
    await page.locator('#play-toggle').click();
    await page.waitForTimeout(3500);
    await expect(page.locator('#play-toggle')).toHaveText('■ Parar');
    await page.locator('#play-toggle').click();
    await page.waitForTimeout(300);
    const stopped = await plucks(page);
    expect(stopped).toBeGreaterThan(12 + 30);
    await page.waitForTimeout(800);
    expect(await plucks(page)).toBe(stopped);
    expect(errors).toEqual([]);
  });

  test('el rasgueo a mano cruza las seis cuerdas aunque el gesto sea rápido', async ({ page }) => {
    await goto(page, '/afinador/dadgad');
    const box = (await page.getByTestId('strum-zone').boundingBox())!;
    await page.getByTestId('strum-zone').scrollIntoViewIfNeeded();
    const zone = (await page.getByTestId('strum-zone').boundingBox()) ?? box;
    await page.mouse.move(zone.x + zone.width / 2, zone.y + 4);
    await page.mouse.down();
    await page.mouse.move(zone.x + zone.width / 2, zone.y + zone.height - 4, { steps: 2 });
    await page.mouse.up();
    await page.waitForTimeout(100);
    expect(await plucks(page)).toBe(6);
  });

  test('pisar un traste y poner capo cambian las notas', async ({ page }) => {
    await goto(page, '/afinador/dadgad');
    const labels = page.locator('[data-label]');
    await expect(labels.nth(0)).toHaveText('D');
    await page.locator('[data-fret="5:2"]').click();
    await expect(labels.nth(0)).toHaveText('E');
    await page.getByRole('button', { name: 'Subir capo' }).click();
    await expect(labels.nth(0)).toHaveText('F');
    await expect(labels.nth(1)).toHaveText('A#');
  });

  test('un cambio de afinación reinicia trastes y capo', async ({ page }) => {
    await goto(page, '/afinador/dadgad');
    await page.getByRole('button', { name: 'Subir capo' }).click();
    await expect(page.getByTestId('capo-value')).toHaveText('Traste 1');
    await page.locator('[data-id="dropd"]').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Drop D');
    await expect(page.getByTestId('capo-value')).toHaveText('Sin capo');
  });

  test('el capo de un tema se aplica y empieza a tocar', async ({ page }) => {
    await goto(page, '/afinador/dgddad');
    await page.getByRole('button', { name: /capo en el traste 3/ }).click();
    await expect(page.getByTestId('capo-value')).toHaveText('Traste 3');
    await page.waitForTimeout(400);
    expect(await plucks(page)).toBeGreaterThan(0);
  });
});

test.describe('afinación', () => {
  test('muestra los datos que se deducen de las notas', async ({ page }) => {
    await goto(page, '/afinador/dadgad');
    await expect(page.getByTestId('fact-chord')).toHaveText('Dsus4');
    await expect(page.getByTestId('fact-intervals')).toHaveText('5J 4J 4J 2M 4J');
    await expect(page.getByTestId('fact-changes')).toHaveText(/^3 de 6/);
  });

  test('avisa si una cuerda corre riesgo', async ({ page }) => {
    await goto(page, '/afinador/dadgdfs');
    await expect(page.getByText(/Puede cortarse/)).toBeVisible();
    await goto(page, '/afinador/dadgad');
    await expect(page.getByText(/Puede cortarse/)).toHaveCount(0);
  });

  test('la búsqueda encuentra por tema y por notas', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await goto(page, '/afinador');
    await page.getByPlaceholder('BUSCAR').fill('kool thing');
    await expect(page.locator('[data-id]')).toHaveCount(1);
    await expect(page.locator('[data-id="fsharp"]')).toBeVisible();
    await page.getByPlaceholder('BUSCAR').fill('zzzz');
    await expect(page.getByText('No hay afinaciones con esa búsqueda.')).toBeVisible();
  });

  test('el solfeo cambia los nombres en toda la app', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await goto(page, '/afinador/dadgad');
    await page.getByRole('button', { name: 'Mi La Re' }).click();
    await expect(page.getByTestId('fact-chord')).toHaveText('Resus4');
    await expect(page.locator('[data-label]').first()).toHaveText('Re');
  });

  test('tu afinación se edita, se guarda y sobrevive a recargar', async ({ page }) => {
    await goto(page, '/afinador/tuya');
    await page.getByRole('button', { name: 'Bajar cuerda 6 un semitono' }).click();
    await page.getByRole('button', { name: 'Bajar cuerda 6 un semitono' }).click();
    await expect(page.getByTestId('fact-changes')).toHaveText(/^1 de 6 · 2 semitonos/);
    await page.reload();
    await expect(page.getByTestId('fact-changes')).toHaveText(/^1 de 6 · 2 semitonos/);
  });

  test('una afinación generada se abre desde su link', async ({ page }) => {
    await goto(page, '/afinador/tuya?n=Ds2,A2,D3,G3,B3,F4');
    await expect(page.getByTestId('fact-changes')).toHaveText(/^2 de 6/);
  });

  test('tirar afinación lleva a otra pantalla válida', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const errors = watchErrors(page);
    await goto(page, '/afinador/estandar');
    await page.locator('#roll-tuning').click();
    await expect(page).toHaveURL(/\/afinador\/(?!estandar$)/);
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('');
    expect(errors).toEqual([]);
  });
});

test.describe('videos', () => {
  test('nada de YouTube hasta abrir, y uno a la vez', async ({ page }) => {
    const requests: string[] = [];
    await page.route(/youtube/, (route) => {
      requests.push(route.request().url());
      return route.abort();
    });
    await goto(page, '/afinador/cgcfce');
    await page.waitForTimeout(200);
    expect(requests).toEqual([]);
    await expect(page.locator('iframe')).toHaveCount(0);

    await page.getByRole('button', { name: /Oír Which Will/ }).click();
    await expect(page.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/AZsxbWHlXyY/);
    await page.getByRole('button', { name: /Oír Hazey Jane II/ }).click();
    await expect(page.locator('iframe')).toHaveCount(1);
    await expect(page.locator('iframe')).toHaveAttribute('src', /lCaDp1gb6D4/);
    await page.getByRole('button', { name: /Oír Hazey Jane II/ }).click();
    await expect(page.locator('iframe')).toHaveCount(0);
  });
});

test.describe('páginas para buscadores', () => {
  test('cada afinación tiene su HTML sin ejecutar JavaScript', async ({ request }) => {
    const response = await request.get('/afinador/dadgad');
    const html = await response.text();
    expect(response.ok()).toBe(true);
    expect(html).toContain('<title>DADGAD: afinación de guitarra');
    expect(html).toContain('Re suspendido');
    expect(html).toContain('Dsus4');
  });
});

test.describe('metrónomo y navegación', () => {
  test('sigue sonando al cambiar de herramienta, y se puede parar desde otra', async ({ page }) => {
    await countSounds(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await goto(page, '/ritmo');
    await page.locator('#metro-toggle').click();
    await page.getByRole('button', { name: 'Menú' }).click();
    await page
      .getByRole('navigation', { name: 'Herramientas' })
      .getByRole('link', { name: 'Cartas' })
      .click();
    await expect(page).toHaveURL(/\/cartas/);
    await expect(page.getByTestId('dock-ritmo')).toBeVisible();
    const before = await clicks(page);
    await page.waitForTimeout(800);
    expect(await clicks(page)).toBeGreaterThan(before);
    await page.getByTestId('dock-ritmo').getByRole('button', { name: /Parar/ }).click();
    await expect(page.getByTestId('dock-ritmo')).toHaveAttribute('data-running', 'false');
    await page.waitForTimeout(300);
    const stopped = await clicks(page);
    await page.waitForTimeout(500);
    expect(await clicks(page)).toBe(stopped);
  });
});
