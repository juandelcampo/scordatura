// Armonía del lienzo: acordes por grado, sus nombres, su grado en números romanos, su función en
// palabras y cuánto dura cada uno (ritmo armónico).
import { MODES, spell, tonicSpelling } from '../harmony';
import type { Risk } from '../roll';
import type { Rng } from '../rng';
import type { Chord, ChordQuality, Key, KeyMode, Section } from './types';
import { LANES, type LaneId } from './types';

export interface ChordInfo {
  /** Como en el resto de la app: Bb, F#m, Edim. */
  name: string;
  root: number;
  pcs: number[];
  quality: '' | 'm' | 'dim' | '5';
}

const pc = (n: number) => ((n % 12) + 12) % 12;
const scaleOf = (mode: KeyMode | 'ionian' | 'aeolian') => MODES[mode].steps;

/** El modo paralelo: el que comparte la tónica y cambia la tercera. */
export const parallelOf = (mode: KeyMode): KeyMode => (scaleOf(mode)[2] === 4 ? 'aeolian' : 'ionian');

/** Cuántas letras sube cada intervalo: el ♭III de Re es Fa y no Mi♯. */
const INTERVAL_LETTERS = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6] as const;
const QUALITY_INTERVALS: Record<ChordQuality, number[]> = {
  M: [0, 4, 7],
  m: [0, 3, 7],
  '5': [0, 7],
  dim: [0, 3, 6],
};
const QUALITY_SUFFIX: Record<ChordQuality, ChordInfo['quality']> = { M: '', m: 'm', '5': '5', dim: 'dim' };

export function chordOf(c: Chord, key: Key): ChordInfo {
  const tonic = tonicSpelling(key.tonic);
  if (c.r !== undefined) {
    const q = c.q ?? 'M';
    const root = pc(key.tonic + c.r);
    const letter = tonic.letter + INTERVAL_LETTERS[pc(c.r)]!;
    const quality = QUALITY_SUFFIX[q];
    return {
      name: spell({ letter, pitch: root }) + quality,
      root,
      pcs: QUALITY_INTERVALS[q].map((step) => pc(root + step)),
      quality,
    };
  }
  const d = c.d ?? 0;
  const steps = scaleOf(c.b ? parallelOf(key.mode) : key.mode);
  const at = (degree: number) => steps[degree % 7]!;
  const third = pc(at(d + 2) - at(d));
  const fifth = pc(at(d + 4) - at(d));
  const quality: ChordInfo['quality'] = third === 4 ? '' : fifth === 6 ? 'dim' : 'm';
  const root = pc(key.tonic + at(d));
  return {
    name: spell({ letter: tonic.letter + d, pitch: key.tonic + at(d) }) + quality,
    root,
    pcs: [root, pc(root + third), pc(root + fifth)],
    quality,
  };
}

export const DEGREE_NAMES = [
  'I',
  '♭II',
  'II',
  '♭III',
  'III',
  'IV',
  '♯IV',
  'V',
  '♭VI',
  'VI',
  '♭VII',
  'VII',
] as const;

/** El grado respecto de la tónica: en re menor, i ii° ♭III iv v ♭VI ♭VII. */
export function degOfCh(ch: ChordInfo, tonic: number): string {
  const base = DEGREE_NAMES[pc(ch.root - tonic)]!;
  if (ch.quality === 'dim') return `${base.toLowerCase()}°`;
  if (ch.quality === 'm') return base.toLowerCase();
  return base;
}

export const degName = (c: Chord, key: Key) => degOfCh(chordOf(c, key), key.tonic);

const MAJOR_ROLES = [
  'casa',
  'camino',
  'pariente',
  'se abre',
  'pide volver',
  'casa triste',
  'inestable',
] as const;
const MINOR_ROLES = [
  'casa',
  'inestable',
  'se ilumina',
  'se hunde',
  'vuelve suave',
  'se abre',
  'empuja',
] as const;

/** La función de un acorde, en palabras y sin jerga. */
export function roleOf(c: Chord, key: Key): string {
  if (c.r !== undefined) return 'de afuera';
  if (c.b) return 'prestado';
  const roles = scaleOf(key.mode)[2] === 4 ? MAJOR_ROLES : MINOR_ROLES;
  return roles[(c.d ?? 0) % 7]!;
}

const TENSION: Record<string, number> = {
  casa: 0,
  'casa triste': 1,
  pariente: 1,
  'se ilumina': 1,
  camino: 2,
  'se abre': 2,
  'se hunde': 2,
  'vuelve suave': 3,
  inestable: 3,
  prestado: 3,
  'de afuera': 3,
  empuja: 4,
  'pide volver': 4,
};

/** De 0 (casa) a 4 (pide volver). */
export const tensionOf = (c: Chord, key: Key) => TENSION[roleOf(c, key)] ?? 0;

