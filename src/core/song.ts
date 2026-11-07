// El tema entero: la forma, con lo que suena en cada bloque ubicado en el tiempo. Una sección sin
// algo propio usa lo de la consigna. El tiempo se mide en negras desde el inicio de cada bloque.
import { closeVoicing, isChordBeats, parseChord, voicingFor } from './chords';
import type { DroneConfig } from './drone';
import type { Note } from './melody';
import { clampBpm, DRUMS, rhythmToDrums, type DrumConfig, type DrumId, type RhythmConfig } from './rhythm';

export const LANES = ['acordes', 'bateria', 'melodia', 'drone'] as const;
export type Lane = (typeof LANES)[number];
export type SongMix = Partial<Record<Lane, { mute?: boolean; solo?: boolean }>>;

export const DEFAULT_BARS = 4;
export const MAX_BARS = 32;

export interface SongSectionInput {
  chords?: string[];
  chordBeats?: number[];
  rhythm?: RhythmConfig;
  bars?: number;
  droneOff?: boolean;
}

export interface SongInput {
  blocks: string[];
  sections: Record<string, SongSectionInput | undefined>;
  /** Lo que usa una sección que todavía no tiene lo suyo. */
  fallback: { chords: string[]; chordBeats?: number[]; rhythm: RhythmConfig };
  tuning: string[];
  melody: Note[];
  /** La melodía la armó la persona. Si no, es un ejemplo y arranca silenciada. */
  melodyChosen: boolean;
  drone: DroneConfig;
  tempo: number | null;
  mix: SongMix;
  a4: number;
}

export interface SongBar {
  start: number;
  beats: number;
  drums: DrumConfig;
}

export interface ChordChange {
  beat: number;
  beats: number;
  name: string;
  midis: number[];
}

export interface SongBlock {
  letter: string;
  beats: number;
  bars: SongBar[];
  changes: ChordChange[];
  drone: boolean;
}

export interface Song {
  bpm: number;
  blocks: SongBlock[];
  melody: Note[];
  audible: Record<Lane, boolean>;
  drone: DroneConfig;
  a4: number;
}

export type SongEvent =
  | { kind: 'drum'; beat: number; voice: DrumId; gain: number }
  | { kind: 'chord'; beat: number; midis: number[] }
  | { kind: 'note'; beat: number; midi: number };

/** La melodía de ejemplo arranca silenciada: es una idea para oír, no parte del tema. */
export const isMuted = (lane: Lane, mix: SongMix, melodyChosen: boolean): boolean =>
  mix[lane]?.mute ?? (lane === 'melodia' && !melodyChosen);

function audibleLanes(mix: SongMix, melodyChosen: boolean): Record<Lane, boolean> {
  const soloed = LANES.some((lane) => mix[lane]?.solo);
  return Object.fromEntries(
    LANES.map((lane) => [lane, soloed ? !!mix[lane]?.solo : !isMuted(lane, mix, melodyChosen)]),
  ) as Record<Lane, boolean>;
}

function midisOf(name: string, tuning: string[]): number[] {
  const parsed = parseChord(name);
  if (!parsed) return [];
  return voicingFor(tuning, name)?.midis ?? closeVoicing(parsed);
}

/**
 * Un acorde por compás, repitiendo la progresión si hay menos acordes que compases. Si hay más, se
 * reparten parejos en el bloque: todos suenan.
 *
 * Con duraciones propias, la vuelta se repite hasta llenar el bloque y el último acorde se corta donde
 * termina. Si la vuelta no entra, se comprime en proporción, para que también suenen todos.
 */
export function chordChanges(
  chords: string[],
  beats: number,
  bars: number,
  tuning: string[],
  chordBeats?: number[],
): ChordChange[] {
  if (chords.length === 0) return [];
  if (isChordBeats(chordBeats, chords.length)) {
    const total = chordBeats.reduce((sum, value) => sum + value, 0);
    const scale = total > beats ? beats / total : 1;
    const changes: ChordChange[] = [];
    for (let beat = 0, index = 0; beat < beats - 1e-9; index++) {
      const position = index % chords.length;
      const name = chords[position]!;
      const length = Math.min(chordBeats[position]! * scale, beats - beat);
      changes.push({ beat, beats: length, name, midis: midisOf(name, tuning) });
      beat += length;
    }
    return changes;
  }
  const count = Math.max(chords.length, bars);
  const length = beats / count;
  return Array.from({ length: count }, (_, index) => {
    const name = chords[index % chords.length]!;
    return { beat: index * length, beats: length, name, midis: midisOf(name, tuning) };
  });
}

