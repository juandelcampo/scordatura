// La consigna: una fila por módulo, cada una con su propia semilla. Es determinista, así que
// alcanza con guardar las semillas para reproducirla o compartirla con un link.
// Lo que elegís a mano en una herramienta reemplaza al sorteo de esa fila: es un "override".
import { canonical } from './canonical';
import { harmonyHref, isChordBeats, parseChord } from './chords';
import { CARDS } from '~/data/cards';
import {
  describeDrone,
  droneFromParams,
  droneToParams,
  followKey,
  fitToHarmony,
  followsTonic,
  matchMode,
  type DroneConfig,
} from './drone';
import { MODES, type ModeId } from './harmony';
import type { Note } from './melody';
import { isNote, noteLabel } from './notes';
import { describeRhythm, rhythmFromParams, rhythmToParams, type RhythmConfig } from './rhythm';
import { createRng, randomSeed, shortHash } from './rng';
import type { Risk, Rolled, Roller } from './roll';
import {
  rollCard,
  rollDrone,
  rollForm,
  rollHarmony,
  rollHarmonyWith,
  rollLyric,
  rollMelody,
  rollRhythm,
  rollTuning,
} from './rollers';
import { openChordName } from './tuning';
import type { SectionNames } from '~/data/structures';

export const ROWS = [
  { id: 'afinacion', name: 'Afinación', roll: rollTuning },
  { id: 'ritmo', name: 'Ritmo', roll: rollRhythm },
  { id: 'armonia', name: 'Armonía', roll: rollHarmony },
  { id: 'melodia', name: 'Melodía', roll: rollMelody },
  { id: 'letra', name: 'Letra', roll: rollLyric },
  { id: 'forma', name: 'Forma', roll: rollForm },
  { id: 'carta', name: 'Consigna', roll: rollCard },
  { id: 'drone', name: 'Drone', roll: rollDrone },
] as const satisfies ReadonlyArray<{ id: string; name: string; roll: Roller }>;

export type RowId = (typeof ROWS)[number]['id'];

/** Lo que cada herramienta le puede pasar a su fila. */
export interface RowOverrides {
  afinacion: { notes: string[]; name?: string; href?: string };
  ritmo: RhythmConfig;
  /** La regla, si la armonía salió de un sorteo con acordes trabados. */
  armonia: { chords: string[]; tonic?: number; mode?: ModeId; beats?: number[]; rule?: string };
  melodia: { label: string; rule: string; notes?: Note[] };
  letra: { label: string; rule: string };
  /** La regla y los nombres viajan con la forma; si se edita a mano, la regla se describe sola. */
  forma: { blocks: string[]; rule?: string; names?: SectionNames };
  carta: { text: string; id?: number; breaks?: string };
  drone: DroneConfig;
}

/** Una fila trabada conserva el riesgo con el que salió. */
export interface RowState {
  seed: number;
  risk: Risk;
  locked: boolean;
  /** Si está, esta fila muestra lo que elegiste en la herramienta en lugar del sorteo. */
  override?: RowOverrides[RowId];
}

export interface Consigna {
  risk: Risk;
  rows: RowState[];
}

export function newConsigna(risk: Risk, seed: () => number = randomSeed): Consigna {
  return { risk, rows: ROWS.map(() => ({ seed: seed() >>> 0, risk, locked: false })) };
}

const MAX_ATTEMPTS = 16;

/** Una semilla que dé un resultado distinto: un sorteo que repite parece un botón que no anda. */
function freshRow(index: number, previous: RowState, risk: Risk, seed: () => number): RowState {
  const before = resolveRow(index, previous).label;
  let row: RowState = { seed: seed() >>> 0, risk, locked: false };
  for (let attempt = 1; attempt < MAX_ATTEMPTS && resolveRow(index, row).label === before; attempt++) {
    row = { seed: seed() >>> 0, risk, locked: false };
  }
  return row;
}

/** Vuelve a sortear lo que no está trabado, con el riesgo actual. */
export function rerollAll(
  consigna: Consigna,
  risk = consigna.risk,
  seed: () => number = randomSeed,
): Consigna {
  return {
    risk,
    rows: consigna.rows.map((row, index) => (row.locked ? row : freshRow(index, row, risk, seed))),
  };
}

/** Cambiar una fila a mano descarta lo elegido en la herramienta, y deja de estar trabada. */
export function rerollRow(consigna: Consigna, index: number, seed: () => number = randomSeed): Consigna {
  return {
    ...consigna,
    rows: consigna.rows.map((row, i) => {
      if (i !== index) return row;
      const next = freshRow(i, row, consigna.risk, seed);
      return { ...next, locked: row.override ? false : row.locked };
    }),
  };
}

