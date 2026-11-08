// Tus reglas: las que te ponés para toda la canción. A diferencia de la consigna, no cambian con el
// sorteo. Las de racha, plazo y canción anterior salen del Diario y de los proyectos guardados.
import { chordOf, type Check } from './harmony';
import { formatTime } from './project';
import { linesOf } from './lyrics';
import { clipOf } from './project';
import type { Project } from './types';

export interface OwnContext {
  project: Project;
  /** Duración del tema en segundos. */
  seconds: number;
  /** Días seguidos con algo en el Diario, contando hoy. */
  streak: number;
  /** Hora más frecuente de las entradas del Diario, si hay. */
  usualHour: number | null;
  /** La canción anterior, si hay una guardada. */
  previous: Project | null;
  meterLabel: string;
  previousMeterLabel: string | null;
}

export interface OwnRule {
  id: string;
  name: string;
  hint?: string;
  check: (ctx: OwnContext) => Check;
}

const DAY = 86_400_000;

export const OWN_RULES: OwnRule[] = [
  {
    id: 'tres',
    name: 'Tres acordes por sección, como máximo',
    check: ({ project: p }) => {
      const bad = p.secs.filter(
        (s) =>
          !s.of &&
          new Set((clipOf(p, 'armonia', s)?.chords ?? []).map((c) => chordOf(c, p.key).name)).size > 3,
      );
      return bad.length
        ? { ok: false, why: `Se pasa en ${bad.map((s) => s.label).join(', ')}.` }
        : { ok: true, why: 'Se cumple en todas.' };
    },
  },
  {
    id: 'ocho',
    name: 'Ninguna sección de más de 8 compases',
    check: ({ project: p }) => {
      const bad = p.secs.filter((s) => !s.of && s.bars > 8);
      return bad.length
        ? { ok: false, why: bad.map((s) => `${s.label} tiene ${s.bars}`).join(', ') + '.' }
        : { ok: true, why: 'Todas entran.' };
    },
  },
  {
    id: 'trio',
    name: 'Todo de a tres: tres secciones distintas',
    check: ({ project: p }) => {
      const labels = [...new Set(p.secs.map((s) => s.label).filter((l) => l !== 'Intro'))];
      return labels.length <= 3
        ? { ok: true, why: `Hay ${labels.join(', ')}.` }
        : { ok: false, why: `${labels.length} distintas.` };
    },
  },
  {
    id: 'plazo',
    name: 'Terminala en diez días',
    hint: 'Los plazos te hacen creativo.',
    check: ({ project: p }) => {
      const days = Math.floor((Date.now() - p.createdAt) / DAY);
      const left = 10 - days;
      return left >= 0
        ? { ok: true, why: `Día ${days + 1} de 10: quedan ${left}.` }
        : { ok: false, why: `Se pasó por ${-left} días.` };
    },
  },
  {
    id: 'impar',
    name: 'Al menos una frase de compases impares',
    hint: 'El oído esperaba 4 u 8.',
    check: ({ project: p }) => {
      const odd = p.secs.filter((s) => !s.of && s.bars > 1 && s.bars % 2);
      return odd.length
        ? { ok: true, why: odd.map((s) => `${s.label} tiene ${s.bars}`).join(', ') + '.' }
        : { ok: false, why: 'Todas son pares.' };
    },
  },
  {
    id: 'horario',
    name: 'Todos los días, a la misma hora',
    hint: 'Sentate aunque no venga nada.',
    check: ({ streak, usualHour }) =>
      streak > 0
        ? {
            ok: true,
            why: `Racha: ${streak} ${streak === 1 ? 'día' : 'días'}${usualHour === null ? '' : `, a las ${usualHour}`}.`,
          }
        : { ok: false, why: 'Hoy no hay nada en el Diario.' },
  },
  {
    id: 'cocina',
    name: 'No salís de la cocina sin una canción entera',
    check: ({ project: p }) => {
      const missing: string[] = [];
      const noHarmony = p.secs
        .filter((s) => !s.of && s.bars > 1 && !clipOf(p, 'armonia', s))
        .map((s) => s.label);
      if (noHarmony.length) missing.push(`armonía en ${noHarmony.join(', ')}`);
      const noLyric = [
        ...new Set(
          p.secs
            .filter((s) => s.label !== 'Intro' && s.bars > 1 && !linesOf(clipOf(p, 'letra', s)?.text).length)
            .map((s) => s.label),
        ),
      ];
      if (noLyric.length) missing.push(`letra en ${noLyric.join(', ')}`);
      if (!p.title.trim()) missing.push('el título');
      return missing.length
        ? { ok: false, why: `Falta ${missing.join('; ')}.` }
        : { ok: true, why: 'Ya podés salir.' };
    },
  },
  {
    id: 'dosmin',
    name: 'Menos de dos minutos',
    hint: 'Estructura normal, tocada rápido.',
    check: ({ seconds }) =>
      seconds < 120
        ? { ok: true, why: `Dura ${formatTime(seconds)}.` }
        : { ok: false, why: `Dura ${formatTime(seconds)}.` },
  },
  {
    id: 'destruir',
    name: 'Nada de lo que usaste en la canción anterior',
    hint: 'Ni la afinación, ni la tónica, ni el compás.',
    check: ({ project: p, previous, meterLabel, previousMeterLabel }) => {
      if (!previous) return { ok: true, why: 'No hay canción anterior guardada.' };
      const same: string[] = [];
      if (previous.tuning.name === p.tuning.name) same.push('la afinación');
      if (previous.key.tonic === p.key.tonic) same.push('la tónica');
      if (previousMeterLabel && previousMeterLabel === meterLabel) same.push('el compás');
      const name = previous.title || 'la anterior';
      return same.length
        ? { ok: false, why: `De “${name}” repetís ${same.join(', ')}.` }
        : { ok: true, why: `Nada se repite de “${name}”.` };
    },
  },
];

/** Días seguidos con entradas, terminando hoy o ayer. */
export function streakOf(times: readonly number[], now = Date.now()): number {
  const day = (t: number) => {
    const d = new Date(t);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY;
  };
  const days = new Set(times.map(day));
  let today = day(now);
  if (!days.has(today)) today -= 1;
  let n = 0;
  while (days.has(today - n)) n += 1;
  return n;
}

export function usualHourOf(times: readonly number[]): number | null {
  if (!times.length) return null;
  const tally = new Map<number, number>();
  for (const t of times) {
    const h = new Date(t).getHours();
    tally.set(h, (tally.get(h) ?? 0) + 1);
  }
  return [...tally].sort((a, b) => b[1] - a[1])[0]![0];
}

/** El reto de 14 canciones en 28 días: cuántas terminadas desde que empezó. */
export function challengeOf(finished: readonly number[], start: number | null, now = Date.now()) {
  if (start === null) return null;
  const day = Math.min(28, Math.floor((now - start) / DAY) + 1);
  const songs = finished.filter((t) => t >= start).length;
  return { day, songs };
}
