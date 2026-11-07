// Sintetizador de drone, fuera de React como el metrónomo: sigue sonando al navegar,
// y la interfaz se suscribe a su estado.
import { DEFAULT_DRONE, droneVoices, type DroneConfig, type TimbreId } from '~/core/drone';
import { midiToHz } from '~/core/notes';
import { channelInput, getAudio } from './engine';

const FADE_IN = 1.2;
const FADE_OUT = 0.6;
const LEVEL = 0.34;

export interface DroneState {
  running: boolean;
  /** Está a la vista en la barra de abajo: aparece al sonar, y se va solo al cerrarla. */
  docked: boolean;
  config: DroneConfig;
}

interface Voice {
  oscillators: OscillatorNode[];
  midi: number;
  group: GainNode;
}

interface Patch {
  voices: Voice[];
  filter: BiquadFilterNode;
  lfo: OscillatorNode;
  lfoDepth: GainNode;
  amp: GainNode;
  timbre: TimbreId;
}

let state: DroneState = { running: false, docked: false, config: DEFAULT_DRONE };
let patch: Patch | null = null;
let analyser: AnalyserNode | null = null;
let a4 = 440;
const listeners = new Set<() => void>();

function setState(next: Partial<DroneState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

const cutoff = (brightness: number) => 120 * Math.pow(45, brightness);
const lfoRate = (motion: number) => 0.05 + motion * 0.5;
const lfoAmount = (brightness: number, motion: number) => cutoff(brightness) * motion * 0.8;

/** Armónicos del timbre órgano: fundamental, octava y duodécima, como unos tiradores de órgano. */
function organWave(ctx: AudioContext): PeriodicWave {
  const real = new Float32Array([0, 0, 0, 0, 0, 0, 0]);
  const imag = new Float32Array([0, 1, 0.55, 0.35, 0.2, 0.1, 0.06]);
  return ctx.createPeriodicWave(real, imag);
}

function setWave(ctx: AudioContext, oscillator: OscillatorNode, timbre: TimbreId) {
  if (timbre === 'organo') oscillator.setPeriodicWave(organWave(ctx));
  else oscillator.type = timbre === 'crudo' ? 'sawtooth' : 'triangle';
}

function buildVoice(
  ctx: AudioContext,
  midi: number,
  config: DroneConfig,
  into: AudioNode,
  index: number,
  total: number,
): Voice {
  const group = ctx.createGain();
  group.gain.value = 1 / Math.sqrt(total);
  const panner = ctx.createStereoPanner();
  panner.pan.value = total > 1 ? (index / (total - 1) - 0.5) * 0.7 : 0;
  group.connect(panner).connect(into);
  // Dos osciladores apenas desafinados: el batido entre ellos es lo que hace vivo a un drone.
  const oscillators = [-1, 1].map((direction) => {
    const oscillator = ctx.createOscillator();
    setWave(ctx, oscillator, config.timbre);
    oscillator.frequency.value = midiToHz(midi, a4);
    oscillator.detune.value = (direction * config.detune) / 2;
    const gain = ctx.createGain();
    gain.gain.value = 0.5;
    oscillator.connect(gain).connect(group);
    oscillator.start();
    return oscillator;
  });
  return { oscillators, midi, group };
}

function build(config: DroneConfig): Patch {
  const { ctx } = getAudio();
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, ctx.currentTime);
  amp.gain.linearRampToValueAtTime(LEVEL, ctx.currentTime + FADE_IN);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.8;
  filter.frequency.value = cutoff(config.brightness);
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = lfoRate(config.motion);
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = lfoAmount(config.brightness, config.motion);
  lfo.connect(lfoDepth).connect(filter.frequency);
  lfo.start();

  analyser ??= ctx.createAnalyser();
  analyser.fftSize = 2048;
  filter.connect(amp).connect(analyser);
  analyser.connect(channelInput('drone'));

  const midis = droneVoices(config);
  const voices = midis.map((midi, index) => buildVoice(ctx, midi, config, filter, index, midis.length));
  return { voices, filter, lfo, lfoDepth, amp, timbre: config.timbre };
}

function release(old: Patch, seconds: number) {
  const { ctx } = getAudio();
  old.amp.gain.cancelScheduledValues(ctx.currentTime);
  old.amp.gain.setTargetAtTime(0, ctx.currentTime, seconds / 3);
  const end = ctx.currentTime + seconds + 0.2;
  old.voices.forEach((voice) => voice.oscillators.forEach((oscillator) => oscillator.stop(end)));
  old.lfo.stop(end);
  old.lfo.onended = () => old.amp.disconnect();
}

const sameVoices = (config: DroneConfig, current: Patch) => {
  const midis = droneVoices(config);
  return midis.length === current.voices.length && midis.every((midi, i) => midi === current.voices[i]!.midi);
};

export const drone = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getState: () => state,

  /** Con `dock: false` no aparece en la barra de abajo: lo maneja quien lo prendió. */
  start({ dock = true }: { dock?: boolean } = {}) {
    if (patch) return;
    patch = build(state.config);
    setState({ running: true, docked: dock || state.docked });
  },

  stop() {
    if (patch) release(patch, FADE_OUT);
    patch = null;
    setState({ running: false });
  },

  /** Para y lo saca de la barra de abajo. */
  close() {
    this.stop();
    setState({ docked: false });
  },

  /** Cambia el sonido sin cortar: filtro y movimiento se deslizan, y las notas nuevas entran con un fundido. */
  setConfig(config: DroneConfig) {
    const previous = state.config;
    setState({ config });
    if (!patch) return;
    const { ctx } = getAudio();
    if (!sameVoices(config, patch) || config.timbre !== patch.timbre) {
      release(patch, FADE_OUT);
      patch = build(config);
      return;
    }
    const now = ctx.currentTime;
    patch.filter.frequency.setTargetAtTime(cutoff(config.brightness), now, 0.08);
    patch.lfo.frequency.setTargetAtTime(lfoRate(config.motion), now, 0.2);
    patch.lfoDepth.gain.setTargetAtTime(lfoAmount(config.brightness, config.motion), now, 0.2);
    if (config.detune !== previous.detune) {
      for (const voice of patch.voices) {
        voice.oscillators.forEach((oscillator, index) =>
          oscillator.detune.setTargetAtTime(((index === 0 ? -1 : 1) * config.detune) / 2, now, 0.1),
        );
      }
    }
  },

  /** Referencia del La: afecta lo que suene de acá en adelante, y a lo que ya está sonando. */
  setReferencePitch(value: number) {
    a4 = value;
    if (!patch) return;
    const { ctx } = getAudio();
    for (const voice of patch.voices) {
      for (const oscillator of voice.oscillators) {
        oscillator.frequency.setTargetAtTime(midiToHz(voice.midi, a4), ctx.currentTime, 0.1);
      }
    }
  },

  /** La forma de onda que suena ahora, para dibujarla. */
  waveform(into: Float32Array<ArrayBuffer>): boolean {
    if (!analyser || !patch) return false;
    analyser.getFloatTimeDomainData(into);
    return true;
  },
};
