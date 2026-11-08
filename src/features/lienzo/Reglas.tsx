// Tus reglas: valen para toda la canción. La racha y la hora salen del Diario; la canción anterior,
// de las guardadas en el lienzo.
import { useMemo } from 'react';
import { OWN_RULES, streakOf, usualHourOf, type OwnContext } from '~/core/lienzo/own';
import { barsToSeconds, totalBars } from '~/core/lienzo/project';
import { meterLabel } from '~/core/lienzo/rhythm';
import { useJournal } from '~/shared/journal';
import { useLienzo } from '~/shared/lienzo';
import { LinkBtn, Win } from './bits';
import { useModel } from './model';
import { cachedRules } from './plan';
import { decodeConsigna } from '~/core/consigna';
import s from './lienzo.module.css';

function useOwnContext(): OwnContext {
  const { project, rules, meter } = useModel();
  const previous = useLienzo((st) => st.archive[0] ?? null);
  const { entries } = useJournal();
  return useMemo(() => {
    const times = (entries ?? []).map((e) => e.createdAt);
    const prevConsigna = previous?.consigna ? decodeConsigna(previous.consigna) : null;
    return {
      project,
      seconds: barsToSeconds(totalBars(project.secs), rules.meter, project.bpm),
      streak: streakOf(times),
      usualHour: usualHourOf(times),
      previous,
      meterLabel: meter,
      previousMeterLabel: prevConsigna ? meterLabel(cachedRules(prevConsigna).rules.meter) : null,
    };
  }, [project, rules.meter, meter, previous, entries]);
}

export function useOwnSummary() {
  const { project } = useModel();
  const ctx = useOwnContext();
  const on = OWN_RULES.filter((r) => project.own[r.id]);
  return { on: on.length, bad: on.filter((r) => !r.check(ctx).ok).length };
}

export function Reglas() {
  const { project } = useModel();
  const store = useLienzo();
  const ctx = useOwnContext();
  return (
    <Win id="reglas" title="Tus reglas">
      <span className={s.lede}>La consigna cambia con cada sorteo. Estas valen para toda la canción.</span>
      {OWN_RULES.map((r) => {
        const on = !!project.own[r.id];
        const res = r.check(ctx);
        return (
          <div
            key={r.id}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0,1fr) auto',
              gap: 12,
              padding: '8px 0',
              borderTop: '1px solid var(--faint)',
              alignItems: 'baseline',
            }}
          >
            <span className={s.stack} style={{ gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: on ? 'var(--ink)' : 'var(--muted)' }}>
                {r.name}
              </span>
              {r.hint && <span className={s.small}>{r.hint}</span>}
              <span className={!on ? s.small : res.ok ? s.ok : s.bad} style={{ fontSize: 12 }}>
                {on ? `${res.ok ? '✓' : '✗'} ${res.why}` : 'Sin usar.'}
              </span>
            </span>
            <LinkBtn onClick={() => store.update((p) => ({ own: { ...p.own, [r.id]: !on } }))}>
              {on ? 'sacar' : 'ponerla'}
            </LinkBtn>
          </div>
        );
      })}
    </Win>
  );
}
