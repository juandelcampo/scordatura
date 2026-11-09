import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams, type MetaFunction } from 'react-router';
import { rhythmToParams, type Meter, type RhythmConfig } from '~/core/rhythm';
import { createRng, randomSeed } from '~/core/rng';
import { harmonyHref } from '~/core/chords';
import { rollForm, rollHarmony, rollLyric, rollRhythm } from '~/core/rollers';
import { DEFAULT_BARS, MAX_BARS } from '~/core/song';
import { FORM_EXAMPLES, type FormExample } from '~/data/forms';
import {
  FORM_FAMILIES,
  SECTION_TERMS,
  SONG_FORMS,
  formLetters,
  formNames,
  formRule,
  type FormFamilyId,
} from '~/data/structures';
import { newConsigna, type RowOverrides } from '~/core/consigna';
import {
  applyForm,
  blocksOf,
  editBlocks,
  publishToConsigna,
  useConsigna,
  useForm,
  type ConsignaForm,
} from '~/shared/consigna';
import { draggable, insertionIndex } from '~/shared/drag';
import { FormStrip, useSongPlayer } from '~/shared/FormStrip';
import { isValidBlocks, letterList, useProject } from '~/shared/project';
import { RecordButton } from '~/shared/RecordButton';
import { useSettings } from '~/shared/settings';
import { useSectionHarmony } from '~/shared/song';
import { Button, Segmented, Stepper, Tabs } from '~/shared/ui/ui';
import styles from './forma.module.css';

export const meta: MetaFunction = () => [
  { title: 'Forma de la canción: AABA, estrofa-estribillo y otras · Scordatura' },
  {
    name: 'description',
    content:
      'Armá el esqueleto de tu canción con bloques, elegí entre más de cuarenta formas (pop, jazz, blues, electrónica, folklore, clásicas y raras) y aprendé qué es cada sección.',
  },
];

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const MAX_BLOCKS = 24;
const DEFAULT_METER: Meter = { groups: [1, 1, 1, 1], denom: 4 };

/** Los acordes de un bloque, sin repetir los que siguen iguales. */
const chordsOf = (changes: Array<{ name: string }>) =>
  changes
    .map((change) => change.name)
    .filter((name, index, all) => name !== all[index - 1])
    .join(' ');

