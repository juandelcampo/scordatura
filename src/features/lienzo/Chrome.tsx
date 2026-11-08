// Lo que rodea al lienzo: el encabezado, la tira de la consigna, el menú ≡ y el menú contextual.
import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router';
import { lienzoPlayer } from '~/audio/lienzo';
import { consignaNumber, encodeConsigna, rerollAll, rerollRow, toggleLock } from '~/core/consigna';
import { lienzoToMidi } from '~/core/lienzo/export';
import { challengeOf } from '~/core/lienzo/own';
import { KEY_MODES } from '~/core/lienzo/types';
import { RISK_NAMES, type Risk } from '~/core/roll';
import { useConsigna } from '~/shared/consigna';
import { useLienzo } from '~/shared/lienzo';
import { useLienzoUi, type View } from '~/shared/lienzoUi';
import { useProject } from '~/shared/project';
import { useSettings } from '~/shared/settings';
import { LinkBtn, Lock, Opt, usePlaying } from './bits';
import { currentPlan, NOTE_NAMES_ES } from './plan';
import { projectFromConsigna, useModel } from './model';
import { useOwnSummary } from './Reglas';
import s from './lienzo.module.css';

const VIEWS: Array<[View, string]> = [
  ['lienzo', 'Lienzo'],
  ['hoja', 'Hoja'],
  ['instrumento', 'Instrumento'],
  ['refs', 'Referencias'],
];

export const keyLabel = (tonic: number, mode: keyof typeof KEY_MODES) =>
  `${NOTE_NAMES_ES[tonic]} ${KEY_MODES[mode].label.toLowerCase()}`;

export function togglePlay() {
  if (lienzoPlayer.isPlaying()) lienzoPlayer.pause();
  else lienzoPlayer.play(currentPlan);
}

const taps: number[] = [];
function tap() {
  const now = Date.now();
  while (taps.length && now - taps[0]! > 2500) taps.shift();
  taps.push(now);
  if (taps.length < 2) return;
  const gaps = taps.slice(1).map((t, i) => t - taps[i]!);
  useLienzo.getState().setBpm(60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length));
}

export function Header() {
  const { project, meter, guitar } = useModel();
  const ui = useLienzoUi();
  const playing = usePlaying();
  const store = useLienzo();
  return (
    <header className={s.header}>
      <Link to="/" className={s.brand} title="Volver a la consigna">
        Scordatura
      </Link>
      <label>
        <span className={s.srOnly}>Título de la canción</span>
        <input
          className={s.title}
          value={project.title}
          placeholder="Título"
          onChange={(e) => store.setTitle(e.target.value)}
        />
      </label>
      <div role="group" aria-label="Vista" className={s.row}>
        {VIEWS.map(([id, label]) => (
          <Opt key={id} on={ui.view === id} onClick={() => ui.set({ view: id })}>
            {label}
          </Opt>
        ))}
      </div>
      <div className={s.headMid}>
        <button
          type="button"
          className={s.keyBtn}
          onClick={() => ui.openWin('tono')}
          aria-label={`Tonalidad: ${keyLabel(project.key.tonic, project.key.mode)}. Cambiarla.`}
        >
          <span className={s.small}>en</span>
          <span className={s.keyName}>{keyLabel(project.key.tonic, project.key.mode)}</span>
          <span className={s.small}>▾</span>
        </button>
        <span className={s.sep} />
        <div className={s.transport}>
          <button
            type="button"
            className={s.play}
            aria-pressed={playing}
            aria-label={playing ? 'Pausar' : 'Reproducir'}
            onClick={togglePlay}
          >
            {playing ? (
              <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
                <rect x="2" y="1" width="3" height="10" fill="currentColor" />
                <rect x="7" y="1" width="3" height="10" fill="currentColor" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M2.5 1v10l8-5z" fill="currentColor" />
              </svg>
            )}
          </button>
          <label>
            <span className={s.srOnly}>Tempo</span>
            <input
              className={s.bpm}
              type="number"
              min={20}
              max={300}
              value={project.bpm}
              onChange={(e) => Number(e.target.value) && store.setBpm(Number(e.target.value))}
            />
          </label>
          <span className={s.small}>bpm</span>
          <LinkBtn onClick={tap}>tap</LinkBtn>
          <Opt
            on={ui.follow}
            struck
            small
            onClick={() => ui.set({ follow: !ui.follow })}
            title="Mientras suena, la selección, la letra y la hoja siguen a la canción"
          >
            seguir
          </Opt>
          <span className={s.small}>·</span>
          <span title="El compás de la consigna">{meter}</span>
        </div>
        <span className={s.sep} />
        <button type="button" className={s.keyBtn} onClick={() => ui.set({ view: 'instrumento' })}>
          <span className={s.small}>{guitar ? 'Guitarra' : 'Piano'}</span>
          {guitar && <span className={s.mono}>{project.tuning.name}</span>}
        </button>
      </div>
      <button
        type="button"
        className={s.burger}
        aria-label="Menú"
        aria-expanded={ui.menu}
        data-ctx="1"
        onClick={() => ui.set({ menu: !ui.menu, ctx: null })}
      >
        <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden="true">
          <rect y="1" width="14" height="1.3" fill="currentColor" />
          <rect y="5.4" width="14" height="1.3" fill="currentColor" />
          <rect y="9.8" width="14" height="1.3" fill="currentColor" />
        </svg>
      </button>
    </header>
  );
}

