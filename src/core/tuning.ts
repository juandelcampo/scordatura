// Lo que se deduce de una afinación: acorde al aire, intervalos, tensión de cada cuerda.
import { STANDARD, type Tuning } from '~/data/tunings';
import { intervalName, noteLabel, noteToMidi, midiToNote, type Notation } from './notes';

const CHORDS: ReadonlyArray<readonly [string, readonly number[]]> = [
  ['', [0, 4, 7]],
  ['m', [0, 3, 7]],
  ['5', [0, 7]],
  ['sus2', [0, 2, 7]],
  ['sus4', [0, 5, 7]],
  ['6', [0, 4, 7, 9]],
  ['m6', [0, 3, 7, 9]],
  ['7', [0, 4, 7, 10]],
  ['maj7', [0, 4, 7, 11]],
  ['m7', [0, 3, 7, 10]],
  ['add9', [0, 2, 4, 7]],
  ['madd9', [0, 2, 3, 7]],
  ['add11', [0, 4, 5, 7]],
  ['7sus4', [0, 5, 7, 10]],
  ['9', [0, 2, 4, 7, 10]],
  ['maj9', [0, 2, 4, 7, 11]],
  ['m9', [0, 2, 3, 7, 10]],
  ['m11', [0, 3, 5, 7, 10]],
  ['6/9', [0, 2, 4, 7, 9]],
  ['dim', [0, 3, 6]],
  ['dim7', [0, 3, 6, 9]],
  ['aug', [0, 4, 8]],
  ['m7(no5)', [0, 3, 10]],
  ['7(no5)', [0, 4, 10]],
  ['maj7(no5)', [0, 4, 11]],
  ['(no5)', [0, 4]],
  ['m(no5)', [0, 3]],
];

export interface OpenChord {
  /** Índice de la cuerda que da la raíz. */
  root: number;
  suffix: string;
  /** Índice de la cuerda del bajo, si no coincide con la raíz. */
  bass: number | null;
  single?: boolean;
}

/** Nombra el acorde que forman las cuerdas al aire, o null si no forman uno reconocible. */
export function openChord(midis: number[]): OpenChord | null {
  const classes = [...new Set(midis.map((midi) => midi % 12))];
  const lowest = midis.indexOf(Math.min(...midis));
  const bassClass = midis[lowest]! % 12;
  if (classes.length === 1) return { root: lowest, suffix: '', bass: null, single: true };

  // Primero se prueba con el bajo como raíz, y solo después con inversiones.
  const roots = [bassClass, ...classes.filter((pitchClass) => pitchClass !== bassClass)];
  for (const root of roots) {
    const intervals = classes.map((pitchClass) => (pitchClass - root + 12) % 12).sort((a, b) => a - b);
    const chord = CHORDS.find(
      ([, shape]) => shape.length === intervals.length && shape.every((step, i) => step === intervals[i]),
    );
    if (chord) {
      const rootString = midis.findIndex((midi) => midi % 12 === root);
      return { root: rootString, suffix: chord[0], bass: root === bassClass ? null : lowest };
    }
  }
  return null;
}

export function openChordName(notes: string[], notation: Notation = 'letters'): string {
  const chord = openChord(notes.map(noteToMidi));
  if (!chord) return 'Sin nombre: un cúmulo';
  const label = (index: number) => noteLabel(notes[index]!, notation);
  if (chord.single) return `Solo ${label(chord.root)}`;
  return label(chord.root) + chord.suffix + (chord.bass === null ? '' : `/${label(chord.bass)}`);
}

export function stringIntervals(notes: string[]): string[] {
  const midis = notes.map(noteToMidi);
  return midis.slice(1).map((midi, index) => intervalName(midis[index]!, midi));
}

/** Semitonos de cada cuerda respecto de la afinación estándar. */
export function stringOffsets(notes: string[]): number[] {
  return notes.map((note, index) => noteToMidi(note) - noteToMidi(STANDARD[index]!));
}

export function changeSummary(notes: string[]): { changed: number; semitones: number } {
  const offsets = stringOffsets(notes);
  return {
    changed: offsets.filter((offset) => offset !== 0).length,
    semitones: offsets.reduce((sum, offset) => sum + Math.abs(offset), 0),
  };
}

/** Subir mucho puede cortar la cuerda; bajar mucho la deja sin tensión ni afinación estable. */
export function isFarFromStandard(offset: number): boolean {
  return offset > 2 || offset < -5;
}

export function tensionWarning(tuning: Pick<Tuning, 'notes' | 'restring'>): string | null {
  const count = tuning.notes.length;
  const describe = (offset: number, index: number) =>
    `${count - index}.ª (${offset > 0 ? '+' : '−'}${Math.abs(offset)})`;
  const offsets = stringOffsets(tuning.notes);
  const high = offsets.flatMap((offset, index) => (offset > 2 ? [describe(offset, index)] : []));
  const low = offsets.flatMap((offset, index) => (offset < -5 ? [describe(offset, index)] : []));
  const parts: string[] = [];
  if (high.length) parts.push(`Puede cortarse por exceso de tensión: ${high.join(', ')}.`);
  if (low.length) parts.push(`Puede quedar muy floja: ${low.join(', ')}.`);
  if (tuning.restring) parts.push('Conviene encordar a medida.');
  return parts.length ? parts.join(' ') : null;
}

export interface SoloShape {
  frets: number[];
  chord: string;
  label: string;
}

/** Lo que suena con un solo dedo: al aire, un traste en una cuerda, o una cejilla recta. */
export function soloShapes(notes: string[], maxFret = 5, limit = 18): SoloShape[] {
  const open = notes.map(noteToMidi);
  const shapes: SoloShape[] = [{ frets: open.map(() => 0), chord: openChordName(notes), label: 'Al aire' }];
  const seen = new Set([shapes[0]!.chord]);
  const add = (frets: number[], label: string) => {
    const sounding = open.map((midi, index) => midiToNote(midi + frets[index]!));
    if (!openChord(sounding.map(noteToMidi))) return;
    const chord = openChordName(sounding);
    if (seen.has(chord)) return;
    seen.add(chord);
    shapes.push({ frets, chord, label });
  };
  for (let fret = 1; fret <= maxFret; fret++)
    add(
      open.map(() => fret),
      `Cejilla en el traste ${fret}`,
    );
  for (let fret = 1; fret <= maxFret; fret++) {
    open.forEach((_, stringIndex) => {
      const frets = open.map((__, index) => (index === stringIndex ? fret : 0));
      add(frets, `${open.length - stringIndex}.ª cuerda, traste ${fret}`);
    });
  }
  return shapes.slice(0, limit);
}

/** Sube o baja una cuerda dentro del rango permitido, conservando la nota si no se puede. */
export function shiftString(notes: string[], index: number, delta: number, range = 12): string[] {
  const midi = noteToMidi(notes[index]!) + delta;
  if (Math.abs(midi - noteToMidi(STANDARD[index]!)) > range) return notes;
  return notes.map((note, i) => (i === index ? midiToNote(midi) : note));
}
