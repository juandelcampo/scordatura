// Ritmo: compases agrupados, ritmos euclidianos, polirritmias, compases mutantes y caja de ritmos.
// Todo se reduce a un "ciclo": una lista de golpes ubicados entre 0 y 1 dentro del ciclo.

export type Denominator = 4 | 8 | 16;

export interface Meter {
  groups: number[];
  denom: Denominator;
}

export type RhythmConfig =
  | ({ mode: 'meter'; bpm: number } & Meter)
  | { mode: 'euclid'; pulses: number; steps: number; rotation: number; bpm: number }
  | {
      mode: 'poly';
      a: number;
      b: number;
      /** El sonido de batería de cada línea. Sin elegir, suenan los de DEFAULT_POLY_VOICES. */
      voices?: PolyVoices;
      bpm: number;
    }
  | { mode: 'mutante'; meters: Meter[]; barsEach: number; bpm: number }
  | {
      mode: 'drum';
      steps: number;
      /** Un arreglo de golpes por sonido, en el orden de DRUMS. */
      tracks: boolean[][];
      /** Volumen de cada sonido, de 0 a 1. */
      levels: number[];
      bpm: number;
    };

export type DrumConfig = Extract<RhythmConfig, { mode: 'drum' }>;

export const DRUMS = [
  { id: 'bombo', name: 'Bombo' },
  { id: 'caja', name: 'Caja' },
  { id: 'hihat', name: 'Hi-hat' },
  { id: 'palma', name: 'Palma' },
  { id: 'tom', name: 'Tom' },
  { id: 'cencerro', name: 'Cencerro' },
] as const;

export type DrumId = (typeof DRUMS)[number]['id'];
export type PolyVoices = [DrumId, DrumId];
export const DRUM_STEPS = [8, 10, 12, 14, 16, 24, 32] as const;
export const DEFAULT_POLY_VOICES: PolyVoices = ['hihat', 'bombo'];
const DEFAULT_LEVEL = 0.8;
/** Volumen de un golpe sin acento en la polirritmia; el primero de cada línea va a 1. */
const POLY_UNACCENTED = 0.7;

const drumName = (id: DrumId) => DRUMS.find((drum) => drum.id === id)!.name.toLowerCase();

function parsePolyVoices(text: string): PolyVoices | null {
  const ids = text.split('_');
  const valid = ids.length === 2 && ids.every((id) => DRUMS.some((drum) => drum.id === id));
  return valid ? (ids as PolyVoices) : null;
}

/** Arma un patrón a partir de texto: cada x es un golpe. */
export function drumConfig(
  bpm: number,
  pattern: Partial<Record<DrumId, string>>,
): Extract<RhythmConfig, { mode: 'drum' }> {
  const steps = Math.max(...Object.values(pattern).map((text) => text.length));
  return {
    mode: 'drum',
    steps,
    bpm,
    tracks: DRUMS.map(({ id }) => Array.from({ length: steps }, (_, i) => pattern[id]?.[i] === 'x')),
    levels: DRUMS.map(() => DEFAULT_LEVEL),
  };
}

/** Un patrón euclidiano por sonido: el riesgo define cuántos sonidos y qué tan densos. */
export function randomDrumPattern(
  next: () => number,
  risk: 0 | 1 | 2,
  bpm: number,
  steps = 16,
): Extract<RhythmConfig, { mode: 'drum' }> {
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const density = [
    [int(2, 4), int(1, 2), int(6, 8), 0, 0, 0],
    [int(3, 5), int(2, 3), int(5, 11), int(0, 2), int(0, 2), 0],
    [int(3, 7), int(2, 5), int(5, 13), int(1, 5), int(1, 5), int(2, 7)],
  ][risk]!;
  return {
    mode: 'drum',
    steps,
    bpm,
    tracks: DRUMS.map((_, track) => {
      const pulses = Math.min(steps, density[track] ?? 0);
      if (pulses === 0) return new Array<boolean>(steps).fill(false);
      return euclid(pulses, steps, risk === 0 ? (track === 1 ? 4 : 0) : int(0, steps - 1));
    }),
    levels: DRUMS.map(() => DEFAULT_LEVEL),
  };
}

export type HitLevel = 0 | 1 | 2;

