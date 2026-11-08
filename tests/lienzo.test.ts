import { describe, expect, it } from 'vitest';
import {
  applyHR,
  barsOf,
  borrowedDegrees,
  checkHarmony,
  chordOf,
  cycleLen,
  degName,
  harmonicRhythmRead,
  keyFor,
  makeHarmony,
  progLen,
  recipes,
  refToMine,
  roleOf,
  segsOf,
  story,
  tensionOf,
} from '~/core/lienzo/harmony';
import { fromLegacy } from '~/core/lienzo/legacy';
import { checkLyric, mirrors, stability, syllables } from '~/core/lienzo/lyrics';
import { checkMelody, degMidi, degPc, genMel, melSlots } from '~/core/lienzo/melody';
import {
  barsToSeconds,
  clipOf,
  formatTime,
  newProject,
  sanitizeProject,
  totalBars,
} from '~/core/lienzo/project';
import {
  checkRhythm,
  counterpart,
  drumFromGroups,
  makeRhythm,
  meterEighths,
  quartersPerBar,
  rBar,
} from '~/core/lienzo/rhythm';
import type { Chord, Key, Section } from '~/core/lienzo/types';
import type { Meter } from '~/core/rhythm';
import type { Risk } from '~/core/roll';
import { createRng } from '~/core/rng';
import { useLienzo } from '~/shared/lienzo';

const D_MINOR: Key = { tonic: 2, mode: 'aeolian' };
const SEVEN_EIGHT: Meter = { groups: [2, 2, 3], denom: 8 };
const names = (chords: Chord[], key: Key) => chords.map((c) => chordOf(c, key).name);
const RADIO: Chord[] = [{ d: 0, len: 2 }, { d: 5 }, { d: 2, len: 0.5 }, { d: 6, len: 0.5 }];
const VERSE =
  'Tengo la mesa servida\npara la gente que vuelve\ny nadie toca la puerta\nporque ya nadie la mueve';

