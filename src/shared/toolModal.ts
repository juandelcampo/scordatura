// Una herramienta abierta desde la consigna se ve encima de ella, en un modal, sin perderla de vista.
// La URL es la de la herramienta, así que todo lo suyo (parámetros, links) sigue andando igual.
import { create } from 'zustand';

const TOOL_ROUTES = ['/afinador', '/ritmo', '/drone', '/armonia', '/melodia', '/letras', '/cartas', '/forma'];

const NAMES: Record<string, string> = {
  '/afinador': 'Afinación',
  '/ritmo': 'Ritmo',
  '/drone': 'Drone',
  '/armonia': 'Armonía',
  '/melodia': 'Melodía',
  '/letras': 'Letra',
  '/cartas': 'Cartas',
  '/forma': 'Forma',
};

const rootOf = (pathname: string) =>
  TOOL_ROUTES.find((route) => pathname === route || pathname.startsWith(`${route}/`));

export const isToolPath = (pathname: string) => rootOf(pathname) !== undefined;
export const toolName = (pathname: string) => NAMES[rootOf(pathname) ?? ''] ?? 'Herramienta';

/** Una herramienta en la pila: dónde empieza y cuántos pasos del historial llevaba la pila al abrirla. */
export interface ToolLevel {
  root: string;
  at: number;
}

interface ToolModalStore {
  /** Desde qué consigna se abrió. Sin valor, la herramienta se ve a pantalla completa. */
  from: string | null;
  /** En qué punto del historial se abrió: lo que vino después es de las herramientas. */
  base: number | null;
  /** Cuántos pasos de historial se agregaron desde que se abrió: cerrar los deshace todos. */
  depth: number;
  /**
   * Las herramientas abiertas, una encima de otra. Ir a otra herramienta desde un modal la abre
   * encima, y la de abajo queda como estaba; moverse dentro de la misma no agrega nada.
   */
  levels: ToolLevel[];
  open: (from: string) => void;
  /** Después de cada navegación: dónde quedó el historial y si se fue hacia adelante. */
  sync: (pathname: string, pushed: boolean) => void;
  clear: () => void;
}

/** La posición en el historial, que React Router guarda en cada entrada. */
export const historyIndex = (): number | null => {
  if (typeof window === 'undefined') return null;
  const idx = (window.history.state as { idx?: unknown } | null)?.idx;
  return typeof idx === 'number' ? idx : null;
};

/**
 * La pila después de llegar a `pathname`. Es pura, así el layout la calcula en el mismo render de la
 * navegación (si esperara al efecto, la herramienta nueva ocuparía un render el lugar de la de abajo).
 */
export function stackAfter(
  state: Pick<ToolModalStore, 'base' | 'depth' | 'levels'>,
  pathname: string,
  pushed: boolean,
  idx = historyIndex(),
): { depth: number; levels: ToolLevel[] } {
  // Volver varios pasos de una vez avisa una sola vez: por eso se mira el historial, no se cuenta.
  const depth =
    idx !== null && state.base !== null
      ? Math.max(0, idx - state.base)
      : Math.max(0, state.depth + (pushed ? 1 : -1));
  const root = rootOf(pathname) ?? pathname;
  let levels = state.levels.filter((level) => level.at < depth);
  const top = levels[levels.length - 1];
  // Otra herramienta, sea por un link o por "Adelante", va encima de la que estaba.
  if (top?.root !== root) levels = [...levels, { root, at: Math.max(0, depth - 1) }];
  return { depth, levels };
}

export const useToolModal = create<ToolModalStore>()((set) => ({
  from: null,
  base: null,
  depth: 0,
  levels: [],
  open: (from) => set({ from, base: historyIndex(), depth: 0, levels: [] }),
  sync: (pathname, pushed) => set((state) => stackAfter(state, pathname, pushed)),
  clear: () => set({ from: null, base: null, depth: 0, levels: [] }),
}));

/** El nombre de una herramienta por su ruta: "Forma", "Armonía"… */
export const levelName = (level: ToolLevel | undefined) => NAMES[level?.root ?? ''] ?? 'Herramienta';
