// Armonía tocable, melodía y métrica en español.
import { describe, expect, it } from 'vitest';
import {
  chordClasses,
  closeVoicing,
  customBeats,
  degreeOf,
  findVoicing,
  harmonyHref,
  isChordBeats,
  parseChord,
  tensionMap,
} from '~/core/chords';
import { rollProgression } from '~/core/harmony';
import {
  borrowedChords,
  chordsOfFormula,
  chordVariations,
  diatonicChords,
  enrichChord,
  insertAt,
  MAX_CHORDS,
  moveItem,
  prepareWithDominants,
  removeAt,
  roleOf,
  rotate,
  simplifyChord,
  smoothBass,
  translateChord,
  keyOfProgression,
  transposeChord,
  transposeTo,
} from '~/core/variations';
import { FAMILIES, FORMULAS } from '~/data/formulas';
import {
  CONTOURS,
  exampleMelody,
  fitContour,
  notesFromVoice,
  quantizeOnsets,
  rollMotif,
  sampleContour,
  scaleNotes,
  speechOnsets,
  textToNotes,
  TRANSFORMS,
} from '~/core/melody';
import { centsBetween, midiToHz, midiToNote, noteToMidi } from '~/core/notes';
import { createRng } from '~/core/rng';
import { detectPitch } from '~/core/pitch';
import { pianoTone } from '~/core/piano';
import {
  DEFAULT_DRONE,
  describeDrone,
  droneFromParams,
  droneToParams,
  droneVoices,
  followKey,
  matchMode,
  STACKS,
  type DroneConfig,
  type StackId,
} from '~/core/drone';
import { applyOverride, consignaDrone, newConsigna, resolveRows, rowIndex } from '~/core/consigna';
import {
  assonantKey,
  consonantKey,
  cutUp,
  metricCount,
  metricSyllables,
  prosody,
  rhymeScheme,
  stressType,
  syllabify,
} from '~/core/spanish';
import { soloShapes } from '~/core/tuning';
import { STANDARD, TUNINGS } from '~/data/tunings';

