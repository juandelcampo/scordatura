// La ventana de Letra: escribir (con sílabas, rima, estabilidad, Lupa y molde), buscar material y el
// cuaderno de frases sueltas.
import { useEffect, useMemo, useState } from 'react';
import { titleSections } from '~/core/lienzo/form';
import { linesOf, mirrors, stability, syllables } from '~/core/lienzo/lyrics';
import {
  checkMold,
  cutAndMix,
  foundPhrases,
  ladder,
  lupa,
  makeDummy,
  soundWords,
  vowelsOf,
} from '~/core/lienzo/lyricsTools';
import type { Section, VariantOf } from '~/core/lienzo/types';
import { createRng, randomSeed } from '~/core/rng';
import {
  CHARACTERS,
  MOLDS,
  OBJECTS,
  PLACES,
  REGISTERS,
  SEED_NOTEBOOK,
  type RegisterId,
} from '~/data/lyrics-material';
import { useLienzo } from '~/shared/lienzo';
import { useLienzoUi } from '~/shared/lienzoUi';
import { newLyric } from './actions';
import { LinkBtn, Opt, usePosition, Win } from './bits';
import { useModel } from './model';
import s from './lienzo.module.css';

const rng = () => createRng(randomSeed());

function useCurrentLyric(): { v: VariantOf<'letra'> | undefined; sec: Section } {
  const { project: p, selSec } = useModel();
  const id = useLienzoUi((st) => st.lyricInst);
  const v = p.lib.find((x) => x.id === id && x.kind === 'letra') as VariantOf<'letra'> | undefined;
  return { v: v ?? (p.lib.find((x) => x.kind === 'letra') as VariantOf<'letra'> | undefined), sec: selSec };
}

