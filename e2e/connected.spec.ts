// Herramientas conectadas a la consigna, Volver, grados, volumen, batería, barra de abajo y mazo.
import { expect, test, type Page } from '@playwright/test';
import { clicks, countSounds, goto, openSection, plucks, watchErrors } from './fixtures/helpers';

test.use({ viewport: { width: 1280, height: 800 } });

const nav = (page: Page, name: string) => openSection(page, name);
const row = (page: Page, id: string) => page.locator(`[data-row="${id}"]`);
const value = (page: Page, id: string) => row(page, id).locator('p').first();

test.describe('lo que cambiás en una herramienta aparece en la consigna', () => {
  test('afinación: elegirla de la lista la pone y la traba', async ({ page }) => {
    const errors = watchErrors(page);
    await goto(page, '/afinador/estandar');
    await page.locator('[data-id="dadgad"]').click();
    await nav(page, 'Consigna');
    await expect(value(page, 'afinacion')).toHaveText('DADGAD');
    await expect(row(page, 'afinacion')).toHaveAttribute('data-locked', 'true');
    await expect(row(page, 'afinacion').getByText('Tu elección')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('una nueva consigna no pisa tu elección, y Cambiar sí', async ({ page }) => {
    await goto(page, '/afinador/estandar');
    await page.locator('[data-id="dadgad"]').click();
    await nav(page, 'Consigna');
    await page.locator('#roll').click();
    await expect(value(page, 'afinacion')).toHaveText('DADGAD');
    await page.getByRole('button', { name: 'Cambiar Afinación' }).click();
    await expect(row(page, 'afinacion').getByText('Tu elección')).toHaveCount(0);
    await expect(row(page, 'afinacion')).toHaveAttribute('data-locked', 'false');
  });

  test('ritmo: el cambio llega, y si está sonando figura sonando', async ({ page }) => {
    await countSounds(page);
    await goto(page, '/ritmo');
    await page.getByRole('button', { name: 'Euclid.' }).click();
    await page.getByRole('button', { name: 'Subir golpes' }).click();
    await page.locator('#metro-toggle').click();
    await nav(page, 'Consigna');
    await expect(value(page, 'ritmo')).toContainText('E(4,8)');
    await expect(row(page, 'ritmo').getByRole('button', { name: 'Parar el ritmo' })).toBeVisible();
    await row(page, 'ritmo').getByRole('button', { name: 'Parar el ritmo' }).click();
    await expect(row(page, 'ritmo').getByRole('button', { name: 'Oír el ritmo' })).toBeVisible();
  });

  test('drone: el cambio llega, y si está sonando figura sonando', async ({ page }) => {
    await goto(page, '/drone');
    await page.getByTestId('drone-stack').selectOption('menor');
    await page.locator('#drone-toggle').click();
    await nav(page, 'Consigna');
    await expect(value(page, 'drone')).toContainText('Menor');
    await expect(row(page, 'drone').getByRole('button', { name: 'Parar el drone' })).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar el drone' }).click();
  });

  test('armonía: la progresión sorteada llega con sus grados', async ({ page }) => {
    await goto(page, '/armonia');
    await page.locator('#roll-harmony').click();
    await expect(page).toHaveURL(/c=/);
    const chords = (await page.getByRole('heading', { level: 1 }).textContent())!;
    const degrees = (await page.getByTestId('degrees').textContent())!;
    await nav(page, 'Consigna');
    await expect(value(page, 'armonia')).toHaveText(chords);
    await expect(row(page, 'armonia').getByTestId('mini-degrees')).toHaveText(degrees);
  });

  test('forma: arrastrar o agregar bloques llega', async ({ page }) => {
    await goto(page, '/forma?f=AB');
    await page.getByRole('button', { name: 'Agregar sección C' }).click();
    await nav(page, 'Consigna');
    await expect(value(page, 'forma')).toHaveText('A B C');
  });

  test('carta: sacar una llega', async ({ page }) => {
    await goto(page, '/cartas');
    const before = await page.getByTestId('card').textContent();
    await page.locator('#draw').click();
    await expect(page.getByTestId('card')).not.toHaveText(before!);
    const text = (await page.getByTestId('card').locator('p').first().textContent())!;
    await nav(page, 'Consigna');
    await expect(value(page, 'carta')).toContainText(text);
  });

  test('melodía: la línea que armás se oye desde la consigna', async ({ page }) => {
    await countSounds(page);
    await goto(page, '/melodia');
    await page.getByRole('button', { name: 'Ola', exact: true }).click();
    await nav(page, 'Consigna');
    await expect(value(page, 'melodia')).toContainText('Contorno ola');
    await expect(row(page, 'melodia').getByText('La que armaste en Melodía.')).toBeVisible();
    await page.getByRole('button', { name: 'Oír un ejemplo de melodía' }).click();
    await expect.poll(() => plucks(page), { timeout: 3000 }).toBeGreaterThan(5);
  });

  test('letras: la consigna de material llega', async ({ page }) => {
    await goto(page, '/letras');
    await page.getByRole('button', { name: 'Material' }).click();
    await page.locator('#use-material').click();
    await nav(page, 'Consigna');
    await expect(row(page, 'letra').getByText('Tu elección')).toHaveCount(0);
    await expect(value(page, 'letra')).toContainText('Imagen:');
  });

  test('abrir una herramienta sin tocar nada no cambia la consigna', async ({ page }) => {
    await goto(page, '/consigna');
    await expect(page).toHaveURL(/\?t=/);
    const before = new URL(page.url()).searchParams.get('t');
    for (const name of ['Afinador', 'Ritmo', 'Drone', 'Melodía', 'Forma']) await nav(page, name);
    await nav(page, 'Consigna');
    await expect.poll(() => new URL(page.url()).searchParams.get('t')).toBe(before);
  });

  test('sobrevive a recargar, y un link la lleva a otro navegador', async ({ page, context }) => {
    await goto(page, '/afinador/estandar');
    await page.locator('[data-id="dadgad"]').click();
    await page.reload();
    await nav(page, 'Consigna');
    await expect(value(page, 'afinacion')).toHaveText('DADGAD');
    await expect(page).toHaveURL(/\?t=/);
    const url = page.url();

    const other = await context.browser()!.newContext({ viewport: { width: 390, height: 844 } });
    const fresh = await other.newPage();
    await goto(fresh, url);
    await expect(value(fresh, 'afinacion')).toHaveText('DADGAD');
    await other.close();
  });
});

test.describe('volver', () => {
  const snapshot = (page: Page) => page.locator('[data-row] p:first-child').allTextContents();

  test('nueva consigna se puede deshacer y rehacer', async ({ page }) => {
    const errors = watchErrors(page);
    await goto(page, '/consigna');
    await expect(page).toHaveURL(/\?t=/);
    await expect(page.locator('#undo')).toBeDisabled();
    const first = await snapshot(page);
    await page.locator('#roll').click();
    await expect.poll(() => snapshot(page)).not.toEqual(first);
    const second = await snapshot(page);
    await page.locator('#undo').click();
    await expect.poll(() => snapshot(page)).toEqual(first);
    await page.locator('#redo').click();
    await expect.poll(() => snapshot(page)).toEqual(second);
    expect(errors).toEqual([]);
  });

  test('también vuelve de cambiar una fila, de trabar y de lo que llegó de una herramienta', async ({
    page,
  }) => {
    await goto(page, '/consigna');
    await expect(page).toHaveURL(/\?t=/);
    const first = await snapshot(page);
    await page.getByRole('button', { name: 'Cambiar Forma' }).click();
    await page.locator('#undo').click();
    await expect.poll(() => snapshot(page)).toEqual(first);

    await nav(page, 'Afinador');
    await page.locator('[data-id="dadgad"]').click();
    await nav(page, 'Consigna');
    await expect(value(page, 'afinacion')).toHaveText('DADGAD');
    await page.locator('#undo').click();
    await expect.poll(() => snapshot(page)).toEqual(first);
  });

  test('sobrevive a recargar', async ({ page }) => {
    await goto(page, '/consigna');
    await expect(page).toHaveURL(/\?t=/);
    const first = await snapshot(page);
    await page.locator('#roll').click();
    await expect.poll(() => snapshot(page)).not.toEqual(first);
    await page.reload();
    await page.locator('#undo').click();
    await expect.poll(() => snapshot(page)).toEqual(first);
  });

  test('cada herramienta deja volver de un sorteo', async ({ page }) => {
    await goto(page, '/armonia?c=C,Am,F,G');
    await expect(page.locator('#undo-harmony')).toBeDisabled();
    await page.locator('#roll-harmony').click();
    await page.locator('#undo-harmony').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('C – Am – F – G');

    await goto(page, '/ritmo?m=meter&bpm=120&g=2%2B2%2B3&d=8');
    await page.locator('#roll-rhythm').click();
    await page.locator('#undo-rhythm').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('7/8 (2+2+3)');

    await goto(page, '/drone?r=45&s=tritono&t=crudo&b=0.50&m=0.50&d=10');
    await page.locator('#roll-drone').click();
    await page.locator('#undo-drone').click();
    await expect(page.getByTestId('drone-root')).toHaveText('A2');

    await goto(page, '/forma?f=AABCA');
    await page.locator('#roll-form').click();
    await page.locator('#undo-form').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('AABCA');

    await goto(page, '/afinador/dadgad');
    await page.locator('#roll-tuning').click();
    await expect(page).not.toHaveURL(/dadgad$/);
    await page.locator('#undo-tuning').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('DADGAD');
  });
});

test.describe('grados', () => {
  test('se muestran, y cambian con la tónica', async ({ page }) => {
    await goto(page, '/armonia?c=Am,F,C,G');
    await expect(page.getByTestId('degrees')).toHaveText('i – bVI – bIII – bVII');
    await expect(page.getByTestId('degree').first()).toHaveText('i');
    await page.getByTestId('harmony-key').selectOption({ label: 'C' });
    await expect(page.getByTestId('degrees')).toHaveText('vi – IV – I – V');
    await expect(page).toHaveURL(/k=0/);
  });
});

test.describe('volumen', () => {
  const trackGains = async (page: Page) => {
    await page.addInitScript(() => {
      const scope = window as unknown as { __gains: GainNode[] };
      scope.__gains = [];
      const create = AudioContext.prototype.createGain;
      AudioContext.prototype.createGain = function () {
        const node = create.call(this);
        scope.__gains.push(node);
        return node;
      };
    });
  };
  const fader = (page: Page, channel: string) => page.locator(`input[data-channel="${channel}"]`).first();
  const smallest = (page: Page) =>
    page.evaluate(() =>
      Math.min(
        ...(window as unknown as { __gains: GainNode[] }).__gains.slice(0, 5).map((n) => n.gain.value),
      ),
    );

  test('el fader general mueve la ganancia real, y se recuerda', async ({ page }) => {
    await trackGains(page);
    await goto(page, '/afinador/dadgad');
    await page.locator('[data-label="0"]').click();
    await fader(page, 'master').fill('0');
    await expect.poll(() => smallest(page)).toBeLessThan(0.001);
    await fader(page, 'master').fill('100');
    await expect.poll(() => smallest(page)).toBeGreaterThan(0.3);
    await fader(page, 'master').fill('40');
    await page.reload();
    await expect(fader(page, 'master')).toHaveValue('40');
  });

  test('la consigna tiene una mezcla con los cuatro canales', async ({ page }) => {
    await goto(page, '/consigna');
    await page.locator('#mixer-toggle').click();
    const mixer = page.getByTestId('mixer').getByRole('slider');
    await expect(mixer).toHaveCount(4);
  });

  test('ritmo, drone y afinador tienen su fader a mano', async ({ page }) => {
    for (const [route, channel] of [
      ['/ritmo', 'ritmo'],
      ['/drone', 'drone'],
      ['/afinador/dadgad', 'instrumento'],
      ['/armonia', 'instrumento'],
      ['/melodia', 'instrumento'],
    ]) {
      await goto(page, route!);
      await expect(page.getByRole('main').locator(`input[data-channel="${channel}"]`)).toBeVisible();
    }
  });
});

test.describe('sonidos del ritmo y caja de ritmos', () => {
  test.beforeEach(async ({ page }) => {
    await countSounds(page);
  });

  test('el metrónomo cambia de sonido y lo recuerda', async ({ page }) => {
    await goto(page, '/ritmo?m=meter&bpm=240&g=1%2B1%2B1%2B1&d=4');
    await page.getByTestId('click-sound').selectOption('bateria');
    await page.locator('#metro-toggle').click();
    // La batería usa ruido además de osciladores: el clic común no.
    await expect.poll(() => plucks(page), { timeout: 4000 }).toBeGreaterThan(0);
    await page.locator('#metro-toggle').click();
    await page.reload();
    await expect(page.getByTestId('click-sound')).toHaveValue('bateria');
  });

  test('la caja de ritmos suena, y un golpe nuevo entra sin cortar', async ({ page }) => {
    const errors = watchErrors(page);
    await goto(page, '/ritmo');
    await page.getByRole('button', { name: 'Batería' }).click();
    await expect(page.getByTestId('drum-machine')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Batería en 16 pasos');
    await page.locator('#metro-toggle').click();
    await expect.poll(() => clicks(page), { timeout: 4000 }).toBeGreaterThan(2);
    await expect(page.locator('[data-now]').first()).toBeAttached({ timeout: 3000 });

    const step = page.getByRole('button', { name: 'Cencerro, paso 3', exact: true });
    await expect(step).toHaveAttribute('aria-pressed', 'false');
    await step.click();
    await expect(step).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#metro-toggle')).toHaveText('■ Parar');
    await expect(page).toHaveURL(/m=drum/);

    const before = await clicks(page);
    await page.waitForTimeout(1200);
    expect(await clicks(page)).toBeGreaterThan(before);
    await page.locator('#metro-toggle').click();
    expect(errors).toEqual([]);
  });

  test('los patrones y los pasos cambian la grilla, y un link la reproduce', async ({ page }) => {
    await goto(page, '/ritmo');
    await page.getByRole('button', { name: 'Batería' }).click();
    await page.getByTestId('drum-preset').selectOption('siete');
    await expect(page.locator('[data-track="bombo"] [data-step]')).toHaveCount(14);
    await page.getByTestId('drum-steps').selectOption('8');
    await expect(page.locator('[data-track="bombo"] [data-step]')).toHaveCount(8);
    await page.getByRole('button', { name: 'Borrar todos los golpes' }).click();
    await expect(page.locator('[data-step][aria-pressed="true"]')).toHaveCount(0);
    await page.locator('#roll-drums').click();
    await expect(page.locator('[data-step][aria-pressed="true"]').first()).toBeVisible();
    const pressed = await page.locator('[data-step][aria-pressed="true"]').count();
    await expect.poll(() => page.url()).toContain('m=drum');
    const url = page.url();
    await goto(page, url);
    await expect(page.locator('[data-step][aria-pressed="true"]')).toHaveCount(pressed);
  });

  test('cada sonido tiene su volumen', async ({ page }) => {
    await goto(page, '/ritmo');
    await page.getByRole('button', { name: 'Batería' }).click();
    await page.getByLabel('Volumen de Hi-hat').fill('20');
    await expect.poll(() => page.url()).toContain('20');
    await page.reload();
    await expect(page.getByLabel('Volumen de Hi-hat')).toHaveValue('20');
  });

  test('la batería también suena en la consigna', async ({ page }) => {
    await goto(page, '/ritmo');
    await page.getByRole('button', { name: 'Batería' }).click();
    await nav(page, 'Consigna');
    await expect(value(page, 'ritmo')).toContainText('Batería');
    const before = await clicks(page);
    await row(page, 'ritmo').getByRole('button', { name: 'Oír el ritmo' }).click();
    await expect.poll(() => clicks(page), { timeout: 4000 }).toBeGreaterThan(before);
  });
});

test.describe('barra de abajo', () => {
  test('parar no la cierra: se puede volver a tocar, y la X la saca', async ({ page }) => {
    await countSounds(page);
    await goto(page, '/ritmo?m=meter&bpm=240&g=1%2B1%2B1%2B1&d=4');
    await expect(page.getByTestId('dock-ritmo')).toHaveCount(0);
    await page.locator('#metro-toggle').click();
    const dock = page.getByTestId('dock-ritmo');
    await expect(dock).toHaveAttribute('data-running', 'true');

    await nav(page, 'Cartas');
    await dock.getByRole('button', { name: 'Parar el ritmo' }).click();
    await expect(dock).toBeVisible();
    await expect(dock).toHaveAttribute('data-running', 'false');
    await page.waitForTimeout(300);
    const stopped = await clicks(page);
    await page.waitForTimeout(500);
    expect(await clicks(page)).toBe(stopped);

    await dock.getByRole('button', { name: 'Tocar el ritmo' }).click();
    await expect(dock).toHaveAttribute('data-running', 'true');
    await expect.poll(() => clicks(page), { timeout: 3000 }).toBeGreaterThan(stopped);

    await dock.getByRole('button', { name: 'Cerrar el ritmo' }).click();
    await expect(dock).toHaveCount(0);
    await page.waitForTimeout(300);
    const closed = await clicks(page);
    await page.waitForTimeout(500);
    expect(await clicks(page)).toBe(closed);
  });

  test('el drone hace lo mismo, y conviven los dos con su fader', async ({ page }) => {
    await goto(page, '/drone');
    await page.locator('#drone-toggle').click();
    await nav(page, 'Ritmo');
    await page.locator('#metro-toggle').click();
    const drone = page.getByTestId('dock-drone');
    const ritmo = page.getByTestId('dock-ritmo');
    await expect(drone).toBeVisible();
    await expect(ritmo).toBeVisible();
    await expect(drone.getByRole('slider')).toBeVisible();
    await expect(ritmo.getByRole('slider')).toBeVisible();
    await drone.getByRole('button', { name: 'Parar el drone' }).click();
    await expect(drone).toHaveAttribute('data-running', 'false');
    await drone.getByRole('button', { name: 'Sostener el drone' }).click();
    await expect(drone).toHaveAttribute('data-running', 'true');
    await drone.getByRole('button', { name: 'Cerrar el drone' }).click();
    await expect(drone).toHaveCount(0);
    await expect(ritmo).toBeVisible();
    await ritmo.getByRole('button', { name: 'Cerrar el ritmo' }).click();
  });

  test('no tapa el botón de nueva consigna', async ({ page }) => {
    await goto(page, '/consigna');
    await row(page, 'drone').getByRole('button', { name: 'Sostener el drone' }).click();
    await row(page, 'ritmo').getByRole('button', { name: 'Oír el ritmo' }).click();
    await expect(page.getByTestId('dock-ritmo')).toBeVisible();
    const before = await page.locator('[data-row="carta"] p').first().textContent();
    // Si algo lo tapara, Playwright no podría hacer el clic.
    await page.locator('#roll').click({ timeout: 3000 });
    await expect(page.locator('[data-row="carta"] p').first()).not.toHaveText(before!);
    const [rollBox, dockBox] = await Promise.all([
      page.locator('#roll').boundingBox(),
      page.getByTestId('dock-ritmo').boundingBox(),
    ]);
    expect(rollBox!.y + rollBox!.height).toBeLessThanOrEqual(dockBox!.y + 1);
  });
});

test.describe('mazo de cartas', () => {
  test('recorre todo sin repetir, y después vuelve a mezclar', async ({ page }) => {
    const errors = watchErrors(page);
    await goto(page, '/cartas');
    const card = page.getByTestId('card');
    const text = async () => (await card.locator('p').first().textContent())!;
    await expect(page.getByTestId('deck-count')).toHaveText(/Carta 1 de (\d+)/);
    const total = Number(/de (\d+) de este/.exec((await page.getByTestId('deck-count').textContent())!)![1]);
    expect(total).toBeGreaterThanOrEqual(24);

    const seen = new Set<string>([await text()]);
    for (let i = 1; i < total; i++) {
      const previous = await text();
      await page.locator('#draw').click();
      await expect(card.locator('p').first()).not.toHaveText(previous);
      const current = await text();
      expect(seen.has(current), current).toBe(false);
      seen.add(current);
    }
    expect(seen.size).toBe(total);
    await expect(page.getByTestId('deck-count')).toContainText(`Carta ${total} de ${total}`);
    await page.locator('#draw').click();
    await expect(page.getByTestId('deck-count')).toContainText(`Carta 1 de ${total}`);
    expect(errors).toEqual([]);
  });

  test('anterior vuelve a la carta de antes, y el recorrido sobrevive a recargar', async ({ page }) => {
    await goto(page, '/cartas');
    const card = page.getByTestId('card').locator('p').first();
    await expect(page.locator('#previous-card')).toBeDisabled();
    const first = (await card.textContent())!;
    await page.locator('#draw').click();
    await expect(card).not.toHaveText(first);
    await page.locator('#previous-card').click();
    await expect(card).toHaveText(first);
    await page.locator('#draw').click();
    await page.reload();
    await expect(page.getByTestId('deck-count')).toContainText('Carta 2 de');
  });
});

test.describe('palabras', () => {
  test('ya no aparece "Tirar" en ninguna pantalla', async ({ page }) => {
    for (const route of [
      '/',
      '/consigna',
      '/afinador/dadgad',
      '/ritmo',
      '/drone',
      '/armonia',
      '/melodia',
      '/letras',
      '/forma',
    ]) {
      await goto(page, route);
      await expect(page.getByRole('button', { name: /^Tirar/ })).toHaveCount(0);
    }
  });
});