export function toggleLock(consigna: Consigna, index: number): Consigna {
  return {
    ...consigna,
    rows: consigna.rows.map((row, i) => (i === index ? { ...row, locked: !row.locked } : row)),
  };
}

export const rowIndex = (id: RowId) => ROWS.findIndex((row) => row.id === id);

/**
 * Vuelve a sortear la armonía en su misma tonalidad, sin tocar los acordes trabados. Lo que sale
 * queda en `target` (por defecto, la misma consigna): así "Nueva consigna" sortea el resto y
 * respeta los acordes que elegiste.
 */
export function rerollHarmonyKeeping(
  source: Consigna,
  locks: readonly boolean[],
  target: Consigna = source,
  seed: () => number = randomSeed,
): Consigna {
  const index = rowIndex('armonia');
  const current = harmonyOf(source);
  const key = harmonyKey(current);
  const rowSeed = seed() >>> 0;
  const rolled = rollHarmonyWith(
    { risk: target.risk, rng: createRng(rowSeed) },
    { length: current.chords.length, tonic: key.tonic, mode: key.mode },
  );
  const chords = rolled.value.chords.map((name, i) => (locks[i] ? current.chords[i]! : name));
  const value: RowOverrides['armonia'] = {
    chords,
    tonic: key.tonic,
    mode: key.mode,
    ...(current.beats ? { beats: current.beats } : {}),
    rule: `${rolled.rule} Los trabados quedan como estaban, y pueden salirse de esa regla.`,
  };
  return {
    ...target,
    rows: target.rows.map((row, i) =>
      i === index ? { seed: rowSeed, risk: target.risk, locked: false, override: value } : row,
    ),
  };
}

/** Lo elegido en una herramienta entra a su fila y queda trabado, para que un sorteo no lo pise. */
export function applyOverride<K extends RowId>(consigna: Consigna, id: K, value: RowOverrides[K]): Consigna {
  const index = rowIndex(id);
  return {
    ...consigna,
    rows: consigna.rows.map((row, i) => (i === index ? { ...row, locked: true, override: value } : row)),
  };
}

/** Lo que se puede decir con certeza de una forma armada a mano: cuántas partes tiene y qué vuelve. */
export function handFormRule(blocks: readonly string[]): string {
  const sections = [...new Set(blocks)];
  const back = sections.filter((letter) => blocks.indexOf(letter) !== blocks.lastIndexOf(letter));
  const count = `${sections.length} ${sections.length === 1 ? 'sección' : 'secciones'} en ${blocks.length} ${blocks.length === 1 ? 'bloque' : 'bloques'}`;
  const listed = back.length > 1 ? `${back.slice(0, -1).join(', ')} y ${back.at(-1)}` : back[0];
  const returns = back.length === 0 ? 'nada vuelve' : `${back.length === 1 ? 'vuelve' : 'vuelven'} ${listed}`;
  return `Armada a mano: ${count}; ${returns}.`;
}

function resolveOverride(id: RowId, override: RowOverrides[RowId]): Rolled {
  switch (id) {
    case 'afinacion': {
      const value = override as RowOverrides['afinacion'];
      return {
        value,
        label: value.name ?? value.notes.map((note) => noteLabel(note)).join(''),
        rule: `Al aire suena ${openChordName(value.notes)}.`,
        href: value.href ?? `/afinador/tuya?n=${value.notes.join(',').replaceAll('#', 's')}`,
      };
    }
    case 'ritmo': {
      const value = override as RhythmConfig;
      const { label, rule } = describeRhythm(value);
      return { value, label, rule, href: `/ritmo?${rhythmToParams(value)}` };
    }
    case 'armonia': {
      const value = override as RowOverrides['armonia'];
      return {
        value,
        label: value.chords.join(' – '),
        rule: value.rule ?? '',
        href: harmonyHref(value.chords, value.beats),
      };
    }
    case 'melodia': {
      const value = override as RowOverrides['melodia'];
      return { value, label: value.label, rule: value.rule, href: '/melodia' };
    }
    case 'letra': {
      const value = override as RowOverrides['letra'];
      return { value, label: value.label, rule: value.rule, href: '/letras' };
    }
    case 'forma': {
      const value = override as RowOverrides['forma'];
      return {
        value,
        label: value.blocks.join(' '),
        rule: value.rule ?? handFormRule(value.blocks),
        href: `/forma?f=${value.blocks.join('')}`,
      };
    }
    case 'carta': {
      const value = override as RowOverrides['carta'];
      return {
        value,
        label: `“${value.text}”`,
        rule: value.breaks ? `Rompe ${value.breaks}.` : '',
        href: value.id ? `/cartas?c=${value.id}` : '/cartas',
      };
    }
    case 'drone': {
      const value = override as DroneConfig;
      const { label, rule } = describeDrone(value);
      return { value, label, rule, href: `/drone?${droneToParams(value)}` };
    }
  }
}