/** La forma como canción: se oye, se ordena arrastrando y cada bloque dice qué es y qué suena. */
function Timeline({ selected, onSelect }: { selected: number; onSelect: (index: number) => void }) {
  const { blocks, names } = useForm();
  const active = useProject((s) => s.active);
  const setActive = useProject((s) => s.setActive);
  const player = useSongPlayer();
  const position = Math.min(selected, blocks.length - 1);
  const used = letterList(blocks);
  const fresh = LETTERS.find((letter) => !used.includes(letter));

  const select = (index: number) => {
    onSelect(index);
    setActive(blocks[index] ?? 'A');
  };
  const move = (from: number, to: number, continuing = false) => {
    if (to < 0 || to >= blocks.length || from === to) return;
    const next = [...blocks];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    editBlocks(next, { continuing });
    onSelect(to);
  };
  const add = (letter: string, at = blocks.length) => {
    if (blocks.length >= MAX_BLOCKS) return;
    const next = [...blocks];
    next.splice(at, 0, letter);
    editBlocks(next);
    onSelect(at);
    setActive(letter);
  };
  /** Un "+ A" se puede llevar hasta el lugar de la tira donde va. */
  const dragAdd = (letter: string) =>
    draggable<HTMLButtonElement>(() =>
      blocks.length >= MAX_BLOCKS
        ? null
        : {
            group: 'forma-bloque',
            label: `+ ${letter}`,
            onDrop: (target, after) => add(letter, insertionIndex(target, after)),
          },
    );

  return (
    <section className={styles.song} aria-label="La forma">
      <div className={styles.songBar}>
        <Button
          variant="primary"
          id="form-play"
          ariaLabel={player.running ? 'Parar la forma' : 'Oír la forma'}
          onClick={() => player.toggle(position)}
        >
          {player.running ? '■ Parar' : '▶ Oír la forma'}
        </Button>
        <span className={styles.songInfo}>
          {player.plan.bpm} ppm · {player.bars.reduce((sum, bars) => sum + bars, 0)} compases · arranca en el
          bloque marcado
        </span>
      </div>
      <FormStrip
        blocks={blocks}
        names={names}
        bars={player.bars}
        detail={(index) => chordsOf(player.plan.blocks[index]?.changes ?? [])}
        selected={position}
        active={active}
        onSelect={select}
        onMove={move}
        dropGroup="forma-bloque"
        onDouble={(index) => {
          select(index);
          player.playFrom(index);
        }}
        menu={(index) => [
          { label: '▶ Oír desde acá', onSelect: () => player.playFrom(index) },
          player.running && { label: '■ Parar', onSelect: () => player.toggle() },
          null,
          { label: '← Mover a la izquierda', disabled: index === 0, onSelect: () => move(index, index - 1) },
          {
            label: 'Mover a la derecha →',
            disabled: index === blocks.length - 1,
            onSelect: () => move(index, index + 1),
          },
          {
            label: `Repetir ${blocks[index]} al lado`,
            disabled: blocks.length >= MAX_BLOCKS,
            onSelect: () => {
              const next = [...blocks];
              next.splice(index + 1, 0, blocks[index]!);
              editBlocks(next);
              select(index + 1);
            },
          },
          {
            label: 'Quitar el bloque',
            disabled: blocks.length <= 1,
            onSelect: () => {
              editBlocks(blocks.filter((_, i) => i !== index));
              onSelect(Math.max(0, Math.min(index, blocks.length - 2)));
            },
          },
        ]}
      />
      <div className={styles.buttons}>
        <Button
          variant="mini"
          ariaLabel="Mover el bloque a la izquierda"
          onClick={() => move(position, position - 1)}
        >
          ←
        </Button>
        <Button
          variant="mini"
          ariaLabel="Mover el bloque a la derecha"
          onClick={() => move(position, position + 1)}
        >
          →
        </Button>
        <Button
          variant="mini"
          ariaLabel="Quitar el bloque"
          onClick={() => {
            if (blocks.length > 1) editBlocks(blocks.filter((_, index) => index !== position));
          }}
        >
          Quitar
        </Button>
        <span className={styles.addLabel}>Sumar</span>
        {used.map((letter) => (
          <Button
            key={letter}
            variant="mini"
            ariaLabel={`Agregar sección ${letter}`}
            onClick={() => add(letter)}
            onPointerDown={dragAdd(letter)}
            title="Tocalo para sumarlo al final, o arrastralo hasta donde va"
          >
            + {letter}
          </Button>
        ))}
        {fresh && (
          <Button
            variant="mini"
            ariaLabel={`Agregar sección ${fresh}`}
            onClick={() => add(fresh)}
            onPointerDown={dragAdd(fresh)}
            title="Tocalo para sumarlo al final, o arrastralo hasta donde va"
          >
            + {fresh} nueva
          </Button>
        )}
        <span className={styles.hint}>
          Arrastrá los bloques para ordenarlos, y los + hasta donde van. Clic derecho: más.
        </span>
      </div>
    </section>
  );
}

