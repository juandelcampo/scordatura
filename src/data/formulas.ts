// Fórmulas conocidas, para partir de algo y romperlo. Están escritas en grados de la escala mayor,
// así entran en cualquier tónica: "b7" es el séptimo grado bemol, "6m" el sexto grado en menor.
import type { ModeId } from '~/core/harmony';

export interface Formula {
  id: string;
  name: string;
  mode: ModeId;
  degrees: string[];
  /** Tiempos de cada acorde, si la fórmula no va de a un compás por acorde. */
  beats?: number[];
  why: string;
}

export const FORMULAS: readonly Formula[] = [
  {
    id: 'pop',
    name: 'Pop de cuatro',
    mode: 'ionian',
    degrees: ['1', '5', '6m', '4'],
    why: 'La vuelta más gastada del pop: reposo, tensión, sombra y aire. Rotala y cambia de carácter.',
  },
  {
    id: 'doowop',
    name: 'Doo-wop',
    mode: 'ionian',
    degrees: ['1', '6m', '4', '5'],
    why: 'La balada de los 50: el relativo menor oscurece antes de volver por la dominante.',
  },
  {
    id: 'andaluza',
    name: 'Cadencia andaluza',
    mode: 'aeolian',
    degrees: ['1m', 'b7', 'b6', '5'],
    why: 'El bajo baja por grados hasta una dominante mayor, ajena a la escala menor natural.',
  },
  {
    id: 'iiVI',
    name: 'ii–V–I',
    mode: 'ionian',
    degrees: ['2m7', '57', '1maj7'],
    beats: [2, 2, 4],
    why: 'La cadencia del jazz: cada raíz cae por quintas hasta la tónica.',
  },
  {
    id: 'turnaround',
    name: 'Turnaround',
    mode: 'ionian',
    degrees: ['1maj7', '6m7', '2m7', '57'],
    beats: [2, 2, 2, 2],
    why: 'Una vuelta por quintas que siempre pide empezar de nuevo.',
  },
  {
    id: 'blues',
    name: 'Blues de 12',
    mode: 'ionian',
    degrees: ['17', '17', '17', '17', '47', '47', '17', '17', '57', '47', '17', '57'],
    why: 'Doce compases de dominantes que no resuelven: la séptima menor acá es color, no tensión.',
  },
  {
    id: 'mixo',
    name: 'Vamp mixolidio',
    mode: 'mixolydian',
    degrees: ['1', 'b7', '4', '1'],
    why: 'El b7 evita la sensible: la música da vueltas sin necesitar una dominante.',
  },
  {
    id: 'dorico',
    name: 'Vamp dórico',
    mode: 'dorian',
    degrees: ['1m7', '4'],
    why: 'Dos acordes alcanzan: el IV mayor sobre tónica menor es la marca del dórico.',
  },
  {
    id: 'canon',
    name: 'Canon',
    mode: 'ionian',
    degrees: ['1', '5', '6m', '3m', '4', '1', '4', '5'],
    why: 'Ocho acordes sobre un bajo que baja y sube, como un ciclo largo.',
  },
  {
    id: 'royal',
    name: 'Royal road',
    mode: 'ionian',
    degrees: ['4maj7', '57', '3m7', '6m'],
    why: 'La vuelta del J-pop: arranca lejos de la tónica y nunca termina de llegar.',
  },
  {
    id: 'subminor',
    name: 'Subdominante menor',
    mode: 'ionian',
    degrees: ['1', '3', '4', '4m'],
    why: 'El III mayor sale de la escala, y el IV menor apaga la luz antes de volver.',
  },
];
