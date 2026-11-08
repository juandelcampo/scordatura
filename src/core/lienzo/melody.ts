// Melodía del lienzo: una columna por sílaba de la letra, alturas en grados de la escala. La app no
// escribe la melodía: pone apoyos sueltos o completa huecos siguiendo un contorno.
import { MODES } from '../harmony';
import { CONTOURS } from '../melody';
import { createRng } from '../rng';
import { chordAtT, chordOf, segsOf, type Check } from './harmony';
import { linesOf, syllables } from './lyrics';
import type { Chord, Key, MelodyFill, Section, VariantOf } from './types';

export interface Slot {
  /** Compás donde empieza, desde 0 y con fracciones. */
  t: number;
  /** Duración en compases. */
  dur: number;
  /** Posición dentro de la frase, de 0 a 1. */
  x: number;
  first: boolean;
  end: boolean;
  line: number;
  /** El verso al que pertenece; vacío si no hay letra. */
  label: string;
}

/**
 * Las columnas de la melodía. Con letra, una por sílaba: cada verso ocupa bars / versos compases y la
 * frase llena el 80 %. Si arranca después del uno, se corre un octavo del verso. Sin letra, dos notas
 * por compás en frases de 4 compases.
 */
export function melSlots(sec: Pick<Section, 'bars' | 'phrase'>, lyric: string | undefined): Slot[] {
  const bars = sec.bars;
  const lines = linesOf(lyric);
  const slots: Slot[] = [];
  if (lines.length) {
    const per = bars / lines.length;
    const offset = sec.phrase === 'back' ? per * 0.125 : 0;
    lines.forEach((label, line) => {
      const n = Math.max(1, syllables(label));
      const step = (per * 0.8 - offset) / n;
      for (let k = 0; k < n; k++) {
        const last = k === n - 1;
        slots.push({
          t: line * per + offset + k * step,
          dur: last ? per - offset - k * step - per * 0.06 : step * 0.9,
          x: n > 1 ? k / (n - 1) : 0.5,
          first: k === 0,
          end: last,
          line,
          label,
        });
      }
    });
    return slots;
  }
  const phrase = Math.min(4, bars);
  const perBar = 2;
  for (let i = 0; i < bars * perBar; i++) {
    const t = i / perBar;
    const end = (i + 1) % (phrase * perBar) === 0;
    slots.push({
      t,
      dur: end ? 0.9 : 0.42,
      x: (t % phrase) / phrase,
      first: i % (phrase * perBar) === 0,
      end,
      line: Math.floor(t / phrase),
      label: '',
    });
  }
  return slots;
}

const mod7 = (n: number) => ((n % 7) + 7) % 7;

/** Clase de altura de un grado (puede ser negativo o pasar de 6). */
export const degPc = (degree: number, key: Key) => (key.tonic + MODES[key.mode].steps[mod7(degree)]!) % 12;

/** El grado en midi, con la tónica entre el Fa♯3 y el Fa♯4. */
export function degMidi(degree: number, key: Key): number {
  const tonicMidi = 60 + key.tonic - (key.tonic > 6 ? 12 : 0);
  return tonicMidi + 12 * Math.floor(degree / 7) + MODES[key.mode].steps[mod7(degree)]!;
}

/** Lo que la consigna le pide a la melodía. */
export type MelodyRule = 'sin-tonica' | 'solo-saltos' | 'sube-y-cae' | null;

type Melody = Pick<VariantOf<'melodia'>, 'contour' | 'fill' | 'seed' | 'shift' | 'notes'>;

/**
 * Sigue el contorno. En los tiempos fuertes (primera y última sílaba, cambios de acorde) cae en notas
 * del acorde; en el resto, en la escala. Con "apoyos" solo pone las fuertes.
 */
export function genMel(
  v: Melody,
  sec: Pick<Section, 'bars'>,
  slots: readonly Slot[],
  harmony: readonly Chord[] | null,
  key: Key,
  rule: MelodyRule,
  fill: MelodyFill = v.fill,
): (number | null)[] {
  const changes = harmony ? segsOf(harmony, sec.bars) : [];
  const rng = createRng(v.seed || 1);
  const shape = CONTOURS[v.contour].shape;
  const low = -1 + (v.shift || 0);
  const span = 6;
  let previous: number | null = null;
  return slots.map((slot) => {
    const chord = harmony?.length ? chordOf(chordAtT(harmony, sec.bars, slot.t)!, key) : null;
    const strong = slot.first || slot.end || changes.some((g) => Math.abs(g.t - slot.t) < 0.12);
    const jitter = rng.next() - 0.5;
    if (fill === 'apoyos' && !strong) return null;
    const target = low + shape(slot.x) * span + jitter;
    let best: number | null = null;
    let bestDistance = Infinity;
    for (let degree = low - 3; degree <= low + span + 3; degree++) {
      const pc = degPc(degree, key);
      if (strong && chord && !chord.pcs.includes(pc)) continue;
      let distance = Math.abs(degree - target);
      if (rule === 'sin-tonica' && slot.end && pc === key.tonic) distance += 20;
      if (rule === 'solo-saltos' && previous !== null && Math.abs(degree - previous) < 2) distance += 20;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = degree;
      }
    }
    previous = best;
    return best;
  });
}

/** Las alturas de la variante: las editadas, o las generadas si todavía no se editó. */
export function melDegs(
  v: Melody,
  sec: Pick<Section, 'bars'>,
  slots: readonly Slot[],
  harmony: readonly Chord[] | null,
  key: Key,
  rule: MelodyRule,
): (number | null)[] {
  if (Array.isArray(v.notes)) return slots.map((_, i) => v.notes![i] ?? null);
  return genMel(v, sec, slots, harmony, key, rule);
}

export function checkMelody(
  degrees: readonly (number | null)[],
  slots: readonly Slot[],
  rule: MelodyRule,
  key: Key,
): Check | null {
  if (!rule) return null;
  const notes = degrees.flatMap((d, i) => (d === null ? [] : [{ d, slot: slots[i]! }]));
  if (!notes.length) return { ok: false, why: 'Sin notas todavía.' };
  if (rule === 'sin-tonica') {
    const bad = notes.filter((n) => n.slot.end && degPc(n.d, key) === key.tonic).length;
    return bad
      ? { ok: false, why: `${bad} frases cierran en la tónica.` }
      : { ok: true, why: 'Ninguna cierra en la tónica.' };
  }
  if (rule === 'solo-saltos') {
    let bad = 0;
    for (let i = 1; i < notes.length; i++) if (Math.abs(notes[i]!.d - notes[i - 1]!.d) < 2) bad += 1;
    return bad ? { ok: false, why: `${bad} pasos son notas vecinas.` } : { ok: true, why: 'Todo salta.' };
  }
  // Sube y cae: el pico de la frase está en su tercio del medio, en la mitad de las frases o más.
  const lines = [...new Set(notes.map((n) => n.slot.line))];
  let good = 0;
  for (const line of lines) {
    const phrase = notes.filter((n) => n.slot.line === line);
    if (phrase.length < 3) continue;
    const top = Math.max(...phrase.map((n) => n.d));
    const at = phrase.findIndex((n) => n.d === top) / (phrase.length - 1);
    if (at > 0.2 && at < 0.8 && phrase[0]!.d < top && phrase[phrase.length - 1]!.d < top) good += 1;
  }
  return good >= Math.ceil(lines.length / 2)
    ? { ok: true, why: `${good} de ${lines.length} frases suben y caen.` }
    : { ok: false, why: `${good} de ${lines.length} frases hacen arco.` };
}
