// Acordes escritos como texto: cómo leerlos, cómo tocarlos en una afinación y qué notas chocan.
import { midiToNote, noteToMidi } from './notes';

const LETTER_PITCH: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const SUFFIXES: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  '9': [0, 4, 7, 10, 14],
  m9: [0, 3, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
  '7sus4': [0, 5, 7, 10],
  m7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
};

/** Cuánto dura cada acorde, en tiempos. Sin nada pedido, un compás de 4. */
export const DEFAULT_CHORD_BEATS = 4;
export const MAX_CHORD_BEATS = 16;

export const isChordBeats = (beats: unknown, count: number): beats is number[] =>
  Array.isArray(beats) &&
  beats.length === count &&
  beats.every((beat) => Number.isInteger(beat) && beat >= 1 && beat <= MAX_CHORD_BEATS);

/** Las duraciones que vale la pena guardar: si son todas las de siempre, no hace falta ninguna. */
export const customBeats = (beats: readonly number[]): number[] | undefined =>
  beats.some((beat) => beat !== DEFAULT_CHORD_BEATS) ? [...beats] : undefined;

/** El link a Armonía. Con la tónica y el modo, la herramienta abre en el mismo tono que la consigna. */
export function harmonyHref(
  chords: readonly string[],
  beats?: readonly number[],
  key?: { tonic?: number; mode?: string },
): string {
  const duration = beats && customBeats(beats) ? `&d=${beats.join(',')}` : '';
  const tonic = key?.tonic === undefined ? '' : `&k=${key.tonic}`;
  const mode = key?.mode === undefined ? '' : `&m=${key.mode}`;
  return `/armonia?c=${encodeURIComponent(chords.join(','))}${duration}${tonic}${mode}`;
}

export interface ParsedChord {
  name: string;
  /** Clase de altura de la raíz, de 0 a 11. */
  root: number;
  /** Lo que sigue a la raíz: "m7", "sus2"... Vacío en una tríada mayor. */
  suffix: string;
  intervals: number[];
  /** Clase de altura del bajo, si el acorde lo pide con una barra: C/E. */
  bass?: number;
}

const pitchClassOf = (letter: string, accidental: string) =>
  (LETTER_PITCH[letter]! + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0) + 12) % 12;

