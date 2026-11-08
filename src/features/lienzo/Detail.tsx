// El panel de abajo: la variante elegida, contra la consigna, el contraste con su pareja y las
// herramientas del carril (diagramas y tensión, editor de melodía, un compás de ritmo, la letra).
import { useEffect, useRef, useState } from 'react';
import { startRecording, type Recording } from '~/audio/recorder';
import { contrast, partnerOf } from '~/core/lienzo/form';
import {
  barsOf,
  chordOf,
  closesHome,
  cycleLen,
  degName,
  harmonicRhythmRead,
  HR_PRESETS,
  keyFor,
  roleOf,
  segsOf,
  story,
  tensionOf,
} from '~/core/lienzo/harmony';
import { linesOf, stability } from '~/core/lienzo/lyrics';
import { clipOf, totalBars, variantById } from '~/core/lienzo/project';
import { rBar } from '~/core/lienzo/rhythm';
import { LANES, type Chord, type Section, type VariantOf } from '~/core/lienzo/types';
import { currentConsigna } from '~/shared/consigna';
import { addEntry } from '~/shared/journal';
import { useLienzo } from '~/shared/lienzo';
import { useLienzoUi } from '~/shared/lienzoUi';
import { addTake, editChords, harmonicPreset, rollVariant, unlink } from './actions';
import { ChordDiagram, fmtLen, LinkBtn, Opt, Steps, usePosition } from './bits';
import { rhythmName } from './Canvas';
import { checkCell } from './checks';
import { MelodyEditor } from './MelodyEditor';
import { useModel } from './model';
import s from './lienzo.module.css';

/** Los versos con los acordes encima, repartidos por palabras. */
export function chordsOverLyrics(text: string, chords: string[]) {
  const lines = linesOf(text);
  return lines.map((line, j) => {
    const a = Math.floor((j * chords.length) / lines.length);
    const b = Math.max(a + 1, Math.floor(((j + 1) * chords.length) / lines.length));
    const cs = chords.slice(a, b).filter((c, i, all) => i === 0 || c !== all[i - 1]);
    const words = line.split(' ');
    if (!cs.length) return [{ c: '', w: line }];
    return cs.map((c, i) => ({
      c,
      w:
        words
          .slice(Math.floor((i * words.length) / cs.length), Math.floor(((i + 1) * words.length) / cs.length))
          .join(' ') || ' ',
    }));
  });
}

function nowIn(pos: number, secs: readonly Section[], sec: Section) {
  let acc = 0;
  for (const x of secs) {
    if (pos < acc + x.bars) return x.id === sec.id || x.of === sec.id ? pos - acc : null;
    acc += x.bars;
  }
  return null;
}

function Recorder({ walking }: { walking: boolean }) {
  const { project } = useModel();
  const store = useLienzo();
  const [rec, setRec] = useState<Recording | null>(null);
  const [msg, setMsg] = useState('');
  const started = useRef(0);
  useEffect(() => () => rec?.cancel(), [rec]);
  const total = totalBars(project.secs);
  const toggle = async () => {
    if (rec) {
      const blob = await rec.stop();
      setRec(null);
      const { code, number } = currentConsigna();
      const seconds = Math.round((Date.now() - started.current) / 1000);
      const name = `${walking ? 'Caminando' : 'Toma'} ${project.takes.length + 1}`;
      await addEntry({
        kind: 'audio',
        blob,
        name: `${project.title || 'Canción'} · ${name}`,
        note: '',
        consignaCode: code,
        consignaNumber: number,
        section: null,
      });
      addTake({
        name,
        start: 1,
        len: Math.min(total, 4),
        about: `${walking ? 'A paso de caminata, ' : ''}${seconds} s. En el Diario.`,
      });
      setMsg('Guardada en el Diario.');
      return;
    }
    if (walking) store.setBpm(108);
    const r = await startRecording();
    if (typeof r === 'string') {
      setMsg('No se pudo usar el micrófono.');
      return;
    }
    started.current = Date.now();
    setRec(r);
    setMsg('');
  };
  return (
    <>
      <LinkBtn onClick={toggle}>
        {rec ? 'parar y guardar' : walking ? 'grabar caminando' : 'grabar una toma'}
      </LinkBtn>
      {msg && <span className={s.small}>{msg}</span>}
    </>
  );
}

