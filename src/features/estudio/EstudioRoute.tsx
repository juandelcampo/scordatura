// El Estudio: el tema entero en una sola pantalla, sin desplazarse. Arriba el transporte, en el
// medio una pista por elemento a lo largo de la forma, y abajo los editores de la sección elegida.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, type MetaFunction } from 'react-router';
import { song } from '~/audio/song';
import { consignaNumber, newConsigna } from '~/core/consigna';
import { useConsigna } from '~/shared/consigna';
import { useProject } from '~/shared/project';
import { useSettings } from '~/shared/settings';
import { useConsignaParts, useSong } from '~/shared/song';
import { Tracks, type PanelId } from './Tracks';
import { ChordsPanel, DronePanel, DrumsPanel, FormPanel, LyricPanel, MelodyPanel } from './Panels';
import styles from './estudio.module.css';

export const meta: MetaFunction = () => [
  { title: 'Estudio: el tema entero en una pantalla · Scordatura' },
  {
    name: 'description',
    content:
      'La forma de la canción con sus acordes, batería, melodía, drone y letra en pistas, para escucharla y editarla sin cambiar de pantalla.',
  },
];

const TEMPO_STEP = 2;

function Transport({ selected }: { selected: number }) {
  const plan = useSong();
  const state = useSyncExternalStore(song.subscribe, song.getState, song.getState);
  const setTempo = useProject((s) => s.setTempo);
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
      <output ref={readout} className={styles.readout} data-testid="song-position" />
      <Link className={styles.source} to="/consigna">
        Consigna Nº {number}
      </Link>
    </div>
  );
}

export default function EstudioRoute() {
  const blocks = useProject((s) => s.blocks);
  const setActive = useProject((s) => s.setActive);
  const parts = useConsignaParts();
  const [selectedRaw, setSelected] = useState(0);
  const [panel, setPanel] = useState<PanelId>('bateria');
  const selected = Math.min(selectedRaw, blocks.length - 1);

  // Sin consigna todavía se sortea una: de ahí sale lo que falte en cada sección.
  useEffect(() => {
    const store = useConsigna.getState();
    if (!store.started) store.load(newConsigna(useSettings.getState().risk));
  }, []);

  // La sección que se edita es la del bloque elegido.
  const letter = blocks[selected] ?? 'A';
  useEffect(() => setActive(letter), [letter, setActive]);

  return (
    <div className={styles.studio} data-open-panel={panel}>
      <h1 className="sr-only">Estudio</h1>
      <Transport selected={selected} />
      <Tracks selected={selected} onSelect={setSelected} panel={panel} onPanel={setPanel} parts={parts} />
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
