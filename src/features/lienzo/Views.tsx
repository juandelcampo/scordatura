// Las otras vistas del proyecto: la Hoja (para tocar o imprimir), el Instrumento (afinación, diapasón,
// afinador y drone) y las Referencias (canciones analizadas y las tuyas).
import { useEffect, useState } from 'react';
import { previewChord } from '~/audio/lienzo';
import { rerollRow } from '~/core/consigna';
import { applyForm } from '~/core/lienzo/form';
import { barsOf, chordOf, degOfCh, refToMine, roleOf, segsOf, type ChordInfo } from '~/core/lienzo/harmony';
import { linesOf } from '~/core/lienzo/lyrics';
import { clipOf } from '~/core/lienzo/project';
import type { Tuning } from '~/core/lienzo/types';
import { chordMidis } from '~/core/lienzo/voicing';
import { MODES } from '~/core/harmony';
import { midiToNote, noteToMidi } from '~/core/notes';
import { openChordName, shiftString } from '~/core/tuning';
import { createRng, randomSeed } from '~/core/rng';
import { REF_TAGS, REFS, refFormToSections, refUrl, type Reference } from '~/data/refs';
import { GROUPS, TUNINGS } from '~/data/tunings';
import { useConsigna } from '~/shared/consigna';
import { useLienzo } from '~/shared/lienzo';
import { useLienzoUi } from '~/shared/lienzoUi';
import { useSettings } from '~/shared/settings';
import { useTuner } from '~/shared/useTuner';
import { newId } from '~/shared/lienzo';
import { putChords } from './actions';
import { ChordDiagram, LinkBtn, Opt, usePosition } from './bits';
import { keyLabel } from './Chrome';
import { chordsOverLyrics } from './Detail';
import { useModel } from './model';
import s from './lienzo.module.css';

const NN = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

// --- Hoja ----------------------------------------------------------------------------------