function TakeDetail() {
  const { project } = useModel();
  const ui = useLienzoUi();
  const store = useLienzo();
  const tk = project.takes.find((x) => x.id === ui.sel.take);
  const wear = ['limpia', 'pisada', 'rayada', 'amp roto'];
  const total = totalBars(project.secs);
  return (
    <div className={s.detailBody}>
      <div className={s.pane} style={{ width: 340 }}>
        <span className={s.small}>Toma</span>
        <span className={s.big}>{tk?.name ?? 'Nueva'}</span>
        {tk && (
          <span className={s.small}>
            {tk.about} Compases {tk.start}–{tk.start + tk.len - 1}.
            {tk.wear ? ` Gastada: ${wear[tk.wear]}.` : ''}
          </span>
        )}
        <div className={s.row} style={{ marginTop: 'auto' }}>
          <Recorder walking={false} />
          <Recorder walking />
        </div>
        {tk && (
          <div className={s.row}>
            <LinkBtn
              onClick={() =>
                addTake({
                  name: `${tk.name} · loop`,
                  start: Math.min(total - 1, tk.start + tk.len),
                  len: 2,
                  loop: true,
                  wear: 1,
                  about: `Dos compases de ${tk.name}, en loop.`,
                  ...(tk.journalId ? { journalId: tk.journalId } : {}),
                })
              }
            >
              samplear 2 compases
            </LinkBtn>
            <LinkBtn
              onClick={() =>
                store.update((p) => ({
                  takes: p.takes.map((x) =>
                    x.id === tk.id ? { ...x, wear: (((x.wear ?? 0) + 1) % 4) as 0 | 1 | 2 | 3 } : x,
                  ),
                }))
              }
            >
              gastarla · {wear[((tk.wear ?? 0) + 1) % 4]}
            </LinkBtn>
          </div>
        )}
      </div>
      <div className={s.pane} style={{ width: 240 }}>
        <span className={s.small}>Contra la consigna</span>
        <span className={s.small}>Las tomas no se comparan.</span>
      </div>
    </div>
  );
}

function Harmony({ h, sec, nowT }: { h: VariantOf<'armonia'>; sec: Section; nowT: number | null }) {
  const { project: p, guitar } = useModel();
  const ui = useLienzoUi();
  const unique = [
    ...new Map(barsOf(h.chords, sec.bars).map((c) => [chordOf(c, p.key).name, chordOf(c, p.key)])).values(),
  ];
  const segs = segsOf(h.chords, sec.bars);
  const current = nowT === null ? null : segs.find((g) => nowT >= g.t && nowT < g.t + g.len);
  const tensions = barsOf(h.chords, sec.bars).map((c) => tensionOf(c, p.key));
  const peak = tensions.indexOf(Math.max(...tensions));
  const last = tensions[tensions.length - 1] ?? 0;
  return (
    <>
      <div className={s.pane}>
        <span className={s.small} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span>{guitar ? `En ${p.tuning.name}` : 'En piano'}</span>
          <LinkBtn onClick={() => ui.openWin('acordes')}>ampliar ↗</LinkBtn>
        </span>
        <div className={s.diagrams}>
          {unique.map((c) => (
            <div
              key={c.name}
              className={s.diagram}
              data-now={!!current && chordOf(current.c, p.key).name === c.name}
            >
              <span className={s.grot} style={{ fontSize: 13, fontWeight: 500 }}>
                {c.name}
              </span>
              <ChordDiagram chord={c} tuning={p.tuning.pcs} guitar={guitar} />
            </div>
          ))}
        </div>
        <span className={s.small} style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span>Tensión</span>
          <LinkBtn onClick={() => ui.openWin('circulo')}>círculo ↗</LinkBtn>
        </span>
        <div className={s.tension}>
          {segs.map((g, i) => {
            const t = tensionOf(g.c, p.key);
            const isNow = current === g;
            return (
              <span
                key={i}
                title={`${chordOf(g.c, p.key).name}: ${roleOf(g.c, p.key)}`}
                style={{
                  flex: `${g.len} 1 0`,
                  minWidth: 4,
                  height: 5 + t * 7,
                  background: isNow ? 'var(--accent)' : t >= 3 ? 'var(--ink)' : 'var(--muted)',
                  opacity: isNow ? 1 : 0.35 + t * 0.15,
                }}
              />
            );
          })}
        </div>
        <span className={s.small}>
          Pico en el compás {peak + 1}.{' '}
          {last === 0 ? 'Cierra en casa.' : last >= 3 ? 'Termina arriba.' : 'Queda abierta.'}
        </span>
      </div>
      <div className={s.pane} style={{ width: 280 }}>
        <span className={s.small}>Ritmo armónico</span>
        <div className={s.row} style={{ gap: 4 }}>
          {h.chords.map((c, i) => {
            const len = c.len ?? 1;
            const name = chordOf(c, p.key).name;
            return (
              <button
                key={i}
                type="button"
                className={s.hrChip}
                data-long={len >= 2}
                style={{ width: 30 + len * 24 }}
                aria-label={`${name} dura ${len} compases. Tocá para cambiar.`}
                onClick={() => editChords(sec, (cs) => cs.map((x, j) => (j === i ? cycleLen(x) : x)))}
              >
                <span className={s.grot} style={{ fontWeight: 600, fontSize: 13 }}>
                  {name}
                </span>
                <span className={`${s.mono} ${s.small}`} style={{ fontSize: 10.5 }}>
                  {degName(c, p.key)} · {fmtLen(len)}
                </span>
              </button>
            );
          })}
        </div>
        <div className={s.row}>
          {HR_PRESETS.map((o) => (
            <LinkBtn key={o.id} onClick={() => harmonicPreset(sec, o.id)}>
              {o.label}
            </LinkBtn>
          ))}
        </div>
        <span className={s.small}>{harmonicRhythmRead(h.chords, sec.bars)}</span>
      </div>
    </>
  );
}

