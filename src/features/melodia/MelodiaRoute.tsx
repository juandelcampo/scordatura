import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { MetaFunction } from 'react-router';
import { stopInstrument, playMelody } from '~/audio/instrument';
import { openMic, type MicInput } from '~/audio/mic';
import { parseChord, tensionMap, type TensionKind } from '~/core/chords';
import { consignaKey } from '~/core/consigna';
import { MODES, type ModeId } from '~/core/harmony';
import {
  CONTOURS,
  fitContour,
  notesFromVoice,
  quantizeOnsets,
  rollMotif,
  sampleContour,
  speechOnsets,
  textToNotes,
  TRANSFORMS,
  type ContourId,
  type Note,
  type TransformId,
  type VoiceFrame,
} from '~/core/melody';
import { midiToNote } from '~/core/notes';
import { detectPitch, rms } from '~/core/pitch';
import { createRng, randomSeed } from '~/core/rng';
import { rollMelody } from '~/core/rollers';
import { publishToConsigna, useConsigna } from '~/shared/consigna';
import { useHydrated } from '~/shared/useHydrated';
import { useSectionHarmony } from '~/shared/song';
import { Fader } from '~/shared/Fader';
import { PianoRoll } from '~/shared/PianoRoll';
import { useProject } from '~/shared/project';
import { SectionPicker } from '~/shared/SectionPicker';
import { useSettings } from '~/shared/settings';
import { Button, PageTitle, Slab, SlabHead, Tabs } from '~/shared/ui/ui';
import styles from './melodia.module.css';

export const meta: MetaFunction = () => [
  { title: 'Generador de melodías: contornos, motivos y restricciones · Scordatura' },
  {
    name: 'description',
    content:
      'Dibujá un contorno, transformá un motivo, convertí texto en notas, mirá qué notas chocan sobre cada acorde y transcribí lo que cantás.',
  },
];

const TONICS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const INTERVALS: Array<[number, string]> = [
  [1, 'Semitono'],
  [2, 'Tono'],
  [3, '3.ª menor'],
  [4, '3.ª mayor'],
  [5, '4.ª justa'],
  [6, 'Tritono'],
  [7, '5.ª justa'],
];
const BPM = 100;

/** Cuando cambian las notas a mano, la consigna las recibe. Al abrir la pestaña no cuenta como cambio. */
function usePublishMelody(label: string, rule: string, notes: Note[]) {
  const key = JSON.stringify(notes);
  const previous = useRef(key);
  useEffect(() => {
    if (previous.current === key) return;
    previous.current = key;
    publishToConsigna('melodia', { label, rule, notes: JSON.parse(key) as Note[] });
  }, [key, label, rule]);
}

const NoteNames = ({ notes }: { notes: Note[] }) => (
  <p className={styles.names} data-testid="note-names">
    {notes.map((note) => midiToNote(note.midi)).join(' ')}
  </p>
);

