// Melodía: contornos ajustados a una escala, motivos y transformaciones, notas desde texto,
// y lo que se saca de la voz (notas cantadas y ritmo hablado).
import { MODES, type ModeId } from './harmony';
import { centsBetween, midiToHz, midiToNote } from './notes';
import type { Rng } from './rng';

export interface Note {
  midi: number;
  /** Inicio y duración en corcheas. */
  start: number;
  dur: number;
}

export function scaleNotes(tonic: number, mode: ModeId, low = 48, high = 84): number[] {
  const steps = new Set<number>(MODES[mode].steps);
  const notes: number[] = [];
  for (let midi = low; midi <= high; midi++) if (steps.has((midi - tonic + 120) % 12)) notes.push(midi);
  return notes;
}

export const CONTOURS = {
  arco: { name: 'Arco', shape: (x: number) => 1 - Math.pow(2 * x - 1, 2) },
  ola: { name: 'Ola', shape: (x: number) => 0.5 + 0.5 * Math.sin(x * Math.PI * 4) },
  escalera: { name: 'Escalera que cae', shape: (x: number) => 1 - Math.floor(x * 5) / 4 },
  subida: { name: 'Subida', shape: (x: number) => x },
  valle: { name: 'Valle', shape: (x: number) => Math.pow(2 * x - 1, 2) },
} as const;

export type ContourId = keyof typeof CONTOURS;

export function sampleContour(shape: (x: number) => number, count = 64): number[] {
  return Array.from({ length: count }, (_, i) => Math.min(1, Math.max(0, shape(i / (count - 1)))));
}

export interface MelodyLimits {
  tonic: number;
  mode: ModeId;
  /** Cuántas notas de la escala entran en el registro. */
  range: number;
  length: number;
  /** Clase de altura prohibida. */
  taboo: number | null;
  /** Intervalo prohibido en semitonos entre notas seguidas. */
  forbiddenInterval: number | null;
  /** Primer grado de la escala, contando desde 0. */
  startDegree: number | null;
}

/** Ajusta una forma dibujada a la escala, sin romper las restricciones. */
export function fitContour(contour: number[], limits: MelodyLimits): Note[] {
  const { tonic, mode, range, length, taboo, forbiddenInterval, startDegree } = limits;
  const scale = scaleNotes(tonic, mode, 55, 84);
  const first = Math.max(
    0,
    scale.findIndex((midi) => (midi - tonic + 120) % 12 === 0),
  );
  const allowed = scale.slice(first, first + range).filter((midi) => taboo === null || midi % 12 !== taboo);
  if (allowed.length === 0) return [];

  const melody: number[] = [];
  for (let i = 0; i < length; i++) {
    const height = contour[Math.round((i / Math.max(1, length - 1)) * (contour.length - 1))] ?? 0;
    let index = Math.round(height * (allowed.length - 1));
    if (i === 0 && startDegree !== null) {
      const wanted = scale[first + startDegree];
      const position = wanted === undefined ? -1 : allowed.indexOf(wanted);
      if (position >= 0) index = position;
    }
    const previous = melody[i - 1];
    if (previous !== undefined && forbiddenInterval !== null) {
      // Si el salto quedó prohibido, se busca la nota permitida más cercana a la forma.
      const order = allowed
        .map((_, candidate) => candidate)
        .sort((a, b) => Math.abs(a - index) - Math.abs(b - index));
      index =
        order.find((candidate) => Math.abs(allowed[candidate]! - previous) !== forbiddenInterval) ?? index;
    }
    melody.push(allowed[index]!);
  }
  return melody.map((midi, i) => ({ midi, start: i, dur: 1 }));
}

/** Un motivo corto: pasos chicos dentro de la escala. */
export function rollMotif(rng: Rng, tonic: number, mode: ModeId, size = 4): Note[] {
  const scale = scaleNotes(tonic, mode, 55, 84);
  let index = rng.int(5, Math.min(12, scale.length - 4));
  let start = 0;
  return Array.from({ length: size }, () => {
    const midi = scale[index]!;
    const dur = rng.pick([1, 1, 2]);
    const note = { midi, start, dur };
    start += dur;
    index = Math.max(0, Math.min(scale.length - 1, index + rng.pick([-2, -1, 1, 2])));
    return note;
  });
}

export const TRANSFORMS = {
  inversion: {
    name: 'Inversión',
    rule: 'Inversión: cada intervalo se repite en sentido contrario.',
    apply: (notes: Note[]) => notes.map((note) => ({ ...note, midi: 2 * notes[0]!.midi - note.midi })),
  },
  retrogradacion: {
    name: 'Retrogradación',
    rule: 'Retrogradación: el motivo se toca de atrás para adelante.',
    apply: (notes: Note[]) => {
      const end = Math.max(...notes.map((note) => note.start + note.dur));
      return notes.map((note) => ({ ...note, start: end - note.start - note.dur })).reverse();
    },
  },
  aumentacion: {
    name: 'Aumentación',
    rule: 'Aumentación: las mismas alturas, con el doble de duración.',
    apply: (notes: Note[]) => notes.map((note) => ({ ...note, start: note.start * 2, dur: note.dur * 2 })),
  },
  disminucion: {
    name: 'Disminución',
    rule: 'Disminución: las mismas alturas, con la mitad de duración.',
    apply: (notes: Note[]) => notes.map((note) => ({ ...note, start: note.start / 2, dur: note.dur / 2 })),
  },
  desplazamiento: {
    name: 'Desplazamiento',
    rule: 'Desplazamiento: lo mismo, una corchea más tarde. Cambia qué nota cae en el tiempo fuerte.',
    apply: (notes: Note[]) => notes.map((note) => ({ ...note, start: note.start + 1 })),
  },
} as const;

