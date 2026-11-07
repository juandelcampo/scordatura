// Valida los datos con esquemas: un error en el catálogo tiene que fallar acá, no en pantalla.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { CARDS } from '~/data/cards';
import { FORM_EXAMPLES } from '~/data/forms';
import { FORM_POOL, TUNING_POOL } from '~/data/pools';
import { GROUPS, SOURCES, TUNINGS } from '~/data/tunings';
import { isNote, noteToMidi } from '~/core/notes';

const noteSchema = z.string().refine(isNote, 'nota inválida');
const heardSchema = z.strictObject({
  artist: z.string().min(1),
  song: z.string().min(1).optional(),
  video: z
    .string()
    .regex(/^[\w-]{11}$/)
    .optional(),
  capo: z.number().int().min(1).max(12).optional(),
  conf: z.enum(['fan', 'duda']).optional(),
  who: z.string().min(1).optional(),
});
const tuningSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+$/),
  name: z.string().min(1),
  group: z.string(),
  notes: z.array(noteSchema).length(6),
  desc: z.string().min(1),
  octaves: z.literal('est').optional(),
  restring: z.boolean().optional(),
  heard: z.array(heardSchema).optional(),
});
const cardSchema = z.strictObject({
  id: z.number().int().positive(),
  text: z.string().min(1),
  risk: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  breaks: z.string().min(1),
});

describe('catálogo de afinaciones', () => {
  it('cumple el esquema', () => {
    for (const tuning of TUNINGS) expect(tuningSchema.safeParse(tuning).error, tuning.id).toBeUndefined();
  });

  it('tiene ids únicos y grupos conocidos', () => {
    const groups = new Set(GROUPS.map((group) => group.id));
    expect(new Set(TUNINGS.map((tuning) => tuning.id)).size).toBe(TUNINGS.length);
    for (const tuning of TUNINGS) expect(groups.has(tuning.group), tuning.id).toBe(true);
  });

  it('no repite afinaciones', () => {
    const keys = TUNINGS.map((tuning) => tuning.notes.map(noteToMidi).join());
    expect(new Set(keys).size).toBe(TUNINGS.length);
  });

  it('los nombres en letras coinciden con las notas', () => {
    for (const tuning of TUNINGS) {
      if (!/^[A-G#b]+$/.test(tuning.name)) continue;
      expect(tuning.notes.map((note) => note.replace(/\d/, '')).join(''), tuning.id).toBe(tuning.name);
    }
  });

  it('las fuentes son enlaces https', () => {
    for (const source of SOURCES) expect(source.url).toMatch(/^https:\/\//);
  });
});

describe('qué se sortea', () => {
  it('solo nombra afinaciones que existen', () => {
    const ids = new Set(TUNINGS.map((tuning) => tuning.id));
    for (const list of Object.values(TUNING_POOL)) {
      for (const id of list) expect(ids.has(id), id).toBe(true);
    }
  });

  it('las formas coinciden con su nombre', () => {
    for (const entries of Object.values(FORM_POOL)) {
      for (const entry of entries) expect(entry.blocks.join(' ')).toBe(entry.label);
    }
  });
});

describe('ejemplos de forma', () => {
  it('tienen videos válidos y solo letras de sección', () => {
    for (const example of FORM_EXAMPLES) {
      expect(example.video, example.song).toMatch(/^[\w-]{11}$/);
      for (const block of example.blocks) expect(block, example.song).toMatch(/^[A-H]$/);
    }
  });
});

describe('mazo de cartas', () => {
  it('cumple el esquema y no repite números', () => {
    for (const card of CARDS) expect(cardSchema.safeParse(card).error, String(card.id)).toBeUndefined();
    expect(new Set(CARDS.map((card) => card.id)).size).toBe(CARDS.length);
  });
});
