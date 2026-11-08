// El proyecto del lienzo, guardado en este navegador. La posición de reproducción no vive acá: va en
// un store aparte para no re-renderizar los paneles pesados mientras suena.
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

type VariantInput = Variant extends infer V ? (V extends Variant ? Omit<V, 'id'> : never) : never;

interface LienzoStore {
  project: Project | null;
  /** Arranca un proyecto (nuevo o migrado). Reemplaza al actual. */
  load: (project: Project) => void;
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
const newId = () => `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const useLienzo = create<LienzoStore>()(
  persist(
    (set) => {
      const edit = (fn: (p: Project) => Partial<Project>) =>
        set((state) => (state.project ? { project: { ...state.project, ...fn(state.project) } } : state));
      return {
        project: null,
        load: (project) => set({ project }),
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
      partialize: ({ project }) => ({ project }),
      merge: (saved, current) => ({
        ...current,
        project: sanitizeProject((saved as { project?: unknown } | null)?.project),
      }),
    },
  ),
);

export { newProject };
