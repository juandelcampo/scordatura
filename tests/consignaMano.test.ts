// Lo que se ajusta desde la consigna sin abrir herramientas: acordes trabados y un drone que no choca.
import { describe, expect, it } from 'vitest';
import {
  applyOverride,
  consignaChords,
  consignaKey,
  decodeConsigna,
  encodeConsigna,
  newConsigna,
  rerollAll,
  rerollHarmonyKeeping,
  resolveRows,
  rowIndex,
} from '~/core/consigna';
import { DEFAULT_DRONE, fitToHarmony } from '~/core/drone';
import { describeRhythm } from '~/core/rhythm';

let next = 1;
const seeds = () => (next++ * 2654435761) >>> 0;

describe('acordes trabados uno por uno', () => {
  const base = applyOverride(newConsigna(1, seeds), 'armonia', {
    chords: ['E', 'Am', 'G#m', 'B'],
    tonic: 4,
    mode: 'lydian',
  });

  it('"Cambiar" sortea los demás en la misma tonalidad y deja los trabados', () => {
    for (let i = 0; i < 30; i++) {
      const after = rerollHarmonyKeeping(base, [true, false, false, true], base, seeds);
      const chords = consignaChords(after);
      expect(chords[0]).toBe('E');
      expect(chords[3]).toBe('B');
      expect(chords).toHaveLength(4);
      expect(consignaKey(after)).toEqual({ tonic: 4, mode: 'lydian' });
      // No queda trabada la fila entera: "Nueva consigna" puede volver a sortear lo destrabado.
      expect(after.rows[rowIndex('armonia')]!.locked).toBe(false);
    }
  });

  it('"Nueva consigna" sortea el resto y respeta los acordes trabados', () => {
    const rolled = rerollAll(base, 1, seeds);
    const kept = rerollHarmonyKeeping(base, [false, true, false, false], rolled, seeds);
    expect(consignaChords(kept)[1]).toBe('Am');
    const other = (id: Parameters<typeof rowIndex>[0]) => kept.rows[rowIndex(id)];
    expect(other('ritmo')).toEqual(rolled.rows[rowIndex('ritmo')]);
  });

  it('la regla viaja en el link', () => {
    const after = rerollHarmonyKeeping(base, [true, false, false, false], base, seeds);
    const back = decodeConsigna(encodeConsigna(after))!;
    expect(resolveRows(back)[rowIndex('armonia')]!.rule).toMatch(/Los trabados quedan como estaban/);
  });
});

describe('el drone sorteado no choca con la armonía', () => {
  it('un Mi menor bajo un C#m prestado pasa a raíz y quinta', () => {
    const drone = { ...DEFAULT_DRONE, root: 40, stack: 'menor' as const };
    const fitted = fitToHarmony(drone, { tonic: 4, mode: 'aeolian' }, ['Em', 'Am', 'C#m', 'G']);
    expect(fitted.stack).toBe('quinta');
  });

  it('un sus4 en lidio, donde la 4.ª no es del modo, pasa a raíz y quinta', () => {
    const drone = { ...DEFAULT_DRONE, root: 40, stack: 'sus4' as const };
    expect(fitToHarmony(drone, { tonic: 4, mode: 'lydian' }, ['E', 'G#m']).stack).toBe('quinta');
  });

  it('si el color es del modo y ningún acorde lo altera, queda', () => {
    const drone = { ...DEFAULT_DRONE, root: 36, stack: 'mayor' as const };
    expect(fitToHarmony(drone, { tonic: 0, mode: 'ionian' }, ['C', 'F', 'G', 'Am']).stack).toBe('mayor');
  });

  it('el tritono choca a propósito: no se toca', () => {
    const drone = { ...DEFAULT_DRONE, root: 36, stack: 'tritono' as const };
    expect(fitToHarmony(drone, { tonic: 0, mode: 'ionian' }, ['C', 'F#']).stack).toBe('tritono');
  });
});

it('el cinquillo se nombra con contracción: "del cinquillo"', () => {
  const { rule } = describeRhythm({ mode: 'euclid', pulses: 5, steps: 8, rotation: 0, bpm: 110 });
  expect(rule).toContain('es una rotación del cinquillo');
});
