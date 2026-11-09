// Consigna con elecciones propias, grados, caja de ritmos y mazo sin repeticiones.
import { describe, expect, it } from 'vitest';
import { degreeOf } from '~/core/chords';
import {
  applyOverride,
  consignaNumber,
  decodeConsigna,
  encodeConsigna,
  handFormRule,
  newConsigna,
  rerollAll,
  rerollRow,
  resolveRow,
  rowIndex,
} from '~/core/consigna';
import { nextCard, previousCard, type DeckState } from '~/core/deck';
import { rollProgression } from '~/core/harmony';
import {
  cycleFor,
  describeRhythm,
  DRUMS,
  drumConfig,
  randomDrumPattern,
  rhythmFromParams,
  rhythmToParams,
} from '~/core/rhythm';
import { createRng } from '~/core/rng';
import { CARDS } from '~/data/cards';
import { DRUM_PRESETS } from '~/data/drums';

const counter = (start = 1) => {
  let value = start;
  return () => value++;
};

describe('grados', () => {
  it('nombra los grados contra la escala mayor', () => {
    expect(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'].map((chord) => degreeOf(chord, 0))).toEqual([
      'I',
      'ii',
      'iii',
      'IV',
      'V',
      'vi',
      'vii°',
    ]);
    expect(['Am', 'F', 'C', 'G'].map((chord) => degreeOf(chord, 9))).toEqual(['i', 'bVI', 'bIII', 'bVII']);
  });

  it('conserva séptimas y suspendidos', () => {
    expect(degreeOf('G7', 0)).toBe('V7');
    expect(degreeOf('Am7', 0)).toBe('vi7');
    expect(degreeOf('Fmaj7', 0)).toBe('IVmaj7');
    expect(degreeOf('Dsus2', 0)).toBe('IIsus2');
    expect(degreeOf('Cualquiera', 0)).toBeNull();
  });

  it('el generador avisa su tónica, y el primer acorde diatónico es el grado uno', () => {
    for (let seed = 0; seed < 100; seed++) {
      const progression = rollProgression(['ionian', 'aeolian'], 0, createRng(seed));
      expect(degreeOf(progression.chords[0]!, progression.tonic)?.toLowerCase()).toBe('i');
    }
  });
});

