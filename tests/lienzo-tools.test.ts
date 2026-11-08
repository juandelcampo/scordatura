import { describe, expect, it } from 'vitest';
import { chromaticCircle, fifthsCircle } from '~/core/lienzo/circle';
import { lienzoToMidi } from '~/core/lienzo/export';
import { applyForm, contrast, faster, partnerOf, titleBar } from '~/core/lienzo/form';
import { chordOf } from '~/core/lienzo/harmony';
import {
  checkMold,
  cutAndMix,
  foundPhrases,
  lupa,
  makeDummy,
  soundWords,
  vowelsOf,
} from '~/core/lienzo/lyricsTools';
import { syllables } from '~/core/lienzo/lyrics';
import { OWN_RULES, streakOf, usualHourOf } from '~/core/lienzo/own';
import { newProject } from '~/core/lienzo/project';
import { harmonyRuleOf, lyricRuleOf, melodyRuleOf, meterOf, rulesOf } from '~/core/lienzo/rules';
import { allBars, barEvents, secAtBar } from '~/core/lienzo/schedule';
import type { Key, Project } from '~/core/lienzo/types';
import { chordMidis, findShape } from '~/core/lienzo/voicing';
import { createRng } from '~/core/rng';
import { MOLDS } from '~/data/lyrics-material';
import { REFS, refFormToSections } from '~/data/refs';

const D_MINOR: Key = { tonic: 2, mode: 'aeolian' };
const RULES = rulesOf({
  rhythm: { mode: 'meter', groups: [2, 2, 3], denom: 8, bpm: 96 },
  harmony: { label: 'Dm – Bb', rule: '' },
  melody: { label: 'Prohibida la tónica', rule: '' },
  lyric: { label: 'Octosílabos, rima ABAB', rule: '' },
});

function radio(): Project {
  return newProject({
    title: 'Radio bajita',
    key: D_MINOR,
    bpm: 96,
    tuning: { name: 'DADGAD', pcs: [2, 9, 2, 7, 9, 2], notes: ['D2', 'A2', 'D3', 'G3', 'A3', 'D4'] },
    secs: [
      { id: 'a1', label: 'A', bars: 8, energy: 2 },
      { id: 'b1', label: 'B', bars: 8, energy: 4 },
      { id: 'a2', label: 'A', bars: 8, of: 'a1', energy: 1 },
    ],
    lib: [
      {
        id: 'h1',
        kind: 'armonia',
        name: 'Armonía 1',
        chords: [{ d: 0, len: 2 }, { d: 5 }, { d: 2, len: 0.5 }, { d: 6, len: 0.5 }],
      },
      { id: 'h2', kind: 'armonia', name: 'Armonía 2', chords: [{ d: 3 }, { d: 0, b: true }] },
      { id: 'r1', kind: 'ritmo', name: 'Ritmo 1', config: { mode: 'meter', groups: [2, 2, 3], denom: 8 } },
      {
        id: 'm1',
        kind: 'melodia',
        name: 'Melodía 1',
        contour: 'arco',
        fill: 'completa',
        seed: 3,
        shift: 0,
        notes: null,
      },
      { id: 'l1', kind: 'letra', name: 'Verso', text: 'Prendo la radio bajita\ncomo quien llama de lejos' },
    ],
    clips: { 'armonia:a1': 'h1', 'armonia:b1': 'h2', 'ritmo:a1': 'r1', 'melodia:a1': 'm1', 'letra:a1': 'l1' },
  });
}

describe('reglas desde la consigna', () => {
  it('lee el compás, la melodía y la letra', () => {
    expect(RULES.meter).toEqual({ groups: [2, 2, 3], denom: 8 });
    expect(RULES.melody).toBe('sin-tonica');
    expect(RULES.lyric).toEqual({ kind: 'metro', syllables: 8 });
    expect(RULES.harmony).toBeNull();
  });
  it('reconoce reglas escritas de distintas formas', () => {
    expect(harmonyRuleOf('Intercambio modal: al menos un prestado')).toBe('intercambio');
    expect(harmonyRuleOf('Sin la V')).toBe('sin-v');
    expect(melodyRuleOf('Solo saltos')).toBe('solo-saltos');
    expect(melodyRuleOf('Contorno en arco')).toBe('sube-y-cae');
    expect(lyricRuleOf('Versos de 6 sílabas')).toEqual({ kind: 'metro', syllables: 6 });
    expect(lyricRuleOf('Sin decir “noche”')).toEqual({ kind: 'sin', word: 'noche' });
    expect(lyricRuleOf('Sin rimar los finales')).toBeNull();
  });
  it('saca el compás de cualquier ritmo', () => {
    expect(meterOf({ mode: 'euclid', pulses: 3, steps: 7, rotation: 0 })).toEqual({ groups: [7], denom: 8 });
    expect(meterOf({ mode: 'poly', a: 3, b: 4 })).toEqual({ groups: [4], denom: 4 });
  });
});

