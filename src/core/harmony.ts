// Progresiones con azar teórico. Cada nivel de riesgo sortea de recursos distintos,
// y cada resultado devuelve la regla que lo generó.
import type { Rng } from './rng';
import type { Risk } from './roll';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const LETTER_PITCH = [0, 2, 4, 5, 7, 9, 11] as const;
const FALLBACK_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

/** Una nota escrita con su letra, para que Bb no salga como A#. */
export interface Spelled {
  letter: number;
  pitch: number;
}

export function spell({ letter, pitch }: Spelled): string {
  const normalized = ((letter % 7) + 7) % 7;
  const target = ((pitch % 12) + 12) % 12;
  const accidental = ((target - LETTER_PITCH[normalized]! + 18) % 12) - 6;
  if (Math.abs(accidental) > 1) return FALLBACK_NAMES[target]!;
  return `${LETTERS[normalized]}${accidental === 1 ? '#' : accidental === -1 ? 'b' : ''}`;
}

export const MODES = {
  ionian: { name: 'jónico', steps: [0, 2, 4, 5, 7, 9, 11] },
  dorian: { name: 'dórico', steps: [0, 2, 3, 5, 7, 9, 10] },
  phrygian: { name: 'frigio', steps: [0, 1, 3, 5, 7, 8, 10] },
  lydian: { name: 'lidio', steps: [0, 2, 4, 6, 7, 9, 11] },
  mixolydian: { name: 'mixolidio', steps: [0, 2, 4, 5, 7, 9, 10] },
  aeolian: { name: 'eólico', steps: [0, 2, 3, 5, 7, 8, 10] },
} as const;

export type ModeId = keyof typeof MODES;

/** Cómo se escribe cada tónica posible: Bb y no A#, F# y no Gb. */
const TONIC_LETTERS = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6] as const;

export const tonicSpelling = (tonic: number): Spelled => ({
  letter: TONIC_LETTERS[((tonic % 12) + 12) % 12]!,
  pitch: tonic,
});

const TONICS: Spelled[] = [
  { letter: 0, pitch: 0 },
  { letter: 1, pitch: 2 },
  { letter: 2, pitch: 4 },
  { letter: 3, pitch: 5 },
  { letter: 4, pitch: 7 },
  { letter: 5, pitch: 9 },
];

interface Chord {
  root: Spelled;
  quality: '' | 'm' | 'dim' | 'aug';
  extra?: string;
}

export const chordName = (chord: Chord) => spell(chord.root) + chord.quality + (chord.extra ?? '');

export function triad(tonic: Spelled, mode: ModeId, degree: number): Chord {
  const steps = MODES[mode].steps;
  const at = (d: number) => steps[d % 7]! + (d >= 7 ? 12 : 0);
  const third = at(degree + 2) - at(degree);
  const fifth = at(degree + 4) - at(degree);
  let quality: Chord['quality'] = third === 4 ? '' : 'm';
  if (fifth === 6) quality = 'dim';
  if (fifth === 8) quality = 'aug';
  return { root: { letter: tonic.letter + degree, pitch: tonic.pitch + at(degree) }, quality };
}

export const FUNCTION_DEGREES = { T: [0, 5, 2], S: [3, 1], D: [4, 6] } as const;
const NEXT_FUNCTION = { T: ['S', 'D'], S: ['D', 'T'], D: ['T'] } as const;
export type HarmonicFunction = keyof typeof FUNCTION_DEGREES;

function diatonic(tonic: Spelled, mode: ModeId, rng: Rng, length: number) {
  const functions: HarmonicFunction[] = ['T'];
  const chords: Chord[] = [triad(tonic, mode, 0)];
  while (chords.length < length) {
    const next: HarmonicFunction = rng.pick(NEXT_FUNCTION[functions[functions.length - 1]!]);
    const options = FUNCTION_DEGREES[next]
      .map((degree) => triad(tonic, mode, degree))
      .filter((chord) => chord.quality !== 'dim' && chord.quality !== 'aug');
    if (options.length === 0) {
      functions.push('T');
      chords.push(triad(tonic, mode, 0));
      continue;
    }
    functions.push(next);
    chords.push(rng.pick(options));
  }
  return { chords, functions };
}

const dominantOf = (target: Chord): Chord => ({
  root: { letter: target.root.letter + 4, pitch: target.root.pitch + 7 },
  quality: '',
  extra: '7',
});

const tritoneSubOf = (target: Chord): Chord => ({
  root: { letter: target.root.letter + 1, pitch: target.root.pitch + 1 },
  quality: '',
  extra: '7',
});

function neoRiemannian(chord: Chord, operation: 'P' | 'L' | 'R'): Chord {
  const { letter, pitch } = chord.root;
  const major = chord.quality === '';
  if (operation === 'P') return { root: chord.root, quality: major ? 'm' : '' };
  if (operation === 'L') {
    return major
      ? { root: { letter: letter + 2, pitch: pitch + 4 }, quality: 'm' }
      : { root: { letter: letter - 2, pitch: pitch - 4 }, quality: '' };
  }
  return major
    ? { root: { letter: letter - 2, pitch: pitch - 3 }, quality: 'm' }
    : { root: { letter: letter + 2, pitch: pitch + 3 }, quality: '' };
}

