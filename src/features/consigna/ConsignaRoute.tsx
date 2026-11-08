import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams, type MetaFunction } from 'react-router';
import {
  consignaNumber,
  decodeConsigna,
  encodeConsigna,
  newConsigna,
  rerollAll,
  rerollRow,
  resolveRow,
  rowIndex,
  ROWS,
  toggleLock,
  type RowId,
  type RowOverrides,
} from '~/core/consigna';
import type { DroneConfig } from '~/core/drone';
import type { RhythmConfig } from '~/core/rhythm';
import { RISK_NAMES } from '~/core/roll';
import { useConsigna } from '~/shared/consigna';
import { ExportMidiButton } from '~/shared/ExportMidiButton';
import { Mixer } from '~/shared/Fader';
import { RecordButton } from '~/shared/RecordButton';
import { useSettings } from '~/shared/settings';
import { Button, PageTitle, Slab } from '~/shared/ui/ui';
import { useHydrated } from '~/shared/useHydrated';
import { CartaSuelta } from './CartaSuelta';
import styles from './consigna.module.css';
import { MiniDrone, MiniForm, MiniHarmony, MiniLyric, MiniMelody, MiniRhythm, MiniTuning } from './Minis';

export const meta: MetaFunction = () => [
  { title: 'Scordatura: una consigna para componer fuera de tus costumbres' },
  {
    name: 'description',
    content:
      'Sorteá restricciones con teoría real: afinación, ritmo, armonía, melodía, letra, forma, una carta y un drone. Se escuchan ahí mismo, y la música la hacés vos.',
  },
  // Se llega por / y por /consigna, y es una sola página.
  { tagName: 'link', rel: 'canonical', href: '/' },
];

export default function ConsignaRoute() {
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
    if (!started) return;
    if (params.get('t') !== code) setParams({ t: code }, { replace: true, preventScrollReset: true });
  }, [code, started, params, setParams]);

  const results = useMemo(() => consigna.rows.map((row, index) => resolveRow(index, row)), [consigna]);
  const allLocked = consigna.rows.every((row) => row.locked);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copiá este link:', window.location.href);
    }
  };

  const valueOf = <T,>(id: RowId) => results[rowIndex(id)]!.value as T;
  const tuningNotes = valueOf<{ notes: string[] }>('afinacion').notes;
  const harmony = valueOf<{ chords: string[]; tonic?: number }>('armonia');
  const melody = valueOf<RowOverrides['melodia'] | null>('melodia');

  const mini = (id: RowId, index: number): ReactNode => {
    switch (id) {
      case 'afinacion':
        return <MiniTuning notes={tuningNotes} />;
      case 'ritmo':
        return <MiniRhythm config={valueOf<RhythmConfig>('ritmo')} />;
      case 'armonia':
        return <MiniHarmony chords={harmony.chords} tonic={harmony.tonic} tuningNotes={tuningNotes} />;
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

  return (
    <div className={styles.page}>
      <Slab>
        <PageTitle eyebrow={`Consigna Nº ${number}`} title="Consigna">
          <p>
            Lo que tenés que respetar en esta canción. Trabá lo que te sirva y sorteá de nuevo el resto.
            Después tocá sobre la base y grabá: la idea queda en tu Diario, con esta consigna.{' '}
            <Link to="/acerca" data-print="hide">
              ¿Qué es esto?
            </Link>
          </p>
        </PageTitle>
        <div className={styles.session} data-print="hide">
          <Link className={styles.listen} to="/estudio" data-testid="listen">
            ▶ Escuchar todo
          </Link>
          <Link className={styles.toCanvas} to="/lienzo" data-testid="to-lienzo">
            Componer en el lienzo →
          </Link>
          <RecordButton />
        </div>
        <div className={styles.extras} data-print="hide">
          <CartaSuelta />
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
          <div data-print="hide">
            <Mixer />
          </div>
        )}
      </Slab>

      <ol className={styles.rows}>
        {ROWS.map((row, index) => {
          const state = consigna.rows[index]!;
          const result = results[index]!;
          const foreign = state.risk !== consigna.risk && !state.override;
          return (
            <li
              key={row.id}
              className={styles.row}
              data-locked={state.locked}
              data-chosen={!!state.override}
              data-row={row.id}
            >
              <div className={styles.rowHead}>
                <h2 className={styles.rowName}>
                  {row.name}
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
                    ariaLabel={`Cambiar ${row.name}`}
                    onClick={() => change(rerollRow(consigna, index))}
                  >
                    Cambiar
                  </Button>
                </div>
              </div>
              <div className={styles.rowBody}>
                <p className={styles.rowValue}>{result.label}</p>
                <p className={styles.rowRule}>
                  <strong>Regla →</strong> {result.rule}
                  {foreign && ` (Trabada en nivel ${RISK_NAMES[state.risk].toLowerCase()}.)`}
                </p>
                <div className={styles.rowTools} data-print="hide">
                  {mini(row.id, index)}
                  {result.href && (
                    <Link className={styles.rowLink} to={result.href}>
                      Abrir {row.name} →
                    </Link>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <p className={styles.sheetLink}>
        Para volver a abrirla: {hydrated ? window.location.origin : ''}/?t={code}
      </p>

      <div className={styles.rollBar} data-print="hide">
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
