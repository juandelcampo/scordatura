// El proyecto: lo que la consigna no dice. La forma y el tempo son de la consigna; acá cada letra
// (A, B, C...) guarda su letra, sus compases y, si se apartó de la consigna, su progresión y su ritmo.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { isChordBeats } from '~/core/chords';
import { clampBpm, rhythmFromParams, rhythmToParams, type RhythmConfig } from '~/core/rhythm';
import { LANES, MAX_BARS, type Lane, type SongMix } from '~/core/song';

export interface Section {
  chords?: string[];
  /** Cuántos tiempos dura cada acorde. Sin esto, uno por compás. */
  chordBeats?: number[];
  rhythm?: RhythmConfig;
  melody?: string;
  lyric?: string;
  /** La letra que se está escribiendo para esta sección. */
  text?: string;
  /** Cuántos compases dura cada bloque de esta sección. */
  bars?: number;
  /** El drone se calla en esta sección. */
  droneOff?: boolean;
}

/** Minutos marcados por la persona en cada video, por posición del bloque. */
export type VideoMarks = Record<string, Record<number, number>>;

interface Project {
  sections: Record<string, Section>;
  active: string;
  marks: VideoMarks;
  mix: SongMix;
  /** Forma y tempo de cuando se guardaban acá. Los levanta la consigna al abrir, y no se vuelven a guardar. */
  savedBlocks?: string[];
  savedTempo?: number;
  setActive: (letter: string) => void;
  updateSection: (letter: string, patch: Partial<Section>) => void;
  setMark: (video: string, block: number, seconds: number) => void;
  setLane: (lane: Lane, patch: { mute?: boolean; solo?: boolean }) => void;
}

const memoryStorage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
const LETTER = /^[A-H]$/;

export const isValidBlocks = (blocks: unknown): blocks is string[] =>
  Array.isArray(blocks) &&
  blocks.length > 0 &&
  blocks.length <= 24 &&
  blocks.every((block) => typeof block === 'string' && LETTER.test(block));

function sanitizeSection(saved: unknown): Section {
  if (!saved || typeof saved !== 'object') return {};
  const raw = saved as Record<string, unknown>;
  const clean: Section = {};
  if (Array.isArray(raw.chords) && raw.chords.every((chord) => typeof chord === 'string')) {
    clean.chords = raw.chords as string[];
    if (isChordBeats(raw.chordBeats, clean.chords.length)) clean.chordBeats = raw.chordBeats;
  }
  if (raw.rhythm) {
    try {
      clean.rhythm = rhythmFromParams(rhythmToParams(raw.rhythm as RhythmConfig)) ?? undefined;
    } catch {
      // Un ritmo ilegible no se conserva.
    }
  }
  if (typeof raw.melody === 'string') clean.melody = raw.melody;
  if (typeof raw.lyric === 'string') clean.lyric = raw.lyric;
  if (typeof raw.text === 'string') clean.text = raw.text;
  if (typeof raw.bars === 'number' && Number.isInteger(raw.bars) && raw.bars >= 1 && raw.bars <= MAX_BARS) {
    clean.bars = raw.bars;
  }
  if (typeof raw.droneOff === 'boolean') clean.droneOff = raw.droneOff;
  return clean;
}

function sanitizeMix(saved: unknown): SongMix {
  if (!saved || typeof saved !== 'object') return {};
  const raw = saved as Record<string, { mute?: unknown; solo?: unknown } | undefined>;
  const clean: SongMix = {};
  for (const lane of LANES) {
    const entry = raw[lane];
    if (!entry || typeof entry !== 'object') continue;
    clean[lane] = {
      ...(typeof entry.mute === 'boolean' ? { mute: entry.mute } : {}),
      ...(typeof entry.solo === 'boolean' ? { solo: entry.solo } : {}),
    };
  }
  return clean;
}

function sanitize(saved: Partial<Project> & { blocks?: unknown; tempo?: unknown }): Partial<Project> {
  const clean: Partial<Project> = {};
  if (isValidBlocks(saved.blocks)) clean.savedBlocks = saved.blocks;
  if (typeof saved.tempo === 'number' && Number.isFinite(saved.tempo)) clean.savedTempo = clampBpm(saved.tempo);
  if (saved.sections && typeof saved.sections === 'object') {
    clean.sections = Object.fromEntries(
      Object.entries(saved.sections)
        .filter(([letter]) => LETTER.test(letter))
        .map(([letter, section]) => [letter, sanitizeSection(section)]),
    );
  }
  if (typeof saved.active === 'string' && LETTER.test(saved.active)) clean.active = saved.active;
  if (saved.marks && typeof saved.marks === 'object') clean.marks = saved.marks;
  clean.mix = sanitizeMix(saved.mix);
  return clean;
}

export const useProject = create<Project>()(
  persist(
    (set) => ({
      sections: {},
      active: 'A',
      marks: {},
      mix: {},
      setActive: (active) => set({ active }),
      updateSection: (letter, patch) =>
        set((state) => {
          const next: Section = { ...state.sections[letter], ...patch };
          // Las duraciones eran de los acordes que había: otros acordes empiezan sin ellas.
          if (patch.chords && !patch.chordBeats) delete next.chordBeats;
          return { sections: { ...state.sections, [letter]: next } };
        }),
      setMark: (video, block, seconds) =>
        set((state) => ({
          marks: { ...state.marks, [video]: { ...state.marks[video], [block]: seconds } },
        })),
      setLane: (lane, patch) =>
        set((state) => ({ mix: { ...state.mix, [lane]: { ...state.mix[lane], ...patch } } })),
    }),
    {
      name: 'scordatura-proyecto',
      version: 1,
      storage: createJSONStorage(() => (typeof window === 'undefined' ? memoryStorage : window.localStorage)),
      partialize: ({ sections, active, marks, mix }) => ({ sections, active, marks, mix }),
      merge: (saved, current) => ({ ...current, ...sanitize((saved ?? {}) as Parameters<typeof sanitize>[0]) }),
    },
  ),
);

export const letterList = (blocks: string[]) => [...new Set(blocks)].sort();