/** Los grados cuyo acorde en el modo paralelo es otro y no es disminuido. */
export function borrowedDegrees(key: Key): number[] {
  const out: number[] = [];
  for (let d = 0; d < 7; d++) {
    const own = chordOf({ d }, key);
    const borrowed = chordOf({ d, b: true }, key);
    if (borrowed.name !== own.name && borrowed.quality !== 'dim') out.push(d);
  }
  return out;
}

export const closesHome = (chords: readonly Chord[], key: Key) =>
  chords.length > 0 && roleOf(chords[chords.length - 1]!, key) === 'casa';

/** El recorrido en una frase: "Arranca en casa, se abre. Cierra en casa." */
export function story(chords: readonly Chord[], key: Key): string {
  if (!chords.length) return '';
  const roles = chords.map((c) => roleOf(c, key)).filter((r, i, all) => i === 0 || r !== all[i - 1]);
  const last = roleOf(chords[chords.length - 1]!, key);
  const end =
    last === 'casa'
      ? 'Cierra en casa.'
      : ['pide volver', 'empuja', 'vuelve suave'].includes(last)
        ? 'Termina empujando a la sección que sigue.'
        : 'Queda abierta.';
  return roles.length === 1
    ? `Se queda en ${roles[0]}. ${end}`
    : `Arranca en ${roles[0]}, ${roles.slice(1).join(', ')}. ${end}`;
}

// --- Ritmo armónico -------------------------------------------------------------------------

export interface Segment {
  c: Chord;
  /** Compás donde empieza, desde 0 y con fracciones. */
  t: number;
  len: number;
}

const EPS = 1e-6;
export const lenOf = (c: Chord) => c.len ?? 1;
export const progLen = (chords: readonly Chord[]) => chords.reduce((sum, c) => sum + lenOf(c), 0);

/** Llena la sección ciclando la progresión. El último acorde se corta donde termina la sección. */
export function segsOf(chords: readonly Chord[], bars: number): Segment[] {
  const out: Segment[] = [];
  if (!chords.length) return out;
  let t = 0;
  for (let i = 0; t < bars - EPS && i < 512; i++) {
    const c = chords[i % chords.length]!;
    const len = Math.min(lenOf(c), bars - t);
    out.push({ c, t, len });
    t += len;
  }
  return out;
}

export function chordAtT(chords: readonly Chord[], bars: number, t: number): Chord | undefined {
  const seg = segsOf(chords, bars).find((g) => t >= g.t - EPS && t < g.t + g.len - EPS);
  return seg?.c ?? chords[0];
}

/** El acorde que suena al empezar cada compás. */
export const barsOf = (chords: readonly Chord[], bars: number): Chord[] =>
  chords.length ? Array.from({ length: bars }, (_, i) => chordAtT(chords, bars, i)!) : [];

/** "Vuelta de 4 c. · entra 2x". */
export function harmonicRhythmRead(chords: readonly Chord[], bars: number): string {
  if (!chords.length) return '';
  const lap = progLen(chords);
  const times = bars / lap;
  const mixed = chords.some((c) => lenOf(c) < 1) && chords.some((c) => lenOf(c) >= 2);
  return (
    `Vuelta de ${lap} c.` +
    (Number.isInteger(times) ? ` · entra ${times}x` : ' · queda cortada') +
    (mixed ? ' · lo largo pesa, lo corto empuja' : '')
  );
}

export const HR_PRESETS = [
  { id: 'uno', label: 'uno por compás' },
  { id: 'dos', label: 'dos por compás' },
  { id: 'lento', label: 'lento' },
  { id: 'acelera', label: 'acelera al final' },
  { id: 'largo-corto', label: 'largo y corto' },
  { id: 'mixto', label: 'mezclado' },
] as const;

export type HrPreset = (typeof HR_PRESETS)[number]['id'];

export function applyHR(chords: readonly Chord[], preset: HrPreset, rng?: Rng): Chord[] {
  const count = chords.length;
  const lens: Record<HrPreset, (i: number) => number> = {
    uno: () => 1,
    dos: () => 0.5,
    lento: () => 2,
    acelera: (i) => (i >= count - 2 ? 0.5 : 1),
    'largo-corto': (i) => (i % 2 ? 0.5 : 1.5),
    mixto: () => (rng ? rng.pick([0.5, 1, 1, 2]) : 1),
  };
  return chords.map((c, i) => ({ ...c, len: lens[preset](i) }));
}

const NEXT_LEN: Record<number, number> = { 0.5: 1, 1: 2, 2: 4, 4: 0.5 };
/** La ficha de cada acorde cicla ½ → 1 → 2 → 4. */
export const cycleLen = (c: Chord): Chord => ({ ...c, len: NEXT_LEN[lenOf(c)] ?? 1 });

// --- Recetas y sorteo -----------------------------------------------------------------------

export interface Recipe {
  name: string;
  about: string;
  chords: Chord[];
}