export interface Hit {
  /** Posición dentro del ciclo, de 0 a 1. */
  at: number;
  level: HitLevel;
  /** Carril donde se dibuja. El carril -1 no suena: marca el paso general de la caja de ritmos. */
  lane: number;
  cell: number;
  /** Sonido de batería. Sin él, suena el sonido elegido para el metrónomo. */
  voice?: DrumId;
  /** Volumen del golpe, de 0 a 1. */
  gain?: number;
}

export interface Cycle {
  /** Duración en negras. */
  beats: number;
  /** Cantidad de casillas de cada carril, para dibujarlo. */
  lanes: number[];
  hits: Hit[];
}

export const LIMITS = { bpm: [20, 300], cells: [1, 32], groupSize: [1, 9], lane: [1, 16] } as const;

export function clampBpm(bpm: number): number {
  return Math.min(LIMITS.bpm[1], Math.max(LIMITS.bpm[0], Math.round(bpm)));
}

/** Reparte los golpes en los pulsos lo más parejo posible. */
export function euclid(pulses: number, steps: number, rotation = 0): boolean[] {
  const pattern = Array.from({ length: steps }, (_, i) => (i * pulses) % steps < pulses);
  const shift = ((rotation % steps) + steps) % steps;
  return pattern.map((_, i) => pattern[(i + shift) % steps]!);
}

function meterCycle({ groups, denom }: Meter): Cycle {
  const total = groups.reduce((sum, group) => sum + group, 0);
  const hits: Hit[] = [];
  let cell = 0;
  groups.forEach((group, groupIndex) => {
    for (let i = 0; i < group; i++) {
      const level: HitLevel = i > 0 ? 0 : groupIndex === 0 ? 2 : 1;
      hits.push({ at: cell / total, level, lane: 0, cell });
      cell += 1;
    }
  });
  return { beats: (total * 4) / denom, lanes: [total], hits };
}

/** El ciclo que suena en la vuelta `index`. Solo el modo mutante cambia entre vueltas. */
export function cycleFor(config: RhythmConfig, index: number): Cycle {
  switch (config.mode) {
    case 'meter':
      return meterCycle(config);
    case 'euclid': {
      const pattern = euclid(config.pulses, config.steps, config.rotation);
      const hits = pattern.flatMap((on, cell): Hit[] =>
        on ? [{ at: cell / config.steps, level: cell === pattern.indexOf(true) ? 2 : 1, lane: 0, cell }] : [],
      );
      return { beats: config.steps / 2, lanes: [config.steps], hits };
    }
    case 'poly': {
      const voices = config.voices ?? DEFAULT_POLY_VOICES;
      const lane = (count: number, laneIndex: number): Hit[] =>
        Array.from({ length: count }, (_, cell) => ({
          at: cell / count,
          level: cell === 0 ? 2 : 1,
          lane: laneIndex,
          cell,
          voice: voices[laneIndex],
          gain: cell === 0 ? 1 : POLY_UNACCENTED,
        }));
      return {
        beats: config.b,
        lanes: [config.a, config.b],
        hits: [...lane(config.a, 0), ...lane(config.b, 1)],
      };
    }
    case 'mutante': {
      const position = Math.floor(index / config.barsEach) % config.meters.length;
      return meterCycle(config.meters[position]!);
    }
    case 'drum': {
      const { steps, tracks, levels } = config;
      const hits: Hit[] = Array.from({ length: steps }, (_, cell) => ({
        at: cell / steps,
        level: 0,
        lane: -1,
        cell,
      }));
      tracks.forEach((track, lane) => {
        const gain = levels[lane] ?? DEFAULT_LEVEL;
        track.forEach((on, cell) => {
          if (!on || gain <= 0) return;
          hits.push({ at: cell / steps, level: 1, lane, cell, voice: DRUMS[lane]!.id, gain });
        });
      });
      return { beats: steps / 4, lanes: tracks.map(() => steps), hits };
    }
  }
}

/**
 * Cualquier ritmo pasado a batería, para poder verlo y editarlo en una grilla: el primer acento va
 * al bombo, los otros acentos a la caja y el resto al hi-hat. El segundo carril de una polirritmia
 * va al cencerro. Lo que no entra en 32 pasos se comprime, así que ahí el resultado es aproximado.
 */
