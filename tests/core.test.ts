import { describe, expect, it } from 'vitest';
import { CARDS } from '~/data/cards';
import { STANDARD, TUNINGS } from '~/data/tunings';
import { rollProgression } from '~/core/harmony';
import { centsBetween, centsToTarget, intervalName, midiToHz, midiToNote, noteToMidi } from '~/core/notes';
import { detectPitch, PitchTracker } from '~/core/pitch';
import { pluck } from '~/core/pluck';
import {
  cycleFor,
  describeRhythm,
  euclid,
  rhythmFromParams,
  rhythmToParams,
  type RhythmConfig,
} from '~/core/rhythm';
import { createRng } from '~/core/rng';
import { randomSafeTuning, SAFE_TUNING_RANGE } from '~/core/rollers';
import type { Risk } from '~/core/roll';
import {
  decodeConsigna,
  encodeConsigna,
  newConsigna,
  rerollAll,
  rerollRow,
  resolveRow,
  ROWS,
  consignaNumber,
  toggleLock,
} from '~/core/consigna';
import { openChordName, shiftString, stringIntervals, stringOffsets, tensionWarning } from '~/core/tuning';

const SR = 48000;
const WINDOW = 4096;

describe('notas', () => {
  it('convierte notas a MIDI y a frecuencia', () => {
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('E2')).toBe(40);
    expect(noteToMidi('F#2')).toBe(noteToMidi('Gb2'));
    expect(midiToNote(40)).toBe('E2');
    expect(midiToHz(40)).toBeCloseTo(82.407, 2);
    expect(midiToHz(69, 432)).toBeCloseTo(432, 9);
  });

  it('pliega solo los errores de octava exacta', () => {
    expect(Math.abs(centsToTarget(220, 110))).toBeLessThan(0.01);
    expect(Math.abs(centsToTarget(110, 220))).toBeLessThan(0.01);
    expect(centsToTarget(110 * Math.pow(2, 7 / 12), 110)).toBeGreaterThan(600);
    expect(centsToTarget(110 * Math.pow(2, -5 / 12), 110)).toBeLessThan(-400);
  });

  it('nombra los intervalos entre cuerdas', () => {
    expect(intervalName(40, 45)).toBe('4J');
    expect(intervalName(43, 43)).toBe('=');
    expect(intervalName(55, 52)).toBe('↓3m');
    expect(intervalName(40, 52)).toBe('8J');
  });
});

describe('detección de altura', () => {
  const tone = (fn: (phase: number) => number, freq: number) =>
    new Float32Array(WINDOW).map((_, i) => fn((2 * Math.PI * freq * i) / SR));

  it('detecta senoidales desde el Si grave hasta el agudo con precisión menor a 1 cent', () => {
    for (const note of ['B1', 'C2', 'E2', 'A2', 'D3', 'G3', 'E4', 'G4', 'B4']) {
      const freq = midiToHz(noteToMidi(note));
      const result = detectPitch(
        tone((phase) => 0.5 * Math.sin(phase), freq),
        SR,
      );
      expect(result, note).not.toBeNull();
      expect(Math.abs(centsBetween(result!.freq, freq)), note).toBeLessThan(1);
    }
  });

  it('no se confunde de octava cuando el segundo armónico domina', () => {
    for (const note of ['B1', 'D2', 'E2', 'A2']) {
      const freq = midiToHz(noteToMidi(note));
      const signal = tone((p) => 0.2 * Math.sin(p) + 0.6 * Math.sin(2 * p) + 0.2 * Math.sin(3 * p), freq);
      const result = detectPitch(signal, SR);
      expect(result, note).not.toBeNull();
      expect(Math.abs(centsBetween(result!.freq, freq)), note).toBeLessThan(5);
    }
  });

  it('ignora el silencio y el ruido', () => {
    expect(detectPitch(new Float32Array(WINDOW), SR)).toBeNull();
    let state = 7;
    const noise = new Float32Array(WINDOW).map(() => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 2147483648 - 1;
    });
    expect(detectPitch(noise, SR)).toBeNull();
  });

  it('descarta las lecturas sueltas con la mediana', () => {
    const tracker = new PitchTracker(5);
    [110, 110, 220, 110, 110].forEach((value) => tracker.push(value));
    expect(tracker.push(110)).toBe(110);
  });
});

