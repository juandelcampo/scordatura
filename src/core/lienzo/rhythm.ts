// Ritmo del lienzo: los ritmos de core/rhythm vistos compás por compás, como niveles de 0 a 3 por
// paso (para dibujarlos y para que suenen), y medidos contra el compás de la consigna.
import { cycleFor, DRUMS, euclid, type Meter, type RhythmConfig } from '../rhythm';
import type { Risk } from '../roll';
import type { Rng } from '../rng';
import type { Check } from './harmony';
import type { LaneRhythm } from './types';

/** 0 = silencio, 1 = golpe suave, 2 = acento, 3 = el acento que abre el compás o el bombo. */
export type StepLevel = 0 | 1 | 2 | 3;

const withBpm = (config: LaneRhythm): RhythmConfig => ({ ...config, bpm: 120 }) as RhythmConfig;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

export const meterEighths = ({ groups, denom }: Meter) => (groups.reduce((a, b) => a + b, 0) * 8) / denom;
/** Negras por compás: 7/8 → 3.5, 5/4 → 5, 3/4 → 3. */
export const quartersPerBar = ({ groups, denom }: Meter) => (groups.reduce((a, b) => a + b, 0) * 4) / denom;
export const meterLabel = ({ groups, denom }: Meter) => `${groups.reduce((a, b) => a + b, 0)}/${denom}`;

/** Los niveles de cada paso del compás `bar` (desde 0). Solo el mutante cambia de un compás a otro. */
export function rBar(config: LaneRhythm, bar: number): StepLevel[] {
  if (config.mode === 'poly') {
    const { a, b } = config;
    const steps = (a * b) / gcd(a, b);
    return Array.from({ length: steps }, (_, i) => {
      const onA = i % (steps / a) === 0;
      const onB = i % (steps / b) === 0;
      return onA && onB ? 3 : onA ? 2 : onB ? 1 : 0;
    });
  }
  if (config.mode === 'drum') {
    const bombo = DRUMS.findIndex((d) => d.id === 'bombo');
    const caja = DRUMS.findIndex((d) => d.id === 'caja');
    return Array.from({ length: config.steps }, (_, i) => {
      if (config.tracks[bombo]?.[i]) return 3;
      if (config.tracks[caja]?.[i]) return 2;
      return config.tracks.some((track) => track[i]) ? 1 : 0;
    });
  }
  // Compás agrupado, euclidiano y mutante: un solo carril, un golpe por paso como mucho.
  const cycle = cycleFor(withBpm(config), bar);
  const levels = new Array<StepLevel>(cycle.lanes[0] ?? 0).fill(0);
  for (const hit of cycle.hits) levels[hit.cell] = (hit.level + 1) as StepLevel;
  return levels;
}

/** Qué tan lleno es un compás, de 0 a 1. */
export function density(config: LaneRhythm): number {
  const steps = rBar(config, 0);
  return steps.filter((x) => x > 0).length / Math.max(1, steps.length);
}

/** La contraparte: toca donde el patrón calla. Para una segunda guitarra o la mano izquierda. */
export const counterpart = (levels: readonly StepLevel[]): StepLevel[] => levels.map((x) => (x ? 0 : 2));

/** Cuántas corcheas mide un compás de este ritmo. */
export const rhythmEighths = (config: LaneRhythm, bar = 0) => cycleFor(withBpm(config), bar).beats * 2;

export function checkRhythm(config: LaneRhythm, meter: Meter): Check {
  const label = meterLabel(meter);
  const need = meterEighths(meter);
  if (config.mode === 'poly') return { ok: true, why: 'Va por encima del compás.' };
  if (config.mode === 'mutante') {
    const passes = config.meters.some((m) => meterEighths(m) === need);
    return passes
      ? { ok: true, why: `Pasa por ${label}.` }
      : { ok: false, why: `Ninguno de sus compases es ${label}.` };
  }
  const has = rhythmEighths(config);
  return has === need
    ? { ok: true, why: `Entra justo en ${label}.` }
    : { ok: false, why: `Mide ${has} corcheas; ${label} pide ${need}.` };
}

/** Parte n corcheas en grupos de 2 y 3. */
export function partition(n: number, rng: Rng): number[] {
  const groups: number[] = [];
  let left = n;
  while (left > 0) {
    const g = left === 4 ? 2 : left <= 3 ? left : rng.pick([2, 3]);
    groups.push(g);
    left -= g;
  }
  return groups;
}

/** Una batería que acentúa los grupos: bombo en el primero y el tercero, caja en el segundo. */
export function drumFromGroups(groups: readonly number[]): Extract<LaneRhythm, { mode: 'drum' }> {
  const steps = groups.reduce((a, b) => a + b, 0) * 2;
  const starts: number[] = [];
  groups.reduce((pos, g) => (starts.push(pos), pos + g * 2), 0);
  const tracks = DRUMS.map(() => new Array<boolean>(steps).fill(false));
  const row = (id: string) => tracks[DRUMS.findIndex((d) => d.id === id)]!;
  for (let i = 0; i < steps; i++) {
    row('bombo')[i] = i === starts[0] || (starts.length > 2 && i === starts[2]);
    row('caja')[i] = starts.length > 1 && i === starts[1];
    row('hihat')[i] = i % 2 === 0;
  }
  return { mode: 'drum', steps, tracks, levels: DRUMS.map(() => 0.8) };
}

const MODES_BY_RISK: Record<Risk, LaneRhythm['mode'][]> = {
  0: ['meter', 'meter', 'drum'],
  1: ['meter', 'euclid', 'drum'],
  2: ['euclid', 'poly', 'mutante'],
};

const OTHER_METERS: Meter[] = [
  { groups: [2, 2, 2, 2], denom: 8 },
  { groups: [2, 2, 2], denom: 8 },
  { groups: [3, 3], denom: 8 },
];

export function makeRhythm(meter: Meter, risk: Risk, rng: Rng, mode?: LaneRhythm['mode']): LaneRhythm {
  const n = meterEighths(meter);
  const chosen = mode ?? rng.pick(MODES_BY_RISK[risk]);
  switch (chosen) {
    case 'meter':
      return { mode: 'meter', groups: partition(n, rng), denom: 8 };
    case 'euclid': {
      const pulses = Math.max(2, Math.min(n - 1, Math.round(n * (0.35 + rng.next() * 0.3))));
      return { mode: 'euclid', pulses, steps: n, rotation: rng.int(0, n - 1) };
    }
    case 'poly':
      return { mode: 'poly', a: rng.pick([3, 5]), b: rng.pick([2, 4]) };
    case 'mutante': {
      const other = rng.pick(OTHER_METERS.filter((m) => meterEighths(m) !== n));
      return { mode: 'mutante', meters: [meter, other], barsEach: rng.int(1, 3) };
    }
    case 'drum':
      return drumFromGroups(partition(n, rng));
  }
}

export { euclid };
