// El tema: bloques ubicados en el tiempo, qué suena en cada momento y cómo se mezcla.
import { describe, expect, it } from 'vitest';
import { DEFAULT_DRONE } from '~/core/drone';
import { cycleFor, drumConfig, rhythmToDrums, type RhythmConfig } from '~/core/rhythm';
import {
  buildSong,
  chordChanges,
  eventsBetween,
  locate,
  melodyInBlock,
  songPitches,
  type SongInput,
} from '~/core/song';

const ROCK = drumConfig(100, { bombo: 'x...............', caja: '....x.......x...' });

const input = (patch: Partial<SongInput> = {}): SongInput => ({
  blocks: ['A', 'B'],
  sections: {},
  fallback: { chords: ['Am', 'F'], rhythm: ROCK },
  tuning: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
  melody: [{ midi: 69, start: 0, dur: 2 }],
  melodyChosen: true,
  drone: DEFAULT_DRONE,
  tempo: null,
  mix: {},
  a4: 440,
  ...patch,
});

describe('rhythmToDrums', () => {
  it('deja igual lo que ya es batería', () => {
    expect(rhythmToDrums(ROCK)).toBe(ROCK);
  });

  it('un compás de 7/8 dura lo mismo y reparte los acentos', () => {
    const meter: RhythmConfig = { mode: 'meter', groups: [2, 2, 3], denom: 8, bpm: 120 };
    const drums = rhythmToDrums(meter);
    expect(drums.steps / 4).toBe(cycleFor(meter, 0).beats);
    expect(drums.tracks[0]![0]).toBe(true); // bombo en el 1
    expect(drums.tracks[1]![4]).toBe(true); // caja en el segundo grupo
    expect(drums.tracks[2]![2]).toBe(true); // hi-hat en lo no acentuado
    expect(drums.bpm).toBe(120);
  });

  it('una polirritmia larga entra en 32 pasos', () => {
    const drums = rhythmToDrums({ mode: 'poly', a: 16, b: 15, bpm: 90 });
    expect(drums.steps).toBeLessThanOrEqual(32);
    expect(drums.tracks.every((track) => track.length === drums.steps)).toBe(true);
  });

  it('un compás mutante cambia según la vuelta', () => {
    const config: RhythmConfig = {
      mode: 'mutante',
      meters: [
        { groups: [1, 1, 1, 1], denom: 4 },
        { groups: [2, 3], denom: 8 },
      ],
      barsEach: 1,
      bpm: 100,
    };
    expect(rhythmToDrums(config, 0).steps).toBe(16);
    expect(rhythmToDrums(config, 1).steps).toBe(10);
  });
});

describe('buildSong', () => {
  it('cada bloque dura sus compases, y la forma respeta el orden', () => {
    const song = buildSong(input({ sections: { B: { bars: 2 } } }));
    expect(song.blocks.map((block) => block.letter)).toEqual(['A', 'B']);
    expect(song.blocks[0]!.beats).toBe(16);
    expect(song.blocks[1]!.beats).toBe(8);
  });

  it('una sección usa lo suyo y, si no tiene, lo de la consigna', () => {
    const song = buildSong(input({ sections: { B: { chords: ['C'] } } }));
    expect(song.blocks[0]!.changes[0]!.name).toBe('Am');
    expect(song.blocks[1]!.changes[0]!.name).toBe('C');
  });

  it('el tempo elegido manda sobre el del ritmo', () => {
    expect(buildSong(input()).bpm).toBe(100);
    expect(buildSong(input({ tempo: 77 })).bpm).toBe(77);
    expect(buildSong(input({ tempo: 9000 })).bpm).toBe(300);
  });

  it('un compás mutante suma la duración real de cada vuelta', () => {
    const rhythm: RhythmConfig = {
      mode: 'mutante',
      meters: [
        { groups: [1, 1, 1, 1], denom: 4 },
        { groups: [2, 3], denom: 8 },
      ],
      barsEach: 1,
      bpm: 100,
    };
    const song = buildSong(input({ blocks: ['A'], sections: { A: { rhythm, bars: 2 } } }));
    expect(song.blocks[0]!.beats).toBe(6.5);
    expect(locate(song.blocks[0]!, 4.5).bar).toBe(1);
  });
});

