// Batería sintetizada: cada golpe se arma con osciladores y ruido.
import type { DrumId } from '~/core/rhythm';

let noise: AudioBuffer | null = null;

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  if (!noise || noise.sampleRate !== ctx.sampleRate) {
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
    const data = noise.getChannelData(0);
    let state = 22222;
    for (let i = 0; i < data.length; i++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      data[i] = state / 2147483648 - 1;
    }
  }
  return noise;
}

function envelope(
  ctx: BaseAudioContext,
  out: AudioNode,
  time: number,
  level: number,
  decay: number,
): GainNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(Math.max(0.0001, level), time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
  gain.connect(out);
  return gain;
}

function tone(
  ctx: BaseAudioContext,
  out: AudioNode,
  time: number,
  options: { from: number; to?: number; level: number; decay: number; type?: OscillatorType; drop?: number },
) {
  const oscillator = ctx.createOscillator();
  oscillator.type = options.type ?? 'sine';
  oscillator.frequency.setValueAtTime(options.from, time);
  if (options.to)
    oscillator.frequency.exponentialRampToValueAtTime(options.to, time + (options.drop ?? options.decay));
  oscillator.connect(envelope(ctx, out, time, options.level, options.decay));
  oscillator.start(time);
  oscillator.stop(time + options.decay + 0.02);
}

function hiss(
  ctx: BaseAudioContext,
  out: AudioNode,
  time: number,
  options: { level: number; decay: number; type: BiquadFilterType; frequency: number; q?: number },
) {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = options.type;
  filter.frequency.value = options.frequency;
  filter.Q.value = options.q ?? 0.7;
  source.connect(filter).connect(envelope(ctx, out, time, options.level, options.decay));
  source.start(time);
  source.stop(time + options.decay + 0.02);
}

export function playDrum(
  ctx: BaseAudioContext,
  out: AudioNode,
  id: DrumId,
  time: number,
  velocity = 1,
): void {
  const v = velocity;
  switch (id) {
    case 'bombo':
      tone(ctx, out, time, { from: 150, to: 45, drop: 0.09, level: 1 * v, decay: 0.28 });
      return;
    case 'caja':
      tone(ctx, out, time, { from: 200, to: 140, drop: 0.05, level: 0.45 * v, decay: 0.1, type: 'triangle' });
      hiss(ctx, out, time, { level: 0.55 * v, decay: 0.17, type: 'highpass', frequency: 1500 });
      return;
    case 'hihat':
      hiss(ctx, out, time, { level: 0.32 * v, decay: 0.05, type: 'highpass', frequency: 7500 });
      return;
    case 'palma':
      for (const delay of [0, 0.012, 0.024]) {
        hiss(ctx, out, time + delay, {
          level: 0.35 * v,
          decay: 0.05,
          type: 'bandpass',
          frequency: 1300,
          q: 1.1,
        });
      }
      hiss(ctx, out, time + 0.036, {
        level: 0.4 * v,
        decay: 0.14,
        type: 'bandpass',
        frequency: 1300,
        q: 1.1,
      });
      return;
    case 'tom':
      tone(ctx, out, time, { from: 190, to: 95, drop: 0.14, level: 0.8 * v, decay: 0.26 });
      return;
    case 'cencerro':
      tone(ctx, out, time, { from: 540, level: 0.28 * v, decay: 0.14, type: 'square' });
      tone(ctx, out, time, { from: 800, level: 0.22 * v, decay: 0.14, type: 'square' });
      return;
  }
}

export type ClickSound = 'clic' | 'madera' | 'cencerro' | 'bateria' | 'palmas';

export const CLICK_SOUNDS: ReadonlyArray<{ id: ClickSound; name: string }> = [
  { id: 'clic', name: 'Clic' },
  { id: 'madera', name: 'Madera' },
  { id: 'cencerro', name: 'Cencerro' },
  { id: 'bateria', name: 'Batería' },
  { id: 'palmas', name: 'Palmas' },
];

const PITCHES: Record<number, number> = { 2: 1760, 1: 1175, 0: 784 };
const LEVELS: Record<number, number> = { 2: 0.9, 1: 0.6, 0: 0.32 };

/** Un golpe de metrónomo. El acento cambia el sonido, y el segundo carril suena más grave. */
export function playClick(
  ctx: BaseAudioContext,
  out: AudioNode,
  sound: ClickSound,
  level: number,
  lane: number,
  time: number,
): void {
  const volume = LEVELS[level] ?? 0.5;
  const lower = lane === 1 ? 0.5 : 1;
  switch (sound) {
    case 'clic':
      tone(ctx, out, time, {
        from: (PITCHES[level] ?? 1000) * lower,
        level: volume * 0.7,
        decay: 0.05,
        type: 'square',
      });
      return;
    case 'madera':
      tone(ctx, out, time, {
        from: (level === 2 ? 1250 : 880) * lower,
        to: 500 * lower,
        drop: 0.03,
        level: volume,
        decay: 0.05,
      });
      return;
    case 'cencerro':
      tone(ctx, out, time, { from: 540 * lower, level: volume * 0.32, decay: 0.12, type: 'square' });
      tone(ctx, out, time, { from: 800 * lower, level: volume * 0.26, decay: 0.12, type: 'square' });
      return;
    case 'bateria':
      if (lane === 1) playDrum(ctx, out, 'hihat', time, volume + 0.3);
      else
        playDrum(
          ctx,
          out,
          level === 2 ? 'bombo' : level === 1 ? 'caja' : 'hihat',
          time,
          level === 0 ? 1 : volume,
        );
      return;
    case 'palmas':
      playDrum(ctx, out, 'palma', time, volume);
      return;
  }
}
