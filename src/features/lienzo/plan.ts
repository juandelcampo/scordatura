// El plan que lee el reproductor en cada compás: siempre lo último del proyecto y de la consigna.
import type { Plan } from '~/audio/lienzo';
import type { Consigna } from '~/core/consigna';
import { useConsigna } from '~/shared/consigna';
import { useLienzo } from '~/shared/lienzo';
import { useLienzoUi } from '~/shared/lienzoUi';
import { useSettings } from '~/shared/settings';
import { rulesFromConsigna } from './model';

export const NOTE_NAMES_ES = ['Do', 'Do♯', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];

let cached: { consigna: Consigna; value: ReturnType<typeof rulesFromConsigna> } | null = null;

/** Las reglas de la consigna, calculadas una vez por consigna. */
export function cachedRules(consigna: Consigna) {
  if (cached?.consigna !== consigna) cached = { consigna, value: rulesFromConsigna(consigna) };
  return cached.value;
}

export function currentPlan(): Plan {
  return {
    project: useLienzo.getState().project!,
    rules: cachedRules(useConsigna.getState().consigna).rules,
    sound: useLienzoUi.getState().sound,
    a4: useSettings.getState().a4,
  };
}
