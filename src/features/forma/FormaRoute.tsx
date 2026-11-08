import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Link, useNavigate, useSearchParams, type MetaFunction } from 'react-router';
import { rhythmToParams, type Meter, type RhythmConfig } from '~/core/rhythm';
import { createRng, randomSeed } from '~/core/rng';
import { harmonyHref } from '~/core/chords';
import { rollForm, rollHarmony, rollLyric, rollRhythm } from '~/core/rollers';
import { FORM_EXAMPLES, type FormExample } from '~/data/forms';
import { newConsigna } from '~/core/consigna';
import { publishToConsigna, useBlocks, useConsigna } from '~/shared/consigna';
import { isValidBlocks, letterList, useProject } from '~/shared/project';
import { RecordButton } from '~/shared/RecordButton';
import { useSettings } from '~/shared/settings';
import { Button, PageTitle, Slab, SlabHead } from '~/shared/ui/ui';
import styles from './forma.module.css';

export const meta: MetaFunction = () => [
  { title: 'Forma de la canción: AABA, estrofa-estribillo y otras · Scordatura' },
  {
    name: 'description',
    content:
      'Armá el esqueleto de tu canción con bloques, sorteá formas clásicas y raras, y escuchá ejemplos de cada una.',
  },
];

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const DEFAULT_METER: Meter = { groups: [1, 1, 1, 1], denom: 4 };

const setBlocks = (blocks: string[], options?: { continuing?: boolean }) =>
  publishToConsigna('forma', { blocks }, options);

function Timeline() {
  const blocks = useBlocks();
  const active = useProject((s) => s.active);
  const setActive = useProject((s) => s.setActive);
  const [selected, setSelected] = useState(0);
  const dragging = useRef<number | null>(null);
  const dragged = useRef(false);
  const position = Math.min(selected, blocks.length - 1);

  const move = (from: number, to: number, continuing = false) => {
    if (to < 0 || to >= blocks.length || from === to) return;
    const next = [...blocks];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    setBlocks(next, { continuing });
    setSelected(to);
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (dragging.current === null) return;
    const under = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-block]');
    const target = under ? Number(under.dataset.block) : null;
    if (target !== null && target !== dragging.current) {
      move(dragging.current, target, dragged.current);
      dragging.current = target;
      dragged.current = true;
    }
  };

  return (
    <>
      <div className={styles.timeline} data-testid="timeline">
        {blocks.map((letter, index) => (
          <button
            key={`${letter}-${index}`}
            type="button"
            className={styles.block}
            data-block={index}
            data-letter={letter}
            data-active={letter === active}
            aria-pressed={index === position}
            aria-label={`Bloque ${index + 1}: sección ${letter}`}
            onClick={() => {
              setSelected(index);
              setActive(letter);
            }}
            onPointerDown={(event) => {
              dragging.current = index;
              dragged.current = false;
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={onPointerMove}
            onPointerUp={() => {
              dragging.current = null;
            }}
            onPointerCancel={() => {
              dragging.current = null;
            }}
          >
            {letter}
          </button>
        ))}
      </div>
      <p className={styles.hint}>
        Arrastrá los bloques para ordenarlos, o usá las flechas con el bloque marcado.
      </p>
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
            if (blocks.length > 1) setBlocks(blocks.filter((_, index) => index !== position));
          }}
        >
          Quitar
        </Button>
        {LETTERS.map((letter) => (
          <Button
            key={letter}
            variant="mini"
            ariaLabel={`Agregar sección ${letter}`}
            onClick={() => {
              if (blocks.length < 24) setBlocks([...blocks, letter]);
            }}
          >
            + {letter}
          </Button>
        ))}
      </div>
    </>
  );
}

function SectionPanel() {
  const active = useProject((s) => s.active);
  const section = useProject((s) => s.sections[s.active]);
  const updateSection = useProject((s) => s.updateSection);
  const risk = useSettings((s) => s.risk);

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
    <Slab>
      <SlabHead title={`Sección ${active}`}>
        <Button onClick={rollSection} id="roll-section">
          Sortear esta sección
        </Button>
      </SlabHead>
      <dl className={styles.facts}>
        <div>
          <dt>Armonía</dt>
          <dd data-testid="section-chords">
            {section?.chords ? (
              <Link to={harmonyHref(section.chords, section.chordBeats)}>{section.chords.join(' – ')}</Link>
            ) : (
              <Link to="/armonia">Elegir en Armonía</Link>
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
              <Link to="/ritmo">Elegir en Ritmo</Link>
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
      <div className={styles.record}>
        <RecordButton />
      </div>
    </Slab>
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

function Examples() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Slab>
      <SlabHead title="Ejemplos" />
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
                    onClick={() => setBlocks(example.blocks)}
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
    </Slab>
  );
}

export default function FormaRoute() {
  const blocks = useBlocks();
  const sections = useProject((s) => s.sections);
  const risk = useSettings((s) => s.risk);
  const [rule, setRule] = useState('Armala a mano o sorteá una forma.');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const shared = params.get('f')?.split('');
    if (isValidBlocks(shared)) setBlocks(shared);
    else if (!useConsigna.getState().started) useConsigna.getState().load(newConsigna(risk));
  }, [params, risk]);

  const [undo, setUndo] = useState<Array<{ blocks: string[]; rule: string }>>([]);
  const roll = () => {
    setUndo((stack) => [...stack, { blocks, rule }].slice(-30));
    const rolled = rollForm({ risk, rng: createRng(randomSeed()) });
    setBlocks(rolled.value.blocks);
    setRule(rolled.rule);
  };
  const goBack = () => {
    const previous = undo[undo.length - 1];
    if (!previous) return;
    setUndo(undo.slice(0, -1));
    setBlocks(previous.blocks);
    setRule(previous.rule);
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
    <div>
      <Slab>
        <PageTitle
          eyebrow={`${letterList(blocks).length} secciones, ${blocks.length} bloques`}
          title={blocks.join('')}
        >
          <p>
            <strong>Regla →</strong> <span data-testid="form-rule">{rule}</span>
          </p>
        </PageTitle>
        <div className={styles.actions}>
          <Button variant="primary" onClick={roll} id="roll-form">
            Sortear forma
          </Button>
          <Button onClick={goBack} id="undo-form" disabled={undo.length === 0}>
            ↩ Volver
          </Button>
          <Button onClick={playMeters} id="play-meters">
            Llevar compases al metrónomo
          </Button>
        </div>
      </Slab>
      <Slab>
        <Timeline />
      </Slab>
      <SectionPanel />
      <Examples />
    </div>
  );
}
