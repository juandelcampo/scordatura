// Digitaciones de guitarra para cualquier afinación, incluidas las de cuerdas sacadas (null), y las
// alturas con que suena cada acorde.
import { noteToMidi } from '../notes';
import type { ChordInfo } from './harmony';
import type { Tuning } from './types';

/** Traste por cuerda, de la 6ª a la 1ª. -1 es una cuerda que no se toca. */
export type Shape = number[];

const cache = new Map<string, Shape | null>();

/**
 * Búsqueda por fuerza bruta: raíz en el bajo, todas las notas del acorde, apertura de 3 trastes como
 * mucho, 4 dedos como mucho y cuerdas muteadas solo en los graves.
 */
export function findShape(
  tuning: readonly (number | null)[],
  chord: Pick<ChordInfo, 'root' | 'pcs'>,
): Shape | null {
  const key = `${tuning.join(',')}:${chord.root}:${chord.pcs.join(',')}`;
  if (cache.has(key)) return cache.get(key)!;
  let best: Shape | null = null;
  let bestScore = Infinity;
  const current: number[] = [];
  const strings = tuning.length;
  const walk = (i: number, started: boolean) => {
    if (i < strings && tuning[i] === null) {
      current.push(-1);
      walk(i + 1, started);
      current.pop();
      return;
    }
    if (i === strings) {
      const sounded = current.map((f, j) => (f < 0 ? -1 : (tuning[j]! + f) % 12));
      const first = sounded.find((p) => p >= 0);
      if (first === undefined || first !== chord.root) return;
      const set = new Set(sounded.filter((p) => p >= 0));
      if (!chord.pcs.every((p) => set.has(p))) return;
      const playable = tuning.filter((p) => p !== null).length;
      const mutes = current.filter((f, j) => f < 0 && tuning[j] !== null).length;
      if (playable - mutes < Math.min(4, playable)) return;
      const fretted = current.filter((f) => f > 0);
      if (fretted.length > 4) return;
      const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
      if (span > 3) return;
      const score = mutes * 3 + fretted.length + (fretted.length ? Math.max(...fretted) * 0.4 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = [...current];
      }
      return;
    }
    for (let f = started ? 0 : -1; f <= 7; f++) {
      if (f >= 0 && !chord.pcs.includes((tuning[i]! + f) % 12)) continue;
      current.push(f);
      walk(i + 1, started || f >= 0);
      current.pop();
    }
  };
  walk(0, false);
  cache.set(key, best);
  return best;
}

/** Las alturas de un acorde: en guitarra, las de su digitación; si no, una posición cerrada. */
export function chordMidis(chord: ChordInfo, tuning: Tuning | null): number[] {
  if (tuning?.notes && tuning.notes.length === tuning.pcs.length) {
    const shape = findShape(tuning.pcs, chord);
    if (shape) {
      const midis = shape.flatMap((f, i) => {
        const note = tuning.notes![i];
        return f < 0 || !note ? [] : [noteToMidi(note) + f];
      });
      if (midis.length) return midis;
    }
  }
  const base = 48 + chord.root;
  return [36 + chord.root, ...chord.pcs.map((p) => base + ((p - chord.root + 12) % 12))];
}
