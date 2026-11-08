// El archivo MIDI: se lee de vuelta con un lector mínimo, para comprobar lo que un programa vería.
import { describe, expect, it } from 'vitest';
import { DEFAULT_DRONE } from '~/core/drone';
import { songToMidi } from '~/core/midi';
import { drumConfig, rhythmFromParams } from '~/core/rhythm';
import { buildSong, type SongInput } from '~/core/song';

interface ParsedTrack {
  name: string;
  notes: Array<{ tick: number; off: number; midi: number; channel: number; velocity: number }>;
  tempos: number[];
  signatures: Array<{ tick: number; numerator: number; denominator: number }>;
}

function parse(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer);
  const text = (at: number, length: number) => String.fromCharCode(...bytes.slice(at, at + length));
  expect(text(0, 4)).toBe('MThd');
  const format = view.getUint16(8);
  const count = view.getUint16(10);
  const division = view.getUint16(12);
  let cursor = 14;
  const tracks: ParsedTrack[] = [];
  for (let index = 0; index < count; index++) {
    expect(text(cursor, 4)).toBe('MTrk');
    const end = cursor + 8 + view.getUint32(cursor + 4);
    cursor += 8;
    const track: ParsedTrack = { name: '', notes: [], tempos: [], signatures: [] };
    const open = new Map<number, ParsedTrack['notes'][number]>();
    let tick = 0;
    let ended = false;
    while (cursor < end) {
      let delta = 0;
      let byte: number;
      do {
        byte = bytes[cursor++]!;
        delta = (delta << 7) | (byte & 0x7f);
      } while (byte & 0x80);
      tick += delta;
      const status = bytes[cursor++]!;
      if (status === 0xff) {
        const type = bytes[cursor++]!;
        const length = bytes[cursor++]!;
        if (type === 0x03) track.name = text(cursor, length);
        if (type === 0x51) {
          track.tempos.push((bytes[cursor]! << 16) | (bytes[cursor + 1]! << 8) | bytes[cursor + 2]!);
        }
        if (type === 0x58) {
          track.signatures.push({ tick, numerator: bytes[cursor]!, denominator: 2 ** bytes[cursor + 1]! });
        }
        if (type === 0x2f) ended = true;
        cursor += length;
      } else if ((status & 0xf0) === 0x90) {
        const note = {
          tick,
          off: -1,
          midi: bytes[cursor]!,
          channel: status & 0x0f,
          velocity: bytes[cursor + 1]!,
        };
        open.set(note.midi, note);
        track.notes.push(note);
        cursor += 2;
      } else if ((status & 0xf0) === 0x80) {
        const note = open.get(bytes[cursor]!);
        if (note) note.off = tick;
        cursor += 2;
      } else if ((status & 0xf0) === 0xc0) {
        cursor += 1;
      } else {
        throw new Error(`Estado inesperado: ${status}`);
      }
    }
    expect(ended).toBe(true);
    tracks.push(track);
  }
  return { format, division, tracks };
}

const FOUR_FOUR = drumConfig(120, { bombo: 'x...x...x...x...', hihat: 'x.x.x.x.x.x.x.x.' });
const base: SongInput = {
  blocks: ['A', 'A'],
  sections: {},
  fallback: { chords: ['C', 'G'], rhythm: FOUR_FOUR },
  tuning: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
  melody: [{ midi: 72, start: 0, dur: 2 }],
  melodyChosen: true,
  drone: DEFAULT_DRONE,
  tempo: 100,
  mix: {},
  a4: 440,
};

const track = (bytes: Uint8Array, name: string) => parse(bytes).tracks.find((item) => item.name === name);

describe('songToMidi', () => {
  it('escribe un archivo de varias pistas, con su tempo y compás', () => {
    const { format, division, tracks } = parse(songToMidi(buildSong(base)));
    expect(format).toBe(1);
    expect(division).toBe(480);
    expect(tracks.map((item) => item.name)).toEqual(['Scordatura', 'Acordes', 'Melodia', 'Drone', 'Bateria']);
    expect(tracks[0]!.tempos).toEqual([600_000]);
    expect(tracks[0]!.signatures).toEqual([{ tick: 0, numerator: 4, denominator: 4 }]);
  });

  it('ubica los bloques uno detrás del otro', () => {
    const song = buildSong(base);
    const chords = track(songToMidi(song), 'Acordes')!;
    const blockTicks = song.blocks[0]!.beats * 480;
    const starts = chords.notes.map((note) => note.tick);
    expect(starts).toContain(0);
    expect(starts).toContain(blockTicks);
    expect(Math.max(...chords.notes.map((note) => note.off))).toBe(blockTicks * 2);
  });

  it('cada nota se suelta después de empezar', () => {
    for (const item of parse(songToMidi(buildSong(base))).tracks) {
      for (const note of item.notes) expect(note.off).toBeGreaterThan(note.tick);
    }
  });

  it('la batería va por el canal 10 con las notas de General MIDI', () => {
    const drums = track(songToMidi(buildSong(base)), 'Bateria')!;
    expect(new Set(drums.notes.map((note) => note.channel))).toEqual(new Set([9]));
    expect(new Set(drums.notes.map((note) => note.midi))).toEqual(new Set([36, 42]));
  });

  it('lo silenciado en el Estudio no se exporta', () => {
    const muted = buildSong({ ...base, mix: { bateria: { mute: true }, drone: { mute: true } } });
    const names = parse(songToMidi(muted)).tracks.map((item) => item.name);
    expect(names).toEqual(['Scordatura', 'Acordes', 'Melodia']);
    // La melodía de ejemplo arranca silenciada: no es parte del tema.
    const example = buildSong({ ...base, melodyChosen: false });
    expect(parse(songToMidi(example)).tracks.map((item) => item.name)).not.toContain('Melodia');
  });

  it('el drone respeta las secciones donde está apagado', () => {
    const song = buildSong({
      ...base,
      blocks: ['A', 'B'],
      sections: { B: { droneOff: true } },
    });
    const drone = track(songToMidi(song), 'Drone')!;
    expect(Math.max(...drone.notes.map((note) => note.off))).toBe(song.blocks[0]!.beats * 480);
  });

  it('avisa los cambios de compás, también en compases irregulares', () => {
    const seven = drumConfig(120, { bombo: 'x...x...x.....' });
    expect(seven.steps).toBe(14);
    const song = buildSong({
      ...base,
      blocks: ['A', 'B'],
      sections: { B: { rhythm: seven, bars: 2 } },
    });
    const { signatures } = parse(songToMidi(song)).tracks[0]!;
    expect(signatures).toEqual([
      { tick: 0, numerator: 4, denominator: 4 },
      { tick: song.blocks[0]!.beats * 480, numerator: 7, denominator: 8 },
    ]);
  });

  it('con todo silenciado sigue siendo un archivo válido', () => {
    const song = buildSong({
      ...base,
      mix: {
        acordes: { mute: true },
        bateria: { mute: true },
        melodia: { mute: true },
        drone: { mute: true },
      },
    });
    expect(parse(songToMidi(song)).tracks.map((item) => item.name)).toEqual(['Scordatura']);
  });

  it('funciona con los ritmos que no son batería', () => {
    const rhythm = rhythmFromParams(new URLSearchParams('m=euclid&bpm=90&k=3&n=8&r=0'));
    expect(rhythm).not.toBeNull();
    const song = buildSong({ ...base, fallback: { chords: ['Am'], rhythm: rhythm! } });
    expect(track(songToMidi(song), 'Bateria')!.notes.length).toBeGreaterThan(0);
  });
});