function SectionPanel() {
  const active = useProject((s) => s.active);
  const section = useProject((s) => s.sections[s.active]);
  const derived = useSectionHarmony(active);
  const updateSection = useProject((s) => s.updateSection);
  const { names } = useForm();
  const risk = useSettings((s) => s.risk);
  const bars = section?.bars ?? DEFAULT_BARS;
  const setBars = (next: number) => updateSection(active, { bars: Math.min(MAX_BARS, Math.max(1, next)) });

  const rollSection = () => {
    const input = () => ({ risk, rng: createRng(randomSeed()) });
    updateSection(active, {
      chords: rollHarmony(input()).value.chords,
      rhythm: rollRhythm(input()).value,
      lyric: rollLyric(input()).label,
    });
  };
  const written = section?.text?.split('\n').find((line) => line.trim());

  return (
    <section className={styles.section} aria-label={`Sección ${active}`}>
      <div className={styles.sectionHead}>
        <h2>
          Sección {active}
          {names[active] && <span> · {names[active]}</span>}
        </h2>
        <Stepper
          label="compases"
          value={`${bars} cc`}
          onDown={() => setBars(bars - 1)}
          onUp={() => setBars(bars + 1)}
        />
        <Button variant="mini" onClick={rollSection} id="roll-section">
          Sortear esta sección
        </Button>
        <RecordButton />
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>Armonía</dt>
          <dd data-testid="section-chords">
            {section?.chords ? (
              <Link to={harmonyHref(section.chords, section.chordBeats)}>{section.chords.join(' – ')}</Link>
            ) : derived.how ? (
              <Link to={harmonyHref(derived.chords, derived.chordBeats)} title={derived.how}>
                {derived.chords.join(' – ')} · variación de la consigna
              </Link>
            ) : (
              <Link to="/armonia">La de la consigna · elegir otra</Link>
            )}
          </dd>
        </div>
        <div>
          <dt>Ritmo</dt>
          <dd data-testid="section-rhythm">
            {section?.rhythm ? (
              <Link to={`/ritmo?${rhythmToParams(section.rhythm)}`}>
                {section.rhythm.mode === 'meter'
                  ? `${section.rhythm.groups.join('+')}/${section.rhythm.denom}`
                  : section.rhythm.mode}
                , {section.rhythm.bpm} ppm
              </Link>
            ) : (
              <Link to="/ritmo">El de la consigna · elegir otro</Link>
            )}
          </dd>
        </div>
        <div>
          <dt>Melodía</dt>
          <dd data-testid="section-melody">
            <Link to="/melodia">Una para todo el tema, en Melodía</Link>
          </dd>
        </div>
        <div>
          <dt>Letra</dt>
          <dd data-testid="section-lyric">
            <Link to="/letras">{written ?? section?.lyric ?? 'Escribir en Letras'}</Link>
          </dd>
        </div>
      </dl>
    </section>
  );
}

// Tipos mínimos de la API oficial del reproductor de YouTube.
interface YouTubePlayer {
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  getCurrentTime(): number;
  destroy(): void;
}
declare global {
  interface Window {
    YT?: { Player: new (element: HTMLElement, options: unknown) => YouTubePlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

function loadYouTubeApi(): Promise<void> {
  return new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve();
      return;
    }
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    if (!document.querySelector('script[data-youtube-api]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.dataset.youtubeApi = 'true';
      document.head.append(script);
    }
  });
}

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** El reproductor se crea recién al abrir el ejemplo: hasta entonces no se contacta a YouTube. */
function ExamplePlayer({ example }: { example: FormExample }) {
  const marks = useProject((s) => s.marks[example.video]) ?? {};
  const setMark = useProject((s) => s.setMark);
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YouTubePlayer | null>(null);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const mount = host.current;
    void loadYouTubeApi().then(() => {
      if (cancelled || !mount || !window.YT) return;
      player.current = new window.YT.Player(mount, {
        videoId: example.video,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { autoplay: 1, rel: 0, playsinline: 1 },
      });
    });
    return () => {
      cancelled = true;
      player.current?.destroy();
      player.current = null;
    };
  }, [example.video]);

  return (
    <div className={styles.player}>
      <div className={styles.video}>
        <div ref={host} data-testid="youtube-host" />
      </div>
      <div className={styles.buttons}>
        {example.blocks.map((letter, index) => {
          const time = marks[index];
          return (
            <button
              key={index}
              type="button"
              className={styles.block}
              data-letter={letter}
              aria-label={`${letter}, bloque ${index + 1}${time !== undefined ? `, en ${formatTime(time)}` : ', sin marcar'}`}
              onClick={() => {
                const current = player.current;
                if (marking) {
                  if (current) setMark(example.video, index, Math.floor(current.getCurrentTime()));
                } else if (time !== undefined && current) {
                  current.seekTo(time, true);
                  current.playVideo();
                }
              }}
            >
              {letter}
              <small>{time !== undefined ? formatTime(time) : '–'}</small>
            </button>
          );
        })}
      </div>
      <div className={styles.buttons}>
        <Button variant="mini" ariaPressed={marking} onClick={() => setMarking(!marking)}>
          {marking ? 'Terminar de marcar' : 'Marcar minutos'}
        </Button>
      </div>
      <p className={styles.hint}>
        {marking
          ? 'Mientras suena, tocá cada bloque justo cuando empieza esa sección.'
          : 'Tocá un bloque marcado para saltar a esa sección. Los minutos los marcás vos al escuchar, y quedan guardados en este navegador.'}
      </p>
    </div>
  );
}