function Write() {
  const { project: p, rules, rows } = useModel();
  const ui = useLienzoUi();
  const store = useLienzo();
  const { v, sec } = useCurrentLyric();
  const pos = usePosition(8);
  const letras = p.lib.filter((x): x is VariantOf<'letra'> => x.kind === 'letra');
  if (!v)
    return (
      <span className={s.row}>
        <span className={s.small}>Sin letras todavía.</span>
        <LinkBtn onClick={() => newLyric(sec)}>escribir en {sec.label}</LinkBtn>
      </span>
    );
  const lines = linesOf(v.text);
  const stab = stability(lines);
  const mirror = mirrors(lines);
  const mold = MOLDS.find((m) => m.id === ui.mold);
  const target = rules.lyric?.kind === 'metro' ? rules.lyric.syllables : 0;
  const banned = rules.lyric?.kind === 'sin' ? rules.lyric.word.toLowerCase() : null;
  const where = [...new Set(p.secs.filter((x) => p.clips[`letra:${x.id}`] === v.id).map((x) => x.label))];
  let current = -1;
  {
    let acc = 0;
    for (const x of p.secs) {
      if (pos > 0 && pos < acc + x.bars) {
        if (p.clips[`letra:${x.id}`] === v.id && lines.length)
          current = Math.min(lines.length - 1, Math.floor(((pos - acc) * lines.length) / x.bars));
        break;
      }
      acc += x.bars;
    }
  }
  const titled = titleSections(p);
  return (
    <>
      <div role="group" aria-label="Variante de letra" className={s.row}>
        {letras.map((x) => (
          <Opt key={x.id} on={x.id === v.id} onClick={() => ui.set({ lyricInst: x.id })}>
            {x.name}
          </Opt>
        ))}
        <LinkBtn onClick={() => newLyric(sec)}>+ en {sec.label}</LinkBtn>
      </div>
      <span className={s.small}>
        {mold
          ? `Molde: ${mold.name.toLowerCase()} ${mold.pattern.join('-')}`
          : `Consigna: ${rows.letra.label.toLowerCase()}`}{' '}
        · {where.length ? `en ${where.join(' ')}` : 'sin usar'} · “=” versos espejo
      </span>
      <label className={s.srOnly} htmlFor="letra-texto">
        Texto de la letra
      </label>
      <textarea
        id="letra-texto"
        className={s.textarea}
        style={{ height: 120 }}
        value={v.text}
        placeholder="Escribí la letra"
        onChange={(e) => store.updateVariant(v.id, { text: e.target.value })}
      />
      <div className={s.stack} style={{ gap: 2 }}>
        {lines.map((line, i) => {
          const n = syllables(line);
          const want = mold ? mold.pattern[i % mold.pattern.length]! : target;
          const bad = !!banned && line.toLowerCase().includes(banned);
          const ok = want ? n === want : !bad;
          return (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1fr) 22px 60px',
                gap: 8,
                fontSize: 12.5,
              }}
            >
              <span
                className={s.ellipsis}
                style={{
                  color: current === i ? 'var(--accent)' : 'var(--muted)',
                  fontWeight: current === i ? 600 : 400,
                }}
              >
                {line}
              </span>
              <span className={`${s.mono} ${s.small}`}>{stab.scheme[i]}</span>
              <span className={`${s.mono} ${ok ? s.ok : s.bad}`} style={{ textAlign: 'right' }}>
                {bad ? `“${banned}”` : `${n}${want ? `/${want}` : ''}${mirror[i] ? ' =' : ''}`}
              </span>
            </div>
          );
        })}
      </div>
      <span className={s.lede}>{stab.label}</span>
      <span style={{ fontSize: 12 }}>{stab.why}</span>
      <div className={`${s.stack} ${s.rule}`} style={{ gap: 4 }}>
        <span className={s.small}>Lupa</span>
        {lupa(lines, p.title).map((x, i) => (
          <span
            key={i}
            className={x.tone === 'warn' ? s.bad : x.tone === 'ok' ? s.ok : ''}
            style={{ fontSize: 12.5 }}
          >
            {x.t}
          </span>
        ))}
      </div>
      <span className={!p.title.trim() ? s.small : titled.length ? s.ok : s.bad} style={{ fontSize: 12.5 }}>
        {!p.title.trim()
          ? 'Sin título todavía.'
          : titled.length
            ? `✓ “${p.title}” está en ${titled.join(', ')}.`
            : `✗ “${p.title}” no está en ninguna letra.`}
      </span>
      {mold && (
        <span className={checkMold(lines, mold).ok ? s.ok : s.bad} style={{ fontSize: 12.5 }}>
          {checkMold(lines, mold).t}
        </span>
      )}
    </>
  );
}

