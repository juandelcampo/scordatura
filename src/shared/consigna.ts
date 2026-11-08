// La consigna en curso, con su historial. Vive fuera de las pantallas: cualquier herramienta
// le pasa lo que elegís, y sobrevive a navegar y a recargar.
import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  applyOverride,
  consignaNumber,
  decodeConsigna,
  encodeConsigna,
  newConsigna,
  resolveRow,
  rowIndex,
  type Consigna,
  type RowId,
  type RowOverrides,
} from '~/core/consigna';
import { canonical } from '~/core/canonical';
import { useProject } from './project';
import { useSettings } from './settings';

const HISTORY = 50;
const memoryStorage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };

// Determinista, para que la página estática y la primera hidratación coincidan.
let exampleSeed = 1;
const EXAMPLE = newConsigna(1, () => (exampleSeed++ * 2654435761) >>> 0);

interface ConsignaStore {
  consigna: Consigna;
  started: boolean;
  /** Códigos de las consignas anteriores y de las que se deshicieron. */
  past: string[];
  future: string[];
  /** Cambio que se puede deshacer con "Volver". */
  change: (next: Consigna) => void;
  /** Reemplaza sin dejar rastro: abrir un link o empezar. */
  load: (next: Consigna) => void;
  undo: () => void;
  redo: () => void;
}

export const useConsigna = create<ConsignaStore>()(
  persist(
    (set, get) => ({
      consigna: EXAMPLE,
      started: false,
      past: [],
      future: [],
      change: (next) => {
        const { consigna, started, past } = get();
        const previous = encodeConsigna(consigna);
        if (previous === encodeConsigna(next)) return;
        set({
          consigna: next,
          started: true,
          past: started ? [...past, previous].slice(-HISTORY) : past,
          future: [],
        });
      },
      load: (next) => set({ consigna: next, started: true }),
      undo: () => {
        const { consigna, past, future } = get();
        const previous = past[past.length - 1];
        const decoded = previous ? decodeConsigna(previous) : null;
        if (!previous || !decoded) return;
        set({ consigna: decoded, past: past.slice(0, -1), future: [encodeConsigna(consigna), ...future] });
      },
      redo: () => {
        const { consigna, past, future } = get();
        const next = future[0];
        const decoded = next ? decodeConsigna(next) : null;
        if (!next || !decoded) return;
        set({ consigna: decoded, past: [...past, encodeConsigna(consigna)], future: future.slice(1) });
      },
    }),
    {
      name: 'scordatura-consigna',
      version: 1,
      storage: createJSONStorage(() => (typeof window === 'undefined' ? memoryStorage : window.localStorage)),
      partialize: (state) => ({
        code: state.started ? encodeConsigna(state.consigna) : null,
        past: state.past,
        future: state.future,
      }),
      merge: (saved, current) => {
        const raw = (saved ?? {}) as { code?: unknown; past?: unknown; future?: unknown };
        const decoded = typeof raw.code === 'string' ? decodeConsigna(raw.code) : null;
        if (!decoded) return current;
        const codes = (list: unknown) =>
          Array.isArray(list)
            ? list.filter((item): item is string => typeof item === 'string').slice(-HISTORY)
            : [];
        return {
          ...current,
          consigna: decoded,
          started: true,
          past: codes(raw.past),
          future: codes(raw.future),
        };
      },
    },
  ),
);

/**
 * Una herramienta avisa lo que elegiste a mano: entra a su fila de la consigna y queda trabado.
 * Si todavía no había consigna, se empieza una para que no se pierda.
 */
export function publishToConsigna<K extends RowId>(
  id: K,
  value: RowOverrides[K],
  /** Sigue el mismo gesto, como un arrastre: "Volver" lo deshace entero, no paso por paso. */
  { continuing = false }: { continuing?: boolean } = {},
): void {
  const store = useConsigna.getState();
  const base = store.started ? store.consigna : newConsigna(useSettings.getState().risk);
  const index = rowIndex(id);
  const row = base.rows[index]!;
  const already = row.override ?? resolveRow(index, row).value;
  if (store.started && canonical(already) === canonical(value)) return;
  const next = applyOverride(base, id, value);
  if (continuing) store.load(next);
  else store.change(next);
}

/** La forma es la de la consigna: la que dice su fila es la que suena. */
export function blocksOf(consigna: Consigna): string[] {
  const index = rowIndex('forma');
  return (resolveRow(index, consigna.rows[index]!).value as RowOverrides['forma']).blocks;
}

export function useBlocks(): string[] {
  const consigna = useConsigna((s) => s.consigna);
  return useMemo(() => blocksOf(consigna), [consigna]);
}

/** La sección en la que se está tiene que existir en la forma, aunque la forma cambie. */
function keepActiveInForm(consigna: Consigna): void {
  const blocks = blocksOf(consigna);
  const { active, setActive } = useProject.getState();
  if (!blocks.includes(active)) setActive(blocks[0] ?? 'A');
}

useConsigna.subscribe((state, previous) => {
  if (state.consigna !== previous.consigna) keepActiveInForm(state.consigna);
});

const DEFAULT_FORM = 'AABA';

/** La forma y el tempo se guardaban en el proyecto: lo que ya estaba elegido pasa a la consigna, una vez. */
function adoptSavedChoices(): void {
  const { savedBlocks, savedTempo } = useProject.getState();
  if (!savedBlocks && savedTempo === undefined) return;
  useProject.setState({ savedBlocks: undefined, savedTempo: undefined });
  const store = useConsigna.getState();
  let next = store.started ? store.consigna : newConsigna(useSettings.getState().risk);
  if (savedBlocks && savedBlocks.join('') !== DEFAULT_FORM) {
    next = applyOverride(next, 'forma', { blocks: savedBlocks });
  }
  if (savedTempo !== undefined) {
    const index = rowIndex('ritmo');
    const rhythm = resolveRow(index, next.rows[index]!).value as RowOverrides['ritmo'];
    next = applyOverride(next, 'ritmo', { ...rhythm, bpm: savedTempo });
  }
  if (next !== store.consigna && (store.started || next.rows.some((row) => row.override))) store.load(next);
}

adoptSavedChoices();
keepActiveInForm(useConsigna.getState().consigna);

/** Las condiciones actuales, para que una idea grabada quede pegada a ellas. */
export function currentConsigna(): { code: string | null; number: string | null } {
  const { consigna, started } = useConsigna.getState();
  return started
    ? { code: encodeConsigna(consigna), number: consignaNumber(consigna) }
    : { code: null, number: null };
}
