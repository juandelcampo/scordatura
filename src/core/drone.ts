// Drone: una nota raíz sostenida y las voces que se le apilan encima.
import { MODES, type ModeId } from './harmony';
import { midiToNote, noteLabel, isNote, noteToMidi } from './notes';

export const STACKS = {
  octava: {
    name: 'Octava',
    steps: [-12, 0, 12],
    rule: 'Solo la raíz en tres octavas: no define ningún acorde y deja todo abierto.',
  },
  quinta: {
    name: 'Quinta',
    steps: [-12, 0, 7, 12],
    rule: 'Raíz y quinta, sin tercera: no es mayor ni menor, y la melodía decide.',
  },
  tanpura: {
    name: 'Tanpura',
    steps: [-12, -5, 0, 0],
    rule: 'Quinta abajo y raíz doble, como la tanpura de la música india: el bordón de un raga.',
  },
  sus2: {
    name: 'Sus2',
    steps: [-12, 0, 2, 7],
    rule: 'La segunda en lugar de la tercera: flota sin resolver.',
  },
  sus4: {
    name: 'Sus4',
    steps: [-12, 0, 5, 7],
    rule: 'La cuarta en lugar de la tercera: una tensión que pide bajar y nunca baja.',
  },
  mayor: {
    name: 'Mayor',
    steps: [-12, 0, 4, 7],
    rule: 'Con la tercera mayor: el color queda definido desde el grave.',
  },
  menor: {
    name: 'Menor',
    steps: [-12, 0, 3, 7],
    rule: 'Con la tercera menor: el color queda definido desde el grave.',
  },
  menor9: {
    name: 'Menor con 9.ª',
    steps: [-12, 0, 3, 7, 14],
    rule: 'Tercera menor y novena: la novena roza la tercera y vibra arriba del acorde.',
  },
  tritono: {
    name: 'Tritono',
    steps: [-12, 0, 6, 12],
    rule: 'Raíz y tritono, el intervalo más inestable: un zumbido que no descansa.',
  },
  racimo: {
    name: 'Racimo',
    steps: [0, 1, 2, 7],
    rule: 'Tres notas a semitonos: baten entre sí y la masa de sonido late sola.',
  },
} as const;

export type StackId = keyof typeof STACKS;

export const TIMBRES = {
  calido: { name: 'Cálido' },
  organo: { name: 'Órgano' },
  crudo: { name: 'Crudo' },
} as const;

export type TimbreId = keyof typeof TIMBRES;

export interface DroneConfig {
  /** Nota raíz, en MIDI. */
  root: number;
  stack: StackId;
  timbre: TimbreId;
  /** De 0 a 1: qué tan abierto está el filtro. */
  brightness: number;
  /** De 0 a 1: cuánto se mueve el sonido solo. */
  motion: number;
  /** Desafinación entre osciladores, en cents. */
  detune: number;
  /** Si está, suenan estas notas en lugar de la pila: las cuerdas de una afinación. */
  notes?: string[];
  /** La nota raíz se eligió a mano: no sigue a la tónica de la armonía. */
  free?: boolean;
}

export const DEFAULT_DRONE: DroneConfig = {
  root: 38,
  stack: 'quinta',
  timbre: 'calido',
  brightness: 0.4,
  motion: 0.25,
  detune: 6,
};

export const ROOT_RANGE = [24, 60] as const;

/** Sigue a la tónica: lo normal, salvo que la raíz se haya elegido a mano o suene una afinación. */
export const followsTonic = (config: DroneConfig) => !config.notes && !config.free;

/** El drone en la tónica de la armonía, en la octava más cercana a la que tenía para no saltar de registro. */
export function followKey(config: DroneConfig, key: { tonic: number }): DroneConfig {
  if (!followsTonic(config)) return config;
  let root = config.root;
  let distance = Infinity;
  for (let candidate = ROOT_RANGE[0]; candidate <= ROOT_RANGE[1]; candidate++) {
    if ((((candidate - key.tonic) % 12) + 12) % 12 !== 0) continue;
    if (Math.abs(candidate - config.root) < distance) {
      root = candidate;
      distance = Math.abs(candidate - config.root);
    }
  }
  return root === config.root ? config : { ...config, root };
}

