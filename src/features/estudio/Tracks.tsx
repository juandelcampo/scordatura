// Las pistas: una fila por elemento y una columna por bloque de la forma, con ancho según su duración.
import { useEffect, useMemo, useRef, type CSSProperties, type PointerEvent } from 'react';
import { song } from '~/audio/song';
import { describeDrone } from '~/core/drone';
import { isMuted, melodyInBlock, type Lane, type Song, type SongBlock } from '~/core/song';
import { Fader } from '~/shared/Fader';
import { useProject } from '~/shared/project';
import type { ChannelId } from '~/shared/settings';
import { useSong, type ConsignaParts } from '~/shared/song';
import styles from './estudio.module.css';

export type PanelId = 'forma' | 'acordes' | 'bateria' | 'melodia' | 'drone' | 'letra';

interface TracksProps {
  selected: number;
  onSelect: (block: number) => void;
  panel: PanelId;
  onPanel: (panel: PanelId) => void;
  parts: ConsignaParts;
}

function LaneHead({
  name,
  id,
  lane,
  channel,
  panel,
  onPanel,
  melodyChosen,
}: {
  name: string;
  id: PanelId;
  lane?: Lane;
  channel?: ChannelId;
  panel: PanelId;
  onPanel: (panel: PanelId) => void;
  melodyChosen: boolean;
}) {
  const mix = useProject((s) => s.mix);
  const setLane = useProject((s) => s.setLane);
  return (
    <div className={styles.head}>
      <button
        type="button"
        className={styles.headName}
        aria-pressed={panel === id}
        aria-label={`Editar ${name}`}
        onClick={() => onPanel(id)}
      >
        {name}
      </button>
      {lane && (
        <>
          <button
            type="button"
            className={styles.laneButton}
            data-kind="mute"
            aria-pressed={isMuted(lane, mix, melodyChosen)}
            aria-label={`Silenciar ${name}`}
            onClick={() => setLane(lane, { mute: !isMuted(lane, mix, melodyChosen) })}
          >
            M
          </button>
          <button
            type="button"
            className={styles.laneButton}
            data-kind="solo"
            aria-pressed={!!mix[lane]?.solo}
            aria-label={`Solo de ${name}`}
            onClick={() => setLane(lane, { solo: !mix[lane]?.solo })}
          >
            S
          </button>
        </>
      )}
      {channel && (
        <div className={styles.headFader}>
          <Fader channel={channel} compact />
        </div>
      )}
    </div>
  );
}