export function parseChord(name: string): ParsedChord | null {
  const match = /^([A-G])([#b]?)([^/]*)(?:\/([A-G])([#b]?))?$/.exec(name);
  if (!match) return null;
  const suffix = match[3]!;
  const intervals = SUFFIXES[suffix];
  if (!intervals) return null;
  const chord: ParsedChord = { name, root: pitchClassOf(match[1]!, match[2]!), suffix, intervals };
  if (match[4]) chord.bass = pitchClassOf(match[4], match[5]!);
  return chord;
}

export const chordClasses = ({ root, intervals }: ParsedChord) => intervals.map((step) => (root + step) % 12);

/** Notas para sonar el acorde sin una afinación elegida: posición cerrada alrededor del Do central. */
export function closeVoicing(chord: ParsedChord): number[] {
  const base = 48 + chord.root;
  return [36 + (chord.bass ?? chord.root), ...chord.intervals.map((step) => base + step)];
}

export interface Voicing {
  /** Traste por cuerda, de la 6.ª a la 1.ª. `null` es una cuerda que no se toca. */
  frets: Array<number | null>;
  midis: number[];
}

const WINDOW = 4;
const MAX_POSITION = 9;

/** Busca la digitación más simple del acorde en esta afinación, en una ventana de 4 trastes. */
export function findVoicing(notes: string[], chord: ParsedChord): Voicing | null {
  const open = notes.map(noteToMidi);
  const required = new Set(chordClasses(chord));
  if (chord.bass !== undefined) required.add(chord.bass);
  // La quinta justa se puede omitir: es la nota que menos define al acorde. Salvo que sea el bajo pedido.
  const fifth =
    chord.intervals.includes(7) && chord.bass !== (chord.root + 7) % 12 ? (chord.root + 7) % 12 : null;
  let best: { frets: Array<number | null>; score: number } | null = null;

  const evaluate = (frets: Array<number | null>) => {
    const played = frets.flatMap((fret, index) => (fret === null ? [] : [open[index]! + fret]));
    if (played.length < 3) return;
    const classes = new Set(played.map((midi) => midi % 12));
    for (const pitchClass of required) if (!classes.has(pitchClass) && pitchClass !== fifth) return;
    for (const pitchClass of classes) if (!required.has(pitchClass)) return;

    const pressed = frets.filter((fret): fret is number => fret !== null && fret > 0);
    const firstPlayed = frets.findIndex((fret) => fret !== null);
    const interiorMutes = frets.slice(firstPlayed).filter((fret) => fret === null).length;
    const lowest = Math.min(...played);
    // C/E sin Mi abajo de todo no es C/E.
    if (chord.bass !== undefined && lowest % 12 !== chord.bass) return;
    let score = 0;
    score -= pressed.reduce((sum, fret) => sum + fret, 0) * 0.6;
    score -= new Set(pressed).size * 1.5;
    score -= interiorMutes * 6;
    score += played.length * 1.2;
    if (lowest % 12 === (chord.bass ?? chord.root)) score += 6;
    if (fifth !== null && !classes.has(fifth)) score -= 3;
    if (!best || score > best.score) best = { frets: [...frets], score };
  };

  for (let position = 0; position <= MAX_POSITION; position++) {
    const options: Array<number | null> = [null, 0];
    for (let fret = position + 1; fret <= position + WINDOW; fret++) options.push(fret);
    const current: Array<number | null> = [];
    const explore = (stringIndex: number) => {
      if (stringIndex === open.length) {
        evaluate(current);
        return;
      }
      for (const option of options) {
        // Una cuerda que no aporta una nota del acorde se descarta sin seguir buscando.
        if (option !== null && !required.has((open[stringIndex]! + option) % 12)) continue;
        current[stringIndex] = option;
        explore(stringIndex + 1);
      }
    };
    explore(0);
  }

  const found = best as { frets: Array<number | null> } | null;
  if (!found) return null;
  return {
    frets: found.frets,
    midis: found.frets.flatMap((fret, index) => (fret === null ? [] : [open[index]! + fret])),
  };
}

export type TensionKind = 'reposo' | 'tension' | 'choque';

export interface TensionNote {
  pitchClass: number;
  note: string;
  kind: TensionKind;
  why: string;
}

const STEP_NAMES: Record<number, string> = {
  0: 'tónica',
  1: 'b9',
  2: '9.ª',
  3: 'b3',
  4: '3.ª',
  5: '11.ª',
  6: '#11',
  7: '5.ª',
  8: 'b13',
  9: '13.ª',
  10: '7.ª menor',
  11: '7.ª mayor',
};

/** Sobre un acorde: qué notas reposan, cuáles tensan bien y cuáles chocan. */
export function tensionMap(chord: ParsedChord): TensionNote[] {
  // La novena de un acorde es la misma clase de altura que su segunda.
  const tones = new Set(chord.intervals.map((step) => step % 12));
  return Array.from({ length: 12 }, (_, step) => {
    const pitchClass = (chord.root + step) % 12;
    const note = midiToNote(60 + pitchClass).replace(/\d/, '');
    const name = STEP_NAMES[step]!;
    if (tones.has(step))
      return { pitchClass, note, kind: 'reposo' as const, why: `${name}: es parte del acorde.` };
    // Medio tono arriba de una nota del acorde es el roce que más se oye.
    const above = [...tones].find((tone) => (tone + 1) % 12 === step);
    if (above !== undefined) {
      return {
        pitchClass,
        note,
        kind: 'choque' as const,
        why: `${name}: queda a un semitono arriba de ${STEP_NAMES[above]}.`,
      };
    }
    return { pitchClass, note, kind: 'tension' as const, why: `${name}: agrega color sin rozar el acorde.` };
  });
}

// Buscar una digitación recorre muchas combinaciones: cada resultado se calcula una sola vez.
const voicingCache = new Map<string, Voicing | null>();

export function voicingFor(notes: string[], name: string): Voicing | null {
  const key = `${notes.join()}|${name}`;
  if (!voicingCache.has(key)) {
    const parsed = parseChord(name);
    voicingCache.set(key, parsed ? findVoicing(notes, parsed) : null);
  }
  return voicingCache.get(key) ?? null;
}

const DEGREES = ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII'] as const;
const DEGREE_SUFFIX: Record<string, string> = {
  '': '',
  m: '',
  dim: '°',
  aug: '+',
  '7': '7',
  m7: '7',
  maj7: 'maj7',
  sus2: 'sus2',
  sus4: 'sus4',
  '6': '6',
  m6: '6',
  '9': '9',
  m9: '9',
  maj9: 'maj9',
  add9: 'add9',
  madd9: 'add9',
  '7sus4': '7sus4',
  m7b5: 'ø7',
  dim7: '°7',
};

/**
 * El grado de un acorde respecto de una tónica, siempre contra la escala mayor: bVI es el Fa
 * de La menor o de La mayor por igual. Los acordes menores y disminuidos van en minúscula.
 */
export function degreeOf(name: string, tonic: number): string | null {
  const chord = parseChord(name);
  if (!chord) return null;
  const slash = name.includes('/') ? name.slice(name.indexOf('/')) : '';
  const step = DEGREES[(chord.root - tonic + 12) % 12]!;
  const lower = chord.intervals.includes(3);
  return (lower ? step.toLowerCase() : step) + (DEGREE_SUFFIX[chord.suffix] ?? '') + slash;
}