describe('digitaciones', () => {
  it('encuentra el acorde con la raíz en el bajo', () => {
    const dm = chordOf({ d: 0 }, D_MINOR);
    const shape = findShape([4, 9, 2, 7, 11, 4], dm)!;
    expect(shape[0]).toBe(-1);
    const sounded = shape.flatMap((f, i) => (f < 0 ? [] : [([4, 9, 2, 7, 11, 4][i]! + f) % 12]));
    expect(sounded[0]).toBe(2);
    expect(new Set(sounded)).toEqual(new Set([2, 5, 9]));
  });
  it('anda con cuerdas sacadas', () => {
    const g = chordOf({ r: 0 }, { tonic: 7, mode: 'ionian' });
    const shape = findShape([null, 7, 2, 7, 11, 2], g)!;
    expect(shape[0]).toBe(-1);
    expect(shape.slice(1)).toEqual([0, 0, 0, 0, 0]);
  });
  it('da las alturas de la digitación', () => {
    const tuning = { name: 'DADGAD', pcs: [2, 9, 2, 7, 9, 2], notes: ['D2', 'A2', 'D3', 'G3', 'A3', 'D4'] };
    const midis = chordMidis(chordOf({ d: 0 }, D_MINOR), tuning);
    expect(midis[0]! % 12).toBe(2);
    expect(new Set(midis.map((m) => m % 12))).toEqual(new Set([2, 5, 9]));
  });
});

describe('círculo', () => {
  it('ubica la familia y el recorrido', () => {
    const c = fifthsCircle({ tonic: 0, mode: 'ionian' }, [{ d: 0 }, { d: 4 }, { d: 5 }, { d: 3 }]);
    expect(c.nodes).toHaveLength(24);
    expect(c.nodes.find((n) => n.kind === 'tonic')!.label).toBe('C');
    expect(
      c.nodes
        .filter((n) => n.kind === 'dia')
        .map((n) => n.label)
        .sort(),
    ).toEqual(['Am', 'Bdim', 'Dm', 'Em', 'F', 'G'].sort());
    expect(c.sector).toBe(0);
    expect(c.read).toBe('C → G → Am → F · 4 cortos, 0 saltos');
  });
  it('el cromático marca la escala', () => {
    const c = chromaticCircle(D_MINOR);
    expect(c.nodes.filter((n) => n.sub).map((n) => n.sub)).toHaveLength(7);
    expect(c.nodes[2]!.kind).toBe('tonic');
  });
});

describe('forma', () => {
  it('conserva las secciones al aplicar una plantilla', () => {
    const p = radio();
    const secs = applyForm(p.secs, ['Intro', 'A', 'B', 'A', 'B'], [1, 2, 4, 2, 4]);
    expect(secs.map((x) => x.label)).toEqual(['Intro', 'A', 'B', 'A', 'B']);
    expect(secs[1]!.id).toBe('a1');
    expect(secs[3]!.of).toBe('a1');
    expect(secs[4]!.of).toBe('b1');
  });
  it('más rápido y más corto', () => {
    const { secs, bpm } = faster(radio().secs, 96);
    expect(secs[0]!.label).toBe('1-2-3-4');
    expect(bpm).toBe(176);
  });
  it('compara una sección con su pareja', () => {
    const p = radio();
    expect(partnerOf(p.secs, p.secs[0]!)!.label).toBe('B');
    const items = contrast(p, RULES.melody, p.secs[0]!, p.secs[1]!);
    expect(items[0]).toEqual({ ok: true, t: 'Armonía: A entra por Dm, B por Gm.' });
    expect(items.some((i) => i.t.startsWith('Intensidad'))).toBe(true);
  });
  it('sabe cuándo llega el título', () => {
    expect(titleBar(radio())).toBe(0);
    expect(titleBar({ ...radio(), title: 'otra cosa' })).toBe(-1);
  });
});