function DrumsPreview({ block }: { block: SongBlock }) {
  const path = useMemo(() => {
    let d = '';
    for (const bar of block.bars) {
      const width = bar.beats / bar.drums.steps;
      bar.drums.tracks.forEach((track, lane) =>
        track.forEach((on, step) => {
          if (on) d += `M${bar.start + step * width} ${lane}h${width * 0.8}v0.8h${-width * 0.8}z`;
        }),
      );
    }
    return d;
  }, [block]);
  return (
    <svg
      className={styles.preview}
      viewBox={`0 0 ${block.beats || 1} 6`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

function MelodyPreview({ block, plan }: { block: SongBlock; plan: Song }) {
  const path = useMemo(() => {
    const notes = melodyInBlock(plan.melody, block);
    if (notes.length === 0) return '';
    const midis = notes.map((note) => note.midi);
    const low = Math.min(...midis);
    const high = Math.max(...midis);
    return notes
      .map((note) => `M${note.beat} ${high - note.midi}h${note.beats}v0.9h${-note.beats}z`)
      .join('')
      .concat(`M0 ${high - low + 1}`);
  }, [block, plan.melody]);
  const midis = plan.melody.map((note) => note.midi);
  const rows = midis.length ? Math.max(...midis) - Math.min(...midis) + 1 : 1;
  return (
    <svg
      className={styles.preview}
      viewBox={`0 0 ${block.beats || 1} ${rows}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

/** La línea de lo que suena: se mueve leyendo el reloj cuadro a cuadro, sin renders. */
function usePlayhead(
  scroller: React.RefObject<HTMLDivElement | null>,
  line: React.RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    let frame = 0;
    let previous = -1;
    const draw = () => {
      const host = scroller.current;
      const marker = line.current;
      const position = song.position();
      if (host && marker) {
        const cell = position ? host.querySelector<HTMLElement>(`[data-block="${position.block}"]`) : null;
        if (position && cell) {
          marker.style.display = 'block';
          marker.style.transform = `translateX(${cell.offsetLeft + position.fraction * cell.offsetWidth}px)`;
          if (position.block !== previous) {
            previous = position.block;
            host.querySelectorAll('[data-now]').forEach((item) => item.removeAttribute('data-now'));
            cell.setAttribute('data-now', '');
            // Con muchos bloques las pistas se desplazan: lo que suena queda a la vista.
            if (host.scrollWidth > host.clientWidth) {
              const start = cell.offsetLeft - host.clientWidth / 3;
              host.scrollTo({ left: start, behavior: 'smooth' });
            }
          }
        } else {
          marker.style.display = 'none';
          if (previous !== -1) {
            previous = -1;
            host.querySelectorAll('[data-now]').forEach((item) => item.removeAttribute('data-now'));
          }
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [scroller, line]);
}

export function Tracks({ selected, onSelect, panel, onPanel, parts }: TracksProps) {
  const plan = useSong();
  const blocks = useProject((s) => s.blocks);
  const sections = useProject((s) => s.sections);
  const setBlocks = useProject((s) => s.setBlocks);
  const updateSection = useProject((s) => s.updateSection);
  const scroller = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);
  const dragged = useRef(false);
  usePlayhead(scroller, line);

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (dragging.current === null) return;
    const under = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-block]');
    const target = under ? Number(under.dataset.block) : null;
    if (target === null || target === dragging.current) return;
    const next = [...blocks];
    const [item] = next.splice(dragging.current, 1);
    next.splice(target, 0, item!);
    setBlocks(next);
    onSelect(target);
    dragging.current = target;
    dragged.current = true;
  };

  const open = (index: number, id: PanelId) => {
    onSelect(index);
    onPanel(id);
  };

  const columns = plan.blocks
    .map((block) => `minmax(var(--block-min), ${Math.max(block.beats, 1)}fr)`)
    .join(' ');
  const head = { panel, onPanel, melodyChosen: parts.melody.chosen };

  return (
    <div className={styles.tracks} ref={scroller}>
      <div
        className={styles.grid}
        style={
          {
            gridTemplateColumns: `var(--head) ${columns}`,
            minWidth: `calc(var(--head) + ${plan.blocks.length} * var(--block-min))`,
          } as CSSProperties
        }
        data-testid="song-tracks"
      >
        <div ref={line} className={styles.playhead} data-testid="playhead" aria-hidden="true" />

        <LaneHead name="Forma" id="forma" {...head} />
        {plan.blocks.map((block, index) => (
          <button
            key={`forma-${index}`}
            type="button"
            className={styles.block}
            data-block={index}
            data-letter={block.letter}
            aria-pressed={index === selected}
            aria-label={`Bloque ${index + 1}: sección ${block.letter}, ${block.bars.length} compases`}
            onClick={() => {
              if (dragged.current) {
                dragged.current = false;
                return;
              }
              onSelect(index);
              song.seek(index);
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
            {block.letter}
            <small>{block.bars.length}</small>
          </button>
        ))}

        <LaneHead name="Acordes" id="acordes" lane="acordes" channel="instrumento" {...head} />
        {plan.blocks.map((block, index) => (
          <button
            key={`acordes-${index}`}
            type="button"
            className={styles.cell}
            data-selected={index === selected}
            data-lane-off={!plan.audible.acordes}
            aria-label={`Acordes del bloque ${index + 1}: ${[...new Set(block.changes.map((c) => c.name))].join(', ')}`}
            onClick={() => open(index, 'acordes')}
          >
            <span className={styles.chords}>
              {block.changes.map((change, position) => (
                <span key={position} style={{ flexGrow: change.beats }}>
                  {change.name}
                </span>
              ))}
            </span>
          </button>
        ))}

        <LaneHead name="Batería" id="bateria" lane="bateria" channel="ritmo" {...head} />
        {plan.blocks.map((block, index) => (
          <button
            key={`bateria-${index}`}
            type="button"
            className={styles.cell}
            data-selected={index === selected}
            data-lane-off={!plan.audible.bateria}
            aria-label={`Batería del bloque ${index + 1}`}
            onClick={() => open(index, 'bateria')}
          >
            <DrumsPreview block={block} />
          </button>
        ))}

        <LaneHead name="Melodía" id="melodia" lane="melodia" {...head} />
        {plan.blocks.map((block, index) => (
          <button
            key={`melodia-${index}`}
            type="button"
            className={styles.cell}
            data-selected={index === selected}
            data-lane-off={!plan.audible.melodia}
            aria-label={`Melodía del bloque ${index + 1}`}
            onClick={() => open(index, 'melodia')}
          >
            <MelodyPreview block={block} plan={plan} />
          </button>
        ))}

        <LaneHead name="Drone" id="drone" lane="drone" channel="drone" {...head} />
        {plan.blocks.map((block, index) => (
          <button
            key={`drone-${index}`}
            type="button"
            className={styles.cell}
            data-selected={index === selected}
            data-lane-off={!plan.audible.drone}
            data-drone={block.drone}
            aria-pressed={block.drone}
            aria-label={`Drone en la sección ${block.letter}, bloque ${index + 1}`}
            title="Prende o apaga el drone en esta sección"
            onClick={() => {
              onSelect(index);
              onPanel('drone');
              updateSection(block.letter, { droneOff: block.drone });
            }}
          >
            <span className={styles.clip}>{block.drone ? describeDrone(parts.drone).name : '—'}</span>
          </button>
        ))}

        <LaneHead name="Letra" id="letra" {...head} />
        {blocks.map((letter, index) => (
          <button
            key={`letra-${index}`}
            type="button"
            className={styles.cell}
            data-selected={index === selected}
            aria-label={`Letra del bloque ${index + 1}`}
            onClick={() => open(index, 'letra')}
          >
            <span className={styles.clip} data-testid="lane-lyric">
              {(sections[letter]?.text ?? '')
                .split('\n')
                .filter((text) => text.trim())
                .join(' / ') || '…'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