export interface Progression {
  chords: string[];
  rule: string;
  /** Tónica, como clase de altura de 0 a 11. */
  tonic: number;
  mode: ModeId;
}

export interface RollOptions {
  /** Cuántos acordes. Por defecto 4, y nunca menos de 2. */
  length?: number;
  /** Sortear en esta tónica en vez de elegir una. */
  tonic?: number;
}

export function rollProgression(
  modes: readonly ModeId[],
  risk: Risk,
  rng: Rng,
  suspended = false,
  { length = 4, tonic: fixedTonic }: RollOptions = {},
): Progression {
  const mode = rng.pick(modes);
  // Se sortea igual aunque no se use: los links de consignas dependen de esta secuencia.
  const picked = rng.pick(TONICS);
  const tonic = fixedTonic === undefined ? picked : tonicSpelling(fixedTonic);
  return {
    ...buildProgression(mode, tonic, risk, rng, suspended, Math.max(2, length)),
    tonic: ((tonic.pitch % 12) + 12) % 12,
    mode,
  };
}

function buildProgression(
  mode: ModeId,
  tonic: Spelled,
  risk: Risk,
  rng: Rng,
  suspended: boolean,
  length: number,
): Omit<Progression, 'tonic' | 'mode'> {
  const key = `${spell(tonic)} ${MODES[mode].name}`;
  const { chords, functions } = diatonic(tonic, mode, rng, length);
  const names = () => chords.map(chordName);
  // Con 4 acordes da los mismos rangos de siempre; con menos, no se sale de la lista.
  const lateTarget = () => rng.int(Math.min(2, length - 1), length - 1);

  if (risk === 0) {
    const list = names();
    const shown = suspended
      ? list.map((name, i) => (chords[i]!.quality === '' ? `${name}sus2` : name))
      : list;
    const susNote = suspended ? ' Los mayores van suspendidos: sin tercera, no resuelven.' : '';
    return { chords: shown, rule: `Diatónico en ${key}. Funciones: ${functions.join(' → ')}.${susNote}` };
  }

  if (risk === 1) {
    if (rng.next() < 0.5) {
      const parallel: ModeId = MODES[mode].steps[2] === 4 ? 'aeolian' : 'ionian';
      const candidates = [1, 2, 3, 4, 5, 6]
        .map((degree) => ({ own: triad(tonic, mode, degree), other: triad(tonic, parallel, degree) }))
        .filter(({ own, other }) => chordName(own) !== chordName(other) && other.quality !== 'dim');
      const { other } = rng.pick(candidates);
      const position = rng.int(1, Math.max(1, length - 2));
      chords[position] = other;
      return {
        chords: names(),
        rule: `Intercambio modal en ${key}: ${chordName(other)} viene prestado de ${spell(tonic)} ${MODES[parallel].name}.`,
      };
    }
    const position = lateTarget();
    const target = chords[position]!;
    const dominant = dominantOf(target);
    chords[position - 1] = dominant;
    return {
      chords: names(),
      rule: `Dominante secundario en ${key}: ${chordName(dominant)} es el V7 de ${chordName(target)}.`,
    };
  }

  const resource = rng.int(0, 2);
  if (resource === 0) {
    const position = lateTarget();
    const target = chords[position]!;
    const dominant = dominantOf(target);
    const substitute = tritoneSubOf(target);
    chords[position - 1] = substitute;
    return {
      chords: names(),
      rule: `Sustituto tritonal en ${key}: ${chordName(substitute)} reemplaza a ${chordName(dominant)} y baja por semitono hacia ${chordName(target)}.`,
    };
  }
  if (resource === 1) {
    const start: Chord = { root: tonic, quality: '' };
    const moves = [
      { letter: 2, pitch: 3 },
      { letter: 2, pitch: 4 },
      { letter: -2, pitch: -3 },
      { letter: -2, pitch: -4 },
    ];
    const list = [start];
    while (list.length < length) {
      const previous = list[list.length - 1]!;
      const move = rng.pick(moves);
      list.push({
        root: { letter: previous.root.letter + move.letter, pitch: previous.root.pitch + move.pitch },
        quality: '',
      });
    }
    return {
      chords: list.map(chordName),
      rule: 'Mediantes cromáticas: acordes mayores a una tercera de distancia, unidos por una sola nota en común.',
    };
  }
  const operations = [
    rng.pick(['P', 'L', 'R'] as const),
    rng.pick(['L', 'R'] as const),
    rng.pick(['P', 'L', 'R'] as const),
  ];
  while (operations.length < length - 1) operations.push(rng.pick(['L', 'R'] as const));
  operations.length = length - 1;
  const list: Chord[] = [{ root: tonic, quality: MODES[mode].steps[2] === 4 ? '' : 'm' }];
  for (const operation of operations) list.push(neoRiemannian(list[list.length - 1]!, operation));
  return {
    chords: list.map(chordName),
    rule: `Neo-riemanniano: ${operations.join(', ')}. Cada paso mueve una sola nota del acorde, sin pasar por una tonalidad.`,
  };
}