describe('armonía del lienzo', () => {
  it('nombra la familia de re menor con sus grados', () => {
    const family = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ d }));
    expect(names(family, D_MINOR)).toEqual(['Dm', 'Edim', 'F', 'Gm', 'Am', 'Bb', 'C']);
    expect(family.map((c) => degName(c, D_MINOR))).toEqual(['i', 'ii°', '♭III', 'iv', 'v', '♭VI', '♭VII']);
  });

  it('presta del modo paralelo y deja afuera al disminuido', () => {
    expect(chordOf({ d: 2, b: true }, D_MINOR).name).toBe('F#m');
    expect(degName({ d: 0, b: true }, D_MINOR)).toBe('I');
    expect(borrowedDegrees(D_MINOR)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(borrowedDegrees({ tonic: 0, mode: 'ionian' })).toEqual([0, 2, 3, 4, 5, 6]);
  });

  it('escribe bien los acordes de afuera', () => {
    expect(chordOf({ r: 1 }, D_MINOR).name).toBe('Eb');
    expect(chordOf({ r: 4 }, D_MINOR).name).toBe('F#');
    expect(degName({ r: 4 }, D_MINOR)).toBe('III');
    expect(degName({ r: 0, q: '5' }, D_MINOR)).toBe('I');
  });

  it('cambiar la tónica transporta todo', () => {
    expect(names(RADIO, D_MINOR)).toEqual(['Dm', 'Bb', 'F', 'C']);
    expect(names(RADIO, { tonic: 4, mode: 'aeolian' })).toEqual(['Em', 'C', 'G', 'D']);
    expect(RADIO.map((c) => degName(c, { tonic: 4, mode: 'aeolian' }))).toEqual(['i', '♭VI', '♭III', '♭VII']);
  });

  it('una progresión con duraciones llena bien 8 compases', () => {
    const segs = segsOf(RADIO, 8);
    expect(segs.map((s) => [s.t, s.len])).toEqual([
      [0, 2],
      [2, 1],
      [3, 0.5],
      [3.5, 0.5],
      [4, 2],
      [6, 1],
      [7, 0.5],
      [7.5, 0.5],
    ]);
    expect(names(barsOf(RADIO, 8), D_MINOR)).toEqual(['Dm', 'Dm', 'Bb', 'F', 'Dm', 'Dm', 'Bb', 'F']);
    expect(progLen(RADIO)).toBe(4);
    expect(harmonicRhythmRead(RADIO, 8)).toBe('Vuelta de 4 c. · entra 2x · lo largo pesa, lo corto empuja');
  });

  it('corta el último acorde donde termina la sección', () => {
    expect(segsOf([{ d: 0, len: 3 }], 4).map((s) => s.len)).toEqual([3, 1]);
    expect(harmonicRhythmRead([{ d: 0, len: 3 }], 4)).toBe('Vuelta de 3 c. · queda cortada');
  });

  it('aplica los presets de ritmo armónico y cicla las fichas', () => {
    const four = [0, 3, 4, 0].map((d) => ({ d }));
    expect(applyHR(four, 'acelera').map((c) => c.len)).toEqual([1, 1, 0.5, 0.5]);
    expect(applyHR(four, 'largo-corto').map((c) => c.len)).toEqual([1.5, 0.5, 1.5, 0.5]);
    expect([0.5, 1, 2, 4].map((len) => cycleLen({ d: 0, len }).len)).toEqual([1, 2, 4, 0.5]);
  });

  it('dice la función en palabras y su tensión', () => {
    expect(roleOf({ d: 6 }, D_MINOR)).toBe('empuja');
    expect(roleOf({ d: 4 }, { tonic: 0, mode: 'ionian' })).toBe('pide volver');
    expect(roleOf({ d: 3, b: true }, D_MINOR)).toBe('prestado');
    expect(tensionOf({ d: 0 }, D_MINOR)).toBe(0);
    expect(story(RADIO, D_MINOR)).toBe(
      'Arranca en casa, se abre, se ilumina, empuja. Termina empujando a la sección que sigue.',
    );
  });

  it('arma las recetas desde la tónica', () => {
    const steps = recipes(D_MINOR).find((r) => r.name === 'Baja por escalones')!;
    expect(names(steps.chords, D_MINOR)).toEqual(['Dm', 'C', 'Bb', 'Am']);
    const borrowed = recipes({ tonic: 0, mode: 'ionian' }).find(
      (r) => r.name === 'Prestado antes de volver',
    )!;
    expect(names(borrowed.chords, { tonic: 0, mode: 'ionian' })).toEqual(['C', 'F', 'Fm', 'C']);
  });

  it('sortea respetando la regla de la consigna', () => {
    for (let seed = 1; seed < 60; seed++) {
      const risk = (seed % 3) as Risk;
      const noV = makeHarmony(D_MINOR, 'sin-v', risk, createRng(seed));
      expect(checkHarmony(noV, 'sin-v', D_MINOR)!.ok).toBe(true);
      const modal = makeHarmony(D_MINOR, 'intercambio', risk, createRng(seed));
      expect(checkHarmony(modal, 'intercambio', D_MINOR)!.ok).toBe(true);
      expect(makeHarmony(D_MINOR, 'un-acorde', risk, createRng(seed))).toHaveLength(1);
    }
  });

  it('pasa una referencia a tu tonalidad', () => {
    const creep = (
      [
        [0, 'M'],
        [4, 'M'],
        [5, 'M'],
        [5, 'm'],
      ] as const
    ).map(([r, q]) => refToMine(r, q, 1, D_MINOR));
    expect(names(creep, D_MINOR)).toEqual(['D', 'F#', 'G', 'Gm']);
    expect(creep).toEqual([{ d: 0, b: true }, { r: 4, q: 'M' }, { d: 3, b: true }, { d: 3 }]);
  });

  it('las repeticiones son espejo salvo en la letra', () => {
    const copy = { id: 'a2', of: 'a1' };
    expect(keyFor('armonia', copy)).toBe('armonia:a1');
    expect(keyFor('ritmo', copy)).toBe('ritmo:a1');
    expect(keyFor('letra', copy)).toBe('letra:a2');
  });
});

describe('ritmo del lienzo', () => {
  it('ve cada modo como niveles por paso', () => {
    expect(rBar({ mode: 'meter', groups: [2, 2, 3], denom: 8 }, 0)).toEqual([3, 1, 2, 1, 2, 1, 1]);
    const tresillo = rBar({ mode: 'euclid', pulses: 3, steps: 8, rotation: 0 }, 0);
    expect(tresillo).toHaveLength(8);
    expect(tresillo.filter((x) => x > 0)).toHaveLength(3);
    expect(rBar({ mode: 'poly', a: 3, b: 2 }, 0)).toEqual([3, 0, 2, 1, 2, 0]);
    const drums = drumFromGroups([2, 2, 3]);
    expect(rBar(drums, 0)).toEqual([3, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 1, 0]);
    expect(counterpart([3, 0, 1, 0])).toEqual([0, 2, 0, 2]);
  });

  it('el mutante cambia de compás cada N', () => {
    const mut = {
      mode: 'mutante' as const,
      meters: [SEVEN_EIGHT, { groups: [2, 2, 2, 2], denom: 8 as const }],
      barsEach: 2,
    };
    expect([0, 1, 2, 3, 4].map((bar) => rBar(mut, bar).length)).toEqual([7, 7, 8, 8, 7]);
  });

  it('mide contra el compás de la consigna', () => {
    expect(meterEighths({ groups: [3, 2], denom: 4 })).toBe(10);
    expect(quartersPerBar(SEVEN_EIGHT)).toBe(3.5);
    expect(checkRhythm({ mode: 'meter', groups: [2, 2, 3], denom: 8 }, SEVEN_EIGHT).ok).toBe(true);
    expect(checkRhythm(drumFromGroups([2, 2, 3]), SEVEN_EIGHT).ok).toBe(true);
    expect(checkRhythm({ mode: 'meter', groups: [2, 2, 2, 2], denom: 8 }, SEVEN_EIGHT)).toEqual({
      ok: false,
      why: 'Mide 8 corcheas; 7/8 pide 7.',
    });
    expect(checkRhythm({ mode: 'poly', a: 3, b: 2 }, SEVEN_EIGHT).ok).toBe(true);
  });

  it('lo que sortea entra en el compás, con cualquier riesgo', () => {
    for (let seed = 1; seed < 80; seed++) {
      const config = makeRhythm(SEVEN_EIGHT, (seed % 3) as Risk, createRng(seed));
      expect(checkRhythm(config, SEVEN_EIGHT).ok, JSON.stringify(config)).toBe(true);
    }
  });
});

