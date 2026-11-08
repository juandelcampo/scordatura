// El tema como archivo MIDI, para seguirlo en cualquier otro programa. Sale lo mismo que suena:
// una pista silenciada en el Estudio no se exporta. La referencia del La no viaja: MIDI no la guarda.
import { droneVoices } from './drone';
import type { DrumId } from './rhythm';
import { eventsBetween, melodyInBlock, type Song, type SongBar } from './song';

const TICKS_PER_BEAT = 480;
const DRUM_CHANNEL = 9;
const DRUM_HIT_BEATS = 0.25;

/** Las notas de batería del estándar General MIDI. */
const GM_DRUMS: Record<DrumId, number> = {
  bombo: 36,
  caja: 38,
  hihat: 42,
  palma: 39,
  tom: 45,
  cencerro: 56,
};

const VELOCITY = { acordes: 72, melodia: 96, drone: 56 };
/** Programas General MIDI: guitarra de acero y pad cálido. */
const PROGRAM = { guitarra: 25, pad: 89 };

interface TrackEvent {
  tick: number;
  /** A un mismo momento, primero se sueltan las notas y después se tocan las nuevas. */
  order: number;
  bytes: number[];
}

interface Span {
  beat: number;
  beats: number;
  midi: number;
  velocity: number;
}

const ticks = (beats: number) => Math.round(beats * TICKS_PER_BEAT);

/** Los tiempos MIDI se escriben con longitud variable: 7 bits por byte. */
function variableLength(value: number): number[] {
  const bytes = [value & 0x7f];
  let rest = value >> 7;
  while (rest > 0) {
    bytes.unshift((rest & 0x7f) | 0x80);
    rest >>= 7;
  }
  return bytes;
}

const uint32 = (value: number) => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
];

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

function chunk(type: string, data: number[]): number[] {
  return [...ascii(type), ...uint32(data.length), ...data];
}

function trackChunk(name: string, events: TrackEvent[]): number[] {
  const nameBytes = ascii(name);
  const data = [0, 0xff, 0x03, nameBytes.length, ...nameBytes];
  const sorted = [...events].sort((a, b) => a.tick - b.tick || a.order - b.order);
  let previous = 0;
  for (const event of sorted) {
    data.push(...variableLength(event.tick - previous), ...event.bytes);
    previous = event.tick;
  }
  data.push(0, 0xff, 0x2f, 0);
  return chunk('MTrk', data);
}

function noteEvents(spans: Span[], channel: number, program?: number): TrackEvent[] {
  const events: TrackEvent[] =
    program === undefined ? [] : [{ tick: 0, order: 0, bytes: [0xc0 | channel, program] }];
  for (const { beat, beats, midi, velocity } of spans) {
    if (!Number.isInteger(midi) || midi < 0 || midi > 127) continue;
    const start = ticks(beat);
    // Una nota sin duración se perdería en la mayoría de los programas.
    const end = Math.max(start + 1, ticks(beat + beats));
    events.push({ tick: start, order: 2, bytes: [0x90 | channel, midi, velocity] });
    events.push({ tick: end, order: 1, bytes: [0x80 | channel, midi, 0] });
  }
  return events;
}

/** El compás en la notación de siempre: 16 pasos son 4/4, 14 son 7/8. */
function timeSignature(bar: SongBar): [number, number] {
  const { steps } = bar.drums;
  if (steps % 4 === 0) return [steps / 4, 2];
  if (steps % 2 === 0) return [steps / 2, 3];
  return [steps, 4];
}

function conductor(song: Song): TrackEvent[] {
  const quarter = Math.round(60_000_000 / song.bpm);
  const events: TrackEvent[] = [
    {
      tick: 0,
      order: 0,
      bytes: [0xff, 0x51, 0x03, (quarter >> 16) & 0xff, (quarter >> 8) & 0xff, quarter & 0xff],
    },
  ];
  let origin = 0;
  let current = '';
  for (const block of song.blocks) {
    for (const bar of block.bars) {
      const [numerator, power] = timeSignature(bar);
      const key = `${numerator}/${power}`;
      if (key !== current) {
        current = key;
        events.push({
          tick: ticks(origin + bar.start),
          order: 0,
          bytes: [0xff, 0x58, 0x04, numerator, power, 24, 8],
        });
      }
    }
    origin += block.beats;
  }
  return events;
}