/**
 * Un drone sorteado con tercera toma la del modo: una tercera mayor sobre un modo menor choca.
 * Lo que se elige a mano no pasa por acá: si pediste Menor, suena Menor.
 */
export function matchMode(config: DroneConfig, mode: ModeId): DroneConfig {
  if (config.notes) return config;
  const minor = MODES[mode].steps[2] === 3;
  const stack: StackId =
    config.stack === 'mayor' && minor
      ? 'menor'
      : (config.stack === 'menor' || config.stack === 'menor9') && !minor
        ? 'mayor'
        : config.stack;
  return stack === config.stack ? config : { ...config, stack };
}

/** Las notas que suenan, en MIDI. */
export function droneVoices(config: DroneConfig): number[] {
  if (config.notes) return config.notes.map(noteToMidi);
  return STACKS[config.stack].steps.map((step) => config.root + step);
}

export function describeDrone(config: DroneConfig): { name: string; label: string; rule: string } {
  if (config.notes) {
    const names = config.notes.map((note) => noteLabel(note)).join(' ');
    return {
      name: names,
      label: `Las cuerdas ${names}`,
      rule: 'Las seis cuerdas de la afinación sostenidas a la vez: así suena su acorde al aire sin apagarse.',
    };
  }
  const root = midiToNote(config.root).replace(/\d/, '');
  const stack = STACKS[config.stack];
  return {
    name: `${root} ${stack.name}`,
    label: `${root} ${stack.name}, ${TIMBRES[config.timbre].name.toLowerCase()}`,
    rule: stack.rule,
  };
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function droneToParams(config: DroneConfig): URLSearchParams {
  const params = new URLSearchParams({
    t: config.timbre,
    b: config.brightness.toFixed(2),
    m: config.motion.toFixed(2),
    d: String(Math.round(config.detune)),
  });
  if (config.notes) params.set('n', config.notes.join(',').replaceAll('#', 's'));
  else {
    params.set('r', String(config.root));
    params.set('s', config.stack);
    if (config.free) params.set('f', '1');
  }
  return params;
}

export function droneFromParams(params: URLSearchParams): DroneConfig | null {
  const notes = params
    .get('n')
    ?.split(',')
    .map((note) => note.replace(/^([A-G])s/, '$1#'));
  const validNotes = notes && notes.length >= 1 && notes.length <= 6 && notes.every(isNote) ? notes : null;
  const root = Number(params.get('r'));
  const stack = params.get('s') as StackId | null;
  const validStack =
    !!stack && stack in STACKS && Number.isInteger(root) && root >= ROOT_RANGE[0] && root <= ROOT_RANGE[1];
  if (!validNotes && !validStack) return null;

  const timbre = params.get('t') as TimbreId | null;
  const number = (key: string, fallback: number) => {
    const raw = params.get(key);
    const value = Number(raw);
    return raw !== null && Number.isFinite(value) ? value : fallback;
  };
  const config: DroneConfig = {
    root: validStack ? root : validNotes ? noteToMidi(validNotes[0]!) : DEFAULT_DRONE.root,
    stack: validStack ? stack! : DEFAULT_DRONE.stack,
    timbre: timbre && timbre in TIMBRES ? timbre : DEFAULT_DRONE.timbre,
    brightness: clamp01(number('b', DEFAULT_DRONE.brightness)),
    motion: clamp01(number('m', DEFAULT_DRONE.motion)),
    detune: Math.min(40, Math.max(0, number('d', DEFAULT_DRONE.detune))),
  };
  if (validNotes) config.notes = validNotes;
  else if (params.get('f') === '1') config.free = true;
  return config;
}