describe('agenda y MIDI', () => {
  it('agenda cada compás con duraciones reales', () => {
    const p = radio();
    expect(secAtBar(p.secs, 9)).toMatchObject({ bar: 1, start: 8 });
    const first = barEvents(p, RULES, 0)!;
    expect(first.chords).toHaveLength(1);
    expect(first.chords[0]).toMatchObject({ at: 0, len: 2, name: 'Dm' });
    expect(barEvents(p, RULES, 1)!.chords).toHaveLength(0);
    expect(barEvents(p, RULES, 3)!.chords.map((c) => c.name)).toEqual(['F', 'C']);
    expect(first.hits.filter((h) => h.voice === 'bombo')).toHaveLength(1);
    expect(first.notes.length).toBeGreaterThan(0);
    expect(barEvents(p, RULES, 16)!.chords[0]!.name).toBe('Dm');
    expect(allBars(p, RULES)).toHaveLength(24);
  });
  it('escribe un MIDI válido', () => {
    const bytes = lienzoToMidi(radio(), RULES);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('MThd');
    expect(bytes.length).toBeGreaterThan(200);
  });
});

describe('herramientas de letra', () => {
  it('la lupa marca lo abstracto y quién habla', () => {
    const out = lupa(['Mi corazón y mi alma', 'tengo el dolor de vos'], '');
    expect(out[0]).toMatchObject({ tone: 'warn' });
    expect(out[0]!.t).toContain('corazón');
    expect(out.some((x) => x.t.startsWith('Habla un yo'))).toBe(true);
  });
  it('mide contra un molde', () => {
    const copla = MOLDS.find((m) => m.id === 'copla')!;
    const res = checkMold(
      [
        'Tengo la mesa servida',
        'para la gente que vuelve',
        'y nadie toca la puerta',
        'porque ya nadie la mueve',
      ],
      copla,
    );
    expect(res.ok).toBe(true);
  });
  it('arma letra de relleno con la métrica justa', () => {
    const lines = makeDummy([8, 8, 8, 8], 'xaxa', createRng(4));
    expect(lines).toHaveLength(4);
    expect(lines.filter((l) => syllables(l) === 8).length).toBeGreaterThanOrEqual(3);
  });
  it('de sonido a palabra', () => {
    expect(vowelsOf('na la ue o a')).toBe('aaeoa');
    const out = soundWords('aa', createRng(2));
    expect(out).toHaveLength(3);
    for (const line of out) expect(vowelsOf(line).startsWith('aa')).toBe(true);
  });
  it('corta texto encontrado y mezcla', () => {
    expect(foundPhrases('Se vende departamento con vista al río. Llamar al dueño.', [])).toEqual([
      'se vende departamento con vista al río',
      'llamar al dueño',
    ]);
    expect(cutAndMix('uno dos tres cuatro cinco seis siete ocho nueve', createRng(1)).length).toBeGreaterThan(
      0,
    );
  });
});

describe('tus reglas', () => {
  const ctx = (p: Project) => ({
    project: p,
    seconds: 50,
    streak: 0,
    usualHour: null,
    previous: null,
    meterLabel: '7/8',
    previousMeterLabel: null,
  });
  it('chequea cada regla', () => {
    const p = radio();
    const byId = Object.fromEntries(OWN_RULES.map((r) => [r.id, r.check(ctx(p))]));
    expect(byId.tres).toEqual({ ok: false, why: 'Se pasa en A.' });
    expect(byId.ocho!.ok).toBe(true);
    expect(byId.dosmin!.ok).toBe(true);
    expect(byId.cocina!.ok).toBe(false);
    expect(byId.horario!.ok).toBe(false);
  });
  it('cuenta la racha y la hora', () => {
    const day = 86_400_000;
    const now = new Date(2026, 10, 7, 12).getTime();
    expect(streakOf([now, now - day, now - 2 * day, now - 4 * day], now)).toBe(3);
    expect(streakOf([now - day], now)).toBe(1);
    expect(streakOf([], now)).toBe(0);
    expect(
      usualHourOf([
        new Date(2026, 1, 1, 10).getTime(),
        new Date(2026, 1, 2, 10).getTime(),
        new Date(2026, 1, 2, 22).getTime(),
      ]),
    ).toBe(10);
  });
});

describe('referencias', () => {
  it('trae los 14 temas y sus formas se pasan al lienzo', () => {
    expect(REFS).toHaveLength(14);
    expect(refFormToSections(['Intro', 'Verso', 'Estribillo', 'Puente'])).toEqual({
      labels: ['Intro', 'A', 'B', 'C'],
      energies: [1, 2, 4, 3],
    });
  });
});