export function recipes(key: Key): Recipe[] {
  const minorish = scaleOf(key.mode)[2] === 3;
  const list: { name: string; about: string; ch: (number | Chord)[] }[] = [
    { name: 'Dos que se mecen', about: 'casa y un vecino', ch: minorish ? [0, 6] : [0, 3] },
    {
      name: 'Baja por escalones',
      about: 'cada acorde un paso más abajo',
      ch: minorish ? [0, 6, 5, 4] : [5, 4, 3, 2],
    },
    { name: 'El engaño', about: 'pide volver y cae en otro lado', ch: [0, 3, 4, 5] },
    { name: 'Rueda de quintas', about: 'cada acorde empuja al siguiente', ch: [5, 1, 4, 0] },
    { name: 'Sube la escalera', about: 'un escalón por compás', ch: [0, 1, 2, 3] },
    {
      name: 'Prestado antes de volver',
      about: 'un color de afuera antes de casa',
      ch: [0, 3, { d: 3, b: true }, 0],
    },
  ];
  return list.map(({ name, about, ch }) => ({
    name,
    about,
    chords: ch.map((c) => (typeof c === 'number' ? { d: c } : c)),
  }));
}

/** Lo que la consigna le pide a la armonía. */
export type HarmonyRule = 'intercambio' | 'un-acorde' | 'sin-v' | null;

const SAFE = [
  [0, 5, 3, 4],
  [0, 3, 4, 0],
  [0, 4, 5, 3],
  [5, 3, 0, 4],
  [0, 3, 0, 4],
];
const MID = [
  [0, 6, 3, 0],
  [3, 4, 0, 0],
  [1, 4, 0, 5],
  [0, 2, 3, 6],
  [5, 6, 0, 0],
];
const HR_BY_RISK: Record<Risk, HrPreset[]> = {
  0: ['uno', 'uno', 'lento'],
  1: ['uno', 'dos', 'acelera', 'largo-corto'],
  2: ['dos', 'acelera', 'largo-corto', 'mixto'],
};

/** Sortea una progresión que respeta la regla de la consigna, con ritmo armónico según el riesgo. */
export function makeHarmony(key: Key, rule: HarmonyRule, risk: Risk, rng: Rng): Chord[] {
  if (rule === 'un-acorde') return [{ d: rng.pick([0, 3, 5, 2]) }];
  let degrees =
    risk === 2
      ? Array.from({ length: 4 }, (_, i) => (i === 0 ? 0 : rng.int(0, 6)))
      : [...rng.pick(risk === 0 ? SAFE : [...SAFE, ...MID])];
  if (rule === 'sin-v') degrees = degrees.map((d) => (d === 4 ? 6 : d));
  const chords: Chord[] = degrees.map((d) => ({ d }));
  if (rule === 'intercambio') {
    const options = borrowedDegrees(key);
    if (options.length) chords.splice(rng.int(1, 3), 1, { d: rng.pick(options), b: true });
  }
  return applyHR(chords, rng.pick(HR_BY_RISK[risk]), rng);
}

export interface Check {
  ok: boolean;
  why: string;
}

export function checkHarmony(chords: readonly Chord[], rule: HarmonyRule, key: Key): Check | null {
  if (!rule) return null;
  if (rule === 'intercambio') {
    const borrowed = chords.find((c) => c.b);
    return borrowed
      ? { ok: true, why: `${chordOf(borrowed, key).name} viene prestado.` }
      : { ok: false, why: 'Todos son de la misma familia.' };
  }
  if (rule === 'un-acorde') {
    const names = new Set(chords.map((c) => chordOf(c, key).name));
    return names.size === 1
      ? { ok: true, why: 'Un solo acorde.' }
      : { ok: false, why: `Tiene ${names.size} acordes distintos.` };
  }
  const five = chords.find((c) => c.d === 4 && !c.b && c.r === undefined);
  return five
    ? { ok: false, why: `Aparece ${chordOf(five, key).name}, el que pide volver.` }
    : { ok: true, why: 'No aparece el que pide volver.' };
}

/**
 * Un acorde de una referencia (semitonos desde su tónica y calidad) pasado a tu tonalidad: el grado
 * diatónico si existe, si no un prestado, si no un acorde de afuera.
 */
export function refToMine(semitones: number, quality: ChordQuality, len: number, key: Key): Chord {
  const target = chordOf({ r: semitones, q: quality }, key);
  const same = (c: Chord) => {
    const info = chordOf(c, key);
    return info.root === target.root && info.quality === target.quality;
  };
  const withLen = (c: Chord): Chord => (len === 1 ? c : { ...c, len });
  for (let d = 0; d < 7; d++) if (same({ d })) return withLen({ d });
  for (let d = 0; d < 7; d++) if (same({ d, b: true })) return withLen({ d, b: true });
  return withLen({ r: pc(semitones), q: quality });
}

// --- Espejo -----------------------------------------------------------------------------------

/** Armonía, melodía y ritmo de una repetición son los de su raíz. La letra, no. */
export function keyFor(lane: LaneId, sec: Pick<Section, 'id' | 'of'>): string {
  const mirror = LANES.find((l) => l.id === lane)?.mirror ?? false;
  return `${lane}:${sec.of && mirror ? sec.of : sec.id}`;
}
