// Letras: una sola pantalla. A la izquierda la letra, con sus sílabas y su rima en el margen y los
// avisos debajo; a la derecha, las herramientas (rimas, acentos, material y cut-up), que escriben en
// la letra en vez de en un texto aparte. En escritorio entra entera: cada panel se desplaza adentro.
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import type { MetaFunction } from 'react-router';
import { resolveRow, rowIndex } from '~/core/consigna';
import {
  findRhymes,
  groupBySyllables,
  parseRhymeIndex,
  type RhymeGroup,
  type RhymeIndex,
  type RhymeMode,
} from '~/core/rhymes';
import { createRng, randomSeed } from '~/core/rng';
import { rollLyric } from '~/core/rollers';
import { cutUp, lastWord } from '~/core/spanish';
import {
  FREE,
  analyze,
  lupa,
  pautaFromConsigna,
  problems,
  stressRows,
  type Align,
  type Pauta,
  type RhymeKind,
  type VerseLine,
} from '~/core/verse';
import { MOLDS } from '~/data/lyrics-material';
import { IMAGE_POOL } from '~/data/pools';
import { publishToConsigna, useConsigna } from '~/shared/consigna';
import { useProject } from '~/shared/project';
import { SectionPicker } from '~/shared/SectionPicker';
import { useSettings } from '~/shared/settings';
import { contextMenu } from '~/shared/ContextMenu';
import { draggable, dropTarget, insertionIndex, reorderTo } from '~/shared/drag';
import { Button, Segmented } from '~/shared/ui/ui';
import styles from './letras.module.css';

export const meta: MetaFunction = () => [
  { title: 'Herramientas para escribir letras: sílabas, rimas y acentos · Scordatura' },
  {
    name: 'description',
    content:
      'Escribí la letra con las sílabas y la rima de cada verso a la vista, moldes de la tradición, acentos comparados entre versos, diccionario de rimas con voseo, cut-up y escritura contra reloj.',
  },
];

/** La consigna de letra que está en curso. */
function useLyricRow(): { label: string; rule: string } {
  const consigna = useConsigna((s) => s.consigna);
  return useMemo(() => {
    const index = rowIndex('letra');
    const { label, rule } = resolveRow(index, consigna.rows[index]!);
    return { label, rule };
  }, [consigna]);
}

/**
 * Una palabra o un pedazo se puede arrastrar hasta la letra: el navegador la pone donde se suelta.
 * Es el arrastre nativo, el que entiende un campo de texto.
 */
const wordDrag = (text: string) => ({
  draggable: true,
  onDragStart: (event: DragEvent<HTMLElement>) => {
    event.dataTransfer.setData('text/plain', text);
    event.dataTransfer.effectAllowed = 'copy';
  },
});

/** Menú de una palabra de las herramientas: ponerla, o buscar con qué rima. */
const wordMenu = (text: string, onInsert: (text: string) => void, onRhymes?: (word: string) => void) =>
  contextMenu<HTMLElement>(
    () => [
      { label: 'Poner donde está el cursor', onSelect: () => onInsert(text) },
      onRhymes && { label: `Rimas de «${lastWord(text)}»`, onSelect: () => onRhymes(lastWord(text)) },
      { label: 'Copiar', onSelect: () => void navigator.clipboard?.writeText(text) },
    ],
    text,
  );

const rollConsigna = (risk: Parameters<typeof rollLyric>[0]['risk']) => {
  const rolled = rollLyric({ risk, rng: createRng(randomSeed()) });
  publishToConsigna('letra', { label: rolled.label, rule: rolled.rule });
};

// ——— La pauta ———

type MoldChoice = 'libre' | 'consigna' | 'medida' | (typeof MOLDS)[number]['id'];
const CUSTOM_SCHEMES = ['', 'abab', 'aabb', 'abba', 'xaxa', '-'];
const schemeName = (scheme: string) =>
  scheme === '' ? 'Sin esquema' : scheme === '-' ? 'Sin rima' : scheme.toUpperCase().replace(/X/g, 'x');

