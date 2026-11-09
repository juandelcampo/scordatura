// Lo que comparten las herramientas: quién suena, en qué sección se está y qué dice cada pantalla.
import { expect, test, type Page } from '@playwright/test';
import { editStudio, goto, gotoStudioEditing, openSection } from './fixtures/helpers';

const go = async (page: Page, name: string) => {
  await openSection(page, name);
  if (name === 'Estudio') await editStudio(page);
};

test.describe('audio', () => {
  test('el metrónomo le saca el lugar al tema', async ({ page }) => {
    await gotoStudioEditing(page);
    await page.locator('#song-play').click();
    await go(page, 'Ritmo');
    await expect(page.getByTestId('dock-estudio')).toBeVisible();
    await page.locator('#metro-toggle').click();
    await expect(page.getByTestId('dock-ritmo')).toHaveAttribute('data-running', 'true');
    await expect(page.getByTestId('dock-estudio')).toHaveCount(0);
  });

  test('la progresión de Armonía le saca el lugar al tema', async ({ page }) => {
    await gotoStudioEditing(page);
    await page.locator('#song-play').click();
    await go(page, 'Armonía');
    await page.locator('#play-harmony').click();
    await expect(page.locator('#play-harmony')).toContainText('Parar');
    await expect(page.getByTestId('dock-estudio')).toHaveCount(0);
  });

  test('el metrónomo y el drone sí suenan juntos', async ({ page }) => {
    await goto(page, '/ritmo');
    await page.locator('#metro-toggle').click();
    await go(page, 'Drone');
    await page.locator('#drone-toggle').click();
    await expect(page.getByTestId('dock-ritmo')).toHaveAttribute('data-running', 'true');
    await expect(page.getByTestId('dock-drone')).toHaveAttribute('data-running', 'true');
  });

  test('el drone del tema se puede parar, y vuelve con el próximo Tocar', async ({ page }) => {
    await gotoStudioEditing(page);
    await page.locator('#song-play').click();
    await go(page, 'Drone');
    const toggle = page.locator('#drone-toggle');
    await expect(toggle).toContainText('Parar');
    await toggle.click();
    await expect(toggle).toContainText('Sostener');
    await page.waitForTimeout(400);
    await expect(toggle).toContainText('Sostener');
    await expect(page.getByTestId('dock-estudio')).toHaveAttribute('data-running', 'true');

    await go(page, 'Estudio');
    await page.locator('#song-play').click();
    await page.locator('#song-play').click();
    await go(page, 'Drone');
    await expect(toggle).toContainText('Parar');
  });
});

test.describe('sección activa', () => {
  test('pasar por el Estudio no cambia la sección', async ({ page }) => {
    await goto(page, '/armonia');
    await page.getByTestId('section-picker').selectOption('B');
    await go(page, 'Estudio');
    await expect(page.getByTestId('form-title')).toContainText('Sección B');
    await go(page, 'Armonía');
    await expect(page.locator('#save-harmony')).toContainText('Guardar en B');
  });

  test('al recargar el Estudio se mantiene, sin errores de hidratación', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    await goto(page, '/armonia');
    await page.getByTestId('section-picker').selectOption('B');
    await gotoStudioEditing(page);
    await expect(page.getByTestId('form-title')).toContainText('Sección B');
    expect(errors).toEqual([]);
  });

  test('elegir un bloque en el Estudio la cambia', async ({ page }) => {
    await gotoStudioEditing(page);
    await page.getByRole('button', { name: /^Bloque 3: sección B/ }).click();
    await go(page, 'Armonía');
    await expect(page.locator('#save-harmony')).toContainText('Guardar en B');
  });
});

test.describe('lo que dice cada pantalla', () => {
  test('Forma muestra la letra ya escrita', async ({ page }) => {
    await goto(page, '/letras');
    await page.getByTestId('lyric-text').fill('una línea de letra\notra');
    await go(page, 'Forma');
    await expect(page.getByTestId('section-lyric')).toHaveText('una línea de letra');
  });

  test('sortear una sección no promete una melodía propia', async ({ page }) => {
    await goto(page, '/forma');
    await page.locator('#roll-section').click();
    await expect(page.getByTestId('section-melody')).toHaveText('Una para todo el tema, en Melodía');
  });

  test('los grados de acordes propios se miden desde su primer acorde', async ({ page }) => {
    await gotoStudioEditing(page);
    await page.getByRole('button', { name: /^Acordes del bloque 1/ }).click();
    await page.getByTestId('song-chords').fill('E A B');
    await expect(page.locator('[data-panel="acordes"]').getByRole('button', { name: 'Oír A' })).toContainText(
      'IV',
    );
  });

  test('arrastrar un bloque en el Estudio llega a la consigna', async ({ page }) => {
    await gotoStudioEditing(page);
    const from = await page.getByRole('button', { name: /^Bloque 3: sección B/ }).boundingBox();
    const to = await page.getByRole('button', { name: /^Bloque 1: sección A/ }).boundingBox();
    await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
    await page.mouse.down();
    await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 5 });
    await page.mouse.up();
    await go(page, 'Sorteo');
    await expect(page.locator('[data-row="forma"] p').first()).toHaveText('B A A A');
    await expect(page.locator('[data-row="forma"]')).toHaveAttribute('data-locked', 'true');
  });
});

test.describe('secciones desde la consigna', () => {
  const sectionB = (page: Page) =>
    page.evaluate(() => JSON.parse(localStorage.getItem('scordatura-proyecto')!).state.sections.B ?? {});

  test('tocar un bloque de la forma cambia lo que dicen ritmo y armonía, y cambiar sortea solo para él', async ({
    page,
  }) => {
    await goto(page, '/forma?f=AB');
    await openSection(page, 'Sorteo');
    const forma = page.locator('[data-row="forma"]');
    const ritmo = page.locator('[data-row="ritmo"]');
    const armonia = page.locator('[data-row="armonia"]');
    await forma.getByRole('button', { name: /^Bloque 2: sección B/ }).click();
    await expect(ritmo).toHaveAttribute('data-section', 'B');
    await expect(ritmo).toContainText('B: la de la consigna');
    await expect(page.getByRole('textbox', { name: 'Letra de la sección B' })).toBeVisible();
    // Sin acordes propios, la B toca una variación de la consigna: no suena igual que la A.
    await expect(armonia).toContainText('B: variación de la consigna');
    const variation = (await armonia.getByTestId('mini-degrees').textContent())!;

    await page.getByRole('button', { name: 'Cambiar Ritmo solo en la sección B' }).click();
    await expect(ritmo).toContainText('Propio de B');
    expect((await sectionB(page)).rhythm).toBeTruthy();

    await page.getByRole('button', { name: 'Cambiar Armonía solo en la sección B' }).click();
    await expect(armonia).toContainText('Propio de B');
    expect((await sectionB(page)).chords?.length).toBeGreaterThan(1);
    await page.getByRole('button', { name: 'Volver a la armonía de la consigna en la sección B' }).click();
    await expect(armonia).toContainText('B: variación de la consigna');
    await expect(armonia.getByTestId('mini-degrees')).toHaveText(variation);

    // Con toda la canción, las tarjetas vuelven a ser la consigna y B guarda su ritmo.
    await page.getByRole('button', { name: 'Toda la canción' }).click();
    await expect(ritmo).not.toHaveAttribute('data-section');
    await expect(ritmo.getByRole('button', { name: 'Cambiar Ritmo' })).toBeVisible();
    expect((await sectionB(page)).rhythm).toBeTruthy();
  });
});