describe('consigna con elecciones propias', () => {
  const tuning = { notes: ['D2', 'A2', 'D3', 'G3', 'A3', 'D4'], name: 'DADGAD', href: '/afinador/dadgad' };

  it('lo elegido reemplaza al sorteo y queda trabado', () => {
    const consigna = applyOverride(newConsigna(1, counter()), 'afinacion', tuning);
    const index = rowIndex('afinacion');
    expect(consigna.rows[index]!.locked).toBe(true);
    const row = resolveRow(index, consigna.rows[index]!);
    expect(row.label).toBe('DADGAD');
    expect(row.rule).not.toContain('Elegida por vos');
    expect(row.rule).toContain('Dsus4');
    expect(row.href).toBe('/afinador/dadgad');
  });

  it('una nueva consigna no pisa lo elegido, y cambiar la fila sí', () => {
    const consigna = applyOverride(newConsigna(1, counter()), 'afinacion', tuning);
    const index = rowIndex('afinacion');
    expect(rerollAll(consigna, 2, counter(99)).rows[index]!.override).toEqual(tuning);
    const changed = rerollRow(consigna, index, counter(99)).rows[index]!;
    expect(changed.override).toBeUndefined();
    expect(changed.locked).toBe(false);
  });

  it('sortear siempre da algo distinto en lo que no está trabado', () => {
    for (let round = 0; round < 40; round++) {
      const consigna = newConsigna(0, counter(round * 100));
      const labels = (value: typeof consigna) => value.rows.map((row, index) => resolveRow(index, row).label);
      const before = labels(consigna);
      const next = rerollAll(consigna);
      labels(next).forEach((label, index) => expect(label).not.toBe(before[index]));
      for (let index = 0; index < consigna.rows.length; index++) {
        expect(resolveRow(index, rerollRow(consigna, index).rows[index]!).label).not.toBe(before[index]);
      }
    }
  });

  it('sobrevive a ida y vuelta por el link, en todas las filas y con acentos', () => {
    let consigna = newConsigna(1, counter());
    consigna = applyOverride(consigna, 'afinacion', tuning);
    consigna = applyOverride(consigna, 'ritmo', { mode: 'meter', groups: [2, 2, 3], denom: 8, bpm: 150 });
    consigna = applyOverride(consigna, 'armonia', { chords: ['Am', 'F'], tonic: 9 });
    consigna = applyOverride(consigna, 'melodia', {
      label: 'Línea',
      rule: 'Una regla',
      notes: [{ midi: 60, start: 0, dur: 1 }],
    });
    consigna = applyOverride(consigna, 'letra', { label: 'Canción sin ñandú', rule: 'Acentuación' });
    consigna = applyOverride(consigna, 'forma', { blocks: ['A', 'B'] });
    consigna = applyOverride(consigna, 'carta', { id: 13, text: CARDS[12]!.text, breaks: CARDS[12]!.breaks });
    consigna = applyOverride(consigna, 'drone', {
      root: 40,
      stack: 'quinta',
      timbre: 'crudo',
      brightness: 0.5,
      motion: 0.25,
      detune: 3,
    });
    const code = encodeConsigna(consigna);
    expect(code).not.toMatch(/[+/=]/);
    const decoded = decodeConsigna(code)!;
    expect(decoded).toEqual(consigna);
    expect(consignaNumber(decoded)).toBe(consignaNumber(consigna));
  });

  it('la forma elegida conserva su regla y sus nombres, y la armada a mano se describe sola', () => {
    const base = newConsigna(1, counter());
    const index = rowIndex('forma');
    const chosen = applyOverride(base, 'forma', {
      blocks: ['A', 'B', 'A'],
      rule: 'Estrofa y estribillo. Probala corta.',
      names: { A: 'Estrofa', B: 'Estribillo' },
    });
    const decoded = decodeConsigna(encodeConsigna(chosen))!;
    expect(decoded).toEqual(chosen);
    expect(resolveRow(index, decoded.rows[index]!).rule).toBe('Estrofa y estribillo. Probala corta.');

    const byHand = applyOverride(base, 'forma', { blocks: ['A', 'B', 'A', 'C'] });
    expect(resolveRow(index, byHand.rows[index]!).rule).toBe(handFormRule(['A', 'B', 'A', 'C']));
    expect(handFormRule(['A', 'B', 'A', 'C'])).toBe('Armada a mano: 3 secciones en 4 bloques; vuelve A.');
    expect(handFormRule(['A', 'B', 'A', 'B', 'C'])).toBe(
      'Armada a mano: 3 secciones en 5 bloques; vuelven A y B.',
    );
    expect(handFormRule(['A'])).toBe('Armada a mano: 1 sección en 1 bloque; nada vuelve.');
  });

  it('de un link de forma solo entran nombres de letras válidas', () => {
    const b64 = (value: unknown) =>
      btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
    const rows = 'a.b.c.d.e.f.g.h'.split('.');
    rows[rowIndex('forma')] += `!@${b64({ blocks: ['A', 'B'], names: { A: ' Estrofa ', Z: 'x', B: 3 } })}`;
    const decoded = decodeConsigna(['1', ...rows].join('.'))!;
    expect(decoded.rows[rowIndex('forma')]!.override).toEqual({
      blocks: ['A', 'B'],
      names: { A: 'Estrofa' },
    });
  });

  it('el número cambia cuando cambia lo elegido', () => {
    const base = newConsigna(1, counter());
    expect(consignaNumber(applyOverride(base, 'forma', { blocks: ['A'] }))).not.toBe(consignaNumber(base));
  });

  it('un link adulterado no entra: se descarta lo elegido, no la consigna', () => {
    const b64 = (value: unknown) =>
      btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
    const seeds = 'a.b.c.d.e.f.g.h'.split('.');
    const withRow = (index: number, value: unknown) => {
      const rows = [...seeds];
      rows[index] = `${rows[index]}!@${b64(value)}`;
      return `1.${rows.join('.')}`;
    };
    const cases: Array<[number, unknown]> = [
      [0, { notes: ['Q9'] }],
      [0, { notes: [1, 2, 3, 4, 5, 6] }],
      [1, { mode: 'marte', bpm: 100 }],
      [1, { mode: 'meter', groups: [99], denom: 8, bpm: 100 }],
      [2, { chords: ['<script>'] }],
      [5, { blocks: ['Z'] }],
      [7, { root: 999, stack: 'marte' }],
    ];
    for (const [index, value] of cases) {
      const decoded = decodeConsigna(withRow(index, value));
      expect(decoded, JSON.stringify(value)).not.toBeNull();
      expect(decoded!.rows[index]!.override, JSON.stringify(value)).toBeUndefined();
    }
    expect(
      decodeConsigna(`1.${seeds.map((seed, i) => (i === 0 ? `${seed}@%%%` : seed)).join('.')}`),
    ).not.toBeNull();
  });

  it('un href de afinación ajeno no se acepta', () => {
    const b64 = btoa(JSON.stringify({ notes: tuning.notes, href: 'https://malo.example' }));
    const decoded = decodeConsigna(`1.a@${b64.replaceAll('=', '')}.b.c.d.e.f.g.h`)!;
    expect(decoded.rows[0]!.override).toEqual({ notes: tuning.notes });
  });

  it('las cartas conocidas se leen del mazo, no del link', () => {
    const b64 = btoa(JSON.stringify({ id: 1, text: 'Texto falso', breaks: 'nada' })).replaceAll('=', '');
    const decoded = decodeConsigna(`1.a.b.c.d.e.f.g@${b64}.h`)!;
    expect(decoded.rows[rowIndex('carta')]!.override).toMatchObject({ id: 1, text: CARDS[0]!.text });
  });
});