describe('letra del lienzo', () => {
  const lines = VERSE.split('\n');

  it('cuenta sílabas métricas', () => {
    expect(lines.map(syllables)).toEqual([8, 8, 8, 8]);
    expect(checkLyric(VERSE, { kind: 'metro', syllables: 8 })).toEqual({
      ok: true,
      why: '4 de 4 versos de 8.',
    });
    expect(checkLyric('la noche cae', { kind: 'sin', word: 'noche' })!.ok).toBe(false);
  });

  it('dice si la letra es estable', () => {
    const stable = stability(lines);
    expect(stable.stable).toBe(true);
    expect(stable.scheme[3]).toBe(stable.scheme[1]);
    const odd = stability(lines.slice(0, 3));
    expect(odd.stable).toBe(false);
    expect(odd.why).toContain('impar');
    expect(stability([]).stable).toBeNull();
  });

  it('marca los versos espejo', () => {
    expect(mirrors(['la casa', 'el perro', 'nadie toca la puerta'])).toEqual([true, true, false]);
  });
});

describe('melodía del lienzo', () => {
  const sec = { bars: 8 };

  it('una columna por sílaba, cada verso en su tramo', () => {
    const slots = melSlots(sec, VERSE);
    expect(slots).toHaveLength(32);
    expect(slots[0]).toMatchObject({ t: 0, first: true, line: 0 });
    expect(slots[8]).toMatchObject({ t: 2, first: true, line: 1 });
    expect(slots.filter((s) => s.end)).toHaveLength(4);
    expect(melSlots({ bars: 8, phrase: 'back' }, VERSE)[0]!.t).toBe(0.25);
  });

  it('sin letra, dos notas por compás en frases de cuatro', () => {
    const slots = melSlots(sec, '');
    expect(slots).toHaveLength(16);
    expect(slots.filter((s) => s.first).map((s) => s.t)).toEqual([0, 4]);
  });

  it('pasa los grados a alturas', () => {
    expect(degMidi(0, D_MINOR)).toBe(62);
    expect(degMidi(7, D_MINOR)).toBe(74);
    expect(degMidi(-1, D_MINOR)).toBe(60);
    expect(degPc(-1, D_MINOR)).toBe(0);
  });

  it('los apoyos caen en notas del acorde y solo en los tiempos fuertes', () => {
    const slots = melSlots(sec, VERSE);
    const v = { contour: 'arco' as const, fill: 'apoyos' as const, seed: 3, shift: 0, notes: null };
    const degs = genMel(v, sec, slots, RADIO, D_MINOR, null);
    const segs = segsOf(RADIO, 8);
    degs.forEach((d, i) => {
      const slot = slots[i]!;
      const strong = slot.first || slot.end || segs.some((g) => Math.abs(g.t - slot.t) < 0.12);
      if (!strong) expect(d).toBeNull();
      else {
        const chord = chordOf(barsOf(RADIO, 8)[0]!, D_MINOR);
        expect(d).not.toBeNull();
        if (slot.t < 2) expect(chord.pcs).toContain(degPc(d!, D_MINOR));
      }
    });
  });

  it('respeta la consigna al completar', () => {
    const slots = melSlots(sec, VERSE);
    for (const seed of [1, 2, 3, 4, 5]) {
      const v = { contour: 'ola' as const, fill: 'completa' as const, seed, shift: 0, notes: null };
      const noTonic = genMel(v, sec, slots, RADIO, D_MINOR, 'sin-tonica');
      expect(checkMelody(noTonic, slots, 'sin-tonica', D_MINOR)!.ok).toBe(true);
    }
    expect(checkMelody([0, 1, 3], slots.slice(0, 3), 'solo-saltos', D_MINOR)).toEqual({
      ok: false,
      why: '1 pasos son notas vecinas.',
    });
  });
});