describe('síntesis', () => {
  it('los tonos de todas las afinaciones suenan afinados, también con capo y trastes', () => {
    const notes = new Set(TUNINGS.flatMap((tuning) => tuning.notes));
    for (const offset of [0, 7, 12]) {
      for (const note of notes) {
        const freq = midiToHz(noteToMidi(note) + offset);
        const signal = pluck(freq, SR, 1);
        const start = Math.floor(0.25 * SR);
        const result = detectPitch(signal.subarray(start, start + WINDOW), SR);
        expect(result, `${note}+${offset}`).not.toBeNull();
        expect(Math.abs(centsBetween(result!.freq, freq)), `${note}+${offset}`).toBeLessThan(2);
      }
    }
  });

  it('funciona con otras frecuencias de muestreo', () => {
    for (const sampleRate of [44100, 96000]) {
      const freq = midiToHz(noteToMidi('B1'));
      const signal = pluck(freq, sampleRate, 1);
      const start = Math.floor(0.25 * sampleRate);
      const result = detectPitch(signal.subarray(start, start + 8192), sampleRate);
      expect(result).not.toBeNull();
      expect(Math.abs(centsBetween(result!.freq, freq))).toBeLessThan(2);
    }
  });
});

describe('afinaciones', () => {
  const byId = (id: string) => TUNINGS.find((tuning) => tuning.id === id)!.notes;

  it('nombra el acorde que suena al aire', () => {
    const expected: Record<string, string> = {
      openg: 'G/D',
      opend: 'D',
      opene: 'E',
      opena: 'A/E',
      openc: 'C',
      openf: 'F/C',
      c6: 'C6',
      dminor: 'Dm',
      gminor: 'Gm/D',
      eminor: 'Em',
      cminor: 'Cm',
      aminor: 'Am/E',
      dadgad: 'Dsus4',
      dadead: 'Dsus2',
      cgcfcf: 'Csus4',
      cgcfce: 'Cadd11',
      cmaj9: 'Cmaj9',
      cmaj7: 'Cmaj7',
      em7: 'Em7',
      gmaj7: 'Gmaj7/D',
      dmaj7: 'Dmaj7',
      g6: 'G6/D',
      egdged: 'Em7(no5)',
      ostrich: 'Solo D',
      dronee: 'E5',
      estandar: 'Em11',
      minorthirds: 'Cdim7',
      tritones: 'Sin nombre: un cúmulo',
    };
    for (const [id, chord] of Object.entries(expected)) expect(openChordName(byId(id)), id).toBe(chord);
    expect(openChordName(byId('opend'), 'solfege')).toBe('Re');
  });

  it('calcula intervalos y desvíos', () => {
    expect(stringIntervals(byId('dadgad'))).toEqual(['5J', '4J', '4J', '2M', '4J']);
    expect(stringOffsets(byId('dropd'))).toEqual([-2, 0, 0, 0, 0, 0]);
  });

  it('avisa cuando una cuerda queda muy tensa o muy floja', () => {
    expect(tensionWarning({ notes: STANDARD })).toBeNull();
    expect(tensionWarning({ notes: byId('dadgdfs') })).toContain('2.ª (+3)');
    expect(tensionWarning({ notes: byId('ggddgg') })).toContain('1.ª (−9)');
  });

  it('DADGDF# equivale a CGCFCE con capo en el traste 2', () => {
    expect(byId('dadgdfs').map(noteToMidi)).toEqual(byId('cgcfce').map((note) => noteToMidi(note) + 2));
    expect(byId('dadgdg').map(noteToMidi)).toEqual(byId('cgcfcf').map((note) => noteToMidi(note) + 2));
  });

  it('no deja mover una cuerda más allá del rango', () => {
    const atLimit = [...STANDARD];
    atLimit[0] = midiToNote(noteToMidi('E2') + 12);
    expect(shiftString(atLimit, 0, 1)).toEqual(atLimit);
    expect(shiftString(STANDARD, 0, 1)[0]).toBe('F2');
  });

  it('las afinaciones generadas respetan el límite y cambian algo', () => {
    for (let seed = 0; seed < 200; seed++) {
      const notes = randomSafeTuning(createRng(seed));
      const offsets = stringOffsets(notes);
      expect(offsets.every((offset) => Math.abs(offset) <= SAFE_TUNING_RANGE)).toBe(true);
      expect(offsets.filter((offset) => offset !== 0).length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('ritmo', () => {
  it('reparte los golpes euclidianos de forma pareja', () => {
    expect(
      euclid(3, 8)
        .map((on) => (on ? 'x' : '.'))
        .join(''),
    ).toBe('x..x..x.');
    for (let steps = 2; steps <= 16; steps++) {
      for (let pulses = 1; pulses <= steps; pulses++) {
        const pattern = euclid(pulses, steps);
        expect(pattern.filter(Boolean).length).toBe(pulses);
        const positions = pattern.flatMap((on, i) => (on ? [i] : []));
        const gaps = positions.map(
          (position, i) => (positions[(i + 1) % pulses]! - position + steps) % steps || steps,
        );
        expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('rota sin cambiar la cantidad de golpes', () => {
    expect(euclid(3, 8, 1).filter(Boolean).length).toBe(3);
    expect(euclid(3, 8, 1).join()).not.toBe(euclid(3, 8).join());
  });

  it('el 7/8 agrupado acentúa el inicio de cada grupo', () => {
    const cycle = cycleFor({ mode: 'meter', groups: [2, 2, 3], denom: 8, bpm: 120 }, 0);
    expect(cycle.beats).toBe(3.5);
    expect(cycle.hits.map((hit) => hit.level)).toEqual([2, 0, 1, 0, 1, 0, 0]);
  });

  it('la polirritmia pone dos carriles en el mismo ciclo', () => {
    const cycle = cycleFor({ mode: 'poly', a: 3, b: 2, bpm: 120 }, 0);
    expect(cycle.lanes).toEqual([3, 2]);
    expect(cycle.hits.filter((hit) => hit.at === 0).length).toBe(2);
  });

  it('cada línea de la polirritmia suena con su instrumento de batería', () => {
    const voicesOf = (config: RhythmConfig) => {
      const { hits } = cycleFor(config, 0);
      return [0, 1].map((lane) => [
        ...new Set(hits.filter((hit) => hit.lane === lane).map((hit) => hit.voice)),
      ]);
    };
    expect(voicesOf({ mode: 'poly', a: 3, b: 2, bpm: 120 })).toEqual([['hihat'], ['bombo']]);
    expect(voicesOf({ mode: 'poly', a: 3, b: 2, voices: ['cencerro', 'tom'], bpm: 120 })).toEqual([
      ['cencerro'],
      ['tom'],
    ]);
    expect(
      describeRhythm({ mode: 'poly', a: 3, b: 2, voices: ['cencerro', 'tom'], bpm: 120 }).rule,
    ).toContain('3 golpes de cencerro y 2 de tom');
  });

  it('el compás mutante cambia cada tantas vueltas', () => {
    const config: RhythmConfig = {
      mode: 'mutante',
      barsEach: 2,
      bpm: 100,
      meters: [
        { groups: [1, 1, 1, 1], denom: 4 },
        { groups: [2, 3], denom: 8 },
      ],
    };
    expect([0, 1, 2, 3, 4].map((index) => cycleFor(config, index).lanes[0])).toEqual([4, 4, 5, 5, 4]);
  });

  it('un ritmo sobrevive a ida y vuelta por la URL', () => {
    const configs: RhythmConfig[] = [
      { mode: 'meter', groups: [2, 2, 3], denom: 8, bpm: 160 },
      { mode: 'euclid', pulses: 5, steps: 8, rotation: 2, bpm: 90 },
      { mode: 'poly', a: 4, b: 3, bpm: 96 },
      { mode: 'poly', a: 4, b: 3, voices: ['palma', 'caja'], bpm: 96 },
      {
        mode: 'mutante',
        meters: [
          { groups: [2, 3], denom: 8 },
          { groups: [1, 1, 1], denom: 4 },
        ],
        barsEach: 3,
        bpm: 120,
      },
    ];
    for (const config of configs) expect(rhythmFromParams(rhythmToParams(config))).toEqual(config);
  });

  it('rechaza una URL inválida', () => {
    for (const text of [
      'm=meter&bpm=9999&g=2&d=8',
      'm=meter&bpm=100&g=abc&d=8',
      'm=euclid&bpm=100&k=9&n=8&r=0',
      'm=poly&bpm=100&a=3&b=2&v=hihat',
      'm=poly&bpm=100&a=3&b=2&v=hihat_gong',
      'm=nada&bpm=100',
      'bpm=100',
    ]) {
      expect(rhythmFromParams(new URLSearchParams(text)), text).toBeNull();
    }
  });

  it('cada ritmo explica su regla', () => {
    expect(describeRhythm({ mode: 'euclid', pulses: 3, steps: 8, rotation: 0, bpm: 90 }).rule).toContain(
      'tresillo',
    );
    expect(describeRhythm({ mode: 'meter', groups: [2, 2, 3], denom: 8, bpm: 90 }).label).toContain(
      '7/8 (2+2+3)',
    );
  });
});

describe('armonía', () => {
  it('escribe bien las notas: Bb no sale como A#', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      rollProgression(['ionian', 'aeolian', 'dorian', 'phrygian'], 0, createRng(seed)).chords.forEach(
        (chord) => seen.add(chord),
      );
    }
    expect(seen.has('Bb') || seen.has('Bbm')).toBe(true);
    expect(seen.has('A#')).toBe(false);
  });

  it('el nivel seguro es diatónico y arranca en la tónica', () => {
    for (let seed = 0; seed < 100; seed++) {
      const { chords, rule } = rollProgression(['ionian'], 0, createRng(seed));
      expect(chords).toHaveLength(4);
      expect(rule).toContain('Diatónico');
    }
    const cMajor = new Set(['C', 'Dm', 'Em', 'F', 'G', 'Am']);
    for (let seed = 0; seed < 400; seed++) {
      const { chords, rule } = rollProgression(['ionian'], 0, createRng(seed));
      if (rule.includes('en C jónico'))
        chords.forEach((chord) => expect(cMajor.has(chord), chord).toBe(true));
    }
  });

  it('el nivel medio y el raro usan los recursos que prometen', () => {
    const rules = (risk: Risk) => {
      const found = new Set<string>();
      for (let seed = 0; seed < 300; seed++)
        found.add(rollProgression(['ionian', 'aeolian'], risk, createRng(seed)).rule.split(/[ :]/)[0]!);
      return found;
    };
    expect(rules(1)).toEqual(new Set(['Intercambio', 'Dominante']));
    expect(rules(2)).toEqual(new Set(['Sustituto', 'Mediantes', 'Neo-riemanniano']));
  });

  const pitchOf = (chord: string) => noteToMidi(`${/^[A-G][#b]?/.exec(chord)![0]}4`) % 12;

  it('el dominante secundario está una quinta arriba de su objetivo, en cualquier tonalidad', () => {
    let checked = 0;
    for (let seed = 0; seed < 600; seed++) {
      const { rule } = rollProgression(['ionian', 'aeolian', 'dorian'], 1, createRng(seed));
      const match = /: (\S+)7 es el V7 de (\S+)\.$/.exec(rule);
      if (!match) continue;
      expect((pitchOf(match[1]!) - pitchOf(match[2]!) + 12) % 12, rule).toBe(7);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(50);
  });

  it('el sustituto tritonal baja por semitono y está a un tritono del dominante', () => {
    let checked = 0;
    for (let seed = 0; seed < 600; seed++) {
      const { rule } = rollProgression(['ionian', 'aeolian'], 2, createRng(seed));
      const match = /: (\S+)7 reemplaza a (\S+)7 y baja por semitono hacia (\S+)\.$/.exec(rule);
      if (!match) continue;
      expect((pitchOf(match[1]!) - pitchOf(match[2]!) + 12) % 12, rule).toBe(6);
      expect((pitchOf(match[1]!) - pitchOf(match[3]!) + 12) % 12, rule).toBe(1);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(50);
  });
});

describe('consigna', () => {
  const counter = (start = 1) => {
    let value = start;
    return () => value++;
  };

  it('todos los módulos dan resultados con regla, en todo nivel de riesgo', () => {
    for (const risk of [0, 1, 2] as Risk[]) {
      for (let seed = 0; seed < 300; seed++) {
        const consigna = newConsigna(risk, () => seed);
        consigna.rows.forEach((row, index) => {
          const rolled = resolveRow(index, row);
          expect(rolled.label.length, `${risk} ${ROWS[index]!.id}`).toBeGreaterThan(0);
          expect(rolled.rule.length, `${risk} ${ROWS[index]!.id}`).toBeGreaterThan(0);
        });
      }
    }
  });

  it('la misma semilla da el mismo resultado', () => {
    const consigna = newConsigna(2, counter());
    consigna.rows.forEach((row, index) => expect(resolveRow(index, row)).toEqual(resolveRow(index, row)));
  });

  it('lo trabado no cambia al volver a tirar, aunque cambie el riesgo', () => {
    let consigna = newConsigna(0, counter());
    consigna = toggleLock(consigna, 2);
    const locked = resolveRow(2, consigna.rows[2]!);
    const next = rerollAll(consigna, 2, counter(1000));
    expect(resolveRow(2, next.rows[2]!)).toEqual(locked);
    expect(next.rows[0]!.risk).toBe(2);
    expect(next.rows[0]!.seed).not.toBe(consigna.rows[0]!.seed);
  });

  it('volver a tirar una fila solo cambia esa fila', () => {
    const consigna = newConsigna(0, counter());
    const next = rerollRow(consigna, 3, counter(500));
    expect(next.rows[3]!.seed).toBe(500);
    expect(next.rows[4]).toEqual(consigna.rows[4]);
  });

  it('sobrevive a ida y vuelta por el código, con filas trabadas de otro nivel', () => {
    let consigna = newConsigna(1, counter(4000000000));
    consigna = toggleLock(consigna, 1);
    consigna = rerollAll(consigna, 2, counter(77));
    const decoded = decodeConsigna(encodeConsigna(consigna));
    expect(decoded).toEqual(consigna);
    expect(consignaNumber(decoded!)).toBe(consignaNumber(consigna));
  });

  it('rechaza códigos inválidos', () => {
    for (const code of ['', 'nada', '9.a.b.c.d.e.f.g', '1.a', '1.a.b.c.d.e.f.$$', '1.a.b.c.d.e.f.g~9']) {
      expect(decodeConsigna(code), code).toBeNull();
    }
  });
});

describe('cartas', () => {
  it('hay cartas para cada nivel de riesgo', () => {
    for (const risk of [0, 1, 2])
      expect(CARDS.filter((card) => card.risk === risk).length).toBeGreaterThanOrEqual(10);
  });
});