describe('caja de ritmos', () => {
  const config = drumConfig(120, { bombo: 'x...x...', caja: '..x...x.' });

  it('arma un carril por sonido, y un carril mudo que marca el paso', () => {
    const cycle = cycleFor(config, 0);
    expect(cycle.lanes).toEqual(DRUMS.map(() => 8));
    expect(cycle.beats).toBe(2);
    expect(cycle.hits.filter((hit) => hit.lane === -1)).toHaveLength(8);
    expect(cycle.hits.filter((hit) => hit.lane === -1).every((hit) => !hit.voice)).toBe(true);
    expect(cycle.hits.filter((hit) => hit.voice === 'bombo').map((hit) => hit.cell)).toEqual([0, 4]);
    expect(cycle.hits.filter((hit) => hit.voice === 'caja').map((hit) => hit.cell)).toEqual([2, 6]);
  });

  it('un sonido en cero no suena', () => {
    const silent = { ...config, levels: config.levels.map((level, lane) => (lane === 0 ? 0 : level)) };
    expect(cycleFor(silent, 0).hits.some((hit) => hit.voice === 'bombo')).toBe(false);
  });

  it('sobrevive a ida y vuelta por la URL, con su volumen', () => {
    const custom = { ...config, levels: config.levels.map((_, lane) => lane / 10) };
    expect(rhythmFromParams(rhythmToParams(custom))).toEqual(custom);
  });

  it('rechaza patrones inválidos', () => {
    for (const text of [
      'm=drum&bpm=100&n=8',
      'm=drum&bpm=100&n=8&p=1_1',
      'm=drum&bpm=100&n=4&p=2222_0000_0000_0000_0000_0000',
    ]) {
      expect(rhythmFromParams(new URLSearchParams(text)), text).toBeNull();
    }
  });

  it('explica qué suena', () => {
    expect(describeRhythm(config).rule).toContain('bombo, caja');
    expect(describeRhythm(config).name).toBe('Batería en 8 pasos');
  });

  it('el patrón sorteado respeta los pasos y crece con el riesgo', () => {
    const hitsAt = (risk: 0 | 1 | 2) =>
      randomDrumPattern(createRng(risk + 3).next, risk, 100, 16).tracks.filter((track) => track.some(Boolean))
        .length;
    expect(hitsAt(2)).toBeGreaterThanOrEqual(hitsAt(0));
    for (const track of randomDrumPattern(createRng(1).next, 1, 100, 14).tracks)
      expect(track).toHaveLength(14);
  });

  it('los patrones de partida están bien escritos', () => {
    for (const preset of DRUM_PRESETS) {
      expect(preset.config.mode).toBe('drum');
      if (preset.config.mode === 'drum') {
        for (const track of preset.config.tracks) expect(track, preset.id).toHaveLength(preset.config.steps);
      }
    }
  });
});

