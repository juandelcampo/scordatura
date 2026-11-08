// Lo que suena en cada compás del tema, en tiempo relativo al compás. Lo usan el audio (que lo agenda
// compás por compás) y el MIDI (que lo escribe entero). Una sola fuente para las dos cosas.
import { DRUMS, type DrumId } from '../rhythm';
import { chordOf, segsOf } from './harmony';
import { melDegs, melSlots, degMidi } from './melody';
import { clipOf, totalBars } from './project';
import { quartersPerBar, rBar } from './rhythm';
import type { LienzoRules } from './rules';
import { chordMidis } from './voicing';
import type { Project, Section } from './types';

export interface BarEvents {
  sec: Section;
  /** Compás dentro de la sección, desde 0. */
  bar: number;
  /** Negras del compás. */
  quarters: number;
  /** Tiempos en compases desde el inicio de este compás; duraciones en compases. */
  chords: { at: number; len: number; name: string; midis: number[] }[];
  hits: { at: number; voice: DrumId; gain: number }[];
  notes: { at: number; dur: number; midi: number }[];
}

export function secAtBar(
  secs: readonly Section[],
  bar: number,
): { sec: Section; bar: number; start: number } | null {
  let start = 0;
  for (const sec of secs) {
    if (bar < start + sec.bars) return { sec, bar: bar - start, start };
    start += sec.bars;
  }
  return null;
}

const EPS = 1e-6;
const inBar = (t: number, bar: number) => t >= bar - EPS && t < bar + 1 - EPS;
const LEVEL_VOICE: Record<number, { voice: DrumId; gain: number }> = {
  3: { voice: 'bombo', gain: 1 },
  2: { voice: 'caja', gain: 0.75 },
  1: { voice: 'hihat', gain: 0.35 },
};

export function barEvents(p: Project, rules: LienzoRules, absoluteBar: number): BarEvents | null {
  const at = secAtBar(p.secs, absoluteBar);
  if (!at) return null;
  const { sec, bar } = at;
  const out: BarEvents = { sec, bar, quarters: quartersPerBar(rules.meter), chords: [], hits: [], notes: [] };
  const harmony = clipOf(p, 'armonia', sec);
  if (harmony) {
    for (const g of segsOf(harmony.chords, sec.bars)) {
      if (!inBar(g.t, bar)) continue;
      const info = chordOf(g.c, p.key);
      out.chords.push({
        at: g.t - bar,
        len: g.len,
        name: info.name,
        midis: chordMidis(info, p.instrument === 'guitarra' ? p.tuning : null),
      });
    }
  }
  const rhythm = clipOf(p, 'ritmo', sec);
  if (rhythm) {
    const config = rhythm.config;
    if (config.mode === 'drum') {
      config.tracks.forEach((track, lane) =>
        track.forEach((on, step) => {
          const gain = config.levels[lane] ?? 0.8;
          if (on && gain > 0) out.hits.push({ at: step / config.steps, voice: DRUMS[lane]!.id, gain });
        }),
      );
    } else {
      const levels = rBar(config, bar);
      levels.forEach((level, step) => {
        const hit = LEVEL_VOICE[level];
        if (hit) out.hits.push({ at: step / levels.length, ...hit });
      });
    }
  }
  const melody = clipOf(p, 'melodia', sec);
  if (melody) {
    const lyric = clipOf(p, 'letra', sec)?.text;
    const slots = melSlots(sec, lyric);
    const degrees = melDegs(melody, sec, slots, harmony?.chords ?? null, p.key, rules.melody);
    slots.forEach((slot, i) => {
      const d = degrees[i];
      if (d === null || d === undefined || !inBar(slot.t, bar)) return;
      out.notes.push({ at: slot.t - bar, dur: slot.dur, midi: degMidi(d, p.key) });
    });
  }
  return out;
}

/** Todo el tema, compás por compás. */
export const allBars = (p: Project, rules: LienzoRules) =>
  Array.from({ length: totalBars(p.secs) }, (_, i) => barEvents(p, rules, i)!).filter(Boolean);
