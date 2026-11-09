import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  consignaNumber,
  decodeConsigna,
  encodeConsigna,
  newConsigna,
  rerollAll,
  rerollHarmonyKeeping,
  rerollRow,
  resolveRows,
  rowIndex,
  ROWS,
  toggleLock,
  type RowId,
  type RowOverrides,
} from '~/core/consigna';
import { DEFAULT_CHORD_BEATS, degreeOf } from '~/core/chords';
import { MIN_CHORDS } from '~/core/variations';
import type { DroneConfig } from '~/core/drone';
import type { ModeId } from '~/core/harmony';
import type { Note } from '~/core/melody';
import type { MelodyKind } from '~/core/melodyRules';
import { describeRhythm, type RhythmConfig } from '~/core/rhythm';
import { createRng, randomSeed } from '~/core/rng';
import { RISK_NAMES } from '~/core/roll';
import { rollHarmonyWith, rollRhythm } from '~/core/rollers';
import { keyOfProgression, translateChord, transposeTo } from '~/core/variations';
import { publishToConsigna, useConsigna, useForm } from '~/shared/consigna';
import { useProject } from '~/shared/project';
import { RiskPicker } from '~/shared/RiskPicker';
import { ExportMidiButton } from '~/shared/ExportMidiButton';
import { Mixer } from '~/shared/Fader';
import { RecordButton } from '~/shared/RecordButton';
import { useSettings } from '~/shared/settings';
import { contextMenu, onFreeDoubleClick, type MenuItem } from '~/shared/ContextMenu';
import { useSectionHarmony } from '~/shared/song';
import { useToolModal } from '~/shared/toolModal';
import { Button } from '~/shared/ui/ui';
import { useHydrated } from '~/shared/useHydrated';
import styles from './consigna.module.css';
import { Sheet } from './Sheet';
import { MiniDrone, MiniForm, MiniHarmony, MiniLyric, MiniMelody, MiniRhythm, MiniTuning } from './Minis';

/** Abre una herramienta encima de la consigna: lo usan el nombre de la tarjeta y sus atajos. */
function useOpenTool() {
  const navigate = useNavigate();
  const open = useToolModal((s) => s.open);
  return (to: string) => {
    open(`${window.location.pathname}${window.location.search}`);
    void navigate(to);
  };
}

/**
 * El nombre de la tarjeta abre su herramienta encima de la consigna. Con Ctrl o el botón del medio
 * sigue siendo un link común.
 */
