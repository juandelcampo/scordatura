import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  consignaNumber,
  decodeConsigna,
  encodeConsigna,
  newConsigna,
  rerollAll,
  rerollRow,
  resolveRows,
  rowIndex,
  ROWS,
  toggleLock,
  type RowId,
  type RowOverrides,
} from '~/core/consigna';
import { degreeOf } from '~/core/chords';
import type { DroneConfig } from '~/core/drone';
import type { RhythmConfig } from '~/core/rhythm';
import { RISK_NAMES } from '~/core/roll';
import { keyOfProgression, transposeTo } from '~/core/variations';
import { publishToConsigna, useConsigna } from '~/shared/consigna';
import { RiskPicker } from '~/shared/RiskPicker';
import { ExportMidiButton } from '~/shared/ExportMidiButton';
import { Mixer } from '~/shared/Fader';
import { RecordButton } from '~/shared/RecordButton';
import { useSettings } from '~/shared/settings';
import { useToolModal } from '~/shared/toolModal';
import { Button } from '~/shared/ui/ui';
import { useHydrated } from '~/shared/useHydrated';
import styles from './consigna.module.css';
import { MiniDrone, MiniForm, MiniHarmony, MiniLyric, MiniMelody, MiniRhythm, MiniTuning } from './Minis';

/**
 * El nombre de la tarjeta abre su herramienta encima de la consigna. Con Ctrl o el botón del medio
 * sigue siendo un link común.
 */
function OpenTool({ to, name }: { to: string; name: string }) {
  const navigate = useNavigate();
  const open = useToolModal((s) => s.open);
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    open(`${window.location.pathname}${window.location.search}`);
    void navigate(to);
  };
  return (
    <Link
      className={styles.open}
      to={to}
      onClick={onClick}
      aria-label={`Abrir ${name}`}
      title={`Abrir ${name}`}
    >
      {name}
      <span aria-hidden="true">↗</span>
    </Link>
  );
}

/**
 * La consigna entera en una pantalla. Con `background`, queda detrás de una herramienta abierta en
 * un modal: sigue al día con lo que se elija ahí, pero la URL es de la herramienta y no se toca.
 */
