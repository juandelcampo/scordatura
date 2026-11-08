// El tema del lienzo como MIDI: acordes con su duración real, melodía, batería y una marca por
// sección con su nombre y sus grados.
import { DRUM_CHANNEL, GM_DRUMS, GM_PROGRAM, writeMidi, type MidiSpan } from '../midi';
import { degName } from './harmony';
import { clipOf } from './project';
import { meterLabel, quartersPerBar } from './rhythm';
import type { LienzoRules } from './rules';
import { allBars } from './schedule';
import type { Project } from './types';

function signature(rules: LienzoRules): { numerator: number; power: number } {
  const label = meterLabel(rules.meter);
  const [num, den] = label.split('/').map(Number) as [number, number];
  return { numerator: num, power: Math.round(Math.log2(den)) };
}

export function lienzoToMidi(p: Project, rules: LienzoRules): Uint8Array<ArrayBuffer> {
  const qpb = quartersPerBar(rules.meter);
  const chords: MidiSpan[] = [];
  const melody: MidiSpan[] = [];
  const drums: MidiSpan[] = [];
  const markers: { beat: number; text: string }[] = [];
  allBars(p, rules).forEach((ev, i) => {
    const origin = i * qpb;
    if (ev.bar === 0) {
      const degrees =
        clipOf(p, 'armonia', ev.sec)
          ?.chords.map((c) => degName(c, p.key))
          .join(' ') ?? '';
      markers.push({ beat: origin, text: `${ev.sec.label}${degrees ? ` · ${degrees}` : ''}` });
    }
    for (const c of ev.chords)
      for (const midi of c.midis)
        chords.push({ beat: origin + c.at * qpb, beats: c.len * qpb, midi, velocity: 72 });
    for (const n of ev.notes)
      melody.push({ beat: origin + n.at * qpb, beats: n.dur * qpb, midi: n.midi, velocity: 96 });
    for (const h of ev.hits)
      drums.push({
        beat: origin + h.at * qpb,
        beats: 0.25,
        midi: GM_DRUMS[h.voice],
        velocity: Math.max(1, Math.round(h.gain * 127)),
      });
  });
  return writeMidi(
    p.bpm,
    [{ beat: 0, ...signature(rules) }],
    [
      { name: 'Acordes', channel: 0, program: GM_PROGRAM.guitarra, spans: chords },
      { name: 'Melodia', channel: 1, program: GM_PROGRAM.guitarra, spans: melody },
      { name: 'Bateria', channel: DRUM_CHANNEL, spans: drums },
    ],
    markers,
  );
}
