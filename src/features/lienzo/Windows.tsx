// Ventanas flotantes de armonía y ritmo: Tonalidad, Círculo, Ritmo y Acordes.
import { previewChord, previewNote } from '~/audio/lienzo';
import { chromaticCircle, fifthsCircle } from '~/core/lienzo/circle';
import {
  barsOf,
  borrowedDegrees,
  chordOf,
  degName,
  parallelOf,
  recipes,
  roleOf,
  type ChordInfo,
} from '~/core/lienzo/harmony';
import { clipOf } from '~/core/lienzo/project';
import { checkRhythm, counterpart, drumFromGroups, rBar } from '~/core/lienzo/rhythm';
import { KEY_MODES, type Chord, type KeyMode, type LaneRhythm } from '~/core/lienzo/types';
import { chordMidis } from '~/core/lienzo/voicing';
import { DRUMS, euclid } from '~/core/rhythm';
import { DRUM_PRESETS, OBJECT_KIT } from '~/data/drums';
import { useLienzo } from '~/shared/lienzo';
import { useLienzoUi } from '~/shared/lienzoUi';
import { useSettings } from '~/shared/settings';
import { addChord, nextName, putChords, putVariant, rollAllHarmony, rollVariant } from './actions';
import { ChordDiagram, LinkBtn, Opt, Steps, usePosition, Win } from './bits';
import { keyLabel } from './Chrome';
import { consignaKey, useModel } from './model';
import { NOTE_NAMES_ES } from './plan';
import s from './lienzo.module.css';

function useHear() {
  const { project } = useModel();
  const a4 = useSettings((st) => st.a4);
  return (ch: ChordInfo) =>
    previewChord(chordMidis(ch, project.instrument === 'guitarra' ? project.tuning : null), a4);
}

export function Tonalidad() {
  const { project: p, selSec, rules, risk } = useModel();
  const store = useLienzo();
  const ui = useLienzoUi();
  const hear = useHear();
  const famBtn = (c: Chord, role: string) => {
    const ch = chordOf(c, p.key);
    return (
      <button
        key={`${c.d}${c.b ? 'b' : ''}`}
        type="button"
        className={s.famBtn}
        aria-label={`Sumar ${ch.name}, ${role}, a ${selSec.label}`}
        onClick={() => {
          hear(ch);
          addChord(selSec, c);
        }}
      >
        <span className={s.mono} style={{ fontSize: 10, color: 'var(--muted)' }}>
          {degName(c, p.key)}
        </span>
        <span className={s.grot} style={{ fontWeight: 600, fontSize: 16 }}>
          {ch.name}
        </span>
        <span className={s.grot} style={{ fontSize: 11.5 }}>
          {role}
        </span>
      </button>
    );
  };
  const parallel = `${NOTE_NAMES_ES[p.key.tonic]} ${KEY_MODES[parallelOf(p.key.mode)].label.toLowerCase()}`;
  return (
    <Win id="tono" title="Tonalidad">
      <div className={s.stack}>
        <span className={s.small}>Tónica</span>
        <div className={s.row}>
          {NOTE_NAMES_ES.map((n, i) => (
            <Opt key={n} on={p.key.tonic === i} onClick={() => store.setKey({ ...p.key, tonic: i })}>
              {n}
            </Opt>
          ))}
        </div>
      </div>
      <div className={s.stack}>
        <span className={s.small}>Color</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '2px 16px' }}>
          {(Object.keys(KEY_MODES) as KeyMode[]).map((m) => (
            <Opt key={m} on={p.key.mode === m} onClick={() => store.setKey({ ...p.key, mode: m })}>
              {KEY_MODES[m].label} <span className={s.small}>{KEY_MODES[m].hint}</span>
            </Opt>
          ))}
        </div>
      </div>
      <div className={s.stack}>
        <span className={s.small}>La familia de {keyLabel(p.key.tonic, p.key.mode).toLowerCase()}</span>
        <div className={s.family}>
          {[0, 1, 2, 3, 4, 5, 6].map((d) => famBtn({ d }, roleOf({ d }, p.key)))}
        </div>
        <span className={s.small}>Prestados de {parallel}</span>
        <div className={s.borrowed}>
          {borrowedDegrees(p.key).map((d) => famBtn({ d, b: true }, 'prestado'))}
        </div>
        <span className={s.small}>
          Tocá uno para sumarlo a {selSec.label}. Cambiar la tónica transporta todo.
        </span>
      </div>
      <div className={s.stack}>
        <span className={s.small}>Recetas · tocá una para ponerla en {selSec.label}</span>
        <div style={{ borderTop: '1px solid var(--faint)' }}>
          {recipes(p.key).map((r) => (
            <button
              key={r.name}
              type="button"
              className={s.recipe}
              aria-label={`Poner ${r.name} en ${selSec.label}`}
              onClick={() => putChords(selSec, r.chords, r.name)}
            >
              <span style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{r.name}</span>
                <span className={`${s.mono} ${s.small}`} style={{ fontSize: 10.5 }}>
                  {r.chords.map((c) => degName(c, p.key)).join(' ')}
                </span>
              </span>
              <span className={s.small}>{r.about}</span>
              <span className={s.grot} style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {r.chords.map((c) => chordOf(c, p.key).name).join(' ')}
              </span>
            </button>
          ))}
        </div>
      </div>
      <span className={s.row}>
        <LinkBtn onClick={() => rollAllHarmony(rules, risk)}>sortear armonías para todo el tema</LinkBtn>
        <LinkBtn onClick={() => ui.openWin('circulo')}>ver en el círculo</LinkBtn>
        <LinkBtn onClick={() => store.unplace('armonia', selSec)}>vaciar {selSec.label}</LinkBtn>
      </span>
      <ConsignaKeyHint />
    </Win>
  );
}

