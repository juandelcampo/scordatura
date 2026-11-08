// El motor del tema: recorre la forma y programa lo que suena en cada bloque, con el mismo reloj
// por adelantado que el metrónomo. Lee el plan en cada tic, así que lo que se edita se oye enseguida.
import { eventsBetween, locate, songPitches, type Song } from '~/core/song';
import { drone } from './drone';
import { playDrum } from './drums';
import { channelInput, getAudio } from './engine';
import { pluckString, prepareInstrument, stopInstrument, strum } from './instrument';
import { metronome } from './metronome';
import { createTicker } from './ticker';

const LOOKAHEAD_SECONDS = 0.25;
const TICK_MS = 25;
const START_DELAY = 0.08;
/** La melodía usa una voz propia, para no cortar las cuerdas del acorde. */
const MELODY_VOICE = 6;
const MAX_BLOCKS_PER_TICK = 64;
const HISTORY = 16;

export interface SongState {
  running: boolean;
  /** Repite el bloque en el que está, en lugar de seguir con la forma. */
  loop: boolean;
}

export interface SongPosition {
  block: number;
  beat: number;
  bar: number;
  step: number;
  /** De 0 a 1, dentro del bloque. */
  fraction: number;
}

interface Anchor {
  block: number;
  time: number;
  beat: number;
  bpm: number;
}

let state: SongState = { running: false, loop: false };
const listeners = new Set<() => void>();
const ticker = createTicker(TICK_MS);

let plan: Song | null = null;
let anchors: Anchor[] = [];
let index = 0;
let cursor = 0;
let droneConfig: Song['drone'] | null = null;
let ownsDrone = false;
/** Lo prendió el tema y debería seguir sonando. */
let droneOn = false;
/** La persona lo paró mientras sonaba el tema: no se vuelve a prender hasta el próximo "Tocar". */
let droneSilenced = false;

function setState(patch: Partial<SongState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

const lastAnchor = () => anchors[anchors.length - 1]!;

function pushAnchor(anchor: Anchor) {
  anchors = [...anchors.slice(-HISTORY), anchor];
}

function schedule(from: number, to: number, anchor: Anchor) {
  if (!plan) return;
  const { ctx } = getAudio();
  const out = channelInput('ritmo');
  for (const event of eventsBetween(plan, index, from, to)) {
    const time = anchor.time + ((event.beat - anchor.beat) * 60) / anchor.bpm;
    if (event.kind === 'drum') playDrum(ctx, out, event.voice, time, event.gain);
    else if (event.kind === 'chord') strum(event.midis, plan.a4, time);
    else pluckString(MELODY_VOICE, event.midi, { a4: plan.a4, when: time });
  }
}

/** El drone sigue al bloque que se oye ahora, no al que ya se está programando. */
function followDrone() {
  if (!plan) return;
  // Si la persona lo prendió aparte, es suyo: el tema no lo toca.
  if (drone.getState().docked) return;
  if (droneOn && !drone.getState().running) {
    droneOn = false;
    droneSilenced = true;
  }
  const block = plan.blocks[song.position()?.block ?? index];
  const wanted = plan.audible.drone && !!block?.drone && !droneSilenced;
  if (plan.drone !== droneConfig) {
    droneConfig = plan.drone;
    drone.setConfig(plan.drone);
  }
  if (wanted && !drone.getState().running) {
    drone.start({ dock: false });
    ownsDrone = true;
    droneOn = true;
  } else if (!wanted && drone.getState().running) {
    droneOn = false;
    drone.stop();
  }
}

function tick() {
  if (!state.running || !plan) return;
  const horizon = getAudio().ctx.currentTime + LOOKAHEAD_SECONDS;
  for (let guard = 0; guard < MAX_BLOCKS_PER_TICK; guard++) {
    const block = plan.blocks[index];
    if (!block) {
      index = 0;
      cursor = 0;
      continue;
    }
    const anchor = lastAnchor();
    const wanted = anchor.beat + ((horizon - anchor.time) * anchor.bpm) / 60;
    const end = Math.min(wanted, block.beats);
    if (end > cursor) {
      schedule(cursor, end, anchor);
      cursor = end;
    }
    if (wanted < block.beats) break;
    const time = anchor.time + ((block.beats - anchor.beat) * 60) / anchor.bpm;
    index = state.loop ? index : (index + 1) % plan.blocks.length;
    cursor = 0;
    pushAnchor({ block: index, time, beat: 0, bpm: anchor.bpm });
  }
  followDrone();
}

export const song = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getState: () => state,

  play(next: Song, from = 0) {
    // El tema se hace cargo de todo lo que suena: si no, se oirían dos ritmos a la vez.
    metronome.close();
    drone.close();
    plan = next;
    droneConfig = null;
    droneOn = false;
    droneSilenced = false;
    prepareInstrument(songPitches(next), next.a4);
    index = Math.min(from, next.blocks.length - 1);
    cursor = 0;
    anchors = [];
    pushAnchor({ block: index, time: getAudio().ctx.currentTime + START_DELAY, beat: 0, bpm: next.bpm });
    setState({ running: true });
    tick();
    ticker.start(tick);
  },

  stop() {
    ticker.stop();
    stopInstrument();
    droneOn = false;
    if (ownsDrone && !drone.getState().docked) drone.stop();
    ownsDrone = false;
    setState({ running: false });
  },

  /** Lo editado se oye sin cortar. Si cambió el tempo, sigue desde este mismo punto. */
  setPlan(next: Song) {
    plan = next;
    if (!state.running) return;
    const anchor = lastAnchor();
    if (next.bpm !== anchor.bpm) {
      const { currentTime } = getAudio().ctx;
      const time = Math.max(currentTime, anchor.time);
      const beat = anchor.beat + ((time - anchor.time) * anchor.bpm) / 60;
      pushAnchor({ block: anchor.block, time, beat, bpm: next.bpm });
    }
  },

  setLoop(loop: boolean) {
    setState({ loop });
  },

  /** Salta a un bloque enseguida, como al tocar la regla de tiempo. */
  seek(block: number) {
    if (!state.running || !plan) return;
    index = Math.min(block, plan.blocks.length - 1);
    cursor = 0;
    const time = getAudio().ctx.currentTime + START_DELAY;
    pushAnchor({ block: index, time, beat: 0, bpm: plan.bpm });
  },

  /** Lo que se oye en este instante, que puede estar atrás de lo ya programado. */
  position(): SongPosition | null {
    if (!state.running || !plan) return null;
    const now = getAudio().ctx.currentTime;
    let anchor = anchors[0];
    for (const item of anchors) if (item.time <= now) anchor = item;
    if (!anchor) return null;
    const block = plan.blocks[anchor.block];
    if (!block || block.beats <= 0) return null;
    const beat = Math.max(0, anchor.beat + ((now - anchor.time) * anchor.bpm) / 60);
    const clamped = Math.min(beat, block.beats);
    return { block: anchor.block, beat: clamped, fraction: clamped / block.beats, ...locate(block, clamped) };
  },
};

// Es la otra mitad de lo que hace play: si arranca el metrónomo, el tema cede. Si no, sonarían dos ritmos.
metronome.subscribe(() => {
  if (state.running && metronome.getState().running) song.stop();
});