describe('acordes', () => {
  it('lee los nombres que produce el generador', () => {
    expect(parseChord('Bbsus2')?.root).toBe(10);
    expect(chordClasses(parseChord('Am')!).sort((a, b) => a - b)).toEqual([0, 4, 9]);
    expect(parseChord('H7')).toBeNull();
    expect(parseChord('Cloquesea')).toBeNull();
  });

  it('encuentra digitaciones conocidas en afinación estándar', () => {
    const fretsOf = (name: string) => findVoicing(STANDARD, parseChord(name)!)!.frets;
    expect(fretsOf('Em')).toEqual([0, 2, 2, 0, 0, 0]);
    expect(fretsOf('Am').slice(1)).toEqual([0, 2, 2, 1, 0]);
    expect(fretsOf('C').slice(1)).toEqual([3, 2, 0, 1, 0]);
  });

  it('solo usa notas del acorde y las contiene todas en cualquier afinación', () => {
    const names = ['C', 'Am', 'F#m', 'Bb', 'G7', 'Dsus2', 'Ebmaj7'];
    for (const tuning of TUNINGS.filter((item) => !item.restring)) {
      for (const name of names) {
        const chord = parseChord(name)!;
        const voicing = findVoicing(tuning.notes, chord);
        if (!voicing) continue;
        const allowed = new Set(chordClasses(chord));
        const played = new Set(voicing.midis.map((midi) => midi % 12));
        for (const pitchClass of played) expect(allowed.has(pitchClass), `${tuning.id} ${name}`).toBe(true);
        expect(voicing.midis.length, `${tuning.id} ${name}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('una afinación abierta toca su acorde al aire', () => {
    const open = TUNINGS.find((tuning) => tuning.id === 'opend')!;
    expect(findVoicing(open.notes, parseChord('D')!)!.frets).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('sin afinación también hay notas para oírlo', () => {
    expect(closeVoicing(parseChord('C')!).length).toBe(4);
  });

  it('clasifica las notas sobre un acorde', () => {
    const map = tensionMap(parseChord('C')!);
    const kind = (note: string) => map.find((item) => item.note === note)!.kind;
    expect(kind('C')).toBe('reposo');
    expect(kind('E')).toBe('reposo');
    expect(kind('D')).toBe('tension');
    expect(kind('A')).toBe('tension');
    // La 11.ª sobre un acorde mayor roza la 3.ª, y la b9 roza la tónica.
    expect(kind('F')).toBe('choque');
    expect(kind('C#')).toBe('choque');
  });

  it('nombra lo que suena con un solo dedo', () => {
    const shapes = soloShapes(TUNINGS.find((tuning) => tuning.id === 'opend')!.notes);
    expect(shapes[0]).toMatchObject({ chord: 'D', label: 'Al aire' });
    expect(shapes.some((shape) => shape.chord === 'E' && shape.label.includes('Cejilla'))).toBe(true);
    expect(new Set(shapes.map((shape) => shape.chord)).size).toBe(shapes.length);
  });
});

describe('melodía', () => {
  const limits = {
    tonic: 9,
    mode: 'aeolian' as const,
    range: 5,
    length: 12,
    taboo: null,
    forbiddenInterval: null,
    startDegree: null,
  };
  const arc = sampleContour(CONTOURS.arco.shape);

  it('el contorno respeta la escala, el registro y el largo', () => {
    const notes = fitContour(arc, limits);
    const scale = new Set(scaleNotes(9, 'aeolian', 40, 90));
    expect(notes).toHaveLength(12);
    expect(new Set(notes.map((note) => note.midi)).size).toBeLessThanOrEqual(5);
    for (const note of notes) expect(scale.has(note.midi)).toBe(true);
  });

  it('un arco sube y vuelve a bajar', () => {
    const notes = fitContour(arc, limits).map((note) => note.midi);
    const peak = Math.max(...notes);
    expect(notes[0]).toBeLessThan(peak);
    expect(notes[notes.length - 1]).toBeLessThan(peak);
  });

  it('nunca usa la nota tabú', () => {
    for (let taboo = 0; taboo < 12; taboo++) {
      for (const note of fitContour(arc, { ...limits, range: 7, taboo }))
        expect(note.midi % 12).not.toBe(taboo);
    }
  });

  it('nunca salta el intervalo prohibido', () => {
    for (const forbiddenInterval of [1, 2, 3, 4, 5, 7]) {
      const midis = fitContour(sampleContour(CONTOURS.ola.shape), {
        ...limits,
        range: 8,
        length: 24,
        forbiddenInterval,
      }).map((note) => note.midi);
      midis
        .slice(1)
        .forEach((midi, i) =>
          expect(Math.abs(midi - midis[i]!), String(forbiddenInterval)).not.toBe(forbiddenInterval),
        );
    }
  });

  it('arranca en el grado pedido', () => {
    const notes = fitContour(arc, { ...limits, range: 7, startDegree: 2 });
    expect(notes[0]!.midi % 12).toBe(0);
  });

  it('las transformaciones hacen lo que dicen', () => {
    const motif = [
      { midi: 60, start: 0, dur: 1 },
      { midi: 64, start: 1, dur: 2 },
      { midi: 62, start: 3, dur: 1 },
    ];
    expect(TRANSFORMS.inversion.apply(motif).map((note) => note.midi)).toEqual([60, 56, 58]);
    expect(TRANSFORMS.retrogradacion.apply(motif).map((note) => note.midi)).toEqual([62, 64, 60]);
    expect(TRANSFORMS.retrogradacion.apply(motif)[0]!.start).toBe(0);
    expect(TRANSFORMS.aumentacion.apply(motif)[1]).toEqual({ midi: 64, start: 2, dur: 4 });
    expect(TRANSFORMS.desplazamiento.apply(motif)[0]!.start).toBe(1);
  });

  it('el motivo se queda en la escala', () => {
    const scale = new Set(scaleNotes(0, 'dorian', 40, 90));
    for (let seed = 0; seed < 50; seed++) {
      for (const note of rollMotif(createRng(seed), 0, 'dorian')) expect(scale.has(note.midi)).toBe(true);
    }
  });

  it('B-A-C-H da las cuatro notas del motivo clásico', () => {
    const { notes } = textToNotes('Bach', 0, 'ionian');
    expect(notes.map((note) => midiToNote(note.midi))).toEqual(['A#4', 'A4', 'C4', 'B4']);
  });

  it('el texto ignora acentos y signos, y no se rompe con vacío', () => {
    expect(textToNotes('Ñandú!', 0, 'ionian').notes.length).toBe(5);
    expect(textToNotes('  ¿? ', 0, 'ionian').notes).toEqual([]);
  });

  const framesOf = (midis: Array<number | null>, each = 8) =>
    midis.flatMap((midi) =>
      Array.from({ length: each }, () => ({ hz: midi === null ? null : midiToHz(midi), level: 0.1 })),
    );

  it('transcribe lo cantado y descarta los pasajes muy cortos', () => {
    const notes = notesFromVoice(framesOf([60, 62, null, 64]), 50);
    expect(notes.map((note) => note.midi)).toEqual([60, 62, 64]);
    const glitch = [...framesOf([60]), { hz: midiToHz(72), level: 0.1 }, ...framesOf([60])];
    expect(notesFromVoice(glitch, 50).map((note) => note.midi)).toEqual([60, 60]);
  });

  it('una afinación apenas corrida sigue siendo la misma nota', () => {
    const frames = Array.from({ length: 10 }, () => ({
      hz: midiToHz(60) * Math.pow(2, 30 / 1200),
      level: 0.1,
    }));
    expect(notesFromVoice(frames, 50)[0]!.midi).toBe(60);
  });

  it('encuentra los ataques de una frase hablada y los lleva a una grilla', () => {
    const levels: number[] = [];
    for (const gap of [4, 4, 8, 4]) levels.push(0.3, 0.2, ...new Array<number>(gap - 2).fill(0.01));
    levels.push(0.3, 0.1);
    const onsets = speechOnsets(levels, 50);
    expect(onsets).toEqual([0, 200, 400, 800, 1000]);
    const { cells } = quantizeOnsets(onsets);
    expect(cells.map((on) => (on ? 'x' : '.')).join('')).toBe('xxx.xx');
  });

  it('el silencio no da ataques', () => {
    expect(speechOnsets(new Array<number>(40).fill(0.001), 50)).toEqual([]);
    expect(quantizeOnsets([]).cells).toEqual([]);
  });
});

describe('español', () => {
  it('separa en sílabas', () => {
    const expected: Record<string, string> = {
      camino: 'ca-mi-no',
      perro: 'pe-rro',
      calle: 'ca-lle',
      noche: 'no-che',
      atlas: 'a-tlas',
      carta: 'car-ta',
      instante: 'ins-tan-te',
      obstruir: 'obs-truir',
      poeta: 'po-e-ta',
      teatro: 'te-a-tro',
      cuando: 'cuan-do',
      tierra: 'tie-rra',
      día: 'dí-a',
      país: 'pa-ís',
      ciudad: 'ciu-dad',
      Uruguay: 'u-ru-guay',
      siesta: 'sies-ta',
      sol: 'sol',
    };
    for (const [word, syllables] of Object.entries(expected))
      expect(syllabify(word).join('-'), word).toBe(syllables);
  });

  it('reconoce el acento', () => {
    expect(stressType('camino')).toBe('llana');
    expect(stressType('amor')).toBe('aguda');
    expect(stressType('canción')).toBe('aguda');
    expect(stressType('lágrima')).toBe('esdrujula');
    expect(stressType('árbol')).toBe('llana');
    expect(stressType('sol')).toBe('aguda');
    expect(stressType('cantan')).toBe('llana');
  });

  it('cuenta bien versos conocidos', () => {
    const verses: Array<[string, number]> = [
      ['En un lugar de la Mancha', 8],
      ['Caminante, no hay camino', 8],
      ['Verde que te quiero verde', 8],
      ['A un panal de rica miel', 8],
      ['Cien años de soledad', 8],
      ['Se hace camino al andar', 8],
      ['Volverán las oscuras golondrinas', 11],
      ['Puedo escribir los versos más tristes esta noche', 14],
      ['Nel mezzo', 3],
    ];
    for (const [verse, syllables] of verses) expect(metricCount(verse).total, verse).toBe(syllables);
  });

  it('suma en final aguda y resta en esdrújula', () => {
    expect(metricCount('el camino de la canción')).toMatchObject({ ending: 'aguda', adjustment: 1 });
    expect(metricCount('se mojaba la lágrima')).toMatchObject({ ending: 'esdrujula', adjustment: -1 });
    expect(metricCount('')).toMatchObject({ total: 0, ending: null });
  });

  it('une con sinalefa, también a través de la hache muda', () => {
    expect(metricSyllables('la hoja').map((syllable) => syllable.text)).toEqual(['la‿ho', 'ja']);
    expect(metricSyllables('mi amor').length).toBe(2);
  });

  it('distingue rima consonante de asonante', () => {
    expect(consonantKey('camino')).toBe(consonantKey('destino'));
    expect(consonantKey('camino')).not.toBe(consonantKey('amigo'));
    expect(assonantKey('camino')).toBe(assonantKey('amigo'));
    expect(assonantKey('canción')).toBe(assonantKey('sol'));
    expect(consonantKey('amor')).toBe(consonantKey('dolor'));
  });

  it('detecta el esquema de una estrofa', () => {
    const stanza = ['Por el camino', 'va la canción', 'hacia el destino', 'del corazón'];
    expect(rhymeScheme(stanza, 'consonante').join('')).toBe('ABAB');
    expect(rhymeScheme(['uno solo', 'nada que ver'], 'consonante').join('')).toBe('––');
  });

  it('marca las sílabas acentuadas que caen en tiempo débil', () => {
    const cells = prosody('la casa', 2, 1);
    expect(cells.map((cell) => cell.text)).toEqual(['la', 'ca', 'sa']);
    expect(cells.some((cell) => cell.clash)).toBe(false);
    expect(
      prosody('la casa', 2, 0)
        .filter((cell) => cell.clash)
        .map((cell) => cell.text),
    ).toEqual(['ca']);
  });

  it('el cut-up no pierde palabras', () => {
    const text = 'una frase cualquiera para cortar\ny otra frase más';
    const pieces = cutUp(text, createRng(3).next);
    expect(pieces.join(' ').split(' ').sort()).toEqual(text.split(/\s+/).sort());
    expect(cutUp('', createRng(3).next)).toEqual([]);
  });
});

describe('afinaciones generales', () => {
  it('toda nota del catálogo se puede leer', () => {
    for (const tuning of TUNINGS)
      for (const note of tuning.notes) expect(noteToMidi(note)).toBeGreaterThan(0);
  });
});

describe('piano', () => {
  it('suena afinado en todo el registro', () => {
    for (const note of ['B1', 'E2', 'A2', 'D3', 'G3', 'E4', 'A4', 'E5', 'C6']) {
      const freq = midiToHz(noteToMidi(note));
      const signal = pianoTone(freq, 48000, 1);
      const start = Math.floor(0.1 * 48000);
      const result = detectPitch(signal.subarray(start, start + 4096), 48000);
      expect(result, note).not.toBeNull();
      expect(Math.abs(centsBetween(result!.freq, freq)), note).toBeLessThan(3);
    }
  });

  it('no satura y se apaga', () => {
    const signal = pianoTone(220, 48000, 3);
    expect(Math.max(...signal.subarray(0, 48000))).toBeLessThanOrEqual(1);
    const rms = (from: number) =>
      Math.sqrt(signal.subarray(from, from + 4800).reduce((sum, value) => sum + value * value, 0) / 4800);
    expect(rms(100000)).toBeLessThan(rms(1000));
  });

  it('se calcula rápido: una nota no puede frenar la reproducción', () => {
    const start = performance.now();
    for (let i = 0; i < 6; i++) pianoTone(110 * (i + 1), 48000, 4.5);
    expect(performance.now() - start).toBeLessThan(400);
  });
});

describe('drone', () => {
  it('apila las notas de cada acorde', () => {
    expect(droneVoices({ ...DEFAULT_DRONE, root: 38, stack: 'quinta' })).toEqual([26, 38, 45, 50]);
    expect(droneVoices({ ...DEFAULT_DRONE, root: 38, stack: 'menor' })).toEqual([26, 38, 41, 45]);
  });

  it('con una afinación suenan sus cuerdas', () => {
    expect(droneVoices({ ...DEFAULT_DRONE, notes: ['D2', 'A2'] })).toEqual([38, 45]);
    expect(describeDrone({ ...DEFAULT_DRONE, notes: ['D2', 'A2'] }).name).toBe('D A');
  });

  it('todas las pilas explican su regla', () => {
    for (const stack of Object.keys(STACKS) as StackId[]) {
      expect(describeDrone({ ...DEFAULT_DRONE, stack }).rule.length).toBeGreaterThan(0);
    }
  });

  it('sobrevive a ida y vuelta por la URL', () => {
    const configs: DroneConfig[] = [
      { root: 45, stack: 'tritono', timbre: 'crudo', brightness: 0.5, motion: 0.25, detune: 12 },
      { ...DEFAULT_DRONE, notes: ['D2', 'F#3', 'Bb3'] },
    ];
    for (const config of configs) {
      const back = droneFromParams(new URLSearchParams(droneToParams(config).toString()))!;
      expect(back.notes).toEqual(config.notes);
      expect(back.timbre).toBe(config.timbre);
      expect(back.brightness).toBeCloseTo(config.brightness);
      if (!config.notes) expect(back.root).toBe(config.root);
    }
  });

  it('rechaza una URL inválida', () => {
    for (const text of ['', 'r=45', 'r=999&s=quinta', 's=marte&r=40', 'n=Q9']) {
      expect(droneFromParams(new URLSearchParams(text)), text).toBeNull();
    }
    expect(droneFromParams(new URLSearchParams('r=40&s=quinta&b=99'))!.brightness).toBe(1);
  });

  it('se para sobre la tónica, en la octava más cercana', () => {
    // D2 (38) hacia Mi: E2 (40) está más cerca que E1 (28).
    expect(followKey({ ...DEFAULT_DRONE, root: 38 }, { tonic: 4 }).root).toBe(40);
    // C3 (48) hacia La: A2 (45) está más cerca que A3 (57).
    expect(followKey({ ...DEFAULT_DRONE, root: 48 }, { tonic: 9 }).root).toBe(45);
    const already = { ...DEFAULT_DRONE, root: 40 };
    expect(followKey(already, { tonic: 4 })).toBe(already);
  });

  it('sorteado, toma la tercera del modo', () => {
    expect(matchMode({ ...DEFAULT_DRONE, stack: 'mayor' }, 'dorian').stack).toBe('menor');
    expect(matchMode({ ...DEFAULT_DRONE, stack: 'menor' }, 'mixolydian').stack).toBe('mayor');
    expect(matchMode({ ...DEFAULT_DRONE, stack: 'menor9' }, 'lydian').stack).toBe('mayor');
    expect(matchMode({ ...DEFAULT_DRONE, stack: 'sus4' }, 'aeolian').stack).toBe('sus4');
    // Elegido a mano solo sigue la tónica: si pediste Menor, queda Menor.
    expect(followKey({ ...DEFAULT_DRONE, stack: 'menor' }, { tonic: 0 }).stack).toBe('menor');
  });

  it('elegido a mano o con una afinación, no se mueve', () => {
    const key = { tonic: 4 } as const;
    const free = { ...DEFAULT_DRONE, root: 43, free: true };
    const tuning = { ...DEFAULT_DRONE, notes: ['D2', 'A2'] };
    expect(followKey(free, key)).toBe(free);
    expect(followKey(tuning, key)).toBe(tuning);
    const back = droneFromParams(new URLSearchParams(droneToParams(free).toString()))!;
    expect(back.free).toBe(true);
  });

  it('en la consigna sigue a la tónica de la armonía', () => {
    for (let seed = 0; seed < 200; seed++) {
      let consigna = newConsigna(1, () => seed * 7919);
      consigna = applyOverride(consigna, 'armonia', { chords: ['Am', 'F', 'C', 'G'], tonic: 9, mode: 'aeolian' });
      const config = consignaDrone(consigna);
      if (!config.notes) expect(config.root % 12, String(seed)).toBe(9);
      expect(config.stack, String(seed)).not.toBe('mayor');
      expect(resolveRows(consigna)[rowIndex('drone')]!.value).toEqual(config);
    }
    // Cambiar la tónica mueve el drone; uno elegido a mano se queda donde está.
    let consigna = applyOverride(newConsigna(0, () => 3), 'armonia', { chords: ['C', 'G'], tonic: 7 });
    expect(consignaDrone(consigna).root % 12).toBe(7);
    consigna = applyOverride(consigna, 'drone', { ...DEFAULT_DRONE, root: 38, stack: 'menor' });
    expect(consignaDrone(consigna)).toMatchObject({ root: 43, stack: 'menor' });
    consigna = applyOverride(consigna, 'drone', { ...DEFAULT_DRONE, root: 41, free: true });
    expect(consignaDrone(consigna).root).toBe(41);
  });
});

describe('melodía de ejemplo', () => {
  it('es determinista y queda en la escala', () => {
    const notes = exampleMelody(createRng(5), 9, 'aeolian');
    expect(notes).toEqual(exampleMelody(createRng(5), 9, 'aeolian'));
    const scale = new Set(scaleNotes(9, 'aeolian', 40, 90));
    for (const note of notes) expect(scale.has(note.midi)).toBe(true);
  });
});

describe('acordes con color y con bajo', () => {
  it('lee cifras nuevas y bajos con barra', () => {
    expect(parseChord('F#m7b5')).toMatchObject({ root: 6, suffix: 'm7b5', intervals: [0, 3, 6, 10] });
    expect(parseChord('C/E')).toMatchObject({ root: 0, suffix: '', bass: 4 });
    expect(parseChord('Bbmaj9/D')).toMatchObject({ root: 10, suffix: 'maj9', bass: 2 });
    for (const bad of ['C/', 'C/H', 'C/E/G', 'C/Em']) expect(parseChord(bad), bad).toBeNull();
  });

  it('la digitación de un acorde con barra tiene ese bajo', () => {
    const voicing = findVoicing(STANDARD, parseChord('C/E')!)!;
    expect(Math.min(...voicing.midis) % 12).toBe(4);
    expect(closeVoicing(parseChord('C/E')!)[0]! % 12).toBe(4);
  });

  it('el mapa de tensiones trata a la novena como una segunda', () => {
    const map = tensionMap(parseChord('C9')!);
    expect(map.find((note) => note.pitchClass === 2)?.kind).toBe('reposo');
    expect(map.every((note) => !note.why.includes('undefined'))).toBe(true);
  });

  it('el grado lleva su color y su bajo', () => {
    expect(degreeOf('Bm7b5', 0)).toBe('viiø7');
    expect(degreeOf('C/E', 0)).toBe('I/E');
    expect(degreeOf('Am9', 0)).toBe('vi9');
  });
});

describe('sortear con pedido', () => {
  it('respeta el largo en cualquier riesgo, sin acordes ilegibles', () => {
    for (const risk of [0, 1, 2] as const) {
      for (const length of [2, 3, 4, 5, 8, 16]) {
        for (let seed = 0; seed < 150; seed++) {
          const { chords } = rollProgression(['ionian', 'aeolian'], risk, createRng(seed), false, { length });
          expect(chords).toHaveLength(length);
          chords.forEach((chord) => expect(parseChord(chord), chord).not.toBeNull());
        }
      }
    }
  });

  it('respeta la tónica pedida', () => {
    for (let seed = 0; seed < 50; seed++) {
      const roll = rollProgression(['ionian'], 0, createRng(seed), false, { tonic: 10 });
      expect(roll.tonic).toBe(10);
      expect(roll.chords[0]).toBe('Bb');
    }
  });
});

describe('variar una progresión', () => {
  const C_MAJOR = { tonic: 0, mode: 'ionian' } as const;
  const slot = (name: string, locked = false, beats = 4) => ({ name, locked, beats });
  const labels = (name: string, title: string) =>
    chordVariations(name, C_MAJOR)
      .find((group) => group.title.startsWith(title))
      ?.items.map((item) => item.label) ?? [];

  it('la paleta muestra los acordes de la tonalidad y los prestados', () => {
    expect(diatonicChords(C_MAJOR).map((chord) => chord.name)).toEqual([
      'C',
      'Dm',
      'Em',
      'F',
      'G',
      'Am',
      'Bdim',
    ]);
    expect(diatonicChords({ tonic: 10, mode: 'ionian' })[3]?.name).toBe('Eb');
    expect(borrowedChords(C_MAJOR).map((chord) => chord.name)).toEqual(
      expect.arrayContaining(['Cm', 'Eb', 'Fm', 'Ab', 'Bb']),
    );
  });

  it('nombra el rol de cada acorde, mirando adónde va', () => {
    const role = (chords: string[], index: number) => roleOf(chords, index, C_MAJOR);
    expect(role(['C', 'F', 'G7', 'C'], 0)).toBe('Tónica');
    expect(role(['C', 'F', 'G7', 'C'], 1)).toBe('Subdominante');
    expect(role(['C', 'F', 'G7', 'C'], 2)).toBe('Dominante');
    expect(role(['C', 'A7', 'Dm'], 1)).toBe('V7 de Dm');
    expect(role(['Dm', 'Db7', 'C'], 1)).toBe('subV de C');
    expect(role(['C', 'Ab', 'C'], 1)).toBe('Prestado');
    expect(role(['C', 'F#', 'C'], 1)).toBe('Fuera del tono');
    expect(role(['C7', 'F7', 'C7', 'G7'], 1)).toBe('Subdominante');
    expect(role(['C7', 'G', 'C'], 0)).toBe('Tónica');
  });

  it('cada acorde ofrece colores, reemplazos, bajos y preparaciones que se pueden leer', () => {
    expect(labels('C', 'Color')).toEqual(expect.arrayContaining(['C7', 'Cmaj7', 'Csus2', 'C6']));
    expect(labels('C', 'Reemplazos')).toEqual(expect.arrayContaining(['Am', 'Em', 'Cm']));
    expect(labels('G7', 'Reemplazos')).toContain('Db7');
    expect(labels('C', 'Bajo')).toEqual(['C/E', 'C/G']);
    expect(labels('C/E', 'Bajo')).toEqual(['C', 'C/G']);
    expect(labels('C', 'Preparar')).toEqual(
      expect.arrayContaining(['G7', 'Dm7 G7', 'Db7', 'Bdim7', 'Csus4']),
    );
    expect(labels('Am', 'Preparar')).toContain('Bm7b5 E7');

    const every = ['C', 'Am', 'F#m7', 'Bbmaj7', 'G7', 'Bdim', 'Eaug', 'Dsus4', 'C/E', 'Ebm9', 'Abadd9'];
    for (const name of every) {
      for (const group of chordVariations(name, C_MAJOR)) {
        for (const item of group.items) {
          item.chords.forEach((chord) => expect(parseChord(chord), `${name} → ${chord}`).not.toBeNull());
          expect(item.why, `${name} → ${item.label}`).not.toBe('');
          expect(item.chords).not.toContain(name);
        }
      }
    }
  });

  it('las notas en común que promete cada reemplazo son las que hay', () => {
    const shared = (a: string, b: string) => {
      const notes = new Set(chordClasses(parseChord(a)!));
      return chordClasses(parseChord(b)!).filter((note) => notes.has(note)).length;
    };
    for (const name of ['C', 'Am', 'Eb', 'F#m', 'Bb', 'Gm']) {
      const items = chordVariations(name, { tonic: 4, mode: 'lydian' }).find((group) =>
        group.title.startsWith('Reemplazos'),
      )!.items;
      const check = (word: string, count: number) => {
        const item = items.find((option) => option.why.startsWith(word));
        expect(item, `${name}: ${word}`).toBeDefined();
        expect(shared(name, item!.label), `${name} → ${item!.label}`).toBe(count);
      };
      check('Relativo', 2);
      check('Mediante cromática', 1);
      check(name.endsWith('m') ? 'Mediante mayor' : 'Mediante menor', 2);
    }
    expect(shared('C7', 'C#dim7')).toBe(3);
    expect(labels('Am', 'Reemplazos')).toContain('F#m');
  });

  it('un color nuevo conserva el bajo solo si sigue en el acorde', () => {
    expect(labels('C/E', 'Color')).toEqual(expect.arrayContaining(['Cmaj7/E', 'Csus4']));
  });

  it('transpone escribiendo según la tonalidad de destino', () => {
    const toD = { tonic: 1, mode: 'ionian' } as const;
    expect(['C', 'F', 'G7', 'Am', 'C/E'].map((name) => transposeChord(name, 1, toD))).toEqual([
      'Db',
      'Gb',
      'Ab7',
      'Bbm',
      'Db/F',
    ]);
    expect(transposeChord('Bb', 2, { tonic: 2, mode: 'ionian' })).toBe('C');
  });

  it('cambiar la tónica mueve los acordes y deja los grados', () => {
    const key = keyOfProgression(['Em', 'Am', 'F#7', 'Bm'], 4);
    expect(key).toEqual({ tonic: 4, mode: 'aeolian' });
    const moved = transposeTo(['Em', 'Am', 'F#7', 'Bm'], key, 9);
    expect(moved).toEqual(['Am', 'Dm', 'B7', 'Em']);
    expect(moved.map((name) => degreeOf(name, 9))).toEqual(
      ['Em', 'Am', 'F#7', 'Bm'].map((name) => degreeOf(name, 4)),
    );
    // Sin tónica guardada, manda el primer acorde; un modo guardado se respeta.
    expect(keyOfProgression(['C', 'Am', 'F', 'G'])).toEqual({ tonic: 0, mode: 'ionian' });
    expect(keyOfProgression(['Dm', 'G'], 2, 'dorian')).toEqual({ tonic: 2, mode: 'dorian' });
    expect(transposeTo(['C', 'F', 'G7'], { tonic: 0, mode: 'ionian' }, 10)).toEqual(['Bb', 'Eb', 'F7']);
  });

  it('suma la séptima de la tonalidad y vuelve a la tríada', () => {
    const sevenths = ['C', 'Dm', 'G', 'Bdim', 'Ab', 'F#'].map((name) => enrichChord(name, C_MAJOR));
    expect(sevenths).toEqual(['Cmaj7', 'Dm7', 'G7', 'Bm7b5', 'Abmaj7', 'F#7']);
    expect(enrichChord('Csus4', C_MAJOR)).toBe('Csus4');
    expect(['Cmaj7', 'Dm9', 'Bm7b5', 'G7sus4', 'Fsus2', 'C/E'].map(simplifyChord)).toEqual([
      'C',
      'Dm',
      'Bdim',
      'Gsus4',
      'Fsus2',
      'C',
    ]);
  });

  it('lleva a otro modo por grados, y deja lo prestado', () => {
    const toMinor = (name: string) => translateChord(name, C_MAJOR, 'aeolian');
    expect(['C', 'F', 'G7', 'Am'].map(toMinor)).toEqual(['Cm', 'Fm', 'Gm7', 'Ab']);
    expect(toMinor('Eb')).toBe('Eb');
    expect(translateChord('F', C_MAJOR, 'lydian')).toBe('F#dim');
  });

  it('el bajo por grados acorta el salto, y respeta lo trabado', () => {
    const jump = (bass: string[]) =>
      bass.slice(1).reduce((sum, note, i) => {
        const distance = Math.abs(noteToMidi(`${note}4`) - noteToMidi(`${bass[i]}4`));
        return sum + Math.min(distance, 12 - distance);
      }, 0);
    const { slots, line } = smoothBass([slot('C'), slot('G'), slot('Am'), slot('F')]);
    expect(jump(line)).toBeLessThan(jump(['C', 'G', 'A', 'F']));
    slots.forEach((item) => expect(parseChord(item.name)).not.toBeNull());
    expect(smoothBass([slot('C'), slot('G', true), slot('C')]).slots[1]?.name).toBe('G');
    expect(smoothBass([slot('C'), slot('C')]).line).toEqual(['C', 'C']);
  });

  it('prepara con dominantes sin pasarse del máximo', () => {
    const { slots, added } = prepareWithDominants(
      [slot('C'), slot('Am'), slot('Dm'), slot('G7'), slot('C')],
      C_MAJOR,
    );
    expect(slots.map((item) => item.name)).toEqual(['C', 'E7', 'Am', 'Dm', 'G7', 'C']);
    // Am ya cae por quinta a Dm, y Dm a G7: esos no necesitan nada.
    expect(added).toEqual(['E7']);
    const long = Array.from({ length: 15 }, (_, i) => slot(i % 2 ? 'Am' : 'F'));
    expect(prepareWithDominants(long, C_MAJOR).slots).toHaveLength(MAX_CHORDS);
  });

  it('las transformaciones conservan cuánto dura cada acorde', () => {
    const { slots } = smoothBass([slot('C', false, 2), slot('G', false, 6)]);
    expect(slots.map((item) => item.beats)).toEqual([2, 6]);
    const prepared = prepareWithDominants([slot('C', false, 2), slot('Am', false, 3)], C_MAJOR).slots;
    expect(prepared.map((item) => item.beats)).toEqual([2, 3, 3]);
  });

  it('valida duraciones y arma el link solo si hacen falta', () => {
    expect(isChordBeats([4, 2], 2)).toBe(true);
    for (const bad of [[4], [4, 0], [4, 17], [4, 1.5], 'x', null]) expect(isChordBeats(bad, 2)).toBe(false);
    expect(customBeats([4, 4])).toBeUndefined();
    expect(harmonyHref(['C', 'Am'], [4, 4])).toBe('/armonia?c=C%2CAm');
    expect(harmonyHref(['C', 'Am'], [2, 6])).toBe('/armonia?c=C%2CAm&d=2,6');
  });

  it('las listas mueven, sacan y rotan sin perder elementos', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b'], 1, 5)).toEqual(['a', 'b']);
    expect(removeAt(['a', 'b', 'c'], 1)).toEqual(['a', 'c']);
    expect(insertAt(['a', 'c'], 1, ['b'])).toEqual(['a', 'b', 'c']);
    expect(rotate(['a', 'b', 'c'])).toEqual(['b', 'c', 'a']);
  });

  it('todas las fórmulas se escriben en cualquier tónica', () => {
    for (const formula of FORMULAS) {
      expect(formula.degrees.length).toBeLessThanOrEqual(MAX_CHORDS);
      for (let tonic = 0; tonic < 12; tonic++) {
        chordsOfFormula(formula, tonic).forEach((chord) => expect(parseChord(chord), chord).not.toBeNull());
      }
    }
    expect(new Set(FORMULAS.map((formula) => formula.id)).size).toBe(FORMULAS.length);
    for (const formula of FORMULAS) {
      if (formula.beats) expect(formula.beats, formula.id).toHaveLength(formula.degrees.length);
    }
    for (const { value } of FAMILIES) {
      expect(FORMULAS.some((formula) => formula.family === value), value).toBe(true);
    }
    const andaluza = FORMULAS.find((formula) => formula.id === 'andaluza')!;
    expect(chordsOfFormula(andaluza, 9)).toEqual(['Am', 'G', 'F', 'E']);
  });
});