function Lyric({ v, sec, nowT }: { v: VariantOf<'letra'>; sec: Section; nowT: number | null }) {
  const { project: p } = useModel();
  const ui = useLienzoUi();
  const store = useLienzo();
  const h = clipOf(p, 'armonia', sec);
  const chords = h ? barsOf(h.chords, sec.bars).map((c) => chordOf(c, p.key).name) : [];
  const lines = linesOf(v.text);
  const stab = stability(lines);
  const current =
    nowT === null || !lines.length
      ? -1
      : Math.min(lines.length - 1, Math.floor((nowT * lines.length) / sec.bars));
  const home = h ? closesHome(h.chords, p.key) : null;
  const prosody =
    stab.stable === null || home === null
      ? ''
      : stab.stable === home
        ? `Letra y armonía ${home ? 'cierran' : 'quedan abiertas'} juntas.`
        : stab.stable
          ? 'La letra cierra; la armonía queda abierta.'
          : 'La armonía cierra; la letra queda abierta.';
  const phrase = sec.phrase ?? 'front';
  return (
    <>
      <div className={s.pane} style={{ width: 420 }}>
        <span className={s.small} style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Con sus acordes</span>
          <LinkBtn onClick={() => (ui.set({ lyricInst: v.id, lyricMode: 'write' }), ui.openWin('letra'))}>
            escribir ↗
          </LinkBtn>
        </span>
        {chordsOverLyrics(v.text, chords).map((segs, j) => (
          <div key={j} className={s.sheetLine} data-now={current === j}>
            {segs.map((sg, k) => (
              <span key={k} className={s.seg}>
                <span className={s.segChord}>{sg.c}</span>
                <span style={{ fontSize: 14 }}>{sg.w}</span>
              </span>
            ))}
          </div>
        ))}
        {!lines.length && <span className={s.small}>Vacía.</span>}
      </div>
      <div className={s.pane} style={{ width: 320 }}>
        <span className={s.small}>Cómo se siente</span>
        <span className={s.lede}>{stab.label}</span>
        <span style={{ fontSize: 12.5 }}>{stab.why}</span>
        <span className={s.small}>{prosody}</span>
        <span className={s.row} style={{ fontSize: 12.5 }}>
          <span className={s.small}>Las frases arrancan</span>
          <Opt on={phrase === 'front'} onClick={() => store.patchSection(sec.id, { phrase: 'front' })}>
            en el uno
          </Opt>
          <Opt on={phrase === 'back'} onClick={() => store.patchSection(sec.id, { phrase: 'back' })}>
            después del uno
          </Opt>
        </span>
      </div>
    </>
  );
}

