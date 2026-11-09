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

interface ToolModalStore {
  /** Desde qué consigna se abrió. Sin valor, la herramienta se ve a pantalla completa. */
  from: string | null;
  /** Cuántos pasos de historial se agregaron desde que se abrió: cerrar los deshace todos. */
  depth: number;
  open: (from: string) => void;
  step: (delta: number) => void;
  clear: () => void;
}

export const useToolModal = create<ToolModalStore>()((set) => ({
  from: null,
  depth: 0,
  open: (from) => set({ from, depth: 0 }),
  step: (delta) => set((state) => ({ depth: Math.max(0, state.depth + delta) })),
  clear: () => set({ from: null, depth: 0 }),
}));
