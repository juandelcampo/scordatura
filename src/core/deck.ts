// Un mazo que no repite: se mezcla una vez y se recorre entero antes de volver a mezclar.
import type { Rng } from './rng';

export interface DeckState {
  order: string[];
  /** La carta a la vista dentro de `order`. */
  position: number;
}

function shuffle(items: string[], rng: Rng): string[] {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return list;
}

/** Mantiene el recorrido aunque el mazo cambie: lo que se agrega entra entre lo que falta ver. */
function reconcile(state: DeckState | undefined, keys: string[], rng: Rng): DeckState {
  if (!state) return { order: shuffle(keys, rng), position: -1 };
  const valid = new Set(keys);
  const seen = state.order.slice(0, state.position + 1).filter((key) => valid.has(key));
  const pending = state.order.slice(state.position + 1).filter((key) => valid.has(key));
  const known = new Set(state.order);
  const added = keys.filter((key) => !known.has(key));
  return { order: [...seen, ...shuffle([...pending, ...added], rng)], position: seen.length - 1 };
}

export function nextCard(state: DeckState | undefined, keys: string[], rng: Rng): DeckState {
  const current = reconcile(state, keys, rng);
  if (current.order.length === 0) return { order: [], position: -1 };
  if (current.position + 1 < current.order.length) return { ...current, position: current.position + 1 };
  // Dio toda la vuelta: se vuelve a mezclar, sin empezar por la carta que se acaba de ver.
  const last = current.order[current.order.length - 1];
  const order = shuffle(current.order, rng);
  if (order.length > 1 && order[0] === last) [order[0], order[1]] = [order[1]!, order[0]!];
  return { order, position: 0 };
}

export function previousCard(state: DeckState): DeckState {
  return { ...state, position: Math.max(0, state.position - 1) };
}