function describe(pauta: Pauta): string {
  const parts: string[] = [];
  if (pauta.pattern.length) parts.push(`${[...new Set(pauta.pattern)].join('-')} sílabas`);
  if (pauta.scheme) parts.push(schemeName(pauta.scheme));
  return parts.join(', ') || 'libre';
}

// ——— El reloj ———

const CLOCK_SECONDS = 180;

function useClock() {
  const [remaining, setRemaining] = useState<number | null>(null);
  const running = remaining !== null && remaining > 0;
  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(() => setRemaining((value) => (value ?? 1) - 1), 1000);
    return () => clearTimeout(timer);
  }, [running, remaining]);
  const shown = remaining ?? CLOCK_SECONDS;
  return {
    running,
    done: remaining === 0,
    time: `${Math.floor(shown / 60)}:${String(shown % 60).padStart(2, '0')}`,
    toggle: () => setRemaining(running ? null : CLOCK_SECONDS),
  };
}

// ——— El diccionario ———

let indexPromise: Promise<RhymeIndex> | null = null;
/** La lista pesa un mega: se pide recién al buscar la primera rima. */
function loadIndex(): Promise<RhymeIndex> {
  indexPromise ??= fetch('/palabras.txt')
    .then((response) => {
      if (!response.ok) throw new Error('No se pudo cargar la lista');
      return response.text();
    })
    .then(parseRhymeIndex)
    .catch((error) => {
      indexPromise = null;
      throw error;
    });
  return indexPromise;
}

const PER_GROUP = 15;

/** La búsqueda de rimas vive arriba: el margen del editor también la dispara. */
function useRhymeSearch() {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<RhymeMode>('consonante');
  const [groups, setGroups] = useState<RhymeGroup[] | null>(null);
  const [status, setStatus] = useState('');
  const [searched, setSearched] = useState('');

  const search = async (word = query, how = mode) => {
    if (!word.trim()) return;
    setQuery(word);
    setStatus('Buscando…');
    try {
      const index = await loadIndex();
      const found = findRhymes(index, word, how);
      const grouped = groupBySyllables(found, PER_GROUP, Math.random());
      setGroups(grouped);
      setSearched(word.trim());
      const sampled = grouped.some((group) => group.total > group.words.length);
      setStatus(
        found.length === 0
          ? 'No encontré palabras.'
          : `${found.length} palabras${sampled ? '. Es una muestra: buscá de nuevo para ver otras' : ''}.`,
      );
    } catch {
      setStatus('No se pudo cargar el diccionario. Revisá la conexión y probá de nuevo.');
    }
  };

  return { query, setQuery, mode, setMode, groups, status, searched, search };
}