export function rhythmToDrums(config: RhythmConfig, index = 0): DrumConfig {
  if (config.mode === 'drum') return config;
  const cycle = cycleFor(config, index);
  let steps = Math.max(2, Math.round(cycle.beats * 4));
  while (steps > LIMITS.cells[1]) steps = Math.ceil(steps / 2);
  const tracks = DRUMS.map(() => new Array<boolean>(steps).fill(false));
  const voiceOf = (hit: Hit): DrumId => {
    if (hit.lane > 0) return 'cencerro';
    return hit.level === 2 ? 'bombo' : hit.level === 1 ? 'caja' : 'hihat';
  };
  for (const hit of cycle.hits) {
    const track = DRUMS.findIndex((drum) => drum.id === voiceOf(hit));
    tracks[track]![Math.round(hit.at * steps) % steps] = true;
  }
  return { mode: 'drum', steps, bpm: config.bpm, tracks, levels: DRUMS.map(() => DEFAULT_LEVEL) };
}

const NAMED_EUCLID: Record<string, string> = {
  '2,3': 'el pulso de vals cojo',
  '3,4': 'el cumbia básico',
  '3,8': 'el tresillo',
  '5,8': 'el cinquillo',
  '7,12': 'la campana de 12/8 africana',
  '5,16': 'la bossa nova',
  '2,5': 'el pulso persa khafif-e-ramal',
};

function meterName({ groups, denom }: Meter): string {
  const total = groups.reduce((sum, group) => sum + group, 0);
  return groups.length > 1 && denom !== 4 ? `${total}/${denom} (${groups.join('+')})` : `${total}/${denom}`;
}

export function describeRhythm(config: RhythmConfig): { name: string; label: string; rule: string } {
  const tempo = `${config.bpm} ppm`;
  switch (config.mode) {
    case 'meter': {
      const name = meterName(config);
      const irregular = new Set(config.groups).size > 1;
      return {
        name,
        label: `${name}, ${tempo}`,
        rule: irregular
          ? `Compás irregular: ${config.groups.join('+')} reparte los acentos en grupos desiguales.`
          : `Compás regular: grupos iguales de ${config.groups[0]}.`,
      };
    }
    case 'euclid': {
      const known = NAMED_EUCLID[`${config.pulses},${config.steps}`];
      const pattern = euclid(config.pulses, config.steps, config.rotation)
        .map((on) => (on ? 'x' : '.'))
        .join('');
      return {
        name: `E(${config.pulses},${config.steps})`,
        label: `E(${config.pulses},${config.steps}) ${pattern}, ${tempo}`,
        rule: `Ritmo euclidiano: ${config.pulses} golpes en ${config.steps} pulsos lo más parejo posible${known ? `; es una rotación de ${known}` : ''}.`,
      };
    }
    case 'poly': {
      const [first, second] = config.voices ?? DEFAULT_POLY_VOICES;
      return {
        name: `${config.a} contra ${config.b}`,
        label: `${config.a} contra ${config.b}, ${tempo}`,
        rule: `Polirritmia: ${config.a} golpes de ${drumName(first)} y ${config.b} de ${drumName(second)}, parejos en el mismo tiempo. Solo coinciden al empezar el ciclo.`,
      };
    }
    case 'mutante':
      return {
        name: config.meters.map(meterName).join(' → '),
        label: `${config.meters.map(meterName).join(' → ')}, ${tempo}`,
        rule: `Compás mutante: cambia cada ${config.barsEach} ${config.barsEach === 1 ? 'compás' : 'compases'}.`,
      };
    case 'drum': {
      const used = DRUMS.filter((_, lane) => config.tracks[lane]?.some(Boolean)).map((drum) =>
        drum.name.toLowerCase(),
      );
      return {
        name: `Batería en ${config.steps} pasos`,
        label: `Batería en ${config.steps} pasos, ${tempo}`,
        rule: `Caja de ritmos: cada casilla es una semicorchea. Suenan ${used.length ? used.join(', ') : 'solo silencios'}.`,
      };
    }
  }
}

// --- La configuración viaja en la URL, para que un ritmo se pueda compartir ---

const parseGroups = (text: string | null): number[] | null => {
  if (!text) return null;
  const groups = text
    .split(/[+,\s]+/)
    .filter(Boolean)
    .map(Number);
  const [min, max] = LIMITS.groupSize;
  const valid =
    groups.length > 0 && groups.every((group) => Number.isInteger(group) && group >= min && group <= max);
  return valid && groups.reduce((a, b) => a + b, 0) <= LIMITS.cells[1] ? groups : null;
};