function Cell({
  label,
  value,
  rule,
  locked,
  onLock,
  onRoll,
  wide,
}: {
  label: string;
  value: ReactNode;
  rule: string;
  locked: boolean;
  onLock: () => void;
  onRoll: () => void;
  wide?: boolean;
}) {
  return (
    <div className={`${s.cell} ${wide ? s.carta : ''}`} title={rule}>
      <div className={s.cellTop}>
        <span className={s.small}>{label}</span>
        <Lock locked={locked} onClick={onLock} what={label} />
      </div>
      <button
        type="button"
        className={s.cellValue}
        disabled={locked}
        aria-label={`${label}: ${typeof value === 'string' ? value : ''}${locked ? ', trabada' : '. Tocá para sortear otra.'}`}
        onClick={onRoll}
      >
        {value}
      </button>
    </div>
  );
}

export function Strip() {
  const { rows, consigna, number, meter } = useModel();
  const change = useConsigna((st) => st.change);
  const open = useLienzoUi((st) => st.openWin);
  const own = useOwnSummary();
  const cell = (
    id: 'ritmo' | 'armonia' | 'melodia' | 'letra' | 'carta',
    label: string,
    value?: string,
    wide?: boolean,
  ) => {
    const row = rows[id];
    return (
      <Cell
        key={id}
        label={label}
        value={value ?? row.label}
        rule={row.rule}
        locked={row.locked}
        wide={wide}
        onLock={() => change(toggleLock(consigna, row.index))}
        onRoll={() => change(rerollRow(consigna, row.index))}
      />
    );
  };
  return (
    <section aria-label="Consigna" className={s.strip}>
      <Link to="/" className={s.stripHead} title="Abrir la consigna completa">
        <span className={s.small}>Consigna</span>
        <span className={s.mono} style={{ fontSize: 13 }}>
          nº {number}
        </span>
      </Link>
      {cell('ritmo', 'Compás', meter)}
      {cell('armonia', 'Armonía')}
      {cell('melodia', 'Melodía')}
      {cell('letra', 'Letra')}
      {cell('carta', 'Carta', undefined, true)}
      <button
        type="button"
        className={s.stripBtn}
        onClick={() => open('reglas')}
        title="Las reglas que te ponés para toda la canción"
      >
        <span className={s.small}>Tus reglas</span>
        <span className={`${s.grot} ${own.bad ? s.bad : ''}`} style={{ fontSize: 15, fontWeight: 500 }}>
          {own.on ? `${own.on} · ${own.bad ? `${own.bad} ✗` : '✓'}` : 'ninguna'}
        </span>
      </button>
      <button type="button" className={s.stripRoll} onClick={() => change(rerollAll(consigna))}>
        Sortear lo no trabado
      </button>
    </section>
  );
}