function RhymePanel({
  rhymes,
  current,
  onInsert,
}: {
  rhymes: ReturnType<typeof useRhymeSearch>;
  /** La última palabra del verso donde está el cursor. */
  current: string;
  onInsert: (word: string) => void;
}) {
  const { query, setQuery, mode, setMode, groups, status, searched, search } = rhymes;
  return (
    <>
      {current && (
        <Button variant="mini" full id="rhyme-current" onClick={() => void search(current)}>
          Rimas de «{current}»
        </Button>
      )}
      <form
        className={styles.rhymeForm}
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <input
          value={query}
          aria-label={mode === 'final' ? 'Terminación' : 'Palabra'}
          placeholder={mode === 'final' ? 'ción' : 'camino'}
          data-testid="rhyme-query"
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit" className={styles.submit} id="rhyme-search">
          Buscar
        </button>
      </form>
      <Segmented
        label="Buscar por"
        value={mode}
        onChange={(next) => {
          setMode(next);
          if (searched) void search(query, next);
        }}
        stretch
        options={[
          { value: 'consonante', label: 'Consonante' },
          { value: 'asonante', label: 'Asonante' },
          { value: 'final', label: 'Final' },
        ]}
      />
      <p role="status" className={styles.hint}>
        {status}
      </p>
      {groups && groups.length > 0 && (
        <div className={styles.rhymeGroups} data-testid="rhyme-results">
          {groups.map((group) => (
            <div key={group.syllables}>
              <h4>
                {group.syllables} {group.syllables === 1 ? 'sílaba' : 'sílabas'}
                {group.total > group.words.length && <span> · {group.total}</span>}
              </h4>
              <ul>
                {group.words.map((word) => (
                  <li key={word}>
                    <button
                      type="button"
                      title="Tocala para ponerla donde está el cursor, o arrastrala hasta la letra"
                      onClick={() => onInsert(word)}
                      onContextMenu={wordMenu(word, onInsert, (next) => void search(next))}
                      {...wordDrag(word)}
                    >
                      {word}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <p className={styles.hint}>
        Tocá la letra de rima de un verso, o una palabra para ponerla donde está el cursor (o arrastrala hasta
        donde va). Para una nota larga, mejor una vocal abierta: a, e, o.
      </p>
    </>
  );
}

// ——— Los acentos ———

function StressPanel({ stanzas }: { stanzas: VerseLine[][] }) {
  const [align, setAlign] = useState<Align>('final');
  const [refs, setRefs] = useState<Record<number, number>>({});
  return (
    <>
      <Segmented
        label="Alinear"
        value={align}
        onChange={setAlign}
        stretch
        options={[
          { value: 'final', label: 'Por el final' },
          { value: 'inicio', label: 'Por el principio' },
        ]}
      />
      <p className={styles.hint}>
        Sobre la misma melodía, los versos acentúan en los mismos lugares. Se comparan con el marcado: en
        naranja, un acento de más; punteado, uno que falta. Tocá un número para cambiar la referencia.
      </p>
      {stanzas.length === 0 && <p className={styles.hint}>Escribí unos versos para ver sus acentos.</p>}
      {stanzas.map((lines) => {
        const stanza = lines[0]!.stanza;
        const reference = refs[stanza] ?? lines[0]!.row;
        const rows = stressRows(lines, reference, align);
        return (
          <div key={stanza} className={styles.stressScroll}>
            <div className={styles.stressGrid} data-testid="prosody-stanza">
              {rows.map((row, index) => (
                <StressLine
                  key={row.row}
                  gridRow={index + 1}
                  row={row}
                  isRef={row.row === reference}
                  onPick={() => setRefs({ ...refs, [stanza]: row.row })}
                />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function StressLine({
  row,
  gridRow,
  isRef,
  onPick,
}: {
  row: ReturnType<typeof stressRows>[number];
  gridRow: number;
  isRef: boolean;
  onPick: () => void;
}) {
  return (
    <>
      <button
        type="button"
        className={styles.stressLabel}
        style={{ gridRow, gridColumn: 1 }}
        aria-pressed={isRef}
        aria-label={`Verso ${row.row + 1}, acentos en ${row.positions.join(', ')}${isRef ? ', referencia' : ''}`}
        onClick={onPick}
      >
        {row.row + 1}
      </button>
      {row.cells.map((cell, index) => (
        <span
          key={index}
          data-testid="prosody-cell"
          className={styles.stressCell}
          style={{ gridRow, gridColumn: row.offset + index + 2 }}
          data-stressed={cell.stressed}
          data-clash={cell.clash}
          data-missing={cell.missing}
        >
          {cell.text}
        </span>
      ))}
    </>
  );
}

// ——— Material ———

function MaterialPanel({
  onInsert,
  onForbid,
}: {
  onInsert: (text: string) => void;
  onForbid: (word: string) => void;
}) {
  const risk = useSettings((s) => s.risk);
  const [seed, setSeed] = useState(1);
  const roll = useMemo(() => {
    const rng = createRng(seed);
    return {
      object: rng.pick(IMAGE_POOL.objects),
      place: rng.pick(IMAGE_POOL.places),
      verb: rng.pick(IMAGE_POOL.verbs),
      title: rng.pick(IMAGE_POOL.titles),
      forbidden: rng.pick(IMAGE_POOL.forbidden),
      restriction: rng.pick(IMAGE_POOL.restrictions),
      consigna: rollLyric({ risk, rng }),
    };
  }, [seed, risk]);

  const chip = (text: string) => (
    <button
      type="button"
      className={styles.chip}
      onClick={() => onInsert(text)}
      onContextMenu={wordMenu(text, onInsert)}
      {...wordDrag(text)}
    >
      {text}
    </button>
  );

  return (
    <>
      <Button full id="roll-material" onClick={() => setSeed(randomSeed())}>
        Sortear material
      </Button>
      <dl className={styles.material} data-testid="material">
        <div>
          <dt>Imagen</dt>
          <dd>
            {chip(roll.object)} {chip(roll.place)} {chip(roll.verb)}
          </dd>
          <dd className={styles.why}>Lo concreto escapa de las palabras abstractas. Tocá para ponerla.</dd>
        </div>
        <div>
          <dt>Título primero</dt>
          <dd>{chip(roll.title)}</dd>
          <dd className={styles.why}>Escribí hacia este título, para que la letra llegue a algún lado.</dd>
        </div>
        <div>
          <dt>Sin decir</dt>
          <dd>
            <button
              type="button"
              className={styles.chip}
              id="forbid-material"
              onClick={() => onForbid(roll.forbidden)}
            >
              {roll.forbidden} ✕
            </button>
          </dd>
          <dd className={styles.why}>Tocala para prohibirla: si no podés nombrarlo, tenés que mostrarlo.</dd>
        </div>
        <div>
          <dt>Restricción</dt>
          <dd>{roll.restriction}</dd>
        </div>
        <div>
          <dt>Otra consigna</dt>
          <dd>{roll.consigna.label}</dd>
          <dd className={styles.why}>{roll.consigna.rule}</dd>
        </div>
      </dl>
      <Button
        full
        id="use-material"
        onClick={() => publishToConsigna('letra', { label: roll.consigna.label, rule: roll.consigna.rule })}
      >
        Usar esta consigna
      </Button>
    </>
  );
}

// ——— Cut-up ———

function CutUpPanel({ text, onInsert }: { text: string; onInsert: (piece: string) => void }) {
  const [extra, setExtra] = useState('');
  const [pieces, setPieces] = useState<string[]>([]);
  const source = [text, extra].filter((part) => part.trim()).join('\n');
  return (
    <>
      <p className={styles.hint}>
        Corta tu letra (y lo que pegues acá) en pedazos de dos a cuatro palabras y los mezcla. Tocá lo que te
        sorprenda: entra a la letra donde está el cursor.
      </p>
      <label className={styles.field}>
        <span>Sumá otro texto</span>
        <textarea
          rows={3}
          value={extra}
          placeholder="Frases sueltas, un diario, un prospecto"
          data-testid="cutup-source"
          onChange={(event) => setExtra(event.target.value)}
        />
      </label>
      <Button
        full
        id="cut"
        disabled={!source.trim()}
        onClick={() => setPieces(cutUp(source, createRng(randomSeed()).next))}
      >
        Cortar y mezclar
      </Button>
      <div className={styles.pieces} data-testid="cutup-pieces">
        {pieces.map((piece, index) => (
          <button
            key={`${piece}-${index}`}
            type="button"
            onClick={() => onInsert(piece)}
            onContextMenu={wordMenu(piece, onInsert)}
            {...wordDrag(piece)}
          >
            {piece}
          </button>
        ))}
      </div>
    </>
  );
}

// ——— La pantalla ———

type PanelId = 'rimas' | 'acentos' | 'material' | 'cutup';

export default function LetrasRoute() {
  const risk = useSettings((s) => s.risk);
  const active = useProject((s) => s.active);
  const text = useProject((s) => s.sections[s.active]?.text) ?? '';
  const updateSection = useProject((s) => s.updateSection);
  const { label, rule } = useLyricRow();
  const fromConsigna = pautaFromConsigna(label);

  const [choice, setChoice] = useState<MoldChoice | null>(null);
  const mold: MoldChoice = choice ?? (fromConsigna ? 'consigna' : 'libre');
  const [custom, setCustom] = useState<Pauta>({ pattern: [8], scheme: 'abab' });
  const [kind, setKind] = useState<RhymeKind>('asonante');
  const [forbidden, setForbidden] = useState('');
  const [caret, setCaret] = useState(0);
  const [panel, setPanel] = useState<PanelId>('rimas');
  const rhymes = useRhymeSearch();
  const area = useRef<HTMLTextAreaElement>(null);
  const clock = useClock();

  const found = MOLDS.find((item) => item.id === mold);
  const pauta: Pauta =
    mold === 'consigna'
      ? (fromConsigna ?? FREE)
      : mold === 'medida'
        ? custom
        : found
          ? { pattern: found.pattern, scheme: found.scheme }
          : FREE;

  const stanzas = analyze(text, pauta, kind, forbidden);
  const byRow = new Map(stanzas.flatMap((stanza) => stanza.lines).map((line) => [line.row, line]));
  const rows = text.split('\n');
  const notes = problems(stanzas, pauta);
  const looks = lupa(text);
  const currentWord = lastWord(rows[caret] ?? '');

  const trackCaret = () => {
    const element = area.current;
    if (element) setCaret(element.value.slice(0, element.selectionStart).split('\n').length - 1);
  };

  /** Pone una palabra o un pedazo donde está el cursor, con un espacio si hace falta. */
  const insert = (piece: string) => {
    const element = area.current;
    const at = element?.selectionStart ?? text.length;
    const before = text.slice(0, at);
    const after = text.slice(at);
    const space = before && !/\s$/.test(before) ? ' ' : '';
    updateSection(active, { text: `${before}${space}${piece}${after}` });
    const position = at + space.length + piece.length;
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(position, position);
    });
  };

  /** Lo soltado queda separado por espacios de lo que tiene al lado. */
  const spaceDropped = () => {
    const element = area.current;
    if (!element) return;
    const { value, selectionStart: start, selectionEnd: end } = element;
    if (start === end) return;
    const before = start > 0 && !/\s/.test(value[start - 1]!) ? ' ' : '';
    const after = end < value.length && !/[\s.,;:!?…)»]/.test(value[end]!) ? ' ' : '';
    if (!before && !after) return;
    const next = `${value.slice(0, start)}${before}${value.slice(start, end)}${after}${value.slice(end)}`;
    updateSection(active, { text: next });
    const position = end + before.length + after.length;
    requestAnimationFrame(() => element.setSelectionRange(position, position));
  };

  /** Los versos se reordenan, se repiten o se borran desde el margen. */
  const editRows = (next: string[]) => updateSection(active, { text: next.join('\n') });
  const moveRow = (from: number, to: number) => {
    if (from === to || to < 0 || to >= rows.length) return;
    const next = [...rows];
    const [line] = next.splice(from, 1);
    next.splice(to, 0, line!);
    editRows(next);
    setCaret(to);
  };
  const selectRow = (row: number) => {
    const element = area.current;
    if (!element) return;
    const start = rows.slice(0, row).reduce((sum, line) => sum + line.length + 1, 0);
    element.focus();
    element.setSelectionRange(start, start + (rows[row]?.length ?? 0));
    setCaret(row);
  };
  const rowMenu = (row: number) =>
    contextMenu<HTMLElement>(
      () => {
        const word = lastWord(rows[row] ?? '');
        return [
          word && { label: `Rimas de «${word}»`, onSelect: () => searchLine(word) },
          { label: 'Elegir el verso', onSelect: () => selectRow(row) },
          null,
          { label: '↑ Subir', disabled: row === 0, onSelect: () => moveRow(row, row - 1) },
          { label: '↓ Bajar', disabled: row === rows.length - 1, onSelect: () => moveRow(row, row + 1) },
          {
            label: 'Repetirlo abajo',
            onSelect: () => editRows([...rows.slice(0, row + 1), rows[row]!, ...rows.slice(row + 1)]),
          },
          {
            label: clock.running ? 'Borrar (no con el reloj)' : 'Borrar el verso',
            disabled: clock.running,
            onSelect: () => editRows(rows.filter((_, i) => i !== row)),
          },
        ];
      },
      `Verso ${row + 1}`,
    );
  const dragRow = (row: number) =>
    draggable<HTMLElement>(() =>
      rows[row]?.trim()
        ? {
            group: 'letra-verso',
            label: rows[row]!.trim(),
            axis: 'y',
            onDrop: (target, after) => moveRow(row, reorderTo(row, insertionIndex(target, after))),
          }
        : null,
    );

  const searchLine = (word: string) => {
    setPanel('rimas');
    void rhymes.search(word);
  };

  const moldOptions: Array<{ value: MoldChoice; label: string }> = [
    { value: 'libre', label: 'Libre' },
    ...(fromConsigna ? [{ value: 'consigna' as const, label: `Consigna: ${describe(fromConsigna)}` }] : []),
    ...MOLDS.map((item) => ({
      value: item.id,
      label: `${item.name} (${item.pattern.length > 4 ? `${item.pattern.length} de 8` : item.pattern.join('-')})`,
    })),
    { value: 'medida', label: 'A medida' },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <p className={styles.eyebrow}>Consigna de letra</p>
          <h1 className={styles.title} title={label}>
            {label}
          </h1>
          <p className={styles.rule} title={rule}>
            <span data-testid="lyric-rule">{rule}</span>
          </p>
        </div>
        <Button id="roll-lyric" onClick={() => rollConsigna(risk)}>
          Sortear otra
        </Button>
      </header>

      <div className={styles.toolbar}>
        <SectionPicker />
        <label className={styles.field}>
          <span>Molde</span>
          <select
            value={mold}
            data-testid="mold"
            onChange={(event) => setChoice(event.target.value as MoldChoice)}
          >
            {moldOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {mold === 'medida' && (
          <>
            <label className={styles.field}>
              <span>Sílabas</span>
              <input
                type="number"
                min={2}
                max={20}
                value={custom.pattern[0] ?? ''}
                data-testid="target"
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setCustom({ ...custom, pattern: value > 0 ? [value] : [] });
                }}
              />
            </label>
            <label className={styles.field}>
              <span>Esquema</span>
              <select
                value={custom.scheme}
                data-testid="scheme"
                onChange={(event) => setCustom({ ...custom, scheme: event.target.value })}
              >
                {CUSTOM_SCHEMES.map((scheme) => (
                  <option key={scheme} value={scheme}>
                    {schemeName(scheme)}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <div className={styles.field}>
          <span>Rima</span>
          <Segmented
            label="Tipo de rima"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'asonante', label: 'Asonante' },
              { value: 'consonante', label: 'Consonante' },
            ]}
          />
        </div>
        <label className={styles.field}>
          <span>Prohibida</span>
          <input
            value={forbidden}
            placeholder="noche"
            data-testid="forbidden"
            onChange={(event) => setForbidden(event.target.value)}
          />
        </label>
        <div className={styles.field}>
          <span>Sin borrar</span>
          <Button id="clock-start" ariaPressed={clock.running} onClick={clock.toggle}>
            <span data-testid="clock" role="timer">
              {clock.time}
            </span>{' '}
            {clock.running ? '■ Parar' : '▶ Reloj'}
          </Button>
        </div>
      </div>

      <div className={styles.work}>
        <section className={styles.writing} aria-label={`Letra de la sección ${active}`}>
          <div className={styles.editorScroll} data-clock={clock.running}>
            <div className={styles.editor}>
              <ol className={styles.gutter} aria-label="Sílabas y rima de cada verso">
                {rows.map((_, row) => {
                  const line = byRow.get(row);
                  const handlers = {
                    onContextMenu: rowMenu(row),
                    onPointerDown: dragRow(row),
                    onDoubleClick: () => selectRow(row),
                    ...dropTarget('letra-verso', row),
                  };
                  if (!line) return <li key={row} data-current={row === caret} {...handlers} />;
                  const off = line.want !== null && line.count.total !== line.want;
                  const badRhyme = line.missesRow >= 0 || line.rhymesWhenBlank;
                  return (
                    <li
                      key={row}
                      data-testid="line"
                      data-off={off}
                      data-current={row === caret}
                      data-forbidden={line.forbidden}
                      title="Arrastralo para mover el verso · doble clic: elegirlo · clic derecho: más"
                      {...handlers}
                    >
                      <span
                        className={styles.count}
                        data-testid="line-count"
                        title={`${line.count.total} sílabas${line.want ? `, pide ${line.want}` : ''}`}
                      >
                        {line.count.total}
                      </span>
                      <button
                        type="button"
                        className={styles.letter}
                        data-testid="line-rhyme"
                        data-bad={badRhyme}
                        aria-label={`Rimas para «${lastWord(line.text)}», verso ${row + 1}`}
                        onClick={() => searchLine(lastWord(line.text))}
                      >
                        {line.letter}
                      </button>
                    </li>
                  );
                })}
              </ol>
              <textarea
                ref={area}
                wrap="off"
                rows={Math.max(6, rows.length + 1)}
                value={text}
                aria-label={`Letra de la sección ${active}`}
                placeholder={'Escribí un verso por línea.\nUna línea vacía separa estrofas.'}
                spellCheck={false}
                data-testid="lyric-text"
                onSelect={trackCaret}
                onKeyUp={trackCaret}
                onClick={trackCaret}
                onDrop={() => requestAnimationFrame(spaceDropped)}
                onChange={(event) => {
                  // Con el reloj corriendo, el texto solo puede crecer.
                  if (clock.running && event.target.value.length < text.length) return;
                  updateSection(active, { text: event.target.value });
                  trackCaret();
                }}
              />
            </div>
          </div>

          <div className={styles.notes}>
            {clock.running && (
              <p className={styles.notice}>Corre el reloj: escribí sin parar, borrar no funciona.</p>
            )}
            {clock.done && <p className={styles.notice}>Tiempo. Ahora sí, leelo y rescatá lo que sirva.</p>}
            <Notes title={`Pauta: ${describe(pauta)}${found ? ` · ${found.note}` : ''}`}>
              {text.trim() === '' ? (
                <li>
                  Al lado de cada verso, sus sílabas y su letra de rima. Cuenta con sinalefa; la final aguda
                  suma una y la esdrújula resta una. Al cantar se estira o se junta: tomalo como guía.
                </li>
              ) : notes.length ? (
                notes.map((note) => (
                  <li key={note} data-tone="warn">
                    {note}
                  </li>
                ))
              ) : (
                <li data-tone="ok">{pauta === FREE ? 'Sin pauta: nada que cumplir.' : 'Cumple la pauta.'}</li>
              )}
            </Notes>
            {looks.length > 0 && (
              <Notes title="Lupa">
                {looks.map((note) => (
                  <li key={note.text} data-tone={note.tone}>
                    {note.text}
                  </li>
                ))}
              </Notes>
            )}
          </div>
        </section>

        <aside className={styles.side} aria-label="Herramientas">
          <div className={styles.sideTabs}>
            <Segmented<PanelId>
              label="Herramienta"
              value={panel}
              onChange={setPanel}
              stretch
              options={[
                { value: 'rimas', label: 'Rimas' },
                { value: 'acentos', label: 'Acentos' },
                { value: 'material', label: 'Material' },
                { value: 'cutup', label: 'Cut-up' },
              ]}
            />
          </div>
          <div className={styles.sideBody} data-testid={`panel-${panel}`}>
            {panel === 'rimas' && <RhymePanel rhymes={rhymes} current={currentWord} onInsert={insert} />}
            {panel === 'acentos' && <StressPanel stanzas={stanzas.map((stanza) => stanza.lines)} />}
            {panel === 'material' && <MaterialPanel onInsert={insert} onForbid={setForbidden} />}
            {panel === 'cutup' && <CutUpPanel text={text} onInsert={insert} />}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Notes({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className={styles.panelTitle}>{title}</h3>
      <ul>{children}</ul>
    </section>
  );
}