export function songToMidi(song: Song): Uint8Array<ArrayBuffer> {
  const chords: Span[] = [];
  const melody: Span[] = [];
  const drone: Span[] = [];
  const drums: Span[] = [];
  const voices = droneVoices(song.drone);

  let origin = 0;
  song.blocks.forEach((block, index) => {
    if (song.audible.acordes) {
      for (const change of block.changes) {
        for (const midi of change.midis) {
          chords.push({ beat: origin + change.beat, beats: change.beats, midi, velocity: VELOCITY.acordes });
        }
      }
    }
    if (song.audible.melodia) {
      for (const note of melodyInBlock(song.melody, block)) {
        melody.push({ ...note, beat: origin + note.beat, velocity: VELOCITY.melodia });
      }
    }
    if (song.audible.drone && block.drone && block.beats > 0) {
      for (const midi of voices) {
        drone.push({ beat: origin, beats: block.beats, midi, velocity: VELOCITY.drone });
      }
    }
    for (const event of eventsBetween(song, index, 0, block.beats)) {
      if (event.kind !== 'drum') continue;
      drums.push({
        beat: origin + event.beat,
        beats: DRUM_HIT_BEATS,
        midi: GM_DRUMS[event.voice],
        velocity: Math.min(127, Math.max(1, Math.round(event.gain * 127))),
      });
    }
    origin += block.beats;
  });

  const lanes: Array<[string, TrackEvent[]]> = [];
  if (chords.length) lanes.push(['Acordes', noteEvents(chords, 0, PROGRAM.guitarra)]);
  if (melody.length) lanes.push(['Melodia', noteEvents(melody, 1, PROGRAM.guitarra)]);
  if (drone.length) lanes.push(['Drone', noteEvents(drone, 2, PROGRAM.pad)]);
  if (drums.length) lanes.push(['Bateria', noteEvents(drums, DRUM_CHANNEL)]);

  const header = chunk('MThd', [0, 1, 0, lanes.length + 1, TICKS_PER_BEAT >> 8, TICKS_PER_BEAT & 0xff]);
  const tracks = [['Scordatura', conductor(song)] as [string, TrackEvent[]], ...lanes].flatMap(
    ([name, events]) => trackChunk(name, events),
  );
  return new Uint8Array([...header, ...tracks]);
}

export interface MidiSpan {
  beat: number;
  beats: number;
  midi: number;
  velocity: number;
}

export interface MidiTrack {
  name: string;
  channel: number;
  program?: number;
  spans: MidiSpan[];
}

/** Un MIDI armado desde afuera: tempo, cambios de compás (en negras) y pistas. */
export function writeMidi(
  bpm: number,
  signatures: ReadonlyArray<{ beat: number; numerator: number; power: number }>,
  tracks: readonly MidiTrack[],
  markers: ReadonlyArray<{ beat: number; text: string }> = [],
): Uint8Array<ArrayBuffer> {
  const quarter = Math.round(60_000_000 / bpm);
  const tempo: TrackEvent[] = [
    {
      tick: 0,
      order: 0,
      bytes: [0xff, 0x51, 0x03, (quarter >> 16) & 0xff, (quarter >> 8) & 0xff, quarter & 0xff],
    },
    ...signatures.map(({ beat, numerator, power }) => ({
      tick: ticks(beat),
      order: 0,
      bytes: [0xff, 0x58, 0x04, numerator, power, 24, 8],
    })),
    ...markers.map(({ beat, text }) => {
      const bytes = [...new TextEncoder().encode(text)].slice(0, 127);
      return { tick: ticks(beat), order: 0, bytes: [0xff, 0x06, bytes.length, ...bytes] };
    }),
  ];
  const used = tracks.filter((t) => t.spans.length);
  const header = chunk('MThd', [0, 1, 0, used.length + 1, TICKS_PER_BEAT >> 8, TICKS_PER_BEAT & 0xff]);
  const body = [
    trackChunk('Scordatura', tempo),
    ...used.map((t) => trackChunk(t.name, noteEvents(t.spans, t.channel, t.program))),
  ];
  return new Uint8Array([...header, ...body.flat()]);
}

export { GM_DRUMS, DRUM_CHANNEL, PROGRAM as GM_PROGRAM };