describe('mazo sin repeticiones', () => {
  const keys = Array.from({ length: 12 }, (_, i) => String(i));
  const pull = (state: DeckState | undefined, list: string[], seed: number) =>
    nextCard(state, list, createRng(seed));

  it('no repite hasta dar toda la vuelta', () => {
    let state: DeckState | undefined;
    for (let round = 0; round < 5; round++) {
      const seen = new Set<string>();
      for (let i = 0; i < keys.length; i++) {
        state = pull(state, keys, round * 100 + i);
        seen.add(state.order[state.position]!);
      }
      expect(seen.size).toBe(keys.length);
    }
  });

  it('al volver a mezclar no empieza por la última carta', () => {
    let state: DeckState | undefined;
    for (let i = 0; i < 400; i++) {
      const before = state ? state.order[state.position] : undefined;
      state = pull(state, keys, i);
      expect(state.order[state.position]).not.toBe(before);
    }
  });

  it('una carta nueva entra en lo que falta ver, y una borrada desaparece', () => {
    let state = pull(undefined, keys, 1);
    state = pull(state, keys, 2);
    const seen = state.order.slice(0, state.position + 1);
    const withNew = [...keys.filter((key) => key !== seen[0]), 'nueva'];
    const seenNow = new Set<string>(seen.slice(1));
    for (let i = 0; i < withNew.length - seen.length + 1; i++) {
      state = pull(state, withNew, i);
      const key = state.order[state.position]!;
      expect(seenNow.has(key)).toBe(false);
      seenNow.add(key);
    }
    expect(seenNow.has('nueva')).toBe(true);
    expect(seenNow.has(seen[0]!)).toBe(false);
  });

  it('se puede volver atrás sin pasarse del principio', () => {
    let state = pull(undefined, keys, 1);
    state = pull(state, keys, 2);
    const first = state.order[0];
    state = previousCard(state);
    expect(state.order[state.position]).toBe(first);
    expect(previousCard(state).position).toBe(0);
  });

  it('un mazo con una sola carta no se rompe, y uno vacío tampoco', () => {
    let state = pull(undefined, ['a'], 1);
    state = pull(state, ['a'], 2);
    expect(state.order[state.position]).toBe('a');
    expect(pull(undefined, [], 1).position).toBe(-1);
  });

  it('hay más del doble de cartas, sin textos repetidos', () => {
    expect(CARDS.length).toBeGreaterThanOrEqual(72);
    expect(new Set(CARDS.map((card) => card.text)).size).toBe(CARDS.length);
    expect(new Set(CARDS.map((card) => card.id)).size).toBe(CARDS.length);
  });
});

describe('duración de los acordes en la consigna', () => {
  const seed = (() => {
    let value = 1;
    return () => value++;
  })();

  it('viaja por el link y aparece en el camino a Armonía', () => {
    const consigna = applyOverride(newConsigna(1, seed), 'armonia', {
      chords: ['Am', 'F'],
      tonic: 9,
      beats: [6, 2],
    });
    const decoded = decodeConsigna(encodeConsigna(consigna))!;
    const index = rowIndex('armonia');
    expect(decoded.rows[index]!.override).toMatchObject({ beats: [6, 2] });
    expect(resolveRow(index, decoded.rows[index]!).href).toContain('d=6,2');
  });

  it('una duración que no coincide se descarta, y los acordes quedan', () => {
    const consigna = applyOverride(newConsigna(1, seed), 'armonia', {
      chords: ['Am', 'F'],
      beats: [6],
    });
    const override = decodeConsigna(encodeConsigna(consigna))!.rows[rowIndex('armonia')]!.override;
    expect(override).toEqual({ chords: ['Am', 'F'] });
  });
});
