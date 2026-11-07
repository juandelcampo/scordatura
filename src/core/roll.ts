// El contrato de todo lo que se sortea. `rule` es obligatoria: un resultado que no
// explica su teoría no compila.
import type { Rng } from './rng';

export type Risk = 0 | 1 | 2;

export const RISK_NAMES: Record<Risk, string> = { 0: 'Seguro', 1: 'Medio', 2: 'Raro' };

export interface RollInput {
  risk: Risk;
  rng: Rng;
}

export interface Rolled<V = unknown> {
  value: V;
  label: string;
  /** La regla que generó este resultado, a la vista de quien lo usa. */
  rule: string;
  /** Herramienta donde se puede usar este resultado. */
  href?: string;
}

export type Roller<V = unknown> = (input: RollInput) => Rolled<V>;