function Material() {
  const { project: p, rows } = useModel();
  const ui = useLienzoUi();
  const store = useLienzo();
  const { v, sec } = useCurrentLyric();
  const [lad, setLad] = useState(() => ladder(rng()));
  const [cut, setCut] = useState<string[]>([]);
  const [obj, setObj] = useState(OBJECTS[0]!);
  const [place, setPlace] = useState(PLACES[0]!);
  const [clock, setClock] = useState({ left: 600, on: false });
  const mold = MOLDS.find((m) => m.id === ui.mold);
  const pattern = mold ?? { pattern: [8, 8, 8, 8], scheme: 'xaxa' };
  const [dummy, setDummy] = useState(() => makeDummy(pattern.pattern, pattern.scheme, rng()));
  const [sound, setSound] = useState('na la ue o a');
  const [soundSeed, setSoundSeed] = useState(7);
  const [reg, setReg] = useState<RegisterId>('cotidiano');
  const [regSeed, setRegSeed] = useState(3);
  const [char, setChar] = useState(0);
  const allText = useMemo(
    () =>
      p.lib
        .filter((x): x is VariantOf<'letra'> => x.kind === 'letra')
        .map((x) => x.text)
        .join(' ') +
      ' ' +
      rows.carta.label,
    [p.lib, rows.carta.label],
  );
  useEffect(() => {
    if (!clock.on) return;
    const id = setInterval(
      () => setClock((c) => (c.left <= 1 ? { left: 0, on: false } : { ...c, left: c.left - 1 })),
      1000,
    );
    return () => clearInterval(id);
  }, [clock.on]);
  const items = useMemo(() => {
    const list = [...REGISTERS[reg].items];
    const r = createRng(regSeed);
    for (let i = list.length - 1; i > 0; i--) {
      const j = r.int(0, i);
      [list[i], list[j]] = [list[j]!, list[i]!];
    }
    return list.slice(0, 4);
  }, [reg, regSeed]);
  const vowels = vowelsOf(sound);
  const lineOf = (t: string, i: number) => (
    <span key={i} className={s.grot} style={{ fontSize: 15 }}>
      {t}
    </span>
  );
  const drafts = p.lib.filter((x) => x.kind === 'letra').length;
  return (
    <>
      <div className={s.stack}>
        <span className={s.small} style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Escalera de palabras</span>
          <LinkBtn onClick={() => setLad(ladder(rng()))}>otra</LinkBtn>
        </span>
        <span style={{ fontSize: 12.5 }}>Verbos de {lad.job} × cosas que tenés cerca:</span>
        {lad.pairs.map(lineOf)}
      </div>
      <div className={`${s.stack} ${s.rule}`}>
        <span className={s.small} style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Cortar y mezclar tus letras</span>
          <LinkBtn onClick={() => setCut(cutAndMix(allText, rng()))}>cortar de nuevo</LinkBtn>
        </span>
        {(cut.length ? cut : cutAndMix(allText, createRng(1))).map(lineOf)}
      </div>
      <div className={`${s.stack} ${s.rule}`}>
        <span className={s.small} style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Escritura de objeto</span>
          <LinkBtn onClick={() => setObj(rng().pick(OBJECTS))}>otro objeto</LinkBtn>
        </span>
        <span style={{ fontSize: 12.5 }}>
          Diez minutos sobre <strong className={s.grot}>{obj}</strong>: cómo se ve, suena, huele, pesa.
        </span>
        <span className={s.row}>
          <span className={s.mono} style={{ fontSize: 22 }}>
            {Math.floor(clock.left / 60)}:{String(clock.left % 60).padStart(2, '0')}
          </span>
          <LinkBtn onClick={() => setClock((c) => ({ left: c.left || 600, on: !c.on }))}>
            {clock.on ? 'pausar' : clock.left < 600 ? 'seguir' : 'empezar'}
          </LinkBtn>
        </span>
        <span className={s.small}>
          O un lugar: <LinkBtn onClick={() => setPlace(rng().pick(PLACES))}>{place}</LinkBtn>
        </span>
      </div>
      <div className={`${s.stack} ${s.rule}`}>
        <span className={s.small} style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Letra de relleno</span>
          <LinkBtn onClick={() => setDummy(makeDummy(pattern.pattern, pattern.scheme, rng()))}>otra</LinkBtn>
        </span>
        <span style={{ fontSize: 12.5 }}>Sin sentido, con la métrica justa:</span>
        {dummy.map(lineOf)}
        {v && (
          <LinkBtn
            onClick={() => (
              store.updateVariant(v.id, { text: dummy.join('\n') }),
              ui.set({ lyricMode: 'write' })
            )}
          >
            pegar en {v.name}
          </LinkBtn>
        )}
      </div>
      <div className={`${s.stack} ${s.rule}`}>
        <span className={s.small}>Moldes de la tradición · la letra se mide contra el molde</span>
        {MOLDS.map((m) => (
          <button
            key={m.id}
            type="button"
            className={s.opt}
            aria-pressed={ui.mold === m.id}
            style={{
              color: 'var(--ink)',
              borderLeft: `2px solid ${ui.mold === m.id ? 'var(--accent)' : 'transparent'}`,
              paddingLeft: 8,
            }}
            onClick={() => {
              ui.set({ mold: ui.mold === m.id ? null : m.id });
              setDummy(makeDummy(m.pattern, m.scheme, rng()));
            }}
          >
            <span style={{ fontWeight: 500 }}>{m.name}</span>{' '}
            <span className={`${s.mono} ${s.small}`}>
              {m.pattern.length > 4 ? `${m.pattern.length} × 8` : m.pattern.join('-')}
            </span>
            <span className={s.small} style={{ display: 'block' }}>
              {m.note}
            </span>
          </button>
        ))}
      </div>
      <div className={`${s.stack} ${s.rule}`}>
        <span className={s.small} style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>De sonido a palabra</span>
          <LinkBtn onClick={() => setSoundSeed(soundSeed + 1)}>otras</LinkBtn>
        </span>
        <input
          className={`${s.input} ${s.mono}`}
          aria-label="Sonidos de la melodía"
          value={sound}
          onChange={(e) => setSound(e.target.value)}
          placeholder="na la ue o a"
        />
        <span className={`${s.mono} ${s.small}`}>
          {vowels ? `vocales: ${vowels.split('').join(' ')}` : 'escribí unos sonidos'}
        </span>
        {vowels && soundWords(vowels, createRng(soundSeed)).map(lineOf)}
      </div>
      <div className={`${s.stack} ${s.rule}`}>
        <span className={s.small} style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Registro</span>
          <LinkBtn onClick={() => setRegSeed(regSeed + 1)}>otras</LinkBtn>
        </span>
        <div className={s.row}>
          {(Object.keys(REGISTERS) as RegisterId[]).map((k) => (
            <Opt key={k} on={reg === k} onClick={() => setReg(k)}>
              {REGISTERS[k].label}
            </Opt>
          ))}
        </div>
        <span style={{ fontSize: 12.5 }}>{REGISTERS[reg].about}</span>
        {items.map((t, i) => lineOf(reg === 'cotidiano' ? `dale vuelta a “${t}”` : t, i))}
      </div>
      <div className={`${s.stack} ${s.rule}`}>
        <span className={s.small} style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Escribila desde otro</span>
          <LinkBtn onClick={() => setChar(char + 1 + Math.floor(Math.random() * 3))}>otro</LinkBtn>
        </span>
        <span className={s.grot} style={{ fontSize: 15, fontWeight: 500 }}>
          {CHARACTERS[char % CHARACTERS.length]}
        </span>
        <span className={s.small}>¿Qué quiere? ¿Qué esconde?</span>
      </div>
      <div className={`${s.stack} ${s.rule}`}>
        <span className={s.small}>Abrí la canilla</span>
        <span style={{ fontSize: 12.5 }}>Las primeras salen turbias. Llevás {drafts} borradores.</span>
        <LinkBtn onClick={() => newLyric(sec, '', `Borrador ${drafts + 1}`)}>empezar otro borrador</LinkBtn>
      </div>
    </>
  );
}