export function Hoja() {
  const { project: p, meter, guitar, number } = useModel();
  const follow = useLienzoUi((st) => st.follow);
  const pos = usePosition(8);
  let acc = 0;
  let nowSec: string | null = null;
  let nowT = 0;
  for (const sec of p.secs) {
    if (pos > 0 && pos < acc + sec.bars) {
      nowSec = sec.id;
      nowT = pos - acc;
      break;
    }
    acc += sec.bars;
  }
  useEffect(() => {
    if (follow && nowSec)
      document.getElementById(`hoja-${nowSec}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [nowSec, follow]);
  const seen = new Map<string, ChordInfo>();
  for (const sec of p.secs)
    for (const c of clipOf(p, 'armonia', sec)?.chords ?? [])
      seen.set(chordOf(c, p.key).name, chordOf(c, p.key));
  const counts: Record<string, number> = {};
  return (
    <div className={s.sheetWrap}>
      <article aria-label="Hoja de la canción" className={s.sheet}>
        <h1 className={s.grot} style={{ margin: 0, textAlign: 'center', fontWeight: 600, fontSize: 34 }}>
          {p.title || 'Tema sin nombre'}
        </h1>
        <p
          className={`${s.mono} ${s.small}`}
          style={{ margin: '6px 0 0', textAlign: 'center', fontSize: 12 }}
        >
          En {keyLabel(p.key.tonic, p.key.mode).toLowerCase()} · {guitar ? `${p.tuning.name} · ` : 'piano · '}
          {meter} · {p.bpm} bpm
        </p>
        <div className={s.diagrams} style={{ justifyContent: 'center', gap: 18, margin: '28px 0 36px' }}>
          {[...seen.values()].map((c) => (
            <div key={c.name} className={s.diagram}>
              <span className={s.grot} style={{ fontSize: 13, fontWeight: 600 }}>
                {c.name} <span className={`${s.mono} ${s.small}`}>{degOfCh(c, p.key.tonic)}</span>
              </span>
              <ChordDiagram chord={c} tuning={p.tuning.pcs} guitar={guitar} />
            </div>
          ))}
        </div>
        {p.secs.map((sec) => {
          counts[sec.label] = (counts[sec.label] ?? 0) + 1;
          const h = clipOf(p, 'armonia', sec);
          const chords = h ? barsOf(h.chords, sec.bars).map((c) => chordOf(c, p.key).name) : [];
          const text = clipOf(p, 'letra', sec)?.text ?? '';
          const lines = linesOf(text);
          const isNow = nowSec === sec.id;
          const cur =
            isNow && lines.length
              ? Math.min(lines.length - 1, Math.floor((nowT * lines.length) / sec.bars))
              : -1;
          const barTexts = h
            ? Array.from({ length: sec.bars }, (_, b) => {
                const names = segsOf(h.chords, sec.bars)
                  .filter((g) => g.t >= b - 1e-6 && g.t < b + 1 - 1e-6)
                  .map((g) => chordOf(g.c, p.key).name);
                return names.length ? names.join(' ') : '%';
              })
            : [];
          return (
            <section key={sec.id} id={`hoja-${sec.id}`} className={s.sheetSec}>
              <div className={s.sheetLabel} data-now={isNow}>
                {sec.label}
                {counts[sec.label]! > 1 ? ` ${counts[sec.label]}` : ''}
              </div>
              <div className={s.stack} style={{ gap: 8 }}>
                {lines.length > 0 &&
                  chordsOverLyrics(text, chords).map((segs, j) => (
                    <div key={j} className={s.sheetLine} data-now={cur === j}>
                      {segs.map((sg, k) => (
                        <span key={k} className={s.seg}>
                          <span className={s.segChord} style={{ fontSize: 13, minHeight: 17 }}>
                            {sg.c}
                          </span>
                          <span style={{ fontSize: 16, lineHeight: 1.35 }}>{sg.w}</span>
                        </span>
                      ))}
                    </div>
                  ))}
                {!lines.length &&
                  barTexts.length > 0 &&
                  Array.from({ length: Math.ceil(barTexts.length / 4) }, (_, r) => (
                    <div key={r} className={s.barsRow}>
                      {barTexts.slice(r * 4, r * 4 + 4).map((t, i) => (
                        <span key={i}>{t}</span>
                      ))}
                    </div>
                  ))}
                {!h && !lines.length && <span className={s.small}>Sin acordes todavía.</span>}
              </div>
            </section>
          );
        })}
        <p className={s.small} style={{ margin: '40px 0 0', textAlign: 'center', fontSize: 11 }}>
          Escrita con la consigna nº {number} de Scordatura.
        </p>
      </article>
    </div>
  );
}

// --- Instrumento ---------------------------------------------------------------------------

const toTuning = (name: string, notes: string[]): Tuning => ({
  name,
  notes,
  pcs: notes.map((n) => noteToMidi(n) % 12),
});
const OPEN_G_FIVE: Tuning = {
  name: 'Open G · 5 cuerdas',
  notes: [null, 'G2', 'D3', 'G3', 'B3', 'D4'],
  pcs: [null, 7, 2, 7, 11, 2],
};

function Tuner({ tuning }: { tuning: Tuning }) {
  const a4 = useSettings((st) => st.a4);
  const mode = useSettings((st) => st.tunerMode);
  const strings = tuning.notes?.map((n) => n ?? 'G2') ?? tuning.pcs.map((pc) => midiToNote(48 + (pc ?? 0)));
  const tuner = useTuner(strings, a4, mode);
  const cents = tuner.reading?.cents ?? 0;
  const inTune = !!tuner.reading && Math.abs(cents) < 3;
  return (
    <div className={s.stack} style={{ gap: 10, alignItems: 'flex-start' }}>
      <span className={s.small}>Afinador</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
        <div className={s.needleBox}>
          <div
            style={{ position: 'absolute', left: 89, top: 0, width: 2, height: 10, background: 'var(--ink)' }}
          />
          <div
            className={s.needle}
            style={{
              background: inTune ? 'var(--lock)' : 'var(--accent)',
              transform: `rotate(${Math.max(-50, Math.min(50, cents)) * 1.2}deg)`,
              opacity: tuner.reading ? 1 : 0.3,
            }}
          />
        </div>
        <div className={s.stack}>
          <span className={s.grot} style={{ fontSize: 30, fontWeight: 500, lineHeight: 1 }}>
            {tuning.pcs[tuner.selected] === null ? '–' : NN[tuning.pcs[tuner.selected]!]}{' '}
            <span className={`${s.mono} ${inTune ? s.ok : s.bad}`} style={{ fontSize: 12.5 }}>
              {!tuner.reading
                ? tuner.active
                  ? 'escuchando'
                  : ''
                : inTune
                  ? 'afinada'
                  : cents < 0
                    ? `baja ${Math.round(-cents)}`
                    : `alta ${Math.round(cents)}`}
            </span>
          </span>
          <div role="group" aria-label="Cuerda" style={{ display: 'flex', border: '1px solid var(--ink)' }}>
            {tuning.pcs.map((pc, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={tuner.selected === i}
                aria-label={`Cuerda ${6 - i}ª${pc === null ? ', sacada' : `, ${NN[pc]}`}`}
                disabled={pc === null}
                onClick={() => tuner.selectString(i)}
                style={{
                  width: 34,
                  height: 34,
                  border: 'none',
                  borderLeft: i ? '1px solid var(--ink)' : 'none',
                  background: tuner.selected === i ? 'var(--ink)' : 'transparent',
                  color: tuner.selected === i ? 'var(--bg)' : 'var(--ink)',
                  fontFamily: 'var(--mono)',
                  fontSize: 12,
                }}
              >
                {pc === null ? '–' : NN[pc]}
                {tuner.tuned[i] ? '✓' : ''}
              </button>
            ))}
          </div>
          <LinkBtn onClick={() => void tuner.toggle()}>
            {tuner.active ? 'dejar de escuchar' : 'escuchar'}
          </LinkBtn>
        </div>
      </div>
      {tuner.message && <span className={s.small}>{tuner.message}</span>}
    </div>
  );
}

export function Instrumento() {
  const { project: p, rows, consigna, parts, guitar } = useModel();
  const store = useLienzo();
  const change = useConsigna((st) => st.change);
  const tp = p.tuning.pcs;
  const scale = MODES[p.key.mode].steps.map((x) => (x + p.key.tonic) % 12);
  const setTuning = (t: Tuning) => store.update(() => ({ tuning: t }));
  const sugNotes = parts.tuning.notes;
  const suggested = TUNINGS.find((t) => t.notes.join() === sugNotes.join());
  const sameAsSuggested = p.tuning.notes?.join() === sugNotes.join();
  const notes = p.tuning.notes?.filter((n): n is string => !!n);
  const story =
    notes && notes.length === 6
      ? `Al aire suena ${openChordName(notes)}.`
      : 'Sin la sexta: la nota más grave es el sol. Riffs con dos dedos.';
  const twist = () => {
    const base = p.tuning.notes;
    if (!base || base.some((n) => !n)) return;
    const r = createRng(randomSeed());
    const next = shiftString(base as string[], r.int(0, 5), r.pick([-2, -1, 1, 2]));
    setTuning(toTuning(`Tuya · ${next.map((n) => n.replace(/\d/, '')).join('')}`, next));
  };
  const detect = (set: Set<number>) => {
    for (const r of set) {
      if (set.has((r + 4) % 12) && set.has((r + 7) % 12)) return { r, q: 'M' as const };
      if (set.has((r + 3) % 12) && set.has((r + 7) % 12)) return { r, q: 'm' as const };
    }
    return null;
  };
  const sounding = tp.filter((x): x is number => x !== null);
  return (
    <div className={s.two}>
      <div>
        <div className={s.stack}>
          <span className={s.small}>Componés en</span>
          <div className={s.row}>
            {(['guitarra', 'piano'] as const).map((i) => (
              <Opt key={i} on={p.instrument === i} onClick={() => store.update(() => ({ instrument: i }))}>
                <span className={s.grot} style={{ fontSize: 20, fontWeight: 500 }}>
                  {i === 'guitarra' ? 'Guitarra' : 'Piano'}
                </span>
              </Opt>
            ))}
          </div>
        </div>
        {guitar && (
          <div className={s.stack} style={{ gap: 8 }}>
            <span className={s.small}>Afinación</span>
            <span className={s.grot} style={{ fontSize: 30, fontWeight: 500, lineHeight: 1 }}>
              {p.tuning.name}
            </span>
            <span className={s.mono} style={{ fontSize: 15, letterSpacing: '0.08em' }}>
              {tp.map((x) => (x === null ? '–' : NN[x])).join(' ')}
            </span>
            <span className={s.lede}>{story}</span>
            <div
              className={`${s.row} ${s.rule}`}
              style={{ borderBottom: '1px solid var(--faint)', paddingBottom: 10 }}
            >
              <span className={s.small}>
                {sameAsSuggested
                  ? 'Es la que sugiere la consigna.'
                  : `La consigna sugiere ${rows.afinacion.label}.`}
              </span>
              {!sameAsSuggested && (
                <LinkBtn
                  onClick={() => setTuning(toTuning(suggested?.name ?? rows.afinacion.label, sugNotes))}
                >
                  usarla
                </LinkBtn>
              )}
              <LinkBtn onClick={() => change(rerollRow(consigna, rows.afinacion.index))}>
                que sugiera otra
              </LinkBtn>
            </div>
          </div>
        )}
        {guitar && (
          <div className={s.stack}>
            <span className={s.small}>Otras afinaciones · {TUNINGS.length + 1}</span>
            {GROUPS.map((g) => {
              const items = TUNINGS.filter((t) => t.group === g.id);
              if (!items.length) return null;
              return (
                <div
                  key={g.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '110px minmax(0,1fr)',
                    gap: 8,
                    alignItems: 'baseline',
                  }}
                >
                  <span className={s.small}>{g.name}</span>
                  <div className={s.row}>
                    {items.map((t) => (
                      <Opt
                        key={t.id}
                        on={p.tuning.name === t.name}
                        onClick={() => setTuning(toTuning(t.name, t.notes))}
                      >
                        {t.name}
                      </Opt>
                    ))}
                    {g.id === 'mayores' && (
                      <Opt on={p.tuning.name === OPEN_G_FIVE.name} onClick={() => setTuning(OPEN_G_FIVE)}>
                        {OPEN_G_FIVE.name}
                      </Opt>
                    )}
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              className={s.box}
              style={{ alignSelf: 'flex-start', borderStyle: 'dashed', marginTop: 6 }}
              onClick={twist}
            >
              Girar una clavija al azar
            </button>
            <span className={s.small}>Girá clavijas hasta que algo suene.</span>
          </div>
        )}
        <div className={s.stack}>
          <span className={s.small}>Drone</span>
          <div className={s.row}>
            {(
              [
                ['tonica', 'Tónica'],
                ['quinta', 'Quinta'],
                ['', 'Apagado'],
              ] as const
            ).map(([d, label]) => (
              <Opt key={label} on={p.drone === d} onClick={() => store.update(() => ({ drone: d }))}>
                {label}
              </Opt>
            ))}
          </div>
          <span className={s.small}>Suena mientras reproducís el tema.</span>
        </div>
      </div>
      <div>
        <div className={s.stack} style={{ gap: 8 }}>
          <span className={s.small}>
            Las notas de {keyLabel(p.key.tonic, p.key.mode).toLowerCase()}
            {guitar ? ` en ${p.tuning.name}, 1ª cuerda arriba` : ' en el teclado'}
          </span>
          {guitar ? (
            <div role="img" aria-label="Diapasón con la escala" className={s.neck}>
              {[...tp].reverse().map((open, ri) => (
                <div key={ri} className={s.neckRow}>
                  {Array.from({ length: 13 }, (_, f) => {
                    const pc = open === null ? -1 : (open + f) % 12;
                    return (
                      <span key={f} className={s.fret} data-tonic={pc === p.key.tonic}>
                        {open === null ? (f === 0 ? '×' : '') : scale.includes(pc) ? NN[pc] : ''}
                      </span>
                    );
                  })}
                </div>
              ))}
              <div
                style={{ display: 'grid', gridTemplateColumns: 'repeat(13, minmax(0,1fr))', paddingTop: 4 }}
                className={`${s.mono} ${s.small}`}
              >
                {Array.from({ length: 13 }, (_, f) => (
                  <span key={f} style={{ textAlign: 'center' }}>
                    {f === 0 ? '' : [3, 5, 7, 9, 12].includes(f) ? f : '·'}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <svg
              width="420"
              height="110"
              viewBox="0 0 196 54"
              role="img"
              aria-label="Teclado con la escala"
              style={{ maxWidth: '100%' }}
            >
              {[0, 1].flatMap((o) =>
                [0, 2, 4, 5, 7, 9, 11].map((pc, i) => (
                  <rect
                    key={`w${o}${pc}`}
                    x={1 + (o * 7 + i) * 14}
                    y={1}
                    width={14}
                    height={52}
                    stroke="#141413"
                    strokeWidth="0.8"
                    fill={pc === p.key.tonic ? '#C2551F' : scale.includes(pc) ? '#E9C9B8' : '#F5F3EE'}
                  />
                )),
              )}
              {[0, 1].flatMap((o) =>
                (
                  [
                    [1, 10],
                    [3, 24],
                    [6, 52],
                    [8, 66],
                    [10, 80],
                  ] as const
                ).map(([pc, x]) => (
                  <rect
                    key={`b${o}${pc}`}
                    x={x + o * 98}
                    y={1}
                    width={9}
                    height={32}
                    stroke="#141413"
                    strokeWidth="0.8"
                    fill={pc === p.key.tonic ? '#C2551F' : scale.includes(pc) ? '#8F6A58' : '#141413'}
                  />
                )),
              )}
            </svg>
          )}
          <span className={s.small}>Tónica en color.</span>
        </div>
        {guitar && (
          <div className={s.stack}>
            <span className={s.small}>Con un solo dedo, cejilla en todas las cuerdas</span>
            <div className={s.oneFinger}>
              {[0, 2, 3, 5, 7, 9].map((f) => {
                const set = new Set(sounding.map((x) => (x + f) % 12));
                const found = detect(set);
                const bass = ((sounding[0] ?? 0) + f) % 12;
                const info = found
                  ? chordOf({ r: (found.r - p.key.tonic + 12) % 12, q: found.q }, p.key)
                  : null;
                const fam = info
                  ? [0, 1, 2, 3, 4, 5, 6].find((d) => chordOf({ d }, p.key).name === info.name)
                  : undefined;
                return (
                  <div key={f}>
                    <span className={`${s.mono} ${s.small}`}>{f === 0 ? 'al aire' : `traste ${f}`}</span>
                    <span className={s.grot} style={{ fontWeight: 600, fontSize: 15 }}>
                      {info
                        ? info.name + (info.root !== bass ? `/${NN[bass]}` : '')
                        : [...set].map((x) => NN[x]).join(' ')}
                    </span>
                    <span className={s.grot} style={{ fontSize: 11 }}>
                      {info
                        ? fam !== undefined
                          ? roleOf({ d: fam }, p.key)
                          : 'fuera de la tonalidad'
                        : 'sin tercera'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {guitar && <Tuner tuning={p.tuning} />}
      </div>
    </div>
  );
}

// --- Referencias ---------------------------------------------------------------------------

interface MineRef extends Reference {
  mine: true;
  note: string;
}

export function Referencias() {
  const { project: p, selSec } = useModel();
  const ui = useLienzoUi();
  const store = useLienzo();
  const a4 = useSettings((st) => st.a4);
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [msg, setMsg] = useState('');
  const mine: MineRef[] = p.myRefs.map((r) => ({
    id: r.id,
    title: r.title,
    by: 'Tuya',
    query: r.title,
    url: r.url,
    tonic: null,
    keyName: '',
    meter: '',
    feel: '',
    form: [],
    progs: [],
    look: [],
    tags: [],
    mine: true,
    note: r.note,
  }));
  const all: Array<Reference | MineRef> = [...REFS, ...mine];
  const shown = all.filter(
    (r) =>
      ui.refTag === 'Todo' || (ui.refTag === 'Tuyas' ? 'mine' in r : r.tags.includes(ui.refTag as never)),
  );
  const r = all.find((x) => x.id === ui.refSel) ?? all[0]!;
  const degs = (x: Reference) =>
    x.progs[0]
      ? x.progs[0].ch
          .map(([semi, q]) => degOfCh(chordOf({ r: semi, q }, { tonic: 0, mode: 'ionian' }), 0))
          .join(' ')
      : x.form.length
        ? `${x.form.length} partes`
        : '';
  const refChord = (semi: number, q: Parameters<typeof refToMine>[1]) =>
    chordOf({ r: semi, q }, { tonic: r.tonic ?? 0, mode: 'ionian' });
  return (
    <div className={s.refs}>
      <aside aria-label="Referencias" className={s.refList}>
        <div
          role="group"
          aria-label="Filtrar"
          className={s.row}
          style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--faint)', gap: '2px 12px' }}
        >
          {['Todo', ...REF_TAGS, 'Tuyas'].map((t) => (
            <Opt key={t} small on={ui.refTag === t} onClick={() => ui.set({ refTag: t })}>
              {t}
            </Opt>
          ))}
        </div>
        {shown.map((x) => (
          <button
            key={x.id}
            type="button"
            className={s.refItem}
            aria-pressed={x.id === r.id}
            onClick={() => (ui.set({ refSel: x.id }), setMsg(''))}
          >
            <span style={{ fontSize: 14, fontWeight: 500 }}>{x.title}</span>
            <span className={s.small} style={{ fontSize: 12 }}>
              {x.by}
            </span>
            <span className={`${s.mono} ${s.small}`} style={{ fontSize: 11 }}>
              {degs(x)}
            </span>
          </button>
        ))}
        <div
          className={s.stack}
          style={{ padding: '14px 20px 18px', borderTop: '1px solid var(--faint)', marginTop: 'auto' }}
        >
          <span className={s.small}>Sumar una tuya</span>
          <input
            className={s.input}
            placeholder="Canción · artista"
            aria-label="Canción y artista"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className={s.input}
            placeholder="Link de YouTube (opcional)"
            aria-label="Link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <LinkBtn
            onClick={() => {
              if (!title.trim()) return;
              const id = newId('u');
              store.update((pp) => ({
                myRefs: [
                  ...pp.myRefs,
                  {
                    id,
                    title: title.trim(),
                    url: /^https?:\/\//.test(link.trim()) ? link.trim() : '',
                    note: '',
                  },
                ],
              }));
              ui.set({ refSel: id });
              setTitle('');
              setLink('');
            }}
          >
            sumar
          </LinkBtn>
        </div>
      </aside>
      <div className={s.refBody}>
        <div className={s.stack} style={{ gap: 4 }}>
          <span className={s.grot} style={{ fontWeight: 600, fontSize: 30, lineHeight: 1.1 }}>
            {r.title}
          </span>
          <span className={s.small} style={{ fontSize: 14 }}>
            {r.by}
          </span>
          {!('mine' in r) && (
            <div className={`${s.row} ${s.mono}`} style={{ fontSize: 12.5, marginTop: 8 }}>
              <span>
                <span className={s.small}>tonalidad </span>
                {r.keyName}
              </span>
              <span>
                <span className={s.small}>compás </span>
                {r.meter}
              </span>
              <span>
                <span className={s.small}>tempo </span>
                {r.feel}
              </span>
            </div>
          )}
          <a
            href={refUrl(r)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginTop: 10, fontSize: 13 }}
          >
            escuchar en YouTube ↗
          </a>
        </div>
        {r.form.length > 0 && (
          <div className={s.stack}>
            <span className={s.small}>Forma (aprox.)</span>
            <div className={s.row} style={{ gap: 3 }}>
              {r.form.map((t, i) => (
                <span
                  key={i}
                  className={s.formBlock}
                  data-k={/Estribillo|^B$/.test(t) ? 'dark' : /Verso|Estrofa|^A$/.test(t) ? 'mid' : ''}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
        {r.progs.map((pg) => (
          <div key={pg.label} className={s.stack}>
            <span className={s.row} style={{ fontSize: 11.5 }}>
              <span className={s.small}>{pg.label}</span>
              <LinkBtn
                onClick={() => {
                  const bar = 1.5;
                  let t = 0;
                  for (const [semi, q, len = 1] of pg.ch) {
                    previewChord(chordMidis(refChord(semi, q), null), a4, t);
                    t += len * bar;
                  }
                }}
              >
                escuchar
              </LinkBtn>
              <LinkBtn
                onClick={() => {
                  const chords = pg.ch.map(([semi, q, len = 1]) => refToMine(semi, q, len, p.key));
                  putChords(selSec, chords, `De ${r.title}`);
                  setMsg(
                    `Puesta en ${selSec.label}, en tu tonalidad: ${chords.map((c) => chordOf(c, p.key).name).join(' ')}.`,
                  );
                }}
              >
                probar en {selSec.label}
              </LinkBtn>
            </span>
            <div className={s.row} style={{ gap: 3 }}>
              {pg.ch.map(([semi, q, len = 1], i) => {
                const ch = refChord(semi, q);
                return (
                  <span key={i} className={s.chordChip} style={{ minWidth: 40 * len }}>
                    <span className={s.grot} style={{ fontWeight: 600, fontSize: 15 }}>
                      {r.tonic === null ? degOfCh(ch, 0) : ch.name}
                    </span>
                    <span className={`${s.mono} ${s.small}`} style={{ fontSize: 11 }}>
                      {degOfCh(ch, r.tonic ?? 0)}
                      {len !== 1 ? ` · ${len === 0.5 ? '½' : len}` : ''}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        ))}
        {r.look.length > 0 && (
          <div className={s.stack} style={{ gap: 4, maxWidth: 620 }}>
            <span className={s.small}>Qué escuchar</span>
            {r.look.map((t) => (
              <span key={t} style={{ fontSize: 14 }}>
                · {t}
              </span>
            ))}
          </div>
        )}
        <div className={s.row}>
          {r.tags.map((t) => (
            <button
              key={t}
              type="button"
              className={s.box}
              style={{ borderColor: 'var(--faint)', color: 'var(--muted)', fontSize: 12, padding: '2px 8px' }}
              onClick={() => ui.set({ refTag: t })}
            >
              {t}
            </button>
          ))}
          {r.form.length > 0 && (
            <LinkBtn
              onClick={() => {
                const { labels, energies } = refFormToSections(r.form);
                store.setSecs(applyForm(p.secs, labels, energies));
                ui.set({ view: 'lienzo' });
              }}
            >
              usar su forma en tu canción
            </LinkBtn>
          )}
        </div>
        {'mine' in r && (
          <label className={s.stack} style={{ maxWidth: 620 }}>
            <span className={s.small}>Qué te gusta, qué querés robar</span>
            <textarea
              className={s.input}
              style={{ height: 110, fontSize: 14, lineHeight: 1.5 }}
              value={(r as MineRef).note}
              onChange={(e) =>
                store.update((pp) => ({
                  myRefs: pp.myRefs.map((x) => (x.id === r.id ? { ...x, note: e.target.value } : x)),
                }))
              }
            />
          </label>
        )}
        {msg && (
          <span className={s.ok} style={{ fontSize: 12.5 }}>
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}