function buildBlock(letter: string, input: SongInput): SongBlock {
  const section = input.sections[letter];
  const rhythm = section?.rhythm ?? input.fallback.rhythm;
  const count = section?.bars ?? DEFAULT_BARS;
  const harmony = section?.chords ? section : input.fallback;
  let start = 0;
  const bars = Array.from({ length: count }, (_, index): SongBar => {
    const drums = rhythmToDrums(rhythm, index);
    const bar = { start, beats: drums.steps / 4, drums };
    start += bar.beats;
    return bar;
  });
  return {
    letter,
    beats: start,
    bars,
    changes: chordChanges(harmony.chords!, start, count, input.tuning, harmony.chordBeats),
    drone: !section?.droneOff,
  };
}

export function buildSong(input: SongInput): Song {
  const byLetter = new Map<string, SongBlock>();
  const blocks = input.blocks.map((letter) => {
    const block = byLetter.get(letter) ?? buildBlock(letter, input);
    byLetter.set(letter, block);
    return block;
  });
  const first = input.sections[input.blocks[0] ?? '']?.rhythm ?? input.fallback.rhythm;
  return {
    bpm: clampBpm(input.tempo ?? first.bpm),
    blocks,
    melody: input.melody,
    audible: audibleLanes(input.mix, input.melodyChosen),
    drone: input.drone,
    a4: input.a4,
  };
}

/** Las notas de la melodía en el bloque: la frase se repite en múltiplos de compás hasta llenarlo. */
export function melodyInBlock(
  melody: Note[],
  block: SongBlock,
): Array<{ beat: number; beats: number; midi: number }> {
  if (melody.length === 0 || block.beats <= 0) return [];
  const bar = block.bars[0]?.beats || 1;
  const end = Math.max(...melody.map((note) => note.start + note.dur)) / 2;
  const phrase = Math.max(1, Math.ceil(end / bar)) * bar;
  const notes: Array<{ beat: number; beats: number; midi: number }> = [];
  for (let origin = 0; origin < block.beats; origin += phrase) {
    for (const note of melody) {
      const beat = origin + note.start / 2;
      if (beat < block.beats) {
        notes.push({ beat, beats: Math.min(note.dur / 2, block.beats - beat), midi: note.midi });
      }
    }
  }
  return notes;
}

/** Lo que tiene que sonar en este bloque entre dos momentos: incluye el primero, no el último. */
export function eventsBetween(song: Song, blockIndex: number, from: number, to: number): SongEvent[] {
  const block = song.blocks[blockIndex];
  if (!block) return [];
  const events: SongEvent[] = [];
  const inside = (beat: number) => beat >= from && beat < to;

  if (song.audible.bateria) {
    for (const bar of block.bars) {
      if (bar.start >= to || bar.start + bar.beats <= from) continue;
      const { steps, tracks, levels } = bar.drums;
      tracks.forEach((track, lane) => {
        const gain = levels[lane] ?? 0;
        if (gain <= 0) return;
        track.forEach((on, step) => {
          const beat = bar.start + (step * bar.beats) / steps;
          if (on && inside(beat)) events.push({ kind: 'drum', beat, voice: DRUMS[lane]!.id, gain });
        });
      });
    }
  }
  if (song.audible.acordes) {
    for (const change of block.changes) {
      if (inside(change.beat)) events.push({ kind: 'chord', beat: change.beat, midis: change.midis });
    }
  }
  if (song.audible.melodia) {
    for (const note of melodyInBlock(song.melody, block)) {
      if (inside(note.beat)) events.push({ kind: 'note', beat: note.beat, midi: note.midi });
    }
  }
  return events.sort((a, b) => a.beat - b.beat);
}

/** En qué compás y en qué paso de la batería cae un momento del bloque. */
export function locate(block: SongBlock, beat: number): { bar: number; step: number } {
  for (let index = block.bars.length - 1; index >= 0; index--) {
    const bar = block.bars[index]!;
    if (beat >= bar.start) {
      const step = Math.floor(((beat - bar.start) * bar.drums.steps) / bar.beats);
      return { bar: index, step: Math.min(step, bar.drums.steps - 1) };
    }
  }
  return { bar: 0, step: 0 };
}

/** Todas las alturas del tema, para sintetizarlas antes de que empiece a sonar. */
export function songPitches(song: Song): Set<number> {
  const pitches = new Set<number>(song.melody.map((note) => note.midi));
  for (const block of song.blocks) {
    for (const change of block.changes) change.midis.forEach((midi) => pitches.add(midi));
  }
  return pitches;
}
