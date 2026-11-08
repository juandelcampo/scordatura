// El Estudio: escuchar la consigna entera en una sola pantalla, sin desplazarse. Arriba el transporte y
// en el medio una pista por elemento a lo largo de la forma. Es un boceto: abre para escuchar, y los
// editores de la sección elegida y la mezcla aparecen solo si se piden.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, type MetaFunction } from 'react-router';
import { song } from '~/audio/song';
import { consignaNumber, newConsigna } from '~/core/consigna';
import { clampBpm } from '~/core/rhythm';
import { publishToConsigna, useBlocks, useConsigna } from '~/shared/consigna';
import { ExportMidiButton } from '~/shared/ExportMidiButton';
import { useProject } from '~/shared/project';
import { RecordButton } from '~/shared/RecordButton';
import { useSettings } from '~/shared/settings';
import { useConsignaParts, useSong } from '~/shared/song';
import { useHydrated } from '~/shared/useHydrated';
import { Tracks, type PanelId } from './Tracks';
import { ChordsPanel, DronePanel, DrumsPanel, FormPanel, LyricPanel, MelodyPanel } from './Panels';
import styles from './estudio.module.css';

export const meta: MetaFunction = () => [
  { title: 'Estudio: escuchar la consigna entera · Scordatura' },
  {
    name: 'description',
    content:
      'La consigna sonando entera, a lo largo de su forma: acordes, batería, melodía, drone y letra, para tocar encima, grabar la idea o bajarla en MIDI.',
  },
];

const TEMPO_STEP = 2;

function Transport({
  selected,
  editing,
  onEditing,
}: {
  selected: number;
  editing: boolean;
  onEditing: (next: boolean) => void;
}) {
  const plan = useSong();
  const state = useSyncExternalStore(song.subscribe, song.getState, song.getState);
  const parts = useConsignaParts();
  // El tempo es el del ritmo de la consigna.
  const setTempo = (bpm: number) => publishToConsigna('ritmo', { ...parts.rhythm, bpm: clampBpm(bpm) });
  const number = consignaNumber(useConsigna((s) => s.consigna));
  const readout = useRef<HTMLOutputElement>(null);

  // El lugar se escribe cuadro a cuadro, sin renders.
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const position = song.position();
      const block = position ? plan.blocks[position.block] : null;
      if (readout.current) {
        readout.current.textContent =
          position && block
            ? `${position.block + 1}/${plan.blocks.length} · ${block.letter} · cc ${position.bar + 1}/${block.bars.length}`
            : `${plan.blocks.length} bloques`;
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [plan]);

  const toggle = () => (state.running ? song.stop() : song.play(plan, selected));

  // La barra espaciadora toca y para, salvo cuando se está escribiendo o hay un botón en foco.
  const toggleRef = useRef(toggle);
  useEffect(() => {
    toggleRef.current = toggle;
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return;
      if ((event.target as HTMLElement).closest('input, textarea, select, button, a')) return;
      event.preventDefault();
      toggleRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={styles.transport} role="group" aria-label="Transporte">
      <button
        type="button"
        className={styles.play}
        id="song-play"
        data-running={state.running}
        aria-label={state.running ? 'Parar el tema' : 'Tocar el tema'}
        onClick={toggle}
      >
        {state.running ? '■ Parar' : '▶ Tocar'}
      </button>
      <button
        type="button"
        className={styles.toggle}
        id="song-loop"
        aria-pressed={state.loop}
        aria-label="Repetir el bloque"
        title="Repite el bloque en lugar de seguir con la forma"
        onClick={() => song.setLoop(!state.loop)}
      >
        ⟳ Bloque
      </button>
      <div className={styles.tempo} role="group" aria-label="Tempo">
        <button type="button" aria-label="Bajar el tempo" onClick={() => setTempo(plan.bpm - TEMPO_STEP)}>
          −
        </button>
        <output data-testid="song-tempo">
          {plan.bpm}
          <small>ppm</small>
        </output>
        <button type="button" aria-label="Subir el tempo" onClick={() => setTempo(plan.bpm + TEMPO_STEP)}>
          +
        </button>
      </div>
      <button
        type="button"
        className={styles.toggle}
        id="song-edit"
        aria-pressed={editing}
        title="Muestra los editores y la mezcla"
        onClick={() => onEditing(!editing)}
      >
        Editar
      </button>
      <div className={styles.session}>
        <RecordButton />
        <ExportMidiButton variant="mini" />
      </div>
      <output ref={readout} className={styles.readout} data-testid="song-position" />
      <Link className={styles.source} to="/">
        Consigna Nº {number}
      </Link>
    </div>
  );
}

export default function EstudioRoute() {
  const blocks = useBlocks();
  const active = useProject((s) => s.active);
  const setActive = useProject((s) => s.setActive);
  const parts = useConsignaParts();
  const hydrated = useHydrated();
  const savedEditing = useSettings((s) => s.studioEditing);
  const setSettings = useSettings((s) => s.set);
  const editing = hydrated && savedEditing;
  const setEditing = (next: boolean) => setSettings({ studioEditing: next });
  // Hasta que se elija un bloque acá, se sigue en la sección que venías usando.
  const [selectedRaw, setSelected] = useState<number | null>(null);
  const [panel, setPanel] = useState<PanelId>('bateria');
  const fromActive = hydrated ? Math.max(0, blocks.indexOf(active)) : 0;
  const selected = Math.min(selectedRaw ?? fromActive, blocks.length - 1);

  // Sin consigna todavía se sortea una: de ahí sale lo que falte en cada sección.
  useEffect(() => {
    const store = useConsigna.getState();
    if (!store.started) store.load(newConsigna(useSettings.getState().risk));
  }, []);

  // La sección que se edita es la del bloque elegido.
  const letter = blocks[selected] ?? 'A';
  const chosen = selectedRaw !== null;
  useEffect(() => {
    if (chosen) setActive(letter);
  }, [chosen, letter, setActive]);

  // Tocar una pista para editarla también abre los editores.
  const openPanel = (next: PanelId) => {
    setPanel(next);
    setEditing(true);
  };

  return (
    <div className={styles.studio} data-open-panel={panel} data-editing={editing}>
      <h1 className="sr-only">Estudio</h1>
      <Transport selected={selected} editing={editing} onEditing={setEditing} />
      <Tracks selected={selected} onSelect={setSelected} panel={panel} onPanel={openPanel} parts={parts} />
      <div className={styles.panels}>
        <FormPanel selected={selected} onSelect={setSelected} open={panel === 'forma'} />
        <DrumsPanel letter={letter} parts={parts} open={panel === 'bateria'} />
        <div className={styles.stack}>
          <ChordsPanel letter={letter} parts={parts} open={panel === 'acordes'} />
          <DronePanel letter={letter} parts={parts} open={panel === 'drone'} />
        </div>
        <div className={styles.stack}>
          <LyricPanel letter={letter} parts={parts} open={panel === 'letra'} />
          <MelodyPanel parts={parts} open={panel === 'melodia'} />
        </div>
      </div>
    </div>
  );
}