function useKey() {
  // Se abre en la tonalidad de la consigna; si elegís otra, queda la tuya.
  const hydrated = useHydrated();
  const consignaTonic = useConsigna((s) => consignaKey(s.consigna).tonic);
  const consignaMode = useConsigna((s) => consignaKey(s.consigna).mode);
  const [chosenTonic, setTonic] = useState<number | null>(null);
  const [chosenMode, setMode] = useState<ModeId | null>(null);
  const tonic = chosenTonic ?? (hydrated ? consignaTonic : 9);
  const mode = chosenMode ?? (hydrated ? consignaMode : 'aeolian');
  const picker = (
    <div className={styles.fields}>
      <label className={styles.field}>
        <span>Tónica</span>
        <select value={tonic} onChange={(event) => setTonic(Number(event.target.value))} data-testid="tonic">
          {TONICS.map((name, index) => (
            <option key={name} value={index}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>Modo</span>
        <select value={mode} onChange={(event) => setMode(event.target.value as ModeId)}>
          {(Object.keys(MODES) as ModeId[]).map((id) => (
            <option key={id} value={id}>
              {MODES[id].name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
  return { tonic, mode, picker };
}

function ContourTab() {
  const a4 = useSettings((s) => s.a4);
  const { tonic, mode, picker } = useKey();
  const [contourId, setContourId] = useState<ContourId | 'dibujo'>('arco');
  const [drawn, setDrawn] = useState<number[]>(() => sampleContour(CONTOURS.arco.shape));
  const [range, setRange] = useState(5);
  const [length, setLength] = useState(12);
  const [taboo, setTaboo] = useState<number | null>(null);
  const [forbidden, setForbidden] = useState<number | null>(null);
  const [startDegree, setStartDegree] = useState<number | null>(null);
  const risk = useSettings((s) => s.risk);
  const [consigna, setConsigna] = useState<{ label: string; rule: string } | null>(null);
  const drawing = useRef(false);

  const contour = contourId === 'dibujo' ? drawn : sampleContour(CONTOURS[contourId].shape);
  const notes = fitContour(contour, {
    tonic,
    mode,
    range,
    length,
    taboo,
    forbiddenInterval: forbidden,
    startDegree,
  });

  const paint = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    const y = 1 - Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));
    setContourId('dibujo');
    setDrawn((previous) => {
      const next = contourId === 'dibujo' ? [...previous] : [...contour];
      const center = Math.round(x * (next.length - 1));
      for (let i = Math.max(0, center - 1); i <= Math.min(next.length - 1, center + 1); i++) next[i] = y;
      return next;
    });
  };

  const parts = [
    `Contorno ${contourId === 'dibujo' ? 'dibujado' : CONTOURS[contourId].name.toLowerCase()} ajustado a ${TONICS[tonic]} ${MODES[mode].name}`,
    `registro de ${range} notas`,
    taboo !== null ? `sin ${TONICS[taboo]}, la nota tabú` : null,
    forbidden !== null
      ? `sin saltos de ${INTERVALS.find(([value]) => value === forbidden)?.[1].toLowerCase()}`
      : null,
    startDegree !== null ? `arranca en el grado ${startDegree + 1}` : null,
  ].filter(Boolean);

  usePublishMelody(
    `Contorno ${contourId === 'dibujo' ? 'dibujado' : CONTOURS[contourId].name.toLowerCase()}`,
    `${parts.join(', ')}.`,
    notes,
  );

  return (
    <Slab>
      <SlabHead title="Contorno">
        <Button
          id="roll-melody"
          onClick={() => {
            const rolled = rollMelody({ risk, rng: createRng(randomSeed()) });
            setConsigna({ label: rolled.label, rule: rolled.rule });
            publishToConsigna('melodia', { label: rolled.label, rule: rolled.rule });
          }}
        >
          Sortear consigna
        </Button>
      </SlabHead>
      {consigna && (
        <p className={styles.consigna} data-testid="melody-consigna">
          <strong>{consigna.label}.</strong> {consigna.rule}
        </p>
      )}
      {picker}
      <div className={styles.chips}>
        {(Object.keys(CONTOURS) as ContourId[]).map((id) => (
          <Button key={id} variant="mini" ariaPressed={contourId === id} onClick={() => setContourId(id)}>
            {CONTOURS[id].name}
          </Button>
        ))}
      </div>
      <svg
        className={styles.draw}
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        role="img"
        aria-label="Zona para dibujar el contorno"
        data-testid="contour-pad"
        onPointerDown={(event) => {
          drawing.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          paint(event);
        }}
        onPointerMove={(event) => {
          if (drawing.current) paint(event);
        }}
        onPointerUp={() => {
          drawing.current = false;
        }}
        onPointerCancel={() => {
          drawing.current = false;
        }}
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          points={contour.map((y, i) => `${(i / (contour.length - 1)) * 100},${(1 - y) * 40}`).join(' ')}
        />
      </svg>
      <p className={styles.hint}>Elegí una forma o dibujá la tuya con el dedo.</p>

      <div className={styles.fields}>
        <label className={styles.field}>
          <span>Registro: {range} notas</span>
          <input
            type="range"
            min={2}
            max={12}
            value={range}
            onChange={(event) => setRange(Number(event.target.value))}
          />
        </label>
        <label className={styles.field}>
          <span>Largo: {length} notas</span>
          <input
            type="range"
            min={4}
            max={24}
            value={length}
            onChange={(event) => setLength(Number(event.target.value))}
          />
        </label>
        <label className={styles.field}>
          <span>Nota tabú</span>
          <select
            data-testid="taboo"
            value={taboo ?? ''}
            onChange={(event) => setTaboo(event.target.value === '' ? null : Number(event.target.value))}
          >
            <option value="">Ninguna</option>
            {TONICS.map((name, index) => (
              <option key={name} value={index}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Intervalo prohibido</span>
          <select
            value={forbidden ?? ''}
            onChange={(event) => setForbidden(event.target.value === '' ? null : Number(event.target.value))}
          >
            <option value="">Ninguno</option>
            {INTERVALS.map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Arranca en</span>
          <select
            value={startDegree ?? ''}
            onChange={(event) =>
              setStartDegree(event.target.value === '' ? null : Number(event.target.value))
            }
          >
            <option value="">Donde caiga</option>
            {[0, 2, 4, 6, 8].map((degree) => (
              <option key={degree} value={degree}>
                {degree === 8 ? '9.ª (2.ª arriba)' : `Grado ${degree + 1}`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <PianoRoll notes={notes} label="Melodía generada" />
      <NoteNames notes={notes} />
      <p className={styles.rule}>{parts.join(', ')}.</p>
      <div className={styles.chips}>
        <Button
          variant="primary"
          id="play-melody"
          onClick={() => {
            stopInstrument();
            playMelody(notes, BPM, a4);
          }}
        >
          ▶ Oír
        </Button>
        <Fader channel="instrumento" />
      </div>
    </Slab>
  );
}

function MotifTab() {
  const a4 = useSettings((s) => s.a4);
  const { tonic, mode, picker } = useKey();
  const [motif, setMotif] = useState<Note[]>(() => rollMotif(createRng(7), tonic, mode));
  const [transform, setTransform] = useState<TransformId>('inversion');
  const result = TRANSFORMS[transform].apply(motif);
  const ids = Object.keys(TRANSFORMS) as TransformId[];
  usePublishMelody(`Motivo, ${TRANSFORMS[transform].name.toLowerCase()}`, TRANSFORMS[transform].rule, result);
  return (
    <Slab>
      <SlabHead title="Motivo">
        <Button id="roll-motif" onClick={() => setMotif(rollMotif(createRng(randomSeed()), tonic, mode))}>
          Sortear motivo
        </Button>
      </SlabHead>
      {picker}
      <h3 className={styles.subtitle}>Original</h3>
      <PianoRoll
        notes={motif}
        label="Motivo original"
        onNoteChange={(index, midi) =>
          setMotif((current) => current.map((note, i) => (i === index ? { ...note, midi } : note)))
        }
        onAudition={(midi) => {
          stopInstrument();
          playMelody([{ midi, start: 0 }], BPM, a4);
        }}
      />
      <p className={styles.hint}>Arrastrá una nota para subirla o bajarla: la variación la sigue.</p>
      <NoteNames notes={motif} />
      <div className={styles.chips}>
        {ids.map((id) => (
          <Button key={id} variant="mini" ariaPressed={id === transform} onClick={() => setTransform(id)}>
            {TRANSFORMS[id].name}
          </Button>
        ))}
        <Button
          variant="mini"
          id="dice"
          ariaLabel="Sortear una variación"
          onClick={() => {
            const rng = createRng(randomSeed());
            setTransform(rng.pick(ids.filter((id) => id !== transform)));
          }}
        >
          Dado
        </Button>
      </div>
      <h3 className={styles.subtitle}>{TRANSFORMS[transform].name}</h3>
      <PianoRoll notes={result} label="Motivo transformado" />
      <NoteNames notes={result} />
      <p className={styles.rule} data-testid="motif-rule">
        {TRANSFORMS[transform].rule}
      </p>
      <div className={styles.chips}>
        <Button
          onClick={() => {
            stopInstrument();
            playMelody(motif, BPM, a4);
          }}
        >
          ▶ Oír original
        </Button>
        <Button
          onClick={() => {
            stopInstrument();
            playMelody(result, BPM, a4);
          }}
        >
          ▶ Oír variación
        </Button>
      </div>
    </Slab>
  );
}

function TextTab() {
  const a4 = useSettings((s) => s.a4);
  const { tonic, mode, picker } = useKey();
  const [text, setText] = useState('Bach');
  const { notes, names } = textToNotes(text, tonic, mode);
  usePublishMelody(
    `Notas desde “${text}”`,
    'Notas desde texto, como B-A-C-H: las letras dictan la altura.',
    notes,
  );
  return (
    <Slab>
      <SlabHead title="Notas desde texto" />
      <label className={styles.textField}>
        <span>Palabra</span>
        <input
          value={text}
          maxLength={40}
          onChange={(event) => setText(event.target.value)}
          data-testid="text-input"
        />
      </label>
      {picker}
      <PianoRoll notes={notes} label="Melodía desde el texto" />
      <p className={styles.names} data-testid="text-notes">
        {names.join(' · ')}
      </p>
      <p className={styles.rule}>
        Las letras con nombre de nota usan la notación alemana, como B-A-C-H: B es Si bemol, H es Si y S es Mi
        bemol. Las demás recorren la escala en orden.
      </p>
      <div className={styles.chips}>
        <Button
          id="play-text"
          onClick={() => {
            stopInstrument();
            playMelody(notes, BPM, a4);
          }}
        >
          ▶ Oír
        </Button>
      </div>
    </Slab>
  );
}

const KIND_NAMES: Record<TensionKind, string> = { reposo: 'Reposo', tension: 'Tensión', choque: 'Choque' };

function TensionTab() {
  const active = useProject((s) => s.active);
  // Sin acordes propios, la sección toca lo que sale de la consigna: el mapa arranca en el primero.
  const chords = useSectionHarmony(active).chords;
  const [picked, setChord] = useState<string | null>(null);
  const chord = picked ?? chords[0] ?? 'Am7';
  const parsed = parseChord(chord);
  const map = parsed ? tensionMap(parsed) : [];
  return (
    <Slab>
      <SlabHead title="Mapa de tensiones" />
      <div className={styles.fields}>
        <SectionPicker />
        <label className={styles.field}>
          <span>Acorde</span>
          <input
            value={chord}
            aria-invalid={!parsed}
            onChange={(event) => setChord(event.target.value.trim())}
            data-testid="tension-chord"
          />
        </label>
      </div>
      {chords.length > 0 && (
        <div className={styles.chips}>
          {chords.map((name, index) => (
            <Button
              key={`${name}-${index}`}
              variant="mini"
              ariaPressed={name === chord}
              onClick={() => setChord(name)}
            >
              {name}
            </Button>
          ))}
        </div>
      )}
      {!parsed && (
        <p className={styles.consigna}>No reconozco ese acorde. Probá con Am, C7, Dsus2 o Gmaj7.</p>
      )}
      <ul className={styles.tensions}>
        {map.map((item) => (
          <li key={item.pitchClass} data-kind={item.kind} data-testid="tension">
            <strong>{item.note}</strong>
            <em>{KIND_NAMES[item.kind]}</em>
            <span>{item.why}</span>
          </li>
        ))}
      </ul>
    </Slab>
  );
}

const CAPTURE_SECONDS = 6;
const FRAME_MS = 50;

function useCapture() {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancel = useRef<(() => void) | null>(null);

  useEffect(() => () => cancel.current?.(), []);

  const capture = async (onDone: (frames: VoiceFrame[]) => void) => {
    setError(null);
    const opened = await openMic();
    if (typeof opened === 'string') {
      setError('No se pudo abrir el micrófono. Revisá el permiso del navegador.');
      return;
    }
    const mic: MicInput = opened;
    const frames: VoiceFrame[] = [];
    const startedAt = performance.now();
    setRemaining(CAPTURE_SECONDS);
    const finish = () => {
      clearInterval(timer);
      mic.stop();
      cancel.current = null;
      setRemaining(null);
    };
    const timer = setInterval(() => {
      const buffer = mic.read();
      const result = detectPitch(buffer, mic.sampleRate, { minFreq: 70, maxFreq: 1100, threshold: 0.2 });
      frames.push({ hz: result?.freq ?? null, level: rms(buffer) });
      const elapsed = (performance.now() - startedAt) / 1000;
      setRemaining(Math.max(0, Math.ceil(CAPTURE_SECONDS - elapsed)));
      if (elapsed >= CAPTURE_SECONDS) {
        finish();
        onDone(frames);
      }
    }, FRAME_MS);
    cancel.current = finish;
  };

  return { remaining, error, capture };
}

function VoiceTab() {
  const a4 = useSettings((s) => s.a4);
  const sung = useCapture();
  const spoken = useCapture();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [rhythm, setRhythm] = useState<{ cells: boolean[]; unitMs: number } | null>(null);
  return (
    <>
      <Slab>
        <SlabHead title="Cantar y transcribir" />
        <p className={styles.hint}>
          Cantá o tarareá durante {CAPTURE_SECONDS} segundos, con notas claras. Mejor sin parlantes sonando.
        </p>
        <div className={styles.chips}>
          <Button
            variant="primary"
            id="sing"
            onClick={() => {
              if (sung.remaining === null)
                void sung.capture((frames) => setNotes(notesFromVoice(frames, FRAME_MS, a4)));
            }}
          >
            {sung.remaining === null ? '● Cantar' : `Escuchando… ${sung.remaining}`}
          </Button>
        </div>
        {sung.error && <p className={styles.consigna}>{sung.error}</p>}
        {notes && (
          <>
            <PianoRoll notes={notes} label="Melodía transcripta" />
            <NoteNames notes={notes} />
            <div className={styles.chips}>
              <Button onClick={() => playMelody(notes, 120, a4)}>▶ Oír</Button>
            </div>
          </>
        )}
      </Slab>
      <Slab>
        <SlabHead title="Ritmo desde el habla" />
        <p className={styles.hint}>
          Decí una frase en voz alta, como si la contaras. La grilla marca dónde cayeron las sílabas fuertes.
        </p>
        <div className={styles.chips}>
          <Button
            variant="primary"
            id="speak"
            onClick={() => {
              if (spoken.remaining === null)
                void spoken.capture((frames) =>
                  setRhythm(
                    quantizeOnsets(
                      speechOnsets(
                        frames.map((f) => f.level),
                        FRAME_MS,
                      ),
                    ),
                  ),
                );
            }}
          >
            {spoken.remaining === null ? '● Hablar' : `Escuchando… ${spoken.remaining}`}
          </Button>
        </div>
        {spoken.error && <p className={styles.consigna}>{spoken.error}</p>}
        {rhythm && (
          <>
            <div className={styles.speech} data-testid="speech-grid">
              {rhythm.cells.map((on, index) => (
                <span key={index} data-on={on} />
              ))}
            </div>
            <p className={styles.names}>
              {rhythm.cells.map((on) => (on ? 'x' : '.')).join('')}
              {rhythm.unitMs > 0 && ` · un pulso cada ${Math.round(rhythm.unitMs)} ms`}
            </p>
          </>
        )}
      </Slab>
    </>
  );
}

type TabId = 'contorno' | 'motivo' | 'texto' | 'tensiones' | 'voz';

export default function MelodiaRoute() {
  const [tab, setTab] = useState<TabId>('contorno');
  return (
    <div>
      <Slab>
        <PageTitle eyebrow="Melodía" title="Melodía">
          <p>
            Restricciones para no caer en la misma línea de siempre. Las notas las elegís vos al cantarlas.
          </p>
        </PageTitle>
      </Slab>
      <Tabs<TabId>
        label="Herramientas de melodía"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'contorno', label: 'Contorno' },
          { value: 'motivo', label: 'Motivo' },
          { value: 'texto', label: 'Texto' },
          { value: 'tensiones', label: 'Tensiones' },
          { value: 'voz', label: 'Voz' },
        ]}
      />
      {tab === 'contorno' && <ContourTab />}
      {tab === 'motivo' && <MotifTab />}
      {tab === 'texto' && <TextTab />}
      {tab === 'tensiones' && <TensionTab />}
      {tab === 'voz' && <VoiceTab />}
    </div>
  );
}