function download(bytes: Uint8Array<ArrayBuffer>, name: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/midi' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function Menu() {
  const ui = useLienzoUi();
  const { project, rules, consigna } = useModel();
  const risk = useSettings((st) => st.risk);
  const setSettings = useSettings((st) => st.set);
  const store = useLienzo();
  if (!ui.menu) return null;
  const challenge = challengeOf(store.finished, store.challengeStart);
  const slug = (project.title || 'cancion').toLowerCase().replace(/[^a-z0-9ñáéíóú]+/gi, '-');
  const fresh = (finished: boolean) => {
    lienzoPlayer.pause();
    const p = projectFromConsigna(consigna, {});
    store.next({ ...p, createdAt: Date.now(), consigna: encodeConsigna(consigna) }, finished);
    ui.set({ menu: false, sel: { lane: 'armonia', sec: p.secs[0]!.id, take: null } });
  };
  return (
    <div role="menu" aria-label="Menú" className={s.menu} data-ctx="1">
      <div className={s.menuPart}>
        <span className={s.small}>Carriles a la vista</span>
        <div className={s.row}>
          {(['armonia', 'melodia', 'ritmo', 'letra', 'tomas'] as const).map((lane) => (
            <Opt
              key={lane}
              struck
              on={ui.lanes[lane]}
              onClick={() => ui.set({ lanes: { ...ui.lanes, [lane]: !ui.lanes[lane] } })}
            >
              {
                { armonia: 'Armonía', melodia: 'Melodía', ritmo: 'Ritmo', letra: 'Letra', tomas: 'Tomas' }[
                  lane
                ]
              }
            </Opt>
          ))}
        </div>
        <label className={s.small} style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
          Zoom · {ui.zoom} px por compás
          <input
            type="range"
            min={16}
            max={48}
            step={2}
            value={ui.zoom}
            onChange={(e) => ui.set({ zoom: Number(e.target.value) })}
            style={{ accentColor: 'var(--accent)' }}
          />
        </label>
      </div>
      <div className={s.menuPart}>
        <span className={s.small}>Tema · riesgo del sorteo</span>
        <div className={s.row}>
          <Opt on={ui.theme === 'claro'} onClick={() => ui.set({ theme: 'claro' })}>
            Claro
          </Opt>
          <Opt on={ui.theme === 'oscuro'} onClick={() => ui.set({ theme: 'oscuro' })}>
            Oscuro
          </Opt>
        </div>
        <div className={s.row}>
          {([0, 1, 2] as Risk[]).map((r) => (
            <Opt key={r} on={risk === r} onClick={() => setSettings({ risk: r })}>
              {RISK_NAMES[r]}
            </Opt>
          ))}
        </div>
        <span className={s.small} style={{ marginTop: 6 }}>
          Al reproducir suena
        </span>
        <div className={s.row}>
          <Opt on={ui.sound === 'todo'} onClick={() => ui.set({ sound: 'todo' })}>
            todo
          </Opt>
          <Opt on={ui.sound === 'sin-ritmo'} onClick={() => ui.set({ sound: 'sin-ritmo' })}>
            sin ritmo
          </Opt>
          <Opt on={ui.sound === 'nada'} onClick={() => ui.set({ sound: 'nada' })}>
            nada
          </Opt>
        </div>
      </div>
      <div className={s.menuPart}>
        {(
          [
            ['tono', 'Tonalidad'],
            ['letra', 'Letra'],
            ['ritmo', 'Ritmo'],
            ['acordes', 'Acordes'],
            ['circulo', 'Círculo'],
            ['reglas', 'Tus reglas'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={s.menuLink} onClick={() => ui.openWin(id)}>
            {label} ↗
          </button>
        ))}
        <button
          type="button"
          className={s.menuLink}
          onClick={() => download(lienzoToMidi(project, rules), `${slug}.mid`)}
        >
          Exportar MIDI
        </button>
        <button
          type="button"
          className={s.menuLink}
          onClick={() => {
            ui.set({ view: 'hoja', menu: false });
            setTimeout(() => window.print(), 120);
          }}
        >
          Exportar PDF (hoja)
        </button>
      </div>
      <div className={s.menuPart}>
        <button type="button" className={s.menuLink} onClick={() => fresh(true)}>
          Terminada: empezar otra
        </button>
        <button type="button" className={s.menuLink} onClick={() => fresh(false)}>
          Empezar otra desde la consigna
        </button>
        {challenge ? (
          <span className={s.small}>
            Reto 14 en 28: vas {challenge.songs} en {challenge.day} días.
          </span>
        ) : (
          <LinkBtn onClick={() => store.startChallenge()}>Empezar el reto: 14 canciones en 28 días</LinkBtn>
        )}
      </div>
      <div className={s.menuPart}>
        <Link className={s.menuLink} to="/">
          Consigna
        </Link>
        <Link className={s.menuLink} to="/diario">
          Diario
        </Link>
        <Link className={s.menuLink} to="/herramientas">
          Herramientas
        </Link>
        <span className={s.small}>Consigna nº {consignaNumber(consigna)}</span>
      </div>
    </div>
  );
}

export function ContextMenu() {
  const ctx = useLienzoUi((st) => st.ctx);
  const set = useLienzoUi((st) => st.set);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ctx) ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [ctx]);
  if (!ctx) return null;
  return (
    <div
      ref={ref}
      role="menu"
      aria-label={ctx.title}
      className={s.ctx}
      data-ctx="1"
      style={{ left: ctx.x, top: ctx.y }}
      onKeyDown={(e) => e.key === 'Escape' && set({ ctx: null })}
    >
      <span className={s.ctxTitle}>{ctx.title}</span>
      {ctx.items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className={s.ctxItem}
          data-danger={!!item.danger}
          onClick={() => {
            set({ ctx: null });
            item.fn();
          }}
        >
          <span>{item.label}</span>
          {item.hint && <span className={s.small}>{item.hint}</span>}
        </button>
      ))}
    </div>
  );
}

// El proyecto anterior a la app del lienzo sigue guardado: se puede volver a migrar.
export const legacySections = () => useProject.getState().sections;
