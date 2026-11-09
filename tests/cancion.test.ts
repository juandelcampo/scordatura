// Que la canción se arme sola con sentido: la afinación en el tono y secciones que no suenan igual.
import { describe, expect, it } from 'vitest';
import {
  applyOverride,
  consignaKey,
  newConsigna,
  openStringsFit,
  rerollAll,
  rerollRow,
  resolveRows,
  rowIndex,
  toggleLock,
  type Consigna,
  type RowOverrides,
} from '~/core/consigna';
import { sectionHarmony } from '~/core/sections';
import { buildSong } from '~/core/song';
import type { Risk } from '~/core/roll';

let next = 7;
const seeds = () => (next++ * 2654435761) >>> 0;
const tuningOf = (consigna: Consigna) =>
  (resolveRows(consigna)[rowIndex('afinacion')]!.value as RowOverrides['afinacion']).notes;
const fits = (consigna: Consigna) => openStringsFit(tuningOf(consigna), consignaKey(consigna));

describe('la afinación y el tono', () => {
  const rate = (risk: Risk) => {
    let ok = 0;
    let consigna = newConsigna(risk, seeds);
    for (let i = 0; i < 200; i++) {
      consigna = rerollAll(consigna, risk, seeds);
      if (fits(consigna)) ok++;
    }
    return ok / 200;
  };

  it('en seguro y medio, casi siempre las cuerdas al aire caen en el tono', () => {
    expect(rate(0)).toBeGreaterThan(0.9);
    expect(rate(1)).toBeGreaterThan(0.85);
  });

  it('con la armonía trabada, se busca una afinación que le quede', () => {
    let ok = 0;
    for (let i = 0; i < 100; i++) {
      const base = newConsigna(1, seeds);
      const locked = toggleLock(base, rowIndex('armonia'));
      const after = rerollAll(locked, 1, seeds);
      expect(consignaKey(after)).toEqual(consignaKey(base));
      if (fits(after)) ok++;
    }
    expect(ok).toBeGreaterThan(60);
  });

  it('cambiar solo la armonía también busca encajar', () => {
    let ok = 0;
    let consigna = newConsigna(0, seeds);
    for (let i = 0; i < 100; i++) {
      consigna = rerollRow(consigna, rowIndex('armonia'), seeds);
      if (fits(consigna)) ok++;
    }
    expect(ok).toBeGreaterThan(90);
  });

  it('la regla lo dice cuando encaja', () => {
    const consigna = newConsigna(0, seeds);
    const rule = resolveRows(consigna)[rowIndex('armonia')]!.rule;
    expect(fits(consigna) ? rule : 'Las cuerdas al aire quedan dentro del tono').toContain(
      'Las cuerdas al aire quedan dentro del tono',
    );
  });
});

describe('cada sección suena distinto', () => {
  const base = { chords: ['Am', 'F', 'C', 'G'], tonic: 9, mode: 'aeolian' as const };

  it('la A toca la consigna; la B la misma progresión desde la mitad; la C un contraste', () => {
    const blocks = ['A', 'B', 'A', 'B', 'C', 'B'];
    expect(sectionHarmony('A', blocks, base)).toEqual({ chords: base.chords, how: '' });
    expect(sectionHarmony('B', blocks, base).chords).toEqual(['C', 'G', 'Am', 'F']);
    const c = sectionHarmony('C', blocks, base);
    expect(c.chords).toEqual(['F', 'Dm', 'G', 'Em']);
    expect(c.how).toMatch(/Contraste en el mismo tono/);
  });

  it('sin A, la primera sección de la forma es la que toca la consigna', () => {
    expect(sectionHarmony('B', ['B', 'C'], base).how).toBe('');
    expect(sectionHarmony('C', ['B', 'C'], base).chords).not.toEqual(base.chords);
  });

  it('ninguna sección repite la progresión de otra, ni con muchas secciones', () => {
    const blocks = ['A', 'B', 'C', 'D', 'E'];
    const all = blocks.map((letter) => sectionHarmony(letter, blocks, base).chords.join());
    expect(new Set(all).size).toBe(blocks.length);
  });

  it('nunca da un acorde disminuido en el contraste', () => {
    for (const mode of ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian'] as const) {
      for (let tonic = 0; tonic < 12; tonic++) {
        const c = sectionHarmony('C', ['A', 'B', 'C'], { chords: ['X', 'Y', 'Z', 'W'], tonic, mode });
        expect(c.chords.some((name) => name.includes('dim'))).toBe(false);
      }
    }
  });

  it('el Estudio toca la variación, y lo propio de una sección sigue mandando', () => {
    const rhythm = { mode: 'meter' as const, groups: [1, 1, 1, 1], denom: 4 as const, bpm: 100 };
    const song = buildSong({
      blocks: ['A', 'B', 'C'],
      sections: { C: { chords: ['E7'] } },
      fallback: { chords: base.chords, rhythm },
      derive: (letter) => sectionHarmony(letter, ['A', 'B', 'C'], base),
      tuning: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
      melody: [],
      melodyChosen: false,
      drone: { root: 45, stack: 'quinta', timbre: 'calido', brightness: 0.4, motion: 0.3, detune: 6 },
      tempo: null,
      mix: {},
      a4: 440,
    });
    const names = song.blocks.map((block) => block.changes.map((change) => change.name).join(' '));
    expect(names).toEqual(['Am F C G', 'C G Am F', 'E7 E7 E7 E7']);
  });
});

it('una armonía elegida a mano no se toca al sortear', () => {
  const chosen = applyOverride(newConsigna(1, seeds), 'armonia', { chords: ['D', 'G'] });
  expect(consignaKey(rerollAll(chosen, 1, seeds)).tonic).toBe(2);
});

it('en frigio, donde la v es disminuida, el contraste vuelve por la bvii', () => {
  const c = sectionHarmony('C', ['A', 'B', 'C'], {
    chords: ['Am', 'Gm', 'D7', 'Gm'],
    tonic: 9,
    mode: 'phrygian',
  });
  expect(c.chords).toEqual(['F', 'Dm', 'Bb', 'Gm']);
  expect(c.how).toMatch(/vuelve por el bvii\.$/);
  expect(new Set(c.chords).size).toBe(4);
});