export function Detail() {
  const model = useModel();
  const { project: p, rules, rows, risk, selSec } = model;
  const ui = useLienzoUi();
  const pos = usePosition(10);
  if (ui.sel.take && ui.sel.lane === 'tomas')
    return (
      <section aria-label="Detalle" className={s.detail}>
        <button
          type="button"
          className={s.detailBar}
          aria-expanded={ui.detail}
          onClick={() => ui.set({ detail: !ui.detail })}
        >
          <span className={`${s.mono} ${s.small}`}>{ui.detail ? '−' : '+'}</span>
          <span style={{ fontWeight: 500 }}>Tomas</span>
        </button>
        {ui.detail && <TakeDetail />}
      </section>
    );
  const laneId = ui.sel.lane === 'tomas' ? 'armonia' : ui.sel.lane;
  const lane = LANES.find((l) => l.id === laneId)!;
  const v = variantById(p, p.clips[keyFor(lane.id, selSec)]);
  const chk = checkCell(lane.id, v, selSec, p, rules);
  const partner = partnerOf(p.secs, selSec);
  const cmp = partner ? contrast(p, rules.melody, selSec, partner) : [];
  const copy = p.secs.find((x) => x.of === selSec.id);
  const nowT = nowIn(pos, p.secs, selSec);
  const ruleRow = rows[lane.id === 'ritmo' ? 'ritmo' : lane.id];
  const title =
    v?.kind === 'armonia'
      ? [...new Set(v.chords.map((c) => chordOf(c, p.key).name))].join(' – ')
      : v?.kind === 'ritmo'
        ? rhythmName(v.config)
        : (v?.name ?? 'Nada todavía');
  const actions: Array<[string, () => void]> = [];
  if (lane.id === 'armonia') {
    actions.push([v ? 'sortear otra' : 'sortear', () => rollVariant('armonia', selSec, rules, risk)]);
    if (v?.kind === 'armonia' && v.chords.length > 1)
      actions.push(['rotar el ciclo', () => editChords(selSec, (c) => [...c.slice(1), c[0]!] as Chord[])]);
    actions.push(['tonalidad ↗', () => ui.openWin('tono')]);
  }
  if (lane.id === 'ritmo') {
    actions.push([v ? 'sortear otro' : 'sortear', () => rollVariant('ritmo', selSec, rules, risk)]);
    actions.push(['editar ↗', () => ui.openWin('ritmo')]);
  }
  if (lane.id === 'melodia' && !v)
    actions.push(['empezar con apoyos', () => rollVariant('melodia', selSec, rules, risk)]);
  if (lane.id === 'letra' && !v)
    actions.push([
      'escribir ↗',
      () => (import('./actions').then((a) => a.newLyric(selSec)), ui.openWin('letra')),
    ]);
  if (copy && lane.mirror) actions.push([`hacer única la otra ${selSec.label}`, () => unlink(copy)]);
  return (
    <section aria-label="Detalle" className={s.detail}>
      <button
        type="button"
        className={s.detailBar}
        aria-expanded={ui.detail}
        onClick={() => ui.set({ detail: !ui.detail })}
      >
        <span className={`${s.mono} ${s.small}`}>{ui.detail ? '−' : '+'}</span>
        <span style={{ fontWeight: 500 }}>
          {lane.name} · {selSec.label}
        </span>
        {chk && <span className={chk.ok ? s.ok : s.bad}>{chk.ok ? '✓ cumple' : '✗ no cumple'}</span>}
      </button>
      {ui.detail && (
        <div className={s.detailBody}>
          <div className={s.pane} style={{ width: 290 }}>
            <span className={s.small}>{v ? (v.kind === 'ritmo' ? 'Ritmo' : v.name) : 'Vacía'}</span>
            <span className={s.big}>{title}</span>
            {v?.kind === 'armonia' && <span className={s.lede}>{story(v.chords, p.key)}</span>}
            {!v && <span className={s.small}>Click derecho para sortear, o arrastrá una variante.</span>}
            <span className={s.row} style={{ marginTop: 'auto' }}>
              {actions.map(([label, fn]) => (
                <LinkBtn key={label} onClick={fn}>
                  {label}
                </LinkBtn>
              ))}
            </span>
          </div>
          <div className={s.pane} style={{ width: 220 }}>
            <span className={s.small}>Contra la consigna</span>
            <span className={s.grot} style={{ fontSize: 15, fontWeight: 500 }}>
              {lane.id === 'ritmo' ? model.meter : ruleRow.label}
            </span>
            <span className={chk ? (chk.ok ? s.ok : s.bad) : s.small} style={{ fontSize: 12.5 }}>
              {chk ? chk.why : v ? 'Esta regla no se mide sola.' : 'Nada que comparar.'}
            </span>
          </div>
          {partner && (
            <div className={s.pane} style={{ width: 300 }}>
              <span className={s.small}>
                Contraste con {partner.label} · {cmp.filter((c) => c.ok === true).length} de{' '}
                {cmp.filter((c) => c.ok !== null).length}
              </span>
              {cmp.map((c, i) => (
                <span
                  key={i}
                  className={c.ok === true ? s.ok : c.ok === false ? s.bad : s.small}
                  style={{ fontSize: 12.5 }}
                >
                  {c.ok === true ? '✓ ' : c.ok === false ? '✗ ' : '· '}
                  {c.t}
                </span>
              ))}
            </div>
          )}
          {v?.kind === 'armonia' && <Harmony h={v} sec={selSec} nowT={nowT} />}
          {v?.kind === 'melodia' && <MelodyEditor v={v} sec={selSec} nowT={nowT} />}
          {v?.kind === 'ritmo' && (
            <div className={s.pane} style={{ width: 360 }}>
              <span className={s.small} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Un compás</span>
                <LinkBtn onClick={() => ui.openWin('ritmo')}>editar ↗</LinkBtn>
              </span>
              <Steps levels={rBar(v.config, 0)} height={44} />
            </div>
          )}
          {v?.kind === 'letra' && <Lyric v={v} sec={selSec} nowT={nowT} />}
        </div>
      )}
    </section>
  );
}