function ConsignaKeyHint() {
  const { parts, consigna } = useModel();
  const store = useLienzo();
  if (!parts.harmony.chords.length) return null;
  const use = () => {
    const { tonic, mode } = consignaKey(consigna);
    const km: KeyMode =
      mode === 'dorian' || mode === 'mixolydian' || mode === 'aeolian'
        ? mode
        : mode === 'phrygian'
          ? 'aeolian'
          : 'ionian';
    store.setKey({ tonic, mode: km });
  };
  return (
    <span className={s.small}>
      La consigna propone {parts.harmony.chords.join(' – ')}.{' '}
      <LinkBtn onClick={use}>usar su tonalidad</LinkBtn>
    </span>
  );
}

export function Circulo() {
  const { project: p, selSec } = useModel();
  const ui = useLienzoUi();
  const hear = useHear();
  const a4 = useSettings((st) => st.a4);
  const pos = usePosition(8);
  const h = clipOf(p, 'armonia', selSec);
  const chords = h?.chords ?? [];
  let lit: ChordInfo | null = null;
  if (h && pos > 0) {
    let acc = 0;
    for (const sec of p.secs) {
      if (pos < acc + sec.bars) {
        const hh = clipOf(p, 'armonia', sec);
        if (hh) lit = chordOf(barsOf(hh.chords, sec.bars)[Math.floor(pos - acc)]!, p.key);
        break;
      }
      acc += sec.bars;
    }
  }
  const C = 180;
  const pol = (r: number, k: number): [number, number] => {
    const a = ((k * 30 - 90) * Math.PI) / 180;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  };
  const ring = (r: number) => `M${C - r} ${C}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
  const inSec = new Set(chords.map((c) => chordOf(c, p.key).name));
  const fifths = ui.circMode === 'quintas';
  const model = fifths ? fifthsCircle(p.key, chords) : null;
  const chroma = fifths ? null : chromaticCircle(p.key);
  const nodes = model?.nodes ?? chroma!.nodes;
  let region = '';
  if (model?.sector !== null && model?.sector !== undefined) {
    const k = model.sector;
    const a0 = ((k - 1.5) * 30 - 90) * (Math.PI / 180);
    const a1 = ((k + 1.5) * 30 - 90) * (Math.PI / 180);
    const P = (r: number, a: number) =>
      `${(C + r * Math.cos(a)).toFixed(1)} ${(C + r * Math.sin(a)).toFixed(1)}`;
    region = `M${P(172, a0)}A172 172 0 0 1 ${P(172, a1)}L${P(76, a1)}A76 76 0 0 0 ${P(76, a0)}Z`;
  }
  const radius = (ring: string) => (ring === 'outer' ? 146 : ring === 'inner' ? 100 : 140);
  const route = model ? model.route.map((i) => pol(radius(nodes[i]!.ring), nodes[i]!.pos)) : [];
  const shape = chroma ? chroma.scale.map((pc) => pol(112, pc)) : [];
  const tri = !fifths && (lit ?? (chords[0] ? chordOf(chords[0], p.key) : null));
  const path = (pts: Array<[number, number]>, close: boolean) =>
    pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('') + (close ? 'Z' : '');
  return (
    <Win id="circulo" title={`Círculo · ${keyLabel(p.key.tonic, p.key.mode)}`}>
      <div className={s.row} style={{ justifyContent: 'space-between' }}>
        <div className={s.row}>
          <Opt on={fifths} onClick={() => ui.set({ circMode: 'quintas' })}>
            por quintas
          </Opt>
          <Opt on={!fifths} onClick={() => ui.set({ circMode: 'cromatico' })}>
            cromático
          </Opt>
        </div>
        <div className={s.row}>
          <Opt small on={!ui.circAdd} onClick={() => ui.set({ circAdd: false })}>
            escuchar
          </Opt>
          <Opt small on={ui.circAdd} onClick={() => ui.set({ circAdd: true })}>
            escuchar y sumar
          </Opt>
        </div>
      </div>
      <div className={s.circle}>
        <svg
          width="360"
          height="360"
          viewBox="0 0 360 360"
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0 }}
        >
          <path d={region} fill="var(--soft)" />
          <path d={fifths ? ring(146) + ring(100) + ring(60) : ring(140)} fill="none" stroke="var(--faint)" />
          {shape.length > 0 && (
            <path d={path(shape, true)} fill="var(--soft)" stroke="var(--ink)" strokeWidth="1.2" />
          )}
          {tri && (
            <path
              d={path(
                tri.pcs.map((pc) => pol(112, pc)),
                true,
              )}
              fill="var(--accent)"
              fillOpacity="0.2"
              stroke="var(--accent)"
              strokeWidth="1.6"
            />
          )}
          {route.length > 1 && (
            <path
              d={path(route, route.length > 2)}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="1.6"
              strokeDasharray="5 3"
            />
          )}
          {route.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i === 0 ? 6 : 3.5} fill="var(--accent)" />
          ))}
        </svg>
        {nodes.map((n, i) => {
          const [x, y] = pol(radius(n.ring), n.pos);
          const size = n.ring === 'outer' ? 42 : 36;
          const isLit = !!lit && lit.name === n.chord.name;
          return (
            <button
              key={i}
              type="button"
              className={s.node}
              data-kind={n.kind}
              data-in={fifths && inSec.has(n.chord.name)}
              data-lit={isLit || (!fifths && !!tri && tri.pcs.includes(n.pos))}
              style={{ left: x - size / 2, top: y - size / 2, width: size, height: size }}
              aria-label={`${n.label}${n.kind === 'out' ? ', fuera de la tonalidad' : n.role ? `, ${n.role}` : ''}. Tocá para escuchar.`}
              onClick={() => {
                if (fifths) {
                  hear(n.chord);
                  if (ui.circAdd && n.source) addChord(selSec, n.source);
                } else previewNote(60 + n.pos, a4);
              }}
            >
              <span>{n.label}</span>
              <span className={s.nodeSub}>{n.sub}</span>
            </button>
          );
        })}
        <span
          className={s.grot}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--muted)',
            width: 110,
          }}
        >
          {fifths ? `centro: ${chordOf({ d: 0 }, p.key).name}` : (tri && tri.name) || ''}
        </span>
      </div>
      <span style={{ fontSize: 13 }}>
        {model ? model.read : 'Cambiar la tónica gira la figura; cambiar el color la deforma.'}
      </span>
      <span className={s.small}>
        {fifths
          ? 'Afuera mayores, adentro sus relativos. Vecinos = suave; lejos = sorpresa.'
          : 'Las doce notas, de medio tono en medio tono.'}
      </span>
    </Win>
  );
}

const METER_OPTIONS = [
  { label: '4/4', groups: [2, 2, 2, 2], denom: 8 as const },
  { label: '3/4', groups: [2, 2, 2], denom: 8 as const },
  { label: '6/8', groups: [3, 3], denom: 8 as const },
  { label: '7/8', groups: [2, 2, 3], denom: 8 as const },
  { label: '5/4', groups: [2, 2, 2, 2, 2], denom: 8 as const },
];

export function Ritmo() {
  const { project: p, selSec, rules, risk } = useModel();
  const ui = useLienzoUi();
  const store = useLienzo();
  const v = clipOf(p, 'ritmo', selSec);
  const set = (fn: (c: LaneRhythm) => LaneRhythm, preset?: string) =>
    v &&
    store.updateVariant(v.id, (x) => ({
      config: fn((x as typeof v).config),
      ...(preset !== undefined ? { preset } : {}),
    }));
  const switchTo = (mode: LaneRhythm['mode']) => {
    const n = Math.round((rules.meter.groups.reduce((a, b) => a + b, 0) * 8) / rules.meter.denom);
    const make: Record<LaneRhythm['mode'], () => LaneRhythm> = {
      meter: () => ({ mode: 'meter', groups: [...rules.meter.groups], denom: rules.meter.denom }),
      euclid: () => ({ mode: 'euclid', pulses: 3, steps: n, rotation: 0 }),
      poly: () => ({ mode: 'poly', a: 3, b: 2 }),
      drum: () =>
        drumFromGroups(
          rules.meter.denom === 8 ? rules.meter.groups : rules.meter.groups.flatMap((g) => Array(g).fill(2)),
        ),
      mutante: () => ({
        mode: 'mutante',
        meters: [rules.meter, { groups: [2, 2, 2], denom: 8 }],
        barsEach: 2,
      }),
    };
    if (v) store.updateVariant(v.id, { config: make[mode]() });
    else putVariant(selSec, { kind: 'ritmo', name: nextName('ritmo'), config: make[mode]() });
  };
  const c = v?.config;
  const chk = c ? checkRhythm(c, rules.meter) : null;
  const users = v ? p.secs.filter((x) => !x.of && p.clips[`ritmo:${x.id}`] === v.id).length : 0;
  const names = ui.kit === 'objetos' ? OBJECT_KIT : Object.fromEntries(DRUMS.map((d) => [d.id, d.name]));
  const stepper = (
    label: string,
    value: number,
    dec: () => void,
    inc: () => void,
    extra?: React.ReactNode,
  ) => (
    <div className={s.stepper} key={label}>
      <span className={s.small}>{label}</span>
      <button type="button" aria-label={`Menos ${label.toLowerCase()}`} onClick={dec}>
        −
      </button>
      <span className={s.mono} style={{ textAlign: 'center' }}>
        {value}
      </span>
      <button type="button" aria-label={`Más ${label.toLowerCase()}`} onClick={inc}>
        +
      </button>
      {extra ?? <span />}
    </div>
  );
  const LEDE: Record<LaneRhythm['mode'], string> = {
    meter: 'El acento cae al empezar cada grupo. Tocá un grupo para alternarlo entre 2 y 3.',
    euclid: 'Los golpes repartidos lo más parejo posible.',
    poly: 'Dos pulsos que no coinciden.',
    drum: 'Paso por paso.',
    mutante: 'El compás cambia mientras tocás.',
  };
  return (
    <Win id="ritmo" title={`Ritmo · ${selSec.label}`}>
      <div role="group" aria-label="Modo" className={s.row}>
        {(
          [
            ['meter', 'Compás'],
            ['euclid', 'Euclidiano'],
            ['poly', 'Polirritmia'],
            ['drum', 'Batería'],
            ['mutante', 'Mutante'],
          ] as const
        ).map(([m, label]) => (
          <Opt key={m} on={c?.mode === m} onClick={() => switchTo(m)}>
            {label}
          </Opt>
        ))}
      </div>
      <span className={s.lede}>{c ? LEDE[c.mode] : 'Esta sección no tiene ritmo. Elegí un modo.'}</span>
      {c?.mode === 'meter' && (
        <>
          <div style={{ display: 'flex', gap: 3, height: 40 }}>
            {c.groups.map((g, i) => (
              <button
                key={i}
                type="button"
                className={s.groupCell}
                style={{ flex: `${g} 1 0` }}
                aria-label={`Grupo ${i + 1}: ${g}. Tocá para alternar.`}
                onClick={() =>
                  set((x) =>
                    x.mode === 'meter'
                      ? { ...x, groups: x.groups.map((y, j) => (j === i ? (y === 2 ? 3 : 2) : y)) }
                      : x,
                  )
                }
              >
                {g}
              </button>
            ))}
          </div>
          <span className={s.row}>
            <LinkBtn
              onClick={() => set((x) => (x.mode === 'meter' ? { ...x, groups: [...x.groups, 2] } : x))}
            >
              sumar 2
            </LinkBtn>
            <LinkBtn
              onClick={() => set((x) => (x.mode === 'meter' ? { ...x, groups: [...x.groups, 3] } : x))}
            >
              sumar 3
            </LinkBtn>
            <LinkBtn
              onClick={() =>
                set((x) =>
                  x.mode === 'meter' && x.groups.length > 1 ? { ...x, groups: x.groups.slice(0, -1) } : x,
                )
              }
            >
              sacar el último
            </LinkBtn>
          </span>
        </>
      )}
      {c?.mode === 'euclid' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <svg
            width="128"
            height="128"
            viewBox="0 0 128 128"
            role="img"
            aria-label={`${c.pulses} golpes en ${c.steps} pasos`}
          >
            <circle cx="64" cy="64" r="48" fill="none" stroke="currentColor" strokeOpacity="0.3" />
            {euclid(c.pulses, c.steps, c.rotation).map((hit, i) => {
              const a = (2 * Math.PI * i) / c.steps;
              return (
                <circle
                  key={i}
                  cx={64 + 48 * Math.sin(a)}
                  cy={64 - 48 * Math.cos(a)}
                  r={hit ? 7 : 3.5}
                  fill={hit ? 'currentColor' : 'var(--bg)'}
                  stroke="currentColor"
                />
              );
            })}
          </svg>
          <div className={s.stack}>
            {stepper(
              'Golpes',
              c.pulses,
              () => set((x) => (x.mode === 'euclid' ? { ...x, pulses: Math.max(1, x.pulses - 1) } : x)),
              () => set((x) => (x.mode === 'euclid' ? { ...x, pulses: Math.min(x.steps, x.pulses + 1) } : x)),
            )}
            {stepper(
              'Pasos',
              c.steps,
              () =>
                set((x) =>
                  x.mode === 'euclid' ? { ...x, steps: Math.max(x.pulses, x.steps - 1), rotation: 0 } : x,
                ),
              () =>
                set((x) =>
                  x.mode === 'euclid' ? { ...x, steps: Math.min(16, x.steps + 1), rotation: 0 } : x,
                ),
            )}
            {stepper(
              'Rotación',
              c.rotation,
              () =>
                set((x) =>
                  x.mode === 'euclid' ? { ...x, rotation: (x.rotation + x.steps - 1) % x.steps } : x,
                ),
              () => set((x) => (x.mode === 'euclid' ? { ...x, rotation: (x.rotation + 1) % x.steps } : x)),
            )}
          </div>
        </div>
      )}
      {c?.mode === 'poly' && (
        <div className={s.stack}>
          {(['a', 'b'] as const).map((k, i) =>
            stepper(
              i ? 'Voz baja' : 'Voz alta',
              c[k],
              () => set((x) => (x.mode === 'poly' ? { ...x, [k]: Math.max(2, x[k] - 1) } : x)),
              () => set((x) => (x.mode === 'poly' ? { ...x, [k]: Math.min(7, x[k] + 1) } : x)),
              <span style={{ marginLeft: 12, width: 160 }}>
                <Steps levels={Array.from({ length: c[k] }, (_, j) => (j === 0 ? 3 : 2))} height={14} />
              </span>,
            ),
          )}
        </div>
      )}
      {c?.mode === 'drum' && (
        <>
          <div className={s.row} style={{ fontSize: 12.5 }}>
            <span className={s.small}>Empezar de</span>
            {DRUM_PRESETS.map((pr) => (
              <Opt
                key={pr.id}
                on={v?.preset === pr.name}
                onClick={() => {
                  const { bpm: _b, ...rest } = pr.config as Extract<typeof pr.config, { mode: 'drum' }>;
                  set(() => rest as LaneRhythm, pr.name);
                }}
              >
                {pr.name}
              </Opt>
            ))}
          </div>
          <div className={s.stack} style={{ gap: 2 }}>
            {DRUMS.map((d, lane) => (
              <div
                key={d.id}
                style={{ display: 'grid', gridTemplateColumns: '70px minmax(0,1fr)', alignItems: 'center' }}
              >
                <span className={s.small}>{names[d.id]}</span>
                <span style={{ display: 'flex', gap: 2 }}>
                  {Array.from({ length: c.steps }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={s.drumCell}
                      data-beat={i % 4 === 0}
                      aria-pressed={!!c.tracks[lane]?.[i]}
                      aria-label={`${names[d.id]}, paso ${i + 1}`}
                      onClick={() =>
                        set((x) =>
                          x.mode === 'drum'
                            ? {
                                ...x,
                                tracks: x.tracks.map((t, l) =>
                                  l === lane ? t.map((on, j) => (j === i ? !on : on)) : t,
                                ),
                              }
                            : x,
                        )
                      }
                    />
                  ))}
                </span>
              </div>
            ))}
          </div>
          <span className={s.row} style={{ fontSize: 12.5 }}>
            <span className={s.small}>Sonidos</span>
            <Opt on={ui.kit === 'bateria'} onClick={() => ui.set({ kit: 'bateria' })}>
              batería
            </Opt>
            <Opt on={ui.kit === 'objetos'} onClick={() => ui.set({ kit: 'objetos' })}>
              objetos de la casa
            </Opt>
          </span>
          {ui.kit === 'objetos' && <span className={s.small}>Grabá lo que tengas a mano.</span>}
          <span className={s.row} style={{ fontSize: 12.5 }}>
            <span className={s.small}>Pasos</span>
            {[12, 14, 16, 20].map((n) => (
              <Opt
                key={n}
                on={c.steps === n}
                onClick={() =>
                  set((x) =>
                    x.mode === 'drum'
                      ? {
                          ...x,
                          steps: n,
                          tracks: x.tracks.map((t) => Array.from({ length: n }, (_, i) => !!t[i % x.steps])),
                        }
                      : x,
                  )
                }
              >
                {n}
              </Opt>
            ))}
          </span>
        </>
      )}
      {c?.mode === 'mutante' && (
        <div className={s.stack}>
          {[0, 1].map((idx) => (
            <div
              key={idx}
              style={{ display: 'grid', gridTemplateColumns: '74px minmax(0,1fr)', alignItems: 'baseline' }}
            >
              <span className={s.small}>{idx ? 'Después' : 'Primero'}</span>
              <div className={s.row}>
                {METER_OPTIONS.map((m) => (
                  <Opt
                    key={m.label}
                    on={c.meters[idx]?.groups.join() === m.groups.join()}
                    onClick={() =>
                      set((x) =>
                        x.mode === 'mutante'
                          ? {
                              ...x,
                              meters: x.meters.map((mm, j) =>
                                j === idx ? { groups: m.groups, denom: m.denom } : mm,
                              ),
                            }
                          : x,
                      )
                    }
                  >
                    {m.label}
                  </Opt>
                ))}
              </div>
            </div>
          ))}
          {stepper(
            'Cada',
            c.barsEach,
            () => set((x) => (x.mode === 'mutante' ? { ...x, barsEach: Math.max(1, x.barsEach - 1) } : x)),
            () => set((x) => (x.mode === 'mutante' ? { ...x, barsEach: Math.min(8, x.barsEach + 1) } : x)),
          )}
        </div>
      )}
      {c && (
        <div className={`${s.stack} ${s.rule}`}>
          <span className={s.small}>Así queda un compás</span>
          <Steps levels={rBar(c, 0)} height={30} />
          {chk && (
            <span className={chk.ok ? s.ok : s.bad} style={{ fontSize: 12.5 }}>
              {(chk.ok ? '✓ ' : '✗ ') + chk.why}
            </span>
          )}
          {ui.counter && (
            <>
              <span className={s.small}>Contraparte: toca donde la primera calla</span>
              <Steps levels={counterpart(rBar(c, 0))} height={30} accent />
              <span className={s.small}>Para una segunda guitarra o la mano izquierda.</span>
            </>
          )}
        </div>
      )}
      <span className={s.row}>
        <LinkBtn onClick={() => rollVariant('ritmo', selSec, rules, risk, c?.mode)}>
          sortear uno de este modo
        </LinkBtn>
        {c && (
          <LinkBtn onClick={() => ui.set({ counter: !ui.counter })}>
            {ui.counter ? 'ocultar la contraparte' : 'ver una contraparte'}
          </LinkBtn>
        )}
        {users > 1 && <span className={s.small}>Está en {users} secciones: cambia en todas.</span>}
      </span>
    </Win>
  );
}

export function Acordes() {
  const { project: p, selSec, guitar } = useModel();
  const h = clipOf(p, 'armonia', selSec);
  const unique = h
    ? [...new Map(h.chords.map((c) => [chordOf(c, p.key).name, chordOf(c, p.key)])).values()]
    : [];
  const notes = p.tuning.pcs
    .map((pc) => (pc === null ? '–' : ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'][pc]))
    .join(' ');
  return (
    <Win id="acordes" title={`Acordes · ${selSec.label}`}>
      <div className={s.diagrams} style={{ gap: 20 }}>
        {unique.map((c) => (
          <div key={c.name} className={s.diagram}>
            <span className={s.grot} style={{ fontSize: 15, fontWeight: 500 }}>
              {c.name}
            </span>
            <ChordDiagram chord={c} tuning={p.tuning.pcs} guitar={guitar} size={1} />
          </div>
        ))}
        {!unique.length && <span className={s.small}>Sin acordes en {selSec.label}.</span>}
      </div>
      <span className={s.small}>
        {guitar ? `Cuerdas de 6ª a 1ª: ${notes}.` : 'Una octava; las notas del acorde en color.'}
      </span>
    </Win>
  );
}