describe('proyecto del lienzo', () => {
  const secs: Section[] = [
    { id: 'a1', label: 'A', bars: 8, energy: 2 },
    { id: 'a2', label: 'A', bars: 8, of: 'a1', energy: 1 },
  ];

  it('dura lo que dicen el compás y el tempo', () => {
    expect(totalBars(secs)).toBe(16);
    expect(formatTime(barsToSeconds(16, SEVEN_EIGHT, 96))).toBe('0:35');
  });

  it('lee lo guardado sin confiar', () => {
    const project = newProject({
      key: D_MINOR,
      secs: [...secs, { id: 'b2', label: 'B', bars: 8, of: 'b1', energy: 4 }],
      lib: [{ id: 'h1', kind: 'armonia', name: 'Armonía 1', chords: RADIO }],
      clips: { 'armonia:a1': 'h1', 'ritmo:a1': 'nada', 'letra:zz': 'h1' },
    });
    const back = sanitizeProject(JSON.parse(JSON.stringify(project)))!;
    expect(back.clips).toEqual({ 'armonia:a1': 'h1' });
    expect(back.secs[2]!.of).toBeUndefined();
    expect(clipOf(back, 'armonia', back.secs[1]!)?.chords).toEqual(RADIO);
    expect(sanitizeProject({ secs: [] })).toBeNull();
    expect(sanitizeProject('basura')).toBeNull();
  });

  it('migra la forma y las secciones del formato anterior', () => {
    const project = fromLegacy({
      blocks: ['A', 'A', 'B', 'A'],
      sections: {
        A: {
          chords: ['Dm', 'Bb', 'F', 'C'],
          chordBeats: [8, 4, 2, 2],
          rhythm: { mode: 'meter', groups: [4], denom: 4, bpm: 90 },
          bars: 8,
          text: 'Tengo la mesa servida',
        },
      },
      fallback: { chords: ['Gm', 'A7'], rhythm: { mode: 'meter', groups: [2, 2, 3], denom: 8, bpm: 96 } },
      tonic: 2,
      mode: 'aeolian',
      tempo: null,
      tuning: { name: 'DADGAD', notes: ['D2', 'A2', 'D3', 'G3', 'A3', 'D4'] },
      consigna: 'abc',
    });
    expect(project.secs.map((s) => [s.id, s.bars, s.of])).toEqual([
      ['sec-a', 8, undefined],
      ['sec-a-2', 8, 'sec-a'],
      ['sec-b', 4, undefined],
      ['sec-a-3', 8, 'sec-a'],
    ]);
    expect(clipOf(project, 'armonia', project.secs[0]!)?.chords).toEqual(RADIO);
    expect(clipOf(project, 'armonia', project.secs[2]!)?.chords).toEqual([{ d: 3 }, { d: 4, b: true }]);
    expect(clipOf(project, 'letra', project.secs[0]!)?.text).toBe('Tengo la mesa servida');
    expect(clipOf(project, 'letra', project.secs[1]!)).toBeUndefined();
    expect(clipOf(project, 'ritmo', project.secs[3]!)?.config).toEqual({
      mode: 'meter',
      groups: [4],
      denom: 4,
    });
    expect(clipOf(project, 'ritmo', project.secs[2]!)?.config).toEqual({
      mode: 'meter',
      groups: [2, 2, 3],
      denom: 8,
    });
    expect(project.tuning.pcs).toEqual([2, 9, 2, 7, 9, 2]);
    expect(project.bpm).toBe(90);
    expect(project.consigna).toBe('abc');
  });
});

describe('store del lienzo', () => {
  it('pone las variantes en la raíz y transporta al cambiar la tónica', () => {
    const store = useLienzo.getState();
    store.load(
      newProject({
        key: D_MINOR,
        secs: [
          { id: 'a1', label: 'A', bars: 8, energy: 2 },
          { id: 'a2', label: 'A', bars: 8, of: 'a1', energy: 1 },
        ],
      }),
    );
    const id = useLienzo.getState().addVariant({ kind: 'armonia', name: 'Armonía 1', chords: RADIO });
    useLienzo.getState().place('armonia', { id: 'a2', of: 'a1' }, id);
    useLienzo.getState().place('letra', { id: 'a2', of: 'a1' }, id);
    useLienzo.getState().setBars('a2', 6);
    useLienzo.getState().setKey({ tonic: 4, mode: 'aeolian' });
    const p = useLienzo.getState().project!;
    expect(p.clips).toEqual({ 'armonia:a1': id });
    expect(p.secs.map((s) => s.bars)).toEqual([6, 6]);
    expect(names(clipOf(p, 'armonia', p.secs[1]!)!.chords, p.key)).toEqual(['Em', 'C', 'G', 'D']);
  });
});