describe('chordChanges', () => {
  const placed = (chords: string[], blockBeats: number, chordBeats: number[]) =>
    chordChanges(chords, blockBeats, 4, input().tuning, chordBeats).map(({ name, beat, beats }) => [
      name,
      beat,
      beats,
    ]);

  it('respeta la duración de cada acorde y repite la vuelta hasta llenar el bloque', () => {
    expect(placed(['Am', 'F'], 16, [6, 2])).toEqual([
      ['Am', 0, 6],
      ['F', 6, 2],
      ['Am', 8, 6],
      ['F', 14, 2],
    ]);
  });

  it('corta el último acorde donde termina el bloque', () => {
    expect(placed(['Am', 'F'], 16, [4, 6])).toEqual([
      ['Am', 0, 4],
      ['F', 4, 6],
      ['Am', 10, 4],
      ['F', 14, 2],
    ]);
  });

  it('si la vuelta no entra, la comprime en proporción y suenan todos', () => {
    expect(placed(['Am', 'F', 'C'], 8, [8, 4, 4])).toEqual([
      ['Am', 0, 4],
      ['F', 4, 2],
      ['C', 6, 2],
    ]);
  });

  it('ignora duraciones que no coinciden con los acordes', () => {
    const changes = chordChanges(['Am', 'F'], 16, 4, input().tuning, [2]);
    expect(changes.map((change) => change.beats)).toEqual([4, 4, 4, 4]);
  });

  it('el tema usa las duraciones de la sección y, sin sección, las de la consigna', () => {
    const own = buildSong(input({ sections: { A: { chords: ['C', 'G'], chordBeats: [6, 2] } } }));
    expect(own.blocks[0]!.changes[1]!.beat).toBe(6);
    const fallback = buildSong(
      input({ sections: {}, fallback: { chords: ['C', 'G'], chordBeats: [2, 6], rhythm: ROCK } }),
    );
    expect(fallback.blocks[0]!.changes[1]!.beat).toBe(2);
  });

  it('repite la progresión hasta llenar los compases', () => {
    const changes = chordChanges(['Am', 'F', 'C'], 16, 4, input().tuning);
    expect(changes.map((change) => change.name)).toEqual(['Am', 'F', 'C', 'Am']);
    expect(changes.map((change) => change.beat)).toEqual([0, 4, 8, 12]);
  });

  it('si hay más acordes que compases, suenan todos', () => {
    const changes = chordChanges(['Am', 'F', 'C', 'G'], 8, 2, input().tuning);
    expect(changes).toHaveLength(4);
    expect(changes[1]!.beat).toBe(2);
  });

  it('cada acorde trae notas para sonar', () => {
    for (const change of chordChanges(['Am', 'Ebmaj7'], 8, 2, input().tuning)) {
      expect(change.midis.length).toBeGreaterThan(2);
    }
  });
});

describe('eventsBetween', () => {
  const song = buildSong(input());

  it('dos tramos seguidos no repiten ni pierden nada', () => {
    const whole = eventsBetween(song, 0, 0, 16);
    const parts = [...eventsBetween(song, 0, 0, 5.3), ...eventsBetween(song, 0, 5.3, 16)];
    expect(parts).toHaveLength(whole.length);
    expect(parts.map((event) => event.beat)).toEqual(whole.map((event) => event.beat));
  });

  it('están todas las pistas, ordenadas en el tiempo', () => {
    const events = eventsBetween(song, 0, 0, 4);
    expect(events.map((event) => event.kind)).toEqual(expect.arrayContaining(['drum', 'chord', 'note']));
    const beats = events.map((event) => event.beat);
    expect(beats).toEqual([...beats].sort((a, b) => a - b));
  });

  it('una pista silenciada no suena', () => {
    const muted = buildSong(input({ mix: { bateria: { mute: true } } }));
    expect(eventsBetween(muted, 0, 0, 16).some((event) => event.kind === 'drum')).toBe(false);
    expect(eventsBetween(muted, 0, 0, 16).some((event) => event.kind === 'chord')).toBe(true);
  });

  it('el solo manda sobre todo lo demás', () => {
    const soloed = buildSong(input({ mix: { acordes: { solo: true } } }));
    expect(new Set(eventsBetween(soloed, 0, 0, 16).map((event) => event.kind))).toEqual(new Set(['chord']));
    expect(soloed.audible.drone).toBe(false);
  });

  it('un bloque que no existe no suena', () => {
    expect(eventsBetween(song, 99, 0, 16)).toEqual([]);
  });
});

describe('melodía', () => {
  it('la de ejemplo arranca silenciada, y la elegida suena', () => {
    expect(buildSong(input({ melodyChosen: false })).audible.melodia).toBe(false);
    expect(buildSong(input({ melodyChosen: true })).audible.melodia).toBe(true);
    expect(buildSong(input({ melodyChosen: false, mix: { melodia: { mute: false } } })).audible.melodia).toBe(
      true,
    );
  });

  it('la frase se repite cada compás hasta llenar el bloque, sin pasarse', () => {
    const block = buildSong(input()).blocks[0]!;
    const notes = melodyInBlock([{ midi: 60, start: 0, dur: 2 }], block);
    expect(notes.map((note) => note.beat)).toEqual([0, 4, 8, 12]);
    const long = melodyInBlock([{ midi: 60, start: 30, dur: 8 }], block);
    expect(long.every((note) => note.beat + note.beats <= block.beats)).toBe(true);
  });
});

describe('locate y songPitches', () => {
  it('ubica el compás y el paso', () => {
    const block = buildSong(input()).blocks[0]!;
    expect(locate(block, 0)).toEqual({ bar: 0, step: 0 });
    expect(locate(block, 5.25)).toEqual({ bar: 1, step: 5 });
    expect(locate(block, 15.99).bar).toBe(3);
  });

  it('junta todas las alturas sin repetir', () => {
    const pitches = songPitches(buildSong(input()));
    expect(pitches.has(69)).toBe(true);
    expect(pitches.size).toBeGreaterThan(3);
  });
});