function Examples({ onUse }: { onUse: (value: RowOverrides['forma']) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <p className={styles.hint}>La estructura está simplificada para ver la idea de cada forma.</p>
      <ul className={styles.examples}>
        {FORM_EXAMPLES.map((example) => {
          const isOpen = open === example.video;
          return (
            <li key={example.video}>
              <div className={styles.exampleRow}>
                <div className={styles.exampleText}>
                  <strong>{example.song}</strong> <span>{example.artist}</span>
                  <p data-testid="example-form" className={styles.exampleForm}>
                    {example.blocks.join(' ')}
                  </p>
                  <p className={styles.exampleRule}>{example.rule}</p>
                </div>
                <div className={styles.exampleActions}>
                  <Button
                    variant="mini"
                    ariaExpanded={isOpen}
                    ariaLabel={`Oír ${example.song}`}
                    onClick={() => setOpen(isOpen ? null : example.video)}
                  >
                    {isOpen ? '■ Cerrar' : '▶ Oír'}
                  </Button>
                  <Button
                    variant="mini"
                    ariaLabel={`Usar la forma de ${example.song}`}
                    onClick={() =>
                      onUse({ blocks: example.blocks, rule: `Como «${example.song}». ${example.rule}` })
                    }
                  >
                    Usar forma
                  </Button>
                </div>
              </div>
              {isOpen && <ExamplePlayer example={example} />}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Library({ onUse }: { onUse: (value: RowOverrides['forma']) => void }) {
  const [family, setFamily] = useState<FormFamilyId>('pop');
  const current = FORM_FAMILIES.find((item) => item.value === family)!;
  return (
    <>
      <p className={styles.hint}>
        Cada letra es una sección distinta, y si vuelve la misma música vuelve la misma letra: estrofa,
        estribillo, estrofa, estribillo, puente, estribillo es ABABCB.
      </p>
      <Tabs label="Familia de formas" value={family} options={FORM_FAMILIES} onChange={setFamily} />
      <p className={styles.familyAbout}>{current.about}</p>
      <ul className={styles.forms} data-testid="form-library">
        {SONG_FORMS.filter((form) => form.family === family).map((form) => {
          const letters = formLetters(form.sections);
          return (
            <li key={form.id}>
              <div className={styles.formHead}>
                <h3>{form.name}</h3>
                <Button
                  variant="mini"
                  ariaLabel={`Usar la forma ${form.name}`}
                  onClick={() =>
                    onUse({ blocks: letters, names: formNames(form.sections), rule: formRule(form) })
                  }
                >
                  Usar forma
                </Button>
              </div>
              <ol className={styles.strip} aria-label={`${letters.join('')}: ${form.sections.join(', ')}`}>
                {form.sections.map((section, index) => (
                  <li key={index} className={styles.cell} data-letter={letters[index]}>
                    <b>{letters[index]}</b>
                    <small>{section}</small>
                  </li>
                ))}
              </ol>
              <p className={styles.formAbout}>{form.about}</p>
              <p className={styles.formTip}>
                <strong>Probala →</strong> {form.tip}
              </p>
              {form.heard && <p className={styles.formHeard}>Se oye en {form.heard}</p>}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Qué es cada sección. Las que tiene la forma de ahora van marcadas. */
function Vocabulary() {
  const { names } = useForm();
  const used = new Set(
    Object.values(names)
      .filter((name): name is string => !!name)
      .map((name) => name.toLowerCase()),
  );
  return (
    <>
      <p className={styles.hint}>Qué es cada sección, con su nombre en inglés cuando se usa así.</p>
      <dl className={styles.terms}>
        {SECTION_TERMS.map((item) => (
          <div key={item.term} data-used={used.has(item.term.toLowerCase())}>
            <dt>
              {item.term}
              {item.english && <span> · {item.english}</span>}
              {used.has(item.term.toLowerCase()) && <em className={styles.usedTag}>En tu forma</em>}
            </dt>
            <dd>{item.meaning}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

type SideId = 'formas' | 'ejemplos' | 'vocabulario';

export default function FormaRoute() {
  const form = useForm();
  const { blocks } = form;
  const sections = useProject((s) => s.sections);
  const risk = useSettings((s) => s.risk);
  const [selected, setSelected] = useState(0);
  const [side, setSide] = useState<SideId>('formas');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const shared = params.get('f')?.split('');
    const store = useConsigna.getState();
    // Abierta desde la consigna, el link trae la misma forma: no se pisan su regla ni sus nombres.
    if (isValidBlocks(shared)) {
      if (!store.started || shared.join('') !== blocksOf(store.consigna).join('')) {
        publishToConsigna('forma', { blocks: shared });
      }
    } else if (!store.started) store.load(newConsigna(risk));
  }, [params, risk]);

  const [undo, setUndo] = useState<ConsignaForm[]>([]);
  const apply = (next: RowOverrides['forma']) => {
    setUndo((stack) => [...stack, form].slice(-30));
    applyForm(next);
    setSelected(0);
  };
  const roll = () => {
    const rolled = rollForm({ risk, rng: createRng(randomSeed()) });
    apply({ ...rolled.value, rule: rolled.rule });
  };
  const goBack = () => {
    const previous = undo[undo.length - 1];
    if (!previous) return;
    setUndo(undo.slice(0, -1));
    applyForm({
      blocks: previous.blocks,
      rule: previous.rule,
      ...(Object.keys(previous.names).length ? { names: previous.names } : {}),
    });
  };

  /** Lleva el compás de cada sección al metrónomo, en el orden de la forma. */
  const playMeters = () => {
    const meters = blocks.map((letter): Meter => {
      const rhythm: RhythmConfig | undefined = sections[letter]?.rhythm;
      return rhythm?.mode === 'meter' ? { groups: rhythm.groups, denom: rhythm.denom } : DEFAULT_METER;
    });
    const first = sections[blocks[0] ?? 'A']?.rhythm;
    const config: RhythmConfig = { mode: 'mutante', meters, barsEach: 4, bpm: first?.bpm ?? 100 };
    navigate(`/ritmo?${rhythmToParams(config)}`);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <p className={styles.eyebrow}>
            Consigna de forma · {letterList(blocks).length} secciones, {blocks.length} bloques
          </p>
          <h1 className={styles.title}>{blocks.join('')}</h1>
          <p className={styles.rule} title={form.rule}>
            <span data-testid="form-rule">{form.rule}</span>
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="mini" onClick={playMeters} id="play-meters">
            Compases al metrónomo
          </Button>
          <Button variant="mini" onClick={goBack} id="undo-form" disabled={undo.length === 0}>
            ↩ Volver
          </Button>
          <Button onClick={roll} id="roll-form">
            Sortear otra
          </Button>
        </div>
      </header>
      <div className={styles.work}>
        <div className={styles.lead}>
          <Timeline selected={selected} onSelect={setSelected} />
          <SectionPanel />
        </div>
        <aside className={styles.side} aria-label="Biblioteca">
          <div className={styles.sideTabs}>
            <Segmented<SideId>
              label="Biblioteca"
              value={side}
              onChange={setSide}
              stretch
              options={[
                { value: 'formas', label: 'Formas' },
                { value: 'ejemplos', label: 'Ejemplos' },
                { value: 'vocabulario', label: 'Vocabulario' },
              ]}
            />
          </div>
          <div className={styles.sideBody} data-testid={`panel-${side}`}>
            {side === 'formas' && <Library onUse={apply} />}
            {side === 'ejemplos' && <Examples onUse={apply} />}
            {side === 'vocabulario' && <Vocabulary />}
          </div>
        </aside>
      </div>
    </div>
  );
}