export type TransformId = keyof typeof TRANSFORMS;

const GERMAN: Record<string, string> = {
  A: 'A',
  B: 'Bb',
  C: 'C',
  D: 'D',
  E: 'E',
  F: 'F',
  G: 'G',
  H: 'B',
  S: 'Eb',
};

/**
 * Convierte una palabra en notas. Las letras con nombre de nota usan la notación alemana
 * (B es Si bemol y H es Si, como en B-A-C-H); las demás recorren la escala en orden.
 */
export function textToNotes(text: string, tonic: number, mode: ModeId): { notes: Note[]; names: string[] } {
  const scale = scaleNotes(tonic, mode, 60, 71);
  const letters = text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  const notes: Note[] = [];
  const names: string[] = [];
  [...letters].forEach((letter, start) => {
    const german = GERMAN[letter];
    const midi = german
      ? 60 + ({ A: 9, Bb: 10, C: 0, D: 2, E: 4, F: 5, G: 7, B: 11, Eb: 3 } as Record<string, number>)[german]!
      : scale[(letter.charCodeAt(0) - 65) % scale.length]!;
    notes.push({ midi, start, dur: 1 });
    names.push(`${letter} → ${midiToNote(midi).replace(/\d/, '')}`);
  });
  return { notes, names };
}

export interface VoiceFrame {
  hz: number | null;
  level: number;
}

/** De las alturas cantadas a notas: agrupa lo estable y descarta los pasajes muy cortos. */
export function notesFromVoice(frames: VoiceFrame[], frameMs: number, a4 = 440, minMs = 90): Note[] {
  const toMidi = (hz: number) => Math.round(69 + centsBetween(hz, midiToHz(69, a4)) / 100);
  const eighthMs = 250;
  const notes: Note[] = [];
  let current: { midi: number; from: number; to: number } | null = null;
  const flush = () => {
    if (current && (current.to - current.from) * frameMs >= minMs) {
      notes.push({
        midi: current.midi,
        start: Math.round((current.from * frameMs) / eighthMs),
        dur: Math.max(1, Math.round(((current.to - current.from) * frameMs) / eighthMs)),
      });
    }
    current = null;
  };
  frames.forEach((frame, index) => {
    const midi = frame.hz === null ? null : toMidi(frame.hz);
    if (midi === null) flush();
    else if (current && current.midi === midi) current.to = index + 1;
    else {
      flush();
      current = { midi, from: index, to: index + 1 };
    }
  });
  flush();
  return notes;
}

/** Ataques de una voz hablada: subidas de energía separadas por al menos `minGapMs`. */
export function speechOnsets(levels: number[], frameMs: number, minGapMs = 110): number[] {
  const peak = Math.max(...levels, 0);
  if (peak <= 0.005) return [];
  const threshold = peak * 0.3;
  const onsets: number[] = [];
  let armed = true;
  let last = -Infinity;
  levels.forEach((level, index) => {
    const time = index * frameMs;
    if (armed && level >= threshold && time - last >= minGapMs) {
      onsets.push(time);
      last = time;
      armed = false;
    } else if (level < threshold * 0.6) {
      armed = true;
    }
  });
  return onsets;
}

/** Lleva los ataques a una grilla de corcheas, usando el tiempo más común entre sílabas. */
export function quantizeOnsets(onsets: number[]): { cells: boolean[]; unitMs: number } {
  if (onsets.length < 2) return { cells: onsets.length ? [true] : [], unitMs: 0 };
  const gaps = onsets.slice(1).map((onset, i) => onset - onsets[i]!);
  const sorted = [...gaps].sort((a, b) => a - b);
  const unitMs = Math.max(60, sorted[Math.floor(sorted.length / 4)]!);
  const positions = onsets.map((onset) => Math.round((onset - onsets[0]!) / unitMs));
  const cells = new Array<boolean>(positions[positions.length - 1]! + 1).fill(false);
  positions.forEach((position) => (cells[position] = true));
  return { cells, unitMs };
}

/** Una línea posible para oír la idea en la consigna. Es un ejemplo, no la respuesta. */
export function exampleMelody(rng: Rng, tonic: number, mode: ModeId): Note[] {
  const contours = Object.keys(CONTOURS) as ContourId[];
  const contour = sampleContour(CONTOURS[rng.pick(contours)].shape);
  return fitContour(contour, {
    tonic,
    mode,
    range: rng.int(4, 7),
    length: 8,
    taboo: null,
    forbiddenInterval: null,
    startDegree: null,
  });
}