function OpenTool({ to, name }: { to: string; name: string }) {
  const openTool = useOpenTool();
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openTool(to);
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
  const navigate = useNavigate();
  const openTool = useOpenTool();

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
  const base = valueOf<RowOverrides['armonia']>('armonia');
  const baseRhythm = valueOf<RhythmConfig>('ritmo');
  const melody = valueOf<{ kind?: MelodyKind; notes?: Note[] } | null>('melodia');
  const lyricTarget = valueOf<{ syllables?: number } | null>('letra')?.syllables;
  const baseKey = keyOfProgression(base.chords, base.tonic, base.mode);

  // Tocar un bloque de la forma entra a esa sección: ritmo y armonía muestran lo suyo, y cambiarlos
  // sortea solo para ella. Sin bloque elegido, las tarjetas son la consigna de toda la canción.
  const { blocks } = useForm();
  const [chosen, setFocus] = useState<number | null>(null);
  // Si la forma se acorta, el bloque elegido puede dejar de existir: se vuelve a toda la canción.
  const focus = chosen !== null && chosen < blocks.length ? chosen : null;
  const letter = focus !== null ? (blocks[focus] ?? null) : null;
  const section = useProject((s) => (letter ? s.sections[letter] : undefined));
  const updateSection = useProject((s) => s.updateSection);
  const setActive = useProject((s) => s.setActive);
  /** Tocar el bloque elegido lo suelta; con `keep`, queda elegido igual (el doble clic). */
  const chooseBlock = (index: number | null, keep = false) => {
    const next = index === focus && !keep ? null : index;
    setFocus(next);
    if (next !== null) setActive(blocks[next] ?? 'A');
  };

  const ownChords = letter ? section?.chords : undefined;
  const ownRhythm = letter ? section?.rhythm : undefined;
  // Una sección sin acordes propios toca una variación de la consigna, salvo la primera.
  const derived = useSectionHarmony(letter);
  const variation = !!letter && !ownChords && derived.how !== '';
  const harmony: RowOverrides['armonia'] = ownChords
    ? { chords: ownChords, ...(section?.chordBeats ? { beats: section.chordBeats } : {}) }
    : variation
      ? { chords: derived.chords, ...(derived.chordBeats ? { beats: derived.chordBeats } : {}) }
      : base;
  const rhythm = ownRhythm ?? baseRhythm;
  const harmonyKey = ownChords ? keyOfProgression(ownChords) : baseKey;
  const degrees = harmony.chords.map((name) => degreeOf(name, harmonyKey.tonic) ?? '?').join(' – ');

  // Otra tónica es la misma progresión más arriba o más abajo: los grados quedan, y queda trabada.
  const setTonic = (tonic: number) => {
    if (tonic === harmonyKey.tonic) return;
    if (letter && ownChords) {
      updateSection(letter, {
        chords: transposeTo(ownChords, harmonyKey, tonic),
        ...(section?.chordBeats ? { chordBeats: section.chordBeats } : {}),
      });
      return;
    }
    publishToConsigna('armonia', {
      chords: transposeTo(base.chords, baseKey, tonic),
      tonic,
      mode: baseKey.mode,
      ...(base.beats ? { beats: base.beats } : {}),
    });
  };

  /** Otro modo con la misma tónica: cada grado pasa a ser el de ese modo, y los prestados quedan. */
  const setMode = (mode: ModeId) => {
    if (mode === baseKey.mode) return;
    publishToConsigna('armonia', {
      chords: base.chords.map((name) => translateChord(name, baseKey, mode)),
      tonic: baseKey.tonic,
      mode,
      ...(base.beats ? { beats: base.beats } : {}),
    });
  };

  /** Un grado que había quedado afuera entra al final de la progresión, o donde se lo suelte. */
  const addChord = (name: string, at?: number) => {
    const put = <T,>(list: readonly T[], item: T) => {
      const next = [...list];
      next.splice(at ?? list.length, 0, item);
      return next;
    };
    if (letter && ownChords) {
      updateSection(letter, {
        chords: put(ownChords, name),
        ...(section?.chordBeats ? { chordBeats: put(section.chordBeats, DEFAULT_CHORD_BEATS) } : {}),
      });
      return;
    }
    publishToConsigna('armonia', {
      chords: put(base.chords, name),
      tonic: baseKey.tonic,
      mode: baseKey.mode,
      ...(base.beats ? { beats: put(base.beats, DEFAULT_CHORD_BEATS) } : {}),
    });
    // Los candados quedan con su acorde: el nuevo entra destrabado.
    if (at !== undefined) setChordLocks(put(locks, false));
  };

  /**
   * La progresión con otro orden o sin algún acorde: `order` dice qué acorde de antes va en cada
   * lugar. Los tiempos y los candados viajan con su acorde.
   */
  const reorderChords = (order: number[]) => {
    if (letter && ownChords) {
      const beats = section?.chordBeats;
      updateSection(letter, {
        chords: order.map((i) => ownChords[i]!),
        ...(beats ? { chordBeats: order.map((i) => beats[i] ?? DEFAULT_CHORD_BEATS) } : {}),
      });
      return;
    }
    const beats = base.beats;
    publishToConsigna('armonia', {
      chords: order.map((i) => base.chords[i]!),
      tonic: baseKey.tonic,
      mode: baseKey.mode,
      ...(beats ? { beats: order.map((i) => beats[i] ?? DEFAULT_CHORD_BEATS) } : {}),
    });
    setChordLocks(order.map((i) => locks[i]!));
  };
  const indices = harmony.chords.map((_, i) => i);
  const removeChord = (index: number) => {
    if (harmony.chords.length > MIN_CHORDS) reorderChords(indices.filter((i) => i !== index));
  };
  const moveChord = (index: number, to: number) => {
    if (to < 0 || to >= harmony.chords.length || to === index) return;
    const order = indices.filter((i) => i !== index);
    order.splice(to, 0, index);
    reorderChords(order);
  };

  // Acordes trabados uno por uno: "Cambiar" y "Nueva consigna" sortean los demás en el mismo tono.
  const [chordLocks, setChordLocks] = useState<boolean[]>([]);
  const locks = base.chords.map((_, index) => Boolean(chordLocks[index]));
  const someChordLocked = locks.some(Boolean);
  const toggleChordLock = (index: number) =>
    setChordLocks(base.chords.map((_, i) => (i === index ? !locks[i] : locks[i]!)));
  const rollAll = () => {
    const next = rerollAll(consigna, risk);
    const harmonyLocked = consigna.rows[rowIndex('armonia')]!.locked;
    change(someChordLocked && !harmonyLocked ? rerollHarmonyKeeping(consigna, locks, next) : next);
  };

  /** El tempo es de toda la canción; lo demás del ritmo, de quien lo tenga: la sección o la consigna. */
  const setRhythm = (next: RhythmConfig) => {
    if (letter && ownRhythm) updateSection(letter, { rhythm: next });
    else publishToConsigna('ritmo', next);
  };

  /** Lo de una sección sale en el tono y el tempo de la consigna, para que siga siendo la misma canción. */
  const rollForSection = (id: 'ritmo' | 'armonia') => {
    if (!letter) return;
    const input = { risk, rng: createRng(randomSeed()) };
    if (id === 'ritmo') {
      updateSection(letter, { rhythm: { ...rollRhythm(input).value, bpm: baseRhythm.bpm } });
    } else {
      updateSection(letter, { chords: rollHarmonyWith(input, { tonic: baseKey.tonic }).value.chords });
    }
  };
  const backToConsigna = (id: 'ritmo' | 'armonia') => {
    if (!letter) return;
    updateSection(
      letter,
      id === 'ritmo' ? { rhythm: undefined } : { chords: undefined, chordBeats: undefined },
    );
  };
  const sectionRow = (id: RowId): id is 'ritmo' | 'armonia' =>
    !!letter && (id === 'ritmo' || id === 'armonia');
  const ownOf = (id: 'ritmo' | 'armonia') => (id === 'ritmo' ? !!ownRhythm : !!ownChords);

  const mini = (id: RowId, index: number): ReactNode => {
    switch (id) {
      case 'ritmo':
        return <MiniRhythm config={rhythm} onChange={setRhythm} />;
      case 'armonia':
        return (
          <MiniHarmony
            chords={harmony.chords}
            harmonyKey={harmonyKey}
            tuningNotes={tuningNotes}
            onTonic={setTonic}
            onAdd={addChord}
            onRemove={removeChord}
            onMove={moveChord}
            {...(ownChords ? {} : { onMode: setMode })}
            {...(letter ? {} : { locks, onLock: toggleChordLock })}
          />
        );
      case 'melodia':
        return (
          <MiniMelody
            seed={consigna.rows[index]!.seed}
            kind={melody?.kind ?? null}
            harmonyKey={harmonyKey}
            chords={harmony.chords}
            chosen={melody?.notes ?? null}
          />
        );
      case 'letra':
        return <MiniLyric {...(lyricTarget ? { syllables: lyricTarget } : {})} />;
      case 'forma':
        return (
          <MiniForm
            selected={focus}
            onSelect={chooseBlock}
            onOpenForm={() => openTool(results[index]!.href ?? '/forma')}
          />
        );
      case 'drone':
        return (
          <MiniDrone
            config={valueOf<DroneConfig>('drone')}
            onChange={(next) => publishToConsigna('drone', next)}
          />
        );
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
    if (sectionRow(row.id)) {
      const id = row.id;
      const own = ownOf(id);
      return (
        <div className={styles.rowHead}>
          <h2 className={styles.rowName}>
            {result.href ? <OpenTool to={result.href} name={row.name} /> : row.name}
            <span className={styles.sectionTag} data-own={own}>
              {own
                ? `Propio de ${letter}`
                : id === 'armonia' && variation
                  ? `${letter}: variación de la consigna`
                  : `${letter}: la de la consigna`}
            </span>
          </h2>
          <div className={styles.rowActions} data-print="hide">
            {own && (
              <Button
                variant="mini"
                ariaLabel={`Volver a la ${row.name.toLowerCase()} de la consigna en la sección ${letter}`}
                onClick={() => backToConsigna(id)}
              >
                Consigna
              </Button>
            )}
            <Button
              variant="mini"
              ariaLabel={`Cambiar ${row.name} solo en la sección ${letter}`}
              onClick={() => rollForSection(id)}
            >
              {own ? 'Cambiar' : `Otra para ${letter}`}
            </Button>
          </div>
        </div>
      );
    }
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
            onClick={() => rerollOne(index)}
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
    const isHarmony = row.id === 'armonia';
    // Lo propio de la sección elegida reemplaza a la consigna en esta tarjeta.
    const ownRhythmText = row.id === 'ritmo' && ownRhythm ? describeRhythm(ownRhythm) : null;
    const ownHarmony = isHarmony && !!ownChords;
    const label = ownRhythmText?.label ?? result.label;
    const rule = ownRhythmText
      ? ownRhythmText.rule
      : ownHarmony
        ? `${ownChords!.join(' – ')}. Solo en la sección ${letter}: las demás siguen con la de la consigna.`
        : isHarmony && variation
          ? `${derived.how} Con "Otra para ${letter}" sale una propia.`
          : `${result.rule}${foreign ? ` (Trabada en nivel ${RISK_NAMES[state.risk].toLowerCase()}.)` : ''}`.trim();
    return (
      <div className={styles.rowBody}>
        <p className={styles.rowValue} title={label} data-testid={isHarmony ? 'mini-degrees' : undefined}>
          {isHarmony ? degrees : label}
        </p>
        {rule && (
          <p className={styles.rowRule} title={rule}>
            {rule}
          </p>
        )}
      </div>
    );
  };

  /** Cambiar una fila, igual que su botón: en la armonía respeta los acordes trabados. */
  const rerollOne = (index: number) =>
    change(
      ROWS[index]!.id === 'armonia' && someChordLocked
        ? rerollHarmonyKeeping(consigna, locks)
        : rerollRow(consigna, index),
    );

  /** Lo de toda la consigna: va al final de cada menú y es el menú del fondo. */
  const pageItems = (): MenuItem[] => [
    { label: allLocked ? 'Todo trabado' : 'Nueva consigna', onSelect: rollAll, disabled: allLocked },
    { label: '↩ Volver a la anterior', onSelect: undo, disabled: !canUndo },
    { label: '↪ Rehacer', onSelect: redo, disabled: !canRedo },
  ];
  const pageMenu = contextMenu<HTMLDivElement>(
    () => [
      ...pageItems(),
      null,
      { label: '▶ Escuchar todo', onSelect: () => void navigate('/estudio') },
      { label: 'Copiar link', onSelect: () => void share() },
      { label: 'Hoja en PDF', onSelect: () => window.print() },
    ],
    () => `Consigna Nº ${number}`,
  );

  /**
   * El clic derecho sobre una tarjeta: lo mismo que tiene a mano (abrir, oír, trabar, cambiar), en
   * un solo lugar. "Oír" es el primer botón de su pie, así dice lo mismo que él (Progresión, Parar…).
   */
  const cardMenu = (index: number) =>
    contextMenu<HTMLElement>((card) => {
      const row = ROWS[index]!;
      const state = consigna.rows[index]!;
      const href = results[index]!.href;
      const play = card.querySelector<HTMLButtonElement>(
        `.${styles.foot} button, .${styles.stripPlay} button`,
      );
      const section = sectionRow(row.id) ? row.id : null;
      return [
        href && row.id !== 'carta'
          ? { label: `Abrir ${row.name} ↗`, onSelect: () => openTool(href) }
          : undefined,
        play ? { label: play.textContent?.trim() || 'Oír', onSelect: () => play.click() } : undefined,
        null,
        ...(section
          ? [
              ownOf(section) && {
                label: `Volver a la de la consigna en ${letter}`,
                onSelect: () => backToConsigna(section),
              },
              {
                label: ownOf(section) ? `Cambiar solo en ${letter}` : `Otra para ${letter}`,
                onSelect: () => rollForSection(section),
              },
            ]
          : [
              {
                label: 'Trabada',
                checked: state.locked,
                onSelect: () => change(toggleLock(consigna, index)),
              },
              { label: row.id === 'carta' ? 'Sacar otra' : 'Cambiar', onSelect: () => rerollOne(index) },
            ]),
        null,
        ...pageItems(),
      ];
    }, ROWS[index]!.name);

  /** Doble clic en una parte libre de la tarjeta: abre su herramienta. */
  const cardDouble = (index: number) => {
    const href = results[index]!.href;
    return href && ROWS[index]!.id !== 'carta'
      ? onFreeDoubleClick<HTMLElement>(() => openTool(href))
      : undefined;
  };

  const cartaIndex = rowIndex('carta');
  const carta = consigna.rows[cartaIndex]!;
  const tuningIndex = rowIndex('afinacion');
  const tuningRow = consigna.rows[tuningIndex]!;

  return (
    <div className={styles.page} onContextMenu={pageMenu}>
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
        onContextMenu={cardMenu(cartaIndex)}
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
        onContextMenu={cardMenu(tuningIndex)}
        onDoubleClick={cardDouble(tuningIndex)}
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
              data-locked={sectionRow(row.id) ? false : state.locked}
              data-chosen={!!state.override}
              data-section={sectionRow(row.id) ? letter : undefined}
              data-row={row.id}
              onContextMenu={cardMenu(index)}
              onDoubleClick={cardDouble(index)}
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

      <Sheet
        tuningLabel={results[tuningIndex]!.label}
        tuningNotes={tuningNotes}
        rhythmLabel={results[rowIndex('ritmo')]!.label}
        harmony={{ chords: base.chords, ...(base.beats ? { beats: base.beats } : {}), ...baseKey }}
        harmonyKey={baseKey}
        melody={{
          label: results[rowIndex('melodia')]!.label,
          kind: melody?.kind ?? null,
          seed: consigna.rows[rowIndex('melodia')]!.seed,
        }}
      />

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
        <Button variant="primary" full onClick={rollAll} id="roll" disabled={allLocked}>
          {allLocked ? 'Todo trabado' : 'Nueva consigna'}
        </Button>
        <Button onClick={redo} id="redo" disabled={!canRedo} ariaLabel="Rehacer">
          ↪
        </Button>
      </div>
    </div>
  );
}