function Cuaderno() {
  const { project: p } = useModel();
  const ui = useLienzoUi();
  const store = useLienzo();
  const { v } = useCurrentLyric();
  const [draft, setDraft] = useState('');
  const [found, setFound] = useState('');
  const [fit, setFit] = useState(false);
  const notebook = p.notebook.length ? p.notebook : SEED_NOTEBOOK.map((t) => ({ t, used: false }));
  const save = (nb: typeof notebook) => store.update(() => ({ notebook: nb }));
  const mold = MOLDS.find((m) => m.id === ui.mold);
  const target = mold?.pattern[0] ?? 0;
  const all = notebook.map((n, i) => ({ ...n, i, c: syllables(n.t) }));
  const shown = all.filter((x) => !fit || !target || x.c === target);
  const append = (i: number, end: boolean) => {
    if (!v) return;
    const t = notebook[i]!.t;
    store.updateVariant(v.id, {
      text: (v.text ? `${v.text.replace(/\s+$/, '')}\n` : '') + (end ? '…\n' : '') + t,
    });
    save(notebook.map((n, j) => (j === i ? { ...n, used: true } : n)));
    if (end) ui.set({ lyricMode: 'write' });
  };
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    save([{ t, used: false }, ...notebook]);
    setDraft('');
  };
  return (
    <>
      <span style={{ fontSize: 12.5 }}>
        Frases sueltas: sacá una al azar, filtrá por métrica o usala como final.
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        <label className={s.srOnly} htmlFor="cuaderno-nueva">
          Frase nueva
        </label>
        <input
          id="cuaderno-nueva"
          className={s.input}
          style={{ flex: '1 1 auto' }}
          value={draft}
          placeholder="Anotá una frase"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button type="button" className={s.box} onClick={add}>
          anotar
        </button>
      </div>
      <div className={s.row}>
        <LinkBtn
          disabled={!v}
          onClick={() => {
            const pool = shown.filter((x) => !x.used);
            if (pool.length) append(rng().pick(pool).i, false);
          }}
        >
          sacar una del sombrero → {v?.name ?? 'letra'}
        </LinkBtn>
        <Opt small on={fit} onClick={() => setFit(!fit)}>
          {target ? `solo las de ${target} sílabas` : 'solo las que entran (elegí un molde)'}
        </Opt>
      </div>
      <div>
        {shown.map((x) => (
          <div
            key={x.i}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0,1fr) 30px 34px 52px',
              gap: 8,
              alignItems: 'baseline',
              padding: '5px 0',
              borderBottom: '1px solid var(--faint)',
            }}
          >
            <span
              style={{
                fontSize: 14,
                color: x.used ? 'var(--muted)' : undefined,
                textDecoration: x.used ? 'line-through' : undefined,
              }}
            >
              {x.t}
            </span>
            <span
              className={`${s.mono} ${target && x.c === target ? s.ok : s.small}`}
              style={{ textAlign: 'right' }}
            >
              {x.c}
            </span>
            <LinkBtn disabled={!v} onClick={() => append(x.i, false)}>
              usar
            </LinkBtn>
            <LinkBtn disabled={!v} onClick={() => append(x.i, true)}>
              al final
            </LinkBtn>
          </div>
        ))}
      </div>
      <span className={s.small}>
        {all.length} frases · {all.filter((x) => x.used).length} usadas
      </span>
      <div className={`${s.stack} ${s.rule}`}>
        <span className={s.small}>Texto encontrado · pegá un afiche, un diario, un prospecto</span>
        <label className={s.srOnly} htmlFor="texto-encontrado">
          Texto encontrado
        </label>
        <textarea
          id="texto-encontrado"
          className={s.input}
          style={{ height: 70 }}
          value={found}
          placeholder="Pegá el texto acá"
          onChange={(e) => setFound(e.target.value)}
        />
        <LinkBtn
          onClick={() => {
            const bits = foundPhrases(
              found,
              notebook.map((n) => n.t),
            );
            if (bits.length) {
              save([...bits.map((t) => ({ t, used: false })), ...notebook]);
              setFound('');
            }
          }}
        >
          cortarlo en frases y sumarlas al cuaderno
        </LinkBtn>
      </div>
    </>
  );
}

export function LetraWin() {
  const ui = useLienzoUi();
  return (
    <Win id="letra" title="Letra">
      <div
        role="group"
        aria-label="Pestaña"
        className={s.row}
        style={{ borderBottom: '1px solid var(--faint)', paddingBottom: 6 }}
      >
        <Opt on={ui.lyricMode === 'write'} onClick={() => ui.set({ lyricMode: 'write' })}>
          Escribir
        </Opt>
        <Opt on={ui.lyricMode === 'material'} onClick={() => ui.set({ lyricMode: 'material' })}>
          Buscar material
        </Opt>
        <Opt on={ui.lyricMode === 'cuaderno'} onClick={() => ui.set({ lyricMode: 'cuaderno' })}>
          Cuaderno
        </Opt>
      </div>
      {ui.lyricMode === 'write' && <Write />}
      {ui.lyricMode === 'material' && <Material />}
      {ui.lyricMode === 'cuaderno' && <Cuaderno />}
    </Win>
  );
}