export function parseMeter(groupsText: string, denom: number): Meter | null {
  const groups = parseGroups(groupsText);
  if (!groups || (denom !== 4 && denom !== 8 && denom !== 16)) return null;
  return { groups, denom };
}

const intIn = (value: string | null, min: number, max: number): number | null => {
  const number = Number(value);
  return value !== null && Number.isInteger(number) && number >= min && number <= max ? number : null;
};

export function rhythmToParams(config: RhythmConfig): URLSearchParams {
  const params = new URLSearchParams({ m: config.mode, bpm: String(config.bpm) });
  if (config.mode === 'meter') {
    params.set('g', config.groups.join('+'));
    params.set('d', String(config.denom));
  } else if (config.mode === 'euclid') {
    params.set('k', String(config.pulses));
    params.set('n', String(config.steps));
    params.set('r', String(config.rotation));
  } else if (config.mode === 'poly') {
    params.set('a', String(config.a));
    params.set('b', String(config.b));
    if (config.voices) params.set('v', config.voices.join('_'));
  } else if (config.mode === 'drum') {
    params.set('n', String(config.steps));
    params.set('p', config.tracks.map((track) => track.map((on) => (on ? '1' : '0')).join('')).join('_'));
    params.set('l', config.levels.map((level) => Math.round(level * 100)).join('_'));
  } else {
    params.set('s', config.meters.map((meter) => `${meter.groups.join('+')}/${meter.denom}`).join('_'));
    params.set('c', String(config.barsEach));
  }
  return params;
}

export function rhythmFromParams(params: URLSearchParams): RhythmConfig | null {
  const bpm = intIn(params.get('bpm'), LIMITS.bpm[0], LIMITS.bpm[1]);
  if (bpm === null) return null;
  switch (params.get('m')) {
    case 'meter': {
      const meter = parseMeter(params.get('g') ?? '', Number(params.get('d')));
      return meter && { mode: 'meter', bpm, ...meter };
    }
    case 'euclid': {
      const steps = intIn(params.get('n'), 2, LIMITS.cells[1]);
      if (steps === null) return null;
      const pulses = intIn(params.get('k'), 1, steps);
      const rotation = intIn(params.get('r'), 0, steps - 1);
      return pulses !== null && rotation !== null ? { mode: 'euclid', pulses, steps, rotation, bpm } : null;
    }
    case 'poly': {
      const a = intIn(params.get('a'), LIMITS.lane[0], LIMITS.lane[1]);
      const b = intIn(params.get('b'), LIMITS.lane[0], LIMITS.lane[1]);
      if (a === null || b === null) return null;
      // Los links de antes no traen instrumentos: siguen valiendo, con los de siempre.
      const text = params.get('v');
      if (text === null) return { mode: 'poly', a, b, bpm };
      const voices = parsePolyVoices(text);
      return voices && { mode: 'poly', a, b, voices, bpm };
    }
    case 'mutante': {
      const barsEach = intIn(params.get('c'), 1, 16);
      const meters = (params.get('s') ?? '').split('_').map((part) => {
        const [groups = '', denom] = part.split('/');
        return parseMeter(groups, Number(denom));
      });
      if (barsEach === null || meters.length === 0 || meters.some((meter) => !meter)) return null;
      return { mode: 'mutante', meters: meters as Meter[], barsEach, bpm };
    }
    case 'drum': {
      const steps = intIn(params.get('n'), 2, LIMITS.cells[1]);
      if (steps === null) return null;
      const rows = (params.get('p') ?? '').split('_');
      if (rows.length !== DRUMS.length || !rows.every((row) => row.length === steps && /^[01]+$/.test(row))) {
        return null;
      }
      const levels = (params.get('l') ?? '').split('_').map(Number);
      return {
        mode: 'drum',
        steps,
        bpm,
        tracks: rows.map((row) => [...row].map((char) => char === '1')),
        levels: DRUMS.map((_, lane) => {
          const level = levels[lane];
          return level !== undefined && Number.isFinite(level)
            ? Math.min(1, Math.max(0, level / 100))
            : DEFAULT_LEVEL;
        }),
      };
    }
    default:
      return null;
  }
}
