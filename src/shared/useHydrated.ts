import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;

/**
 * Falso en la página estática y durante la primera pasada de React en el navegador; verdadero
 * después. La página estática no conoce los parámetros de la URL: leerlos antes de tiempo hace
 * que React encuentre un HTML distinto del que esperaba.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
