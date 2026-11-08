// El reproductor del lienzo: agenda compás por compás con un reloj por adelantado. Lee el plan en cada
// compás, así lo que se edita se oye en la vuelta siguiente. La posición se calcula del reloj de audio
// y nunca pasa por el store del proyecto: así los paneles pesados no se re-renderizan mientras suena.
import { quartersPerBar } from '~/core/lienzo/rhythm';
import type { LienzoRules } from '~/core/lienzo/rules';
import { barEvents } from '~/core/lienzo/schedule';
import { totalBars } from '~/core/lienzo/project';
import type { Project } from '~/core/lienzo/types';
import { DEFAULT_DRONE } from '~/core/drone';
import { drone } from './drone';
import { playDrum } from './drums';
import { channelInput, getAudio } from './engine';
import { pluckString, prepareInstrument, strum } from './instrument';
import { metronome } from './metronome';
import { song } from './song';
import { createTicker } from './ticker';

export type Sound = 'todo' | 'sin-ritmo' | 'nada';

export interface Plan {
  project: Project;
  rules: LienzoRules;
  sound: Sound;
  a4: number;
}

const LOOKAHEAD = 0.2;
const TICK_MS = 25;
const START_DELAY = 0.06;
const MELODY_VOICE = 5;

interface Scheduled {
  bar: number;
  time: number;
  seconds: number;
}

let getPlan: (() => Plan) | null = null;
let playing = false;
let nextBar = 0;
let nextTime = 0;
let history: Scheduled[] = [];
/** Posición en compases cuando está en pausa. */
let parked = 0;
let ownsDrone = false;
const listeners = new Set<() => void>();
const ticker = createTicker(TICK_MS);

const notify = () => listeners.forEach((l) => l());
const barSeconds = (plan: Plan) => (quartersPerBar(plan.rules.meter) * 60) / plan.project.bpm;

function scheduleBar(plan: Plan, bar: number, time: number) {
  const seconds = barSeconds(plan);
  history = [...history.slice(-16), { bar, time, seconds }];
  if (plan.sound === 'nada') return;
  const events = barEvents(plan.project, plan.rules, bar);
  if (!events) return;
  const { ctx } = getAudio();
  for (const c of events.chords) strum(c.midis, plan.a4, time + c.at * seconds);
  for (const n of events.notes)
    pluckString(MELODY_VOICE, n.midi, { a4: plan.a4, when: time + n.at * seconds, velocity: 1 });
  if (plan.sound === 'todo') {
    const out = channelInput('ritmo');
    for (const h of events.hits) playDrum(ctx, out, h.voice, time + h.at * seconds, h.gain);
  }
}

function tick() {
  if (!playing || !getPlan) return;
  const plan = getPlan();
  const total = totalBars(plan.project.secs);
  if (!total) return;
  const horizon = getAudio().ctx.currentTime + LOOKAHEAD;
  for (let guard = 0; nextTime < horizon && guard < 32; guard++) {
    if (nextBar >= total) nextBar = 0;
    scheduleBar(plan, nextBar, nextTime);
    nextTime += barSeconds(plan);
    nextBar += 1;
  }
}

function startDrone(plan: Plan) {
  const { project } = plan;
  if (!project.drone || drone.getState().docked) return;
  drone.setConfig({
    ...DEFAULT_DRONE,
    root: 36 + project.key.tonic,
    stack: project.drone === 'quinta' ? 'quinta' : 'octava',
  });
  if (!drone.getState().running) drone.start({ dock: false });
  ownsDrone = true;
}

function stopDrone() {
  if (ownsDrone && drone.getState().running && !drone.getState().docked) drone.stop();
  ownsDrone = false;
}

export const lienzoPlayer = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  isPlaying: () => playing,

  play(source: () => Plan) {
    getPlan = source;
    const plan = source();
    if (song.getState().running) song.stop();
    metronome.stop();
    const { ctx } = getAudio();
    const total = totalBars(plan.project.secs);
    prepareInstrument(
      Array.from({ length: Math.min(total, 64) }, (_, i) => barEvents(plan.project, plan.rules, i)).flatMap(
        (ev) => (ev ? [...ev.chords.flatMap((c) => c.midis), ...ev.notes.map((n) => n.midi)] : []),
      ),
      plan.a4,
    );
    const whole = Math.floor(parked);
    nextBar = whole % Math.max(1, total);
    nextTime = ctx.currentTime + START_DELAY - (parked - whole) * barSeconds(plan);
    history = [];
    playing = true;
    if (plan.sound !== 'nada') startDrone(plan);
    ticker.start(tick);
    tick();
    notify();
  },

  pause() {
    if (!playing) return;
    parked = this.position();
    playing = false;
    ticker.stop();
    stopDrone();
    notify();
  },

  /** Va a una posición, en compases desde el principio. */
  seek(bar: number) {
    const total = getPlan ? totalBars(getPlan().project.secs) : Infinity;
    parked = Math.max(0, Math.min(bar, total - 0.001));
    if (playing && getPlan) {
      const plan = getPlan();
      const whole = Math.floor(parked);
      nextBar = whole;
      nextTime = getAudio().ctx.currentTime + START_DELAY - (parked - whole) * barSeconds(plan);
      history = [];
    }
    notify();
  },

  /** La posición que se oye ahora, en compases desde el principio. */
  position(): number {
    if (!playing) return parked;
    const now = getAudio().ctx.currentTime;
    for (let i = history.length - 1; i >= 0; i--) {
      const s = history[i]!;
      if (now >= s.time) return s.bar + Math.min(0.999, (now - s.time) / s.seconds);
    }
    return history[0]?.bar ?? parked;
  },
};

/** Toca un acorde suelto: para el círculo, la familia o las recetas. */
export function previewChord(midis: number[], a4: number, delay = 0) {
  const { ctx } = getAudio();
  strum(midis, a4, ctx.currentTime + 0.02 + delay);
}

export function previewNote(midi: number, a4: number, delay = 0) {
  const { ctx } = getAudio();
  pluckString(MELODY_VOICE, midi, { a4, when: ctx.currentTime + 0.02 + delay });
}