export function ConsignaView({ background = false }: { background?: boolean }) {
  const consigna = useConsigna((s) => s.consigna);
  const started = useConsigna((s) => s.started);
  const canUndo = useConsigna((s) => s.past.length > 0);
  const canRedo = useConsigna((s) => s.future.length > 0);
  const change = useConsigna((s) => s.change);
  const undo = useConsigna((s) => s.undo);
  const redo = useConsigna((s) => s.redo);
  const risk = useSettings((s) => s.risk);
  const [params, setParams] = useSearchParams();
  const hydrated = useHydrated();
  const [copied, setCopied] = useState(false);
  const [mixerOpen, setMixerOpen] = useState(false);
  const [tuning, setTuning] = useState(false);
  const loaded = useRef(false);

  // Primer montaje: el link compartido manda; si no hay, sigue la que estaba o se sortea una nueva.
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const code = params.get('t');
    const shared = code ? decodeConsigna(code) : null;
    const settings = useSettings.getState();
    const store = useConsigna.getState();
    if (shared) {
      // Primero la consigna: así, al cambiar el riesgo global, ya coincide y no se vuelve a sortear.
      if (encodeConsigna(shared) !== encodeConsigna(store.consigna)) {
        if (store.started) store.change(shared);
        else store.load(shared);
      }
      settings.set({ risk: shared.risk });
    } else if (!store.started) {
      store.load(newConsigna(settings.risk));
    } else if (store.consigna.risk !== settings.risk) {
      // El riesgo cambió mientras se usaba otra herramienta.
      store.change(rerollAll(store.consigna, settings.risk));
    }
  }, [params]);

  // Solo un cambio hecho por la persona vuelve a sortear lo que no esté trabado.
  useEffect(
    () =>
      useSettings.subscribe((next, previous) => {
        if (next.risk === previous.risk) return;
        const store = useConsigna.getState();
        if (store.consigna.risk !== next.risk) store.change(rerollAll(store.consigna, next.risk));
      }),
    [],
  );

  // La URL siempre refleja la consigna, para que compartirla sea copiar el link.
  const code = encodeConsigna(consigna);
  const number = consignaNumber(consigna);
  useEffect(() => {
    if (!started || background) return;
    if (params.get('t') !== code) setParams({ t: code }, { replace: true, preventScrollReset: true });
  }, [code, started, background, params, setParams]);

  const results = useMemo(() => resolveRows(consigna), [consigna]);
  const allLocked = consigna.rows.every((row) => row.locked);

  const share = async () => {
    const href = `${window.location.origin}/?t=${code}`;
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copiá este link:', href);
    }
  };

  const valueOf = <T,>(id: RowId) => results[rowIndex(id)]!.value as T;
  const tuningNotes = valueOf<{ notes: string[] }>('afinacion').notes;
  const harmony = valueOf<RowOverrides['armonia']>('armonia');
  const melody = valueOf<RowOverrides['melodia'] | null>('melodia');
  const harmonyKey = keyOfProgression(harmony.chords, harmony.tonic, harmony.mode);
  const degrees = harmony.chords.map((name) => degreeOf(name, harmonyKey.tonic) ?? '?').join(' – ');

  // Otra tónica es la misma progresión más arriba o más abajo: los grados quedan, y queda trabada.
  const setTonic = (tonic: number) => {
    if (tonic === harmonyKey.tonic) return;
    publishToConsigna('armonia', {
      chords: transposeTo(harmony.chords, harmonyKey, tonic),
      tonic,
      mode: harmonyKey.mode,
      ...(harmony.beats ? { beats: harmony.beats } : {}),
    });
  };

  const mini = (id: RowId, index: number): ReactNode => {
    switch (id) {
      case 'ritmo':
        return <MiniRhythm config={valueOf<RhythmConfig>('ritmo')} />;
      case 'armonia':
        return (
          <MiniHarmony
            chords={harmony.chords}
            harmonyKey={harmonyKey}
            tuningNotes={tuningNotes}
            onTonic={setTonic}
          />
        );
      case 'melodia':
        return (
          <MiniMelody
            seed={consigna.rows[index]!.seed}
            chord={harmony.chords[0]}
            chosen={melody?.notes ?? null}
          />
        );
      case 'letra':
        return <MiniLyric />;
      case 'forma':
        return <MiniForm blocks={valueOf<{ blocks: string[] }>('forma').blocks} />;
      case 'drone':
        return <MiniDrone config={valueOf<DroneConfig>('drone')} />;
      default:
        return null;
    }
  };

  /**
   * Nombre, trabar y cambiar: igual en las tarjetas y en la franja de arriba. La franja no abre
   * herramienta: se cambia ahí mismo, sacando otra.
   */
  const head = (index: number, { band = false }: { band?: boolean } = {}) => {
    const row = ROWS[index]!;
    const state = consigna.rows[index]!;
    const result = results[index]!;
    return (
      <div className={styles.rowHead}>
        <h2 className={styles.rowName}>
          {result.href && !band ? <OpenTool to={result.href} name={row.name} /> : row.name}
          {state.override && <span className={styles.chosenTag}>Tu elección</span>}
        </h2>
        <div className={styles.rowActions} data-print="hide">
          <Button
            variant="mini"
            ariaPressed={state.locked}
            ariaLabel={`${state.locked ? 'Destrabar' : 'Trabar'} ${row.name}`}
            onClick={() => change(toggleLock(consigna, index))}
          >
            {state.locked ? 'Trabada' : 'Trabar'}
          </Button>
          <Button
            variant="mini"
            ariaLabel={band ? `Sacar otra ${row.name.toLowerCase()}` : `Cambiar ${row.name}`}
            onClick={() => change(rerollRow(consigna, index))}
          >
            {band ? 'Sacar otra' : 'Cambiar'}
          </Button>
        </div>
      </div>
    );
  };

  /** Lo que hay que respetar y su descripción. En la armonía mandan los grados; los acordes van abajo. */
  const body = (index: number) => {
    const row = ROWS[index]!;
    const state = consigna.rows[index]!;
    const result = results[index]!;
    const foreign = state.risk !== consigna.risk && !state.override;
    const rule =
      `${result.rule}${foreign ? ` (Trabada en nivel ${RISK_NAMES[state.risk].toLowerCase()}.)` : ''}`.trim();
    const isHarmony = row.id === 'armonia';
    return (
      <div className={styles.rowBody}>
        <p
          className={styles.rowValue}
          title={result.label}
          data-testid={isHarmony ? 'mini-degrees' : undefined}
        >
          {isHarmony ? degrees : result.label}
        </p>
        {rule && (
          <p className={styles.rowRule} title={rule}>
            {rule}
          </p>
        )}
      </div>
    );
  };

  const cartaIndex = rowIndex('carta');
  const carta = consigna.rows[cartaIndex]!;
  const tuningIndex = rowIndex('afinacion');
  const tuningRow = consigna.rows[tuningIndex]!;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.ident}>
          <h1 className={styles.title}>Consigna</h1>
          <span className={styles.number}>Nº {number}</span>
          <Link to="/acerca" className={styles.about} data-print="hide">
            ¿Qué es esto?
          </Link>
        </div>
        <div className={styles.session} data-print="hide">
          <Link className={styles.listen} to="/estudio" data-testid="listen">
            ▶ Escuchar todo
          </Link>
          <RecordButton />
        </div>
        <div className={styles.extras} data-print="hide">
          <Button variant="mini" onClick={share}>
            {copied ? 'Link copiado' : 'Copiar link'}
          </Button>
          <ExportMidiButton variant="mini" />
          <Button variant="mini" id="print-sheet" onClick={() => window.print()}>
            Hoja en PDF
          </Button>
          <Button
            variant="mini"
            ariaExpanded={mixerOpen}
            onClick={() => setMixerOpen(!mixerOpen)}
            id="mixer-toggle"
          >
            Volumen
          </Button>
        </div>
        {mixerOpen && (
          <div className={styles.mixer} data-print="hide">
            <Mixer />
          </div>
        )}
      </header>

      {/* La carta no es una herramienta más: es la consigna de toda la canción, y va arriba. */}
      <section
        className={styles.band}
        aria-label={ROWS[cartaIndex]!.name}
        data-row="carta"
        data-locked={carta.locked}
        data-chosen={!!carta.override}
      >
        {head(cartaIndex, { band: true })}
        {body(cartaIndex)}
      </section>

      {/* La afinación se mira al empezar y después solo hace falta a mano: va en una franja. */}
      <section
        className={styles.strip}
        aria-label={ROWS[tuningIndex]!.name}
        data-row="afinacion"
        data-locked={tuningRow.locked}
        data-chosen={!!tuningRow.override}
        data-tuning={tuning}
      >
        {head(tuningIndex)}
        {body(tuningIndex)}
        <MiniTuning notes={tuningNotes} tuning={tuning} onTuning={setTuning} />
      </section>

      <ol className={styles.rows}>
        {ROWS.map((row, index) => {
          if (row.id === 'carta' || row.id === 'afinacion') return null;
          const state = consigna.rows[index]!;
          return (
            <li
              key={row.id}
              className={styles.row}
              data-locked={state.locked}
              data-chosen={!!state.override}
              data-row={row.id}
            >
              {head(index)}
              {body(index)}
              <div className={styles.rowTools} data-print="hide">
                {mini(row.id, index)}
              </div>
            </li>
          );
        })}
      </ol>

      <p className={styles.sheetLink}>
        Para volver a abrirla: {hydrated ? window.location.origin : ''}/?t={code}
      </p>

      <div className={styles.rollBar} data-print="hide">
        {/* El riesgo solo importa al sortear: va pegado al botón que sortea. */}
        <div className={styles.risk}>
          <RiskPicker />
        </div>
        <Button onClick={undo} id="undo" disabled={!canUndo} ariaLabel="Volver a la consigna anterior">
          ↩ Volver
        </Button>
        <Button
          variant="primary"
          full
          onClick={() => change(rerollAll(consigna, risk))}
          id="roll"
          disabled={allLocked}
        >
          {allLocked ? 'Todo trabado' : 'Nueva consigna'}
        </Button>
        <Button onClick={redo} id="redo" disabled={!canRedo} ariaLabel="Rehacer">
          ↪
        </Button>
      </div>
    </div>
  );
}
