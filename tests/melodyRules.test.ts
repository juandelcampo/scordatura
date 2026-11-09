import { describe, expect, it } from 'vitest';
import { MODES, type ModeId } from '~/core/harmony';
import { BAR, breaksRule, melodyExample, type MelodyKind } from '~/core/melodyRules';
import { noteLabel, midiToNote } from '~/core/notes';
import { createRng } from '~/core/rng';
import { MELODY_POOL } from '~/data/pools';

const KINDS = [...new Set(Object.values(MELODY_POOL).flatMap((pool) => pool.map((item) => item.kind)))];
const MODE_IDS = Object.keys(MODES) as ModeId[];
const name = (pitchClass: number) => noteLabel(midiToNote(60 + pitchClass));

// Progresiones de verdad, con prestados y dominantes: lo que sortea la consigna.
const PROGRESSIONS = [
  ['E', 'Am', 'G#m', 'B'],
  ['Cm', 'Db', 'F', 'Db'],
  ['G', 'F#m', 'E7', 'A'],
  ['Dm', 'C'],
];

describe('ejemplos de melodía de la consigna', () => {
  it('cada restricción del sorteo tiene su ejemplo', () => {
    expect(KINDS.length).toBe(21);
  });

  for (const kind of KINDS as MelodyKind[]) {
    it(`${kind}: cumple su regla en todas las tonalidades y modos`, () => {
      for (const mode of MODE_IDS) {
        for (let tonic = 0; tonic < 12; tonic++) {
          for (const [index, chords] of PROGRESSIONS.entries()) {
            const rng = createRng(tonic * 97 + index * 13 + mode.length);
            const example = melodyExample(kind, { tonic, mode, chords, rng, name });
            expect(example.notes.length, `${kind} ${tonic} ${mode}`).toBeGreaterThan(0);
            expect(breaksRule(kind, example.notes, { tonic, mode, chords })).toBeNull();
            for (const note of example.notes) {
              expect(note.start + note.dur).toBeLessThanOrEqual(example.length);
              expect(note.midi).toBeGreaterThanOrEqual(40);
              expect(note.midi).toBeLessThanOrEqual(84);
            }
            expect(example.length).toBe(Math.min(4, chords.length) * BAR);
            expect(example.hint).not.toMatch(/undefined|NaN/);
          }
        }
      }
    });
  }

  it('dice las notas de la tonalidad: la 3.ª de E lidio es G#', () => {
    const example = melodyExample('sin-tercera', {
      tonic: 4,
      mode: 'lydian',
      chords: ['E', 'Am'],
      rng: createRng(1),
      name,
    });
    expect(example.hint).toContain('Sin G#');
  });

  it('las notas fuera del acorde cambian con cada acorde', () => {
    const example = melodyExample('fuera-del-acorde', {
      tonic: 0,
      mode: 'ionian',
      chords: ['C', 'G'],
      rng: createRng(3),
      name,
    });
    expect(example.hint).toMatch(/^Sobre C, solo D, F, A, B/);
  });
});
