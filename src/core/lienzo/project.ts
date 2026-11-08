// El proyecto como dato: crearlo, leer lo guardado sin confiar en nada, y cuánto dura.
import { quartersPerBar } from './rhythm';
import type { Meter } from '../rhythm';
import { keyFor } from './harmony';
import {
  KEY_MODES,
  LANES,
  MAX_BARS,
  MIN_BARS,
  type LaneId,
  type Project,
  type Section,
  type Variant,
  type VariantOf,
} from './types';

export const DEFAULT_TUNING = {
  name: 'Estándar',
  pcs: [4, 9, 2, 7, 11, 4],
  notes: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
};

export function newProject(patch: Partial<Project> = {}): Project {
  return {
    title: '',
    key: { tonic: 0, mode: 'ionian' },
    bpm: 96,
    tuning: DEFAULT_TUNING,
    instrument: 'guitarra',
    drone: 'tonica',
    secs: [{ id: 'sec-a', label: 'A', bars: 8, energy: 2 }],
    lib: [],
    clips: {},
    lockedSecs: {},
    takes: [],
    consigna: null,
    own: {},
    notebook: [],
    myRefs: [],
    createdAt: Date.now(),
    ...patch,
  };
}

export const variantById = (p: Pick<Project, 'lib'>, id: string | undefined) =>
  id ? p.lib.find((v) => v.id === id) : undefined;

/** La variante que suena en ese carril y esa sección, respetando el espejo de las repeticiones. */
export function clipOf<K extends LaneId>(
  p: Pick<Project, 'lib' | 'clips'>,
  lane: K,
  sec: Pick<Section, 'id' | 'of'>,
): VariantOf<K> | undefined {
  const v = variantById(p, p.clips[keyFor(lane, sec)]);
  return v?.kind === lane ? (v as VariantOf<K>) : undefined;
}

export const totalBars = (secs: readonly Section[]) => secs.reduce((sum, s) => sum + s.bars, 0);

/** Segundos de una cantidad de compases: compases × negras por compás × 60 / bpm. */
export const barsToSeconds = (bars: number, meter: Meter, bpm: number) =>
  (bars * quartersPerBar(meter) * 60) / bpm;

export const formatTime = (seconds: number) => {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// --- Lectura defensiva de lo guardado ------------------------------------------------------------

const isObject = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x);
const isInt = (x: unknown, min: number, max: number): x is number =>
  typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;
const str = (x: unknown, fallback = '') => (typeof x === 'string' ? x : fallback);

function cleanSection(raw: unknown): Section | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || typeof raw.label !== 'string') return null;
  const bars = isInt(raw.bars, MIN_BARS, MAX_BARS) ? raw.bars : 4;
  const energy = isInt(raw.energy, 1, 4) ? (raw.energy as Section['energy']) : 2;
  return {
    id: raw.id,
    label: raw.label.slice(0, 16),
    bars,
    energy,
    ...(typeof raw.of === 'string' ? { of: raw.of } : {}),
    ...(raw.phrase === 'back' || raw.phrase === 'front' ? { phrase: raw.phrase } : {}),
  };
}

const KINDS = new Set<string>(LANES.map((l) => l.id));

function cleanVariant(raw: unknown): Variant | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || !KINDS.has(str(raw.kind))) return null;
  const base = { id: raw.id, name: str(raw.name) };
  switch (raw.kind) {
    case 'armonia':
      if (!Array.isArray(raw.chords)) return null;
      return { ...base, kind: 'armonia', chords: raw.chords.filter(isObject).map((c) => ({ ...c })) };
    case 'ritmo':
      if (!isObject(raw.config) || typeof raw.config.mode !== 'string') return null;
      return {
        ...base,
        kind: 'ritmo',
        config: raw.config as never,
        ...(raw.preset ? { preset: str(raw.preset) } : {}),
      };
    case 'melodia':
      return {
        ...base,
        kind: 'melodia',
        contour: (['arco', 'ola', 'escalera', 'subida', 'valle'].includes(str(raw.contour))
          ? raw.contour
          : 'arco') as never,
        fill: raw.fill === 'completa' ? 'completa' : 'apoyos',
        seed: typeof raw.seed === 'number' ? raw.seed : 1,
        shift: typeof raw.shift === 'number' ? raw.shift : 0,
        notes: Array.isArray(raw.notes) ? raw.notes.map((n) => (typeof n === 'number' ? n : null)) : null,
      };
    case 'letra':
      return { ...base, kind: 'letra', text: str(raw.text) };
  }
  return null;
}

/** Lee un proyecto guardado. Lo que no se entiende se descarta, y si no hay secciones no hay proyecto. */
export function sanitizeProject(saved: unknown): Project | null {
  if (!isObject(saved) || !Array.isArray(saved.secs)) return null;
  const secs = saved.secs.map(cleanSection).filter((s): s is Section => !!s);
  const ids = new Set(secs.map((s) => s.id));
  // Una repetición de algo que no está, o de otra repetición, pasa a ser única.
  const roots = new Set(secs.filter((s) => !s.of).map((s) => s.id));
  for (const s of secs) if (s.of && !roots.has(s.of)) delete s.of;
  if (!secs.length) return null;
  const lib = Array.isArray(saved.lib) ? saved.lib.map(cleanVariant).filter((v): v is Variant => !!v) : [];
  const libIds = new Set(lib.map((v) => v.id));
  const clips = isObject(saved.clips)
    ? Object.fromEntries(
        Object.entries(saved.clips).filter(
          ([k, v]) => typeof v === 'string' && libIds.has(v) && ids.has(k.split(':')[1] ?? ''),
        ),
      )
    : {};
  const key =
    isObject(saved.key) && isInt(saved.key.tonic, 0, 11) && str(saved.key.mode) in KEY_MODES
      ? { tonic: saved.key.tonic, mode: saved.key.mode as Project['key']['mode'] }
      : undefined;
  const tuning =
    isObject(saved.tuning) && Array.isArray(saved.tuning.pcs)
      ? {
          name: str(saved.tuning.name, 'Tuya'),
          pcs: saved.tuning.pcs.map((p) => (isInt(p, 0, 11) ? p : null)),
          ...(Array.isArray(saved.tuning.notes)
            ? { notes: saved.tuning.notes.map((n) => (typeof n === 'string' ? n : null)) }
            : {}),
        }
      : undefined;
  return newProject({
    title: str(saved.title),
    ...(key ? { key } : {}),
    ...(isInt(saved.bpm, 20, 300) ? { bpm: saved.bpm } : {}),
    ...(tuning ? { tuning } : {}),
    instrument: saved.instrument === 'piano' ? 'piano' : 'guitarra',
    drone: saved.drone === 'quinta' || saved.drone === '' ? saved.drone : 'tonica',
    secs,
    lib,
    clips: clips as Record<string, string>,
    lockedSecs: isObject(saved.lockedSecs) ? (saved.lockedSecs as Record<string, boolean>) : {},
    takes: Array.isArray(saved.takes) ? (saved.takes.filter(isObject) as never) : [],
    consigna: typeof saved.consigna === 'string' ? saved.consigna : null,
    own: isObject(saved.own) ? (saved.own as Record<string, boolean>) : {},
    notebook: Array.isArray(saved.notebook)
      ? saved.notebook.filter(isObject).map((n) => ({ t: str(n.t), used: n.used === true }))
      : [],
    myRefs: Array.isArray(saved.myRefs) ? (saved.myRefs.filter(isObject) as never) : [],
    createdAt: typeof saved.createdAt === 'number' ? saved.createdAt : Date.now(),
  });
}