export function resolveRow(index: number, row: RowState): Rolled {
  const definition = ROWS[index]!;
  if (row.override) return resolveOverride(definition.id, row.override);
  return definition.roll({ risk: row.risk, rng: createRng(row.seed) });
}

export type HarmonyKey = { tonic: number; mode: ModeId };

/** La tónica y el modo de una armonía: si no los dice, salen del primer acorde. */
export function harmonyKey(value: { chords: string[]; tonic?: number; mode?: ModeId }): HarmonyKey {
  const first = parseChord(value.chords[0] ?? '');
  return {
    tonic: value.tonic ?? first?.root ?? 9,
    mode: value.mode ?? (first?.intervals.includes(3) ? 'aeolian' : 'ionian'),
  };
}

function harmonyOf(consigna: Consigna): RowOverrides['armonia'] {
  const index = rowIndex('armonia');
  return resolveRow(index, consigna.rows[index]!).value as RowOverrides['armonia'];
}

export function consignaKey(consigna: Consigna): HarmonyKey {
  return harmonyKey(harmonyOf(consigna));
}

/** Los acordes de la consigna, para las herramientas que los leen. */
export const consignaChords = (consigna: Consigna): string[] => harmonyOf(consigna).chords;

/** El drone de la consigna, ya parado sobre la tónica de la armonía. */
function droneRow(consigna: Consigna, harmony = harmonyOf(consigna)): Rolled {
  const key = harmonyKey(harmony);
  const { chords } = harmony;
  const index = rowIndex('drone');
  const row = consigna.rows[index]!;
  const rolled = resolveRow(index, row);
  const config = rolled.value as DroneConfig;
  if (!followsTonic(config)) return rolled;
  // Lo sorteado también toma la tercera del modo, y deja su color si choca con un acorde;
  // lo elegido a mano solo sigue la tónica.
  const matched = row.override ? followKey(config, key) : matchMode(followKey(config, key), key.mode);
  const value = row.override ? matched : fitToHarmony(matched, key, chords);
  const fitted = value.stack !== matched.stack;
  const { label, rule } = describeDrone(value);
  return {
    value,
    label,
    rule: `${rule} Sigue la tónica de la armonía${fitted ? ', sin un color que choque con sus acordes' : ''}.`,
    href: `/drone?${droneToParams(value)}`,
  };
}

/** Todas las filas resueltas: cada una sale de su semilla, y el drone además sigue a la armonía. */
export function resolveRows(consigna: Consigna): Rolled[] {
  const rows = consigna.rows.map((row, index) => resolveRow(index, row));
  rows[rowIndex('drone')] = droneRow(consigna, rows[rowIndex('armonia')]!.value as RowOverrides['armonia']);
  return rows;
}

export const consignaDrone = (consigna: Consigna): DroneConfig => droneRow(consigna).value as DroneConfig;

