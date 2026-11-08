// Lo que es de la pantalla y no de la canción: qué está seleccionado, qué ventanas están abiertas,
// el tema, el zoom. Se guarda lo que conviene encontrar igual al volver.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Sound } from '~/audio/lienzo';
import type { LaneId } from '~/core/lienzo/types';

export type View = 'lienzo' | 'hoja' | 'instrumento' | 'refs';
export type WinId = 'tono' | 'letra' | 'acordes' | 'ritmo' | 'reglas' | 'circulo';
export type LaneView = LaneId | 'tomas';

export interface Win {
  open: boolean;
  x: number;
  y: number;
  z: number;
}

export interface CtxItem {
  label: string;
  hint?: string;
  danger?: boolean;
  fn: () => void;
}

export interface Selection {
  lane: LaneView;
  sec: string;
  take: string | null;
}

interface UiState {
  view: View;
  theme: 'claro' | 'oscuro';
  zoom: number;
  lanes: Record<LaneView, boolean>;
  follow: boolean;
  sound: Sound;
  browser: boolean;
  detail: boolean;
  sel: Selection;
  armed: string | null;
  wins: Record<WinId, Win>;
  menu: boolean;
  ctx: { x: number; y: number; title: string; items: CtxItem[] } | null;
  lyricInst: string | null;
  lyricMode: 'write' | 'material' | 'cuaderno';
  mold: string | null;
  circMode: 'quintas' | 'cromatico';
  circAdd: boolean;
  kit: 'bateria' | 'objetos';
  counter: boolean;
  refSel: string;
  refTag: string;
  set: (patch: Partial<Omit<UiState, 'set' | 'openWin' | 'closeWin' | 'front' | 'select'>>) => void;
  openWin: (id: WinId) => void;
  closeWin: (id: WinId) => void;
  front: (id: WinId) => void;
  select: (sel: Partial<Selection>) => void;
}

const memoryStorage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };

const WINS: Record<WinId, Win> = {
  tono: { open: false, x: 760, y: 150, z: 1 },
  letra: { open: false, x: 820, y: 140, z: 1 },
  acordes: { open: false, x: 520, y: 200, z: 1 },
  ritmo: { open: false, x: 780, y: 170, z: 1 },
  reglas: { open: false, x: 680, y: 130, z: 1 },
  circulo: { open: false, x: 860, y: 120, z: 1 },
};

const topZ = (wins: Record<WinId, Win>) => Math.max(...Object.values(wins).map((w) => w.z));

export const useLienzoUi = create<UiState>()(
  persist(
    (set) => ({
      view: 'lienzo',
      theme: 'claro',
      zoom: 26,
      lanes: { armonia: true, melodia: true, ritmo: true, letra: true, tomas: true },
      follow: true,
      sound: 'todo',
      browser: false,
      detail: true,
      sel: { lane: 'armonia', sec: '', take: null },
      armed: null,
      wins: WINS,
      menu: false,
      ctx: null,
      lyricInst: null,
      lyricMode: 'write',
      mold: null,
      circMode: 'quintas',
      circAdd: false,
      kit: 'bateria',
      counter: false,
      refSel: 'creep',
      refTag: 'Todo',
      set: (patch) => set(patch),
      openWin: (id) =>
        set((s) => ({
          wins: { ...s.wins, [id]: { ...s.wins[id], open: true, z: topZ(s.wins) + 1 } },
          menu: false,
          ctx: null,
        })),
      closeWin: (id) => set((s) => ({ wins: { ...s.wins, [id]: { ...s.wins[id], open: false } } })),
      front: (id) =>
        set((s) =>
          s.wins[id].z >= topZ(s.wins)
            ? s
            : { wins: { ...s.wins, [id]: { ...s.wins[id], z: topZ(s.wins) + 1 } } },
        ),
      select: (sel) => set((s) => ({ sel: { ...s.sel, ...sel } })),
    }),
    {
      name: 'scordatura-lienzo-vista',
      version: 1,
      storage: createJSONStorage(() => (typeof window === 'undefined' ? memoryStorage : window.localStorage)),
      partialize: ({
        view,
        theme,
        zoom,
        lanes,
        follow,
        sound,
        browser,
        detail,
        wins,
        kit,
        circMode,
        refSel,
      }) => ({
        view,
        theme,
        zoom,
        lanes,
        follow,
        sound,
        browser,
        detail,
        wins,
        kit,
        circMode,
        refSel,
      }),
      merge: (saved, current) => {
        const raw = (saved ?? {}) as Partial<UiState>;
        const pick = <K extends keyof UiState>(key: K, ok: (v: unknown) => boolean) =>
          key in raw && ok(raw[key]) ? { [key]: raw[key] } : {};
        const wins = { ...current.wins };
        if (raw.wins && typeof raw.wins === 'object') {
          for (const id of Object.keys(WINS) as WinId[]) {
            const w = (raw.wins as Record<string, Partial<Win>>)[id];
            if (w && typeof w.x === 'number' && typeof w.y === 'number')
              wins[id] = { open: !!w.open, x: w.x, y: w.y, z: typeof w.z === 'number' ? w.z : 1 };
          }
        }
        return {
          ...current,
          ...pick('view', (v) => ['lienzo', 'hoja', 'instrumento', 'refs'].includes(v as string)),
          ...pick('theme', (v) => v === 'claro' || v === 'oscuro'),
          ...pick('zoom', (v) => typeof v === 'number' && v >= 16 && v <= 48),
          ...pick('lanes', (v) => !!v && typeof v === 'object'),
          ...pick('follow', (v) => typeof v === 'boolean'),
          ...pick('sound', (v) => ['todo', 'sin-ritmo', 'nada'].includes(v as string)),
          ...pick('browser', (v) => typeof v === 'boolean'),
          ...pick('detail', (v) => typeof v === 'boolean'),
          ...pick('kit', (v) => v === 'bateria' || v === 'objetos'),
          ...pick('circMode', (v) => v === 'quintas' || v === 'cromatico'),
          ...pick('refSel', (v) => typeof v === 'string'),
          wins,
        };
      },
    },
  ),
);
