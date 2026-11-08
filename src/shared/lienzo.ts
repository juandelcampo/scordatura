// El proyecto del lienzo, guardado en este navegador. La posición de reproducción no vive acá: la da
// el reproductor (audio/lienzo) para no re-renderizar los paneles pesados mientras suena.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { keyFor } from '~/core/lienzo/harmony';
import { newProject, sanitizeProject } from '~/core/lienzo/project';
import {
  MAX_BARS,
  MIN_BARS,
  type Key,
  type LaneId,
  type Project,
  type Section,
  type Variant,
} from '~/core/lienzo/types';

export type VariantInput = Variant extends infer V ? (V extends Variant ? Omit<V, 'id'> : never) : never;

interface LienzoStore {
  project: Project | null;
  /** Las canciones anteriores, la última primero. */
  archive: Project[];
  /** Cuándo se terminó cada canción. */
  finished: number[];
  /** Cuándo arrancó el reto de 14 canciones en 28 días. */
  challengeStart: number | null;
  /** Arranca un proyecto (nuevo o migrado). Reemplaza al actual. */
  load: (project: Project) => void;
  /** Guarda la actual como "anterior" y arranca otra. */
  next: (project: Project, finished: boolean) => void;
  startChallenge: () => void;
  update: (fn: (p: Project) => Partial<Project>) => void;
  setTitle: (title: string) => void;
  /** Los acordes van por grado: cambiar la tonalidad transporta todo el tema. */
  setKey: (key: Key) => void;
  setBpm: (bpm: number) => void;
  setSecs: (secs: Section[]) => void;
  patchSection: (id: string, patch: Partial<Omit<Section, 'id'>>) => void;
  /** Cambia los compases de una sección y de todas sus repeticiones. */
  setBars: (id: string, bars: number) => void;
  /** Suma una variante a la biblioteca y devuelve su id. */
  addVariant: (variant: VariantInput) => string;
  updateVariant: (id: string, patch: Partial<Variant> | ((v: Variant) => Partial<Variant>)) => void;
  /** Pone una variante en un carril y una sección (en la raíz, si el carril es espejo). */
  place: (lane: LaneId, sec: Pick<Section, 'id' | 'of'>, variantId: string) => void;
  unplace: (lane: LaneId, sec: Pick<Section, 'id' | 'of'>) => void;
  toggleLockSec: (rootId: string) => void;
}

const memoryStorage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
let idCounter = 0;
export const newId = (prefix = 'v') => `${prefix}${Date.now().toString(36)}${(idCounter++).toString(36)}`;
const ARCHIVE = 12;

export const useLienzo = create<LienzoStore>()(
  persist(
    (set) => {
      const edit = (fn: (p: Project) => Partial<Project>) =>
        set((state) => (state.project ? { project: { ...state.project, ...fn(state.project) } } : state));
      return {
        project: null,
        archive: [],
        finished: [],
        challengeStart: null,
        load: (project) => set({ project }),
        next: (project, finished) =>
          set((state) => ({
            project,
            archive: state.project ? [state.project, ...state.archive].slice(0, ARCHIVE) : state.archive,
            finished: finished ? [...state.finished, Date.now()] : state.finished,
          })),
        startChallenge: () => set({ challengeStart: Date.now() }),
        update: edit,
        setTitle: (title) => edit(() => ({ title })),
        setKey: (key) => edit(() => ({ key })),
        setBpm: (bpm) => edit(() => ({ bpm: Math.min(300, Math.max(20, Math.round(bpm))) })),
        setSecs: (secs) => edit(() => ({ secs })),
        patchSection: (id, patch) =>
          edit((p) => ({ secs: p.secs.map((s) => (s.id === id ? { ...s, ...patch } : s)) })),
        setBars: (id, bars) =>
          edit((p) => {
            const root = p.secs.find((s) => s.id === id)?.of ?? id;
            const b = Math.max(MIN_BARS, Math.min(MAX_BARS, Math.round(bars)));
            return { secs: p.secs.map((s) => (s.id === root || s.of === root ? { ...s, bars: b } : s)) };
          }),
        addVariant: (variant) => {
          const id = newId();
          edit((p) => ({ lib: [...p.lib, { ...variant, id } as Variant] }));
          return id;
        },
        updateVariant: (id, patch) =>
          edit((p) => ({
            lib: p.lib.map((v) =>
              v.id === id
                ? ({ ...v, ...(typeof patch === 'function' ? patch(v) : patch), id, kind: v.kind } as Variant)
                : v,
            ),
          })),
        place: (lane, sec, variantId) =>
          edit((p) => {
            const v = p.lib.find((x) => x.id === variantId);
            return v?.kind === lane ? { clips: { ...p.clips, [keyFor(lane, sec)]: variantId } } : {};
          }),
        unplace: (lane, sec) =>
          edit((p) => {
            const clips = { ...p.clips };
            delete clips[keyFor(lane, sec)];
            return { clips };
          }),
        toggleLockSec: (rootId) =>
          edit((p) => ({ lockedSecs: { ...p.lockedSecs, [rootId]: !p.lockedSecs[rootId] } })),
      };
    },
    {
      name: 'scordatura-lienzo',
      version: 1,
      storage: createJSONStorage(() => (typeof window === 'undefined' ? memoryStorage : window.localStorage)),
      partialize: ({ project, archive, finished, challengeStart }) => ({
        project,
        archive,
        finished,
        challengeStart,
      }),
      merge: (saved, current) => {
        const raw = (saved ?? {}) as {
          project?: unknown;
          archive?: unknown;
          finished?: unknown;
          challengeStart?: unknown;
        };
        return {
          ...current,
          project: sanitizeProject(raw.project),
          archive: Array.isArray(raw.archive)
            ? raw.archive
                .map(sanitizeProject)
                .filter((p): p is Project => !!p)
                .slice(0, ARCHIVE)
            : [],
          finished: Array.isArray(raw.finished)
            ? raw.finished.filter((t): t is number => typeof t === 'number')
            : [],
          challengeStart: typeof raw.challengeStart === 'number' ? raw.challengeStart : null,
        };
      },
    },
  ),
);

export { newProject };