/** Lo que llega de un link puede estar roto o ser malicioso: solo se acepta lo que tiene sentido. */
function sanitizeOverride(id: RowId, value: unknown): RowOverrides[RowId] | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const text = (key: string) =>
    typeof raw[key] === 'string' ? (raw[key] as string).slice(0, 300) : undefined;
  switch (id) {
    case 'afinacion': {
      const notes = raw.notes;
      if (!Array.isArray(notes) || notes.length !== 6 || !notes.every(isNote)) return null;
      const name = text('name');
      const href = text('href');
      return {
        notes,
        ...(name ? { name } : {}),
        ...(href && /^\/afinador\/[\w-]+$/.test(href) ? { href } : {}),
      };
    }
    case 'ritmo':
      try {
        return rhythmFromParams(rhythmToParams(value as RhythmConfig));
      } catch {
        return null;
      }
    case 'armonia': {
      const chords = raw.chords;
      if (!Array.isArray(chords) || chords.length === 0 || chords.length > 16) return null;
      if (!chords.every((chord) => typeof chord === 'string' && parseChord(chord))) return null;
      const tonic =
        typeof raw.tonic === 'number' && Number.isInteger(raw.tonic) && raw.tonic >= 0 && raw.tonic < 12
          ? raw.tonic
          : undefined;
      const mode =
        typeof raw.mode === 'string' && Object.hasOwn(MODES, raw.mode) ? (raw.mode as ModeId) : undefined;
      const rule = text('rule');
      return {
        chords,
        ...(tonic === undefined ? {} : { tonic }),
        ...(mode === undefined ? {} : { mode }),
        ...(isChordBeats(raw.beats, chords.length) ? { beats: raw.beats } : {}),
        ...(rule ? { rule } : {}),
      };
    }
    case 'melodia': {
      const label = text('label');
      const rule = text('rule');
      if (!label || !rule) return null;
      const valid =
        Array.isArray(raw.notes) &&
        raw.notes.length <= 64 &&
        raw.notes.every((note: Note) => [note?.midi, note?.start, note?.dur].every(Number.isFinite));
      return { label, rule, ...(valid ? { notes: raw.notes as Note[] } : {}) };
    }
    case 'letra': {
      const label = text('label');
      const rule = text('rule');
      return label && rule ? { label, rule } : null;
    }
    case 'forma': {
      const blocks = raw.blocks;
      const valid =
        Array.isArray(blocks) &&
        blocks.length > 0 &&
        blocks.length <= 24 &&
        blocks.every((block) => typeof block === 'string' && /^[A-H]$/.test(block));
      if (!valid) return null;
      const rule = text('rule');
      const names: SectionNames = {};
      if (raw.names && typeof raw.names === 'object') {
        for (const [letter, name] of Object.entries(raw.names as Record<string, unknown>)) {
          if (/^[A-H]$/.test(letter) && typeof name === 'string' && name.trim()) {
            names[letter] = name.trim().slice(0, 40);
          }
        }
      }
      return {
        blocks: blocks as string[],
        ...(rule ? { rule } : {}),
        ...(Object.keys(names).length ? { names } : {}),
      };
    }
    case 'carta': {
      const known = typeof raw.id === 'number' ? CARDS.find((card) => card.id === raw.id) : undefined;
      if (known) return { id: known.id, text: known.text, breaks: known.breaks };
      const own = text('text');
      return own ? { text: own } : null;
    }
    case 'drone':
      try {
        return droneFromParams(droneToParams(value as DroneConfig));
      } catch {
        return null;
      }
  }
}

// --- Código para compartir: "1.semilla.semilla!.semilla~2.semilla!@elegido..." ---

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function fromBase64Url(text: string): string | null {
  try {
    const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
    return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
  } catch {
    return null;
  }
}

export function encodeConsigna(consigna: Consigna): string {
  const rows = consigna.rows.map((row) => {
    const own = row.risk !== consigna.risk ? `~${row.risk}` : '';
    const chosen = row.override ? `@${toBase64Url(canonical(row.override))}` : '';
    return `${row.seed.toString(36)}${own}${row.locked ? '!' : ''}${chosen}`;
  });
  return [consigna.risk, ...rows].join('.');
}

const parseRisk = (value: string | undefined): Risk | null =>
  value === '0' ? 0 : value === '1' ? 1 : value === '2' ? 2 : null;

export function decodeConsigna(code: string): Consigna | null {
  const [riskText, ...rowCodes] = code.split('.');
  const risk = parseRisk(riskText);
  // Un link de cuando había una fila menos se abre igual: el drone sale de la primera semilla.
  if (rowCodes.length === ROWS.length - 1) rowCodes.push(rowCodes[0]!.split('@')[0]!.replace('!', ''));
  if (risk === null || rowCodes.length !== ROWS.length) return null;

  const rows: RowState[] = [];
  for (const [index, rowCode] of rowCodes.entries()) {
    const [base = '', chosen] = rowCode.split('@');
    const locked = base.endsWith('!');
    const [seedText = '', ownRiskText] = (locked ? base.slice(0, -1) : base).split('~');
    const seed = parseInt(seedText, 36);
    if (!/^[0-9a-z]+$/.test(seedText) || !Number.isSafeInteger(seed) || seed > 0xffffffff) return null;
    const ownRisk = ownRiskText === undefined ? risk : parseRisk(ownRiskText);
    if (ownRisk === null) return null;
    const row: RowState = { seed, risk: ownRisk, locked };
    if (chosen) {
      const json = fromBase64Url(chosen);
      let parsed: unknown = null;
      try {
        parsed = json ? JSON.parse(json) : null;
      } catch {
        parsed = null;
      }
      const override = sanitizeOverride(ROWS[index]!.id, parsed);
      if (override) row.override = override;
    }
    rows.push(row);
  }
  return { risk, rows };
}

/** Número corto y estable para nombrar una consigna. */
export function consignaNumber(consigna: Consigna): string {
  return shortHash(
    consigna.rows
      .map((row) => `${row.seed}~${row.risk}~${row.override ? canonical(row.override) : ''}`)
      .join('.'),
  );
}
