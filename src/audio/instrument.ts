// Guitarra sintetizada: una voz por cuerda, con búferes en caché por nota.
import { midiToHz } from '~/core/notes';
import { pluck } from '~/core/pluck';
import { getAudio } from './engine';

const STRINGS = 6;
const SECONDS = 4.5;
/** Tiempo que el afinador ignora el micrófono después de una nota de la app. */
const SPEAKER_BLEED_SECONDS = 1.3;

const buffers = new Map<string, AudioBuffer>();
const voices: Array<{ source: AudioBufferSourceNode; gain: GainNode } | null> = new Array(STRINGS).fill(null);
const sounding = new Set<AudioBufferSourceNode>();
let busyUntil = 0;

function bufferFor(ctx: AudioContext, midi: number, a4: number): AudioBuffer {
  const key = `${midi}:${a4}:${ctx.sampleRate}`;
  let buffer = buffers.get(key);
  if (!buffer) {
    const samples = pluck(midiToHz(midi, a4), ctx.sampleRate, SECONDS);
    buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
    buffers.set(key, buffer);
  }
  return buffer;
}

/** Sintetiza estas notas de antemano: hacerlo mientras suena un tema puede atrasar el reloj. */
export function prepareInstrument(midis: Iterable<number>, a4: number): void {
  const { ctx } = getAudio();
  for (const midi of midis) bufferFor(ctx, midi, a4);
}

export interface PluckOptions {
  a4: number;
  when?: number;
  velocity?: number;
}

/** Toca una cuerda y devuelve el momento exacto en que va a sonar. */
export function pluckString(
  stringIndex: number,
  midi: number,
  { a4, when, velocity = 1 }: PluckOptions,
): number {
  const { ctx, bus } = getAudio();
  const start = Math.max(when ?? ctx.currentTime, ctx.currentTime);

  const previous = voices[stringIndex];
  if (previous) {
    previous.gain.gain.setTargetAtTime(0, start, 0.012);
    try {
      previous.source.stop(start + 0.1);
    } catch {
      // Ya estaba detenida.
    }
  }

  const source = ctx.createBufferSource();
  source.buffer = bufferFor(ctx, midi, a4);
  const gain = ctx.createGain();
  gain.gain.value = 0.62 * velocity;
  const panner = ctx.createStereoPanner();
  panner.pan.value = (stringIndex - 2.5) * 0.09;
  source.connect(gain).connect(panner).connect(bus);
  source.start(start);
  sounding.add(source);
  source.onended = () => sounding.delete(source);
  voices[stringIndex] = { source, gain };
  busyUntil = Math.max(busyUntil, start + SPEAKER_BLEED_SECONDS);
  return start;
}

/** Mientras la app suena fuerte, el micrófono la escucharía a ella en vez de a la guitarra. */
export function isInstrumentSounding(): boolean {
  return getAudio().ctx.currentTime < busyUntil;
}

/** Corta todo lo que esté sonando o programado. */
export function stopInstrument(): void {
  sounding.forEach((source) => {
    try {
      source.stop();
    } catch {
      // Ya estaba detenida.
    }
  });
  sounding.clear();
  voices.fill(null);
  busyUntil = 0;
}

/** Un acorde rasgueado: una nota por cuerda, apenas separadas. */
export function strum(midis: number[], a4: number, when?: number, spread = 0.025): void {
  const start = when ?? getAudio().ctx.currentTime;
  midis.forEach((midi, index) =>
    pluckString(index % STRINGS, midi, { a4, when: start + index * spread, velocity: 0.85 }),
  );
}

export interface TimedNote {
  midi: number;
  /** En corcheas. */
  start: number;
}

/** Programa una melodía. Devuelve cuántos segundos dura. */
export function playMelody(notes: TimedNote[], bpm: number, a4: number): number {
  const { ctx } = getAudio();
  const eighth = 60 / bpm / 2;
  const origin = ctx.currentTime + 0.05;
  notes.forEach((note, index) =>
    pluckString(index % STRINGS, note.midi, { a4, when: origin + note.start * eighth }),
  );
  const last = notes[notes.length - 1];
  return last ? last.start * eighth + 1 : 0;
}
