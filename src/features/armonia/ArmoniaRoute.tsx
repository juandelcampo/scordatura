import { useRef, useState } from 'react';
import { useSearchParams, type MetaFunction } from 'react-router';
import { strum } from '~/audio/instrument';
import {
  closeVoicing,
  customBeats,
  DEFAULT_CHORD_BEATS,
  degreeOf,
  isChordBeats,
  MAX_CHORD_BEATS,
  parseChord,
  voicingFor,
} from '~/core/chords';
import { MODES, type ModeId } from '~/core/harmony';
import { createRng, randomSeed } from '~/core/rng';
import { rollHarmonyWith } from '~/core/rollers';
import {
  chordsOfFormula,
  enrichChord,
  insertAt,
  keyName,
  MAX_CHORDS,
  MIN_CHORDS,
  moveItem,
  prepareWithDominants,
  removeAt,
  roleOf,
  rotate,
  simplifyChord,
  smoothBass,
  transposeChord,
  translateChord,
  type Key,
  type Slot,
  type Variation,
} from '~/core/variations';
import type { Formula } from '~/data/formulas';
import { TUNINGS } from '~/data/tunings';
import { publishToConsigna } from '~/shared/consigna';
import { Fader } from '~/shared/Fader';
import { useProject } from '~/shared/project';
import { SectionPicker } from '~/shared/SectionPicker';
import { useSettings } from '~/shared/settings';
import { useSong } from '~/shared/song';
import { useHydrated } from '~/shared/useHydrated';
import { Button, PageTitle, Slab, SlabHead, Stepper, Tabs } from '~/shared/ui/ui';
import styles from './armonia.module.css';
import { AddPanel, ChordPanel, FormulasPanel, WholePanel, type WholeActions } from './Panels';
import { useProgressionPlayer } from './useProgressionPlayer';

export const meta: MetaFunction = () => [
  { title: 'Generador y editor de progresiones de acordes · Scordatura' },
  {
    name: 'description',
    content:
      'Sorteá una progresión con su regla y sus grados, y después variala: sumá y sacá acordes, reemplazalos por sustitutos, cambiá el bajo, transponé o llevala a otro modo. Y cómo tocarla en cada afinación.',
  },
];

const EXAMPLE = ['Am', 'F', 'C', 'G'];
const TONICS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const LONG_TITLE = 6;

type Tab = 'sumar' | 'acorde' | 'toda' | 'formulas';

interface Snapshot {
  chords: string[];
  tonic: number | null;
  mode: ModeId | null;
  beats: number[];
  rule: string;
  locked: boolean[];
}

const isMode = (text: string | null): text is ModeId => text !== null && text in MODES;

export default function ArmoniaRoute() {
  const risk = useSettings((s) => s.risk);
  const a4 = useSettings((s) => s.a4);
  const active = useProject((s) => s.active);
  const stored = useProject((s) => s.sections[s.active]?.chords);
  const storedBeats = useProject((s) => s.sections[s.active]?.chordBeats);
  const blockBeats = useSong().blocks.find((block) => block.letter === active)?.beats;
  const updateSection = useProject((s) => s.updateSection);
  const [params, setParams] = useSearchParams();
  const hydrated = useHydrated();
  const [tuningId, setTuningId] = useState('estandar');
  const [locked, setLocked] = useState<boolean[]>([]);
  const [rule, setRule] = useState('Un ejemplo para empezar: sorteá una progresión con su regla.');
  const [saved, setSaved] = useState(false);
  const [undo, setUndo] = useState<Snapshot[]>([]);
  const [tab, setTab] = useState<Tab>('sumar');
  const [selected, setSelected] = useState<number | null>(null);
  const [keepKey, setKeepKey] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [loop, setLoop] = useState(false);
  const [draft, setDraft] = useState<{ search: string; known: string[] } | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  // La URL se actualiza con una navegación, y tarda más que un doble toque. Mientras tanto manda lo
  // último que se escribió: si no, el segundo toque editaría la versión vieja y se perdería el primero.
  // Si la URL pasa a ser algo que no escribimos, es una navegación de verdad y manda ella.
  const urlSearch = hydrated ? params.toString() : '';
  const shown = new URLSearchParams(draft?.known.includes(urlSearch) ? draft.search : urlSearch);

  const fromUrl = shown
    .get('c')
    ?.split(',')
    .filter((name) => parseChord(name));
  const chords = fromUrl?.length ? fromUrl : EXAMPLE;
  const notes = TUNINGS.find((tuning) => tuning.id === tuningId)?.notes;
  const voicings = chords.map((name) => (notes ? voicingFor(notes, name) : null));
  const beatsInUrl = shown.get('d')?.split(',').map(Number);
  const beats = isChordBeats(beatsInUrl, chords.length) ? beatsInUrl : chords.map(() => DEFAULT_CHORD_BEATS);
  const totalBeats = beats.reduce((sum, value) => sum + value, 0);
  const evenBeats = beats.every((value) => value === beats[0]);
  const slots: Slot[] = chords.map((name, index) => ({
    name,
    locked: Boolean(locked[index]),
    beats: beats[index]!,
  }));
  const chosen = selected !== null && selected < chords.length ? selected : null;

  // La tónica viene de la URL; si no, se toma la del primer acorde.
  const keyText = shown.get('k');
  const keyFromUrl =
    keyText !== null && /^\d+$/.test(keyText) && Number(keyText) < 12 ? Number(keyText) : null;
  const tonic = keyFromUrl ?? parseChord(chords[0] ?? '')?.root ?? 0;
  const modeText = shown.get('m');
  const modeFromUrl = isMode(modeText) ? modeText : null;
  const mode: ModeId =
    modeFromUrl ?? (parseChord(chords[0] ?? '')?.intervals.includes(3) ? 'aeolian' : 'ionian');
  const chordKey: Key = { tonic, mode };
  const degrees = chords.map((name) => degreeOf(name, tonic) ?? '?');

  const midisOfName = (name: string, voicing = notes ? voicingFor(notes, name) : null) => {
    if (voicing) return voicing.midis;
    const parsed = parseChord(name);
    return parsed ? closeVoicing(parsed) : [];
  };

  const { current, playing, play, stop } = useProgressionPlayer({
    midis: chords.map((name, index) => midisOfName(name, voicings[index])),
    seconds: beats.map((value) => (60 / bpm) * value),
    loop,
    a4,
  });

  /** Para comparar al elegir. Si la progresión está sonando, el cambio se oye en la vuelta. */
  const audition = (name: string) => {
    if (!playing) strum(midisOfName(name), a4);
  };

  const show = (
    next: string[],
    nextTonic: number | null,
    nextMode: ModeId | null,
    nextBeats: readonly number[] = beats,
  ) => {
    setSaved(false);
    const search: Record<string, string> = { c: next.join(',') };
    if (nextTonic !== null) search.k = String(nextTonic);
    if (nextMode !== null) search.m = nextMode;
    const custom = customBeats(nextBeats);
    if (custom) search.d = custom.join(',');
    const written = new URLSearchParams(search).toString();
    setDraft((previous) => ({
      search: written,
      known: [...(previous?.known ?? []), urlSearch, written].slice(-120),
    }));
    setParams(search, { replace: true, preventScrollReset: true });
  };

  /** Toda edición pasa por acá: se puede deshacer, explica lo que hizo y llega a la consigna. */
  const commit = (next: Slot[], nextRule: string, nextKey: Key = chordKey) => {
    setUndo((stack) =>
      [...stack, { chords, tonic: keyFromUrl, mode: modeFromUrl, beats, rule, locked: [...locked] }].slice(
        -50,
      ),
    );
    const names = next.map((slot) => slot.name);
    setLocked(next.map((slot) => slot.locked));
    setRule(nextRule);
    const nextBeats = next.map((slot) => slot.beats);
    const custom = customBeats(nextBeats);
    show(names, nextKey.tonic, nextKey.mode, nextBeats);
    publishToConsigna('armonia', {
      chords: names,
      tonic: nextKey.tonic,
      ...(custom ? { beats: custom } : {}),
    });
  };

  /** Lo mismo, pero si nada cambió lo dice en vez de gastar un paso de "Volver". */
  const transform = (next: Slot[], nextRule: string, unchanged: string, nextKey: Key = chordKey) => {
    if (next.map((slot) => slot.name).join() === chords.join() && nextKey.mode === mode) {
      setRule(unchanged);
      return;
    }
    commit(next, nextRule, nextKey);
  };

  const roll = () => {
    const rolled = rollHarmonyWith(
      { risk, rng: createRng(randomSeed()) },
      keepKey ? { length: chords.length, tonic, mode } : { length: chords.length },
    );
    const next = rolled.value.chords.map((name, index) => ({
      name: slots[index]?.locked ? slots[index].name : name,
      locked: Boolean(slots[index]?.locked),
      beats: slots[index]?.beats ?? DEFAULT_CHORD_BEATS,
    }));
    commit(
      next,
      locked.some(Boolean)
        ? `${rolled.rule} Los acordes trabados quedan como estaban, y pueden salirse de esta regla.`
        : rolled.rule,
      { tonic: rolled.value.tonic, mode: rolled.value.mode },
    );
  };

  const goBack = () => {
    const previous = undo[undo.length - 1];
    if (!previous) return;
    setUndo(undo.slice(0, -1));
    setRule(previous.rule);
    setLocked(previous.locked);
    show(previous.chords, previous.tonic, previous.mode, previous.beats);
    const custom = customBeats(previous.beats);
    publishToConsigna('armonia', {
      chords: previous.chords,
      ...(custom ? { beats: custom } : {}),
      ...(previous.tonic === null ? {} : { tonic: previous.tonic }),
    });
  };

  const openPanel = (next: Tab) => {
    setTab(next);
    panel.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  const addChord = (name: string) => {
    const at = chosen === null ? chords.length : chosen + 1;
    // Entra con la duración del acorde que tiene al lado: en una vuelta de a 2, sigue siendo de a 2.
    const next = insertAt(slots, at, [{ name, locked: false, beats: beats[at - 1] ?? DEFAULT_CHORD_BEATS }]);
    const names = next.map((slot) => slot.name);
    commit(
      next,
      `Sumaste ${name}: en ${keyName(chordKey)} queda como ${roleOf(names, at, chordKey).toLowerCase()}.`,
    );
    if (chosen !== null) setSelected(at);
    audition(name);
  };

  const removeChord = (index: number) => {
    commit(removeAt(slots, index), `Sacaste ${chords[index]}. Probá cómo camina sin ese paso.`);
    if (chosen === null) return;
    if (index === chosen) setSelected(null);
    else if (index < chosen) setSelected(chosen - 1);
  };

  const moveChord = (index: number, to: number) => {
    const name = chords[index]!;
    commit(moveItem(slots, index, to), `Moviste ${name}: mismos acordes, otro recorrido.`);
    if (chosen === null) return;
    if (chosen === index) setSelected(to);
    else if (chosen === to) setSelected(index);
  };

  const changeBeats = (index: number, delta: number) => {
    const name = chords[index]!;
    const value = Math.min(MAX_CHORD_BEATS, Math.max(1, beats[index]! + delta));
    commit(
      slots.map((slot, i) => (i === index ? { ...slot, beats: value } : slot)),
      `${name} dura ${value} ${value === 1 ? 'tiempo' : 'tiempos'}. Cuándo cambia el acorde pesa tanto como cuál es.`,
    );
  };

  const changeAllBeats = (delta: number) => {
    commit(
      slots.map((slot) => ({
        ...slot,
        beats: Math.min(MAX_CHORD_BEATS, Math.max(1, slot.beats + delta)),
      })),
      delta > 0
        ? 'Armonía más lenta: cada acorde dura un tiempo más.'
        : 'Armonía más rápida: cada acorde dura un tiempo menos.',
    );
  };

  const panelChord = chosen ?? 0;

  const pickVariation = (variation: Variation) => {
    const target = chords[panelChord]!;
    if (variation.action === 'replace') {
      const name = variation.chords[0]!;
      commit(
        slots.map((slot, i) => (i === panelChord ? { ...slot, name } : slot)),
        `${target} → ${name}. ${variation.why}`,
      );
      setSelected(panelChord);
      audition(name);
      return;
    }
    const added = variation.chords.map((name) => ({ name, locked: false, beats: beats[panelChord]! }));
    commit(
      insertAt(slots, panelChord, added),
      `${variation.chords.join(' ')} antes de ${target}. ${variation.why}`,
    );
    setSelected(panelChord + added.length);
    audition(variation.chords[0]!);
  };

  const pickFormula = (formula: Formula) => {
    const names = chordsOfFormula(formula, tonic);
    setSelected(null);
    commit(
      names.map((name, index) => ({
        name,
        locked: false,
        beats: formula.beats?.[index] ?? DEFAULT_CHORD_BEATS,
      })),
      `${formula.name}: ${formula.why}`,
      { tonic, mode: formula.mode },
    );
  };

  const free = (change: (name: string) => string) =>
    slots.map((slot) => (slot.locked ? slot : { ...slot, name: change(slot.name) }));

  const whole: WholeActions = {
    transpose: (semitones) => {
      const nextKey = { tonic: (tonic + semitones + 12) % 12, mode };
      // Transponer mueve también lo trabado: si no, dejaría de ser la misma progresión.
      commit(
        slots.map((slot) => ({ ...slot, name: transposeChord(slot.name, semitones, nextKey) })),
        `Transpuesta a ${keyName(nextKey)}: misma música, otra altura y otra digitación.`,
        nextKey,
      );
    },
    sevenths: () =>
      transform(
        free((name) => enrichChord(name, chordKey)),
        `Séptimas: cada tríada suma la que le da ${keyName(chordKey)}.`,
        'No hay tríadas libres para enriquecer: ya tienen color, o están trabadas.',
      ),
    triads: () =>
      transform(
        free(simplifyChord),
        'Tríadas: sin colores ni inversiones queda el esqueleto de la progresión.',
        'Ya está en tríadas, o lo que queda está trabado.',
      ),
    smoothBass: () => {
      const { slots: next, line } = smoothBass(slots);
      transform(
        next,
        `Bajo por grados: ${line.join(' → ')}. Las inversiones acercan cada bajo al siguiente.`,
        `El bajo ya se mueve lo mínimo: ${line.join(' → ')}.`,
      );
    },
    dominants: () => {
      const { slots: next, added } = prepareWithDominants(slots, chordKey);
      transform(
        next,
        `Dominantes secundarias: ${added.join(', ')} preparan el acorde que les sigue.`,
        'Cada acorde ya llega preparado, o no hay nada para preparar más que la tónica.',
      );
    },
    reverse: () =>
      commit([...slots].reverse(), 'Dada vuelta: las funciones quedan al revés, y las cadencias también.'),
    rotate: () =>
      commit(
        rotate(slots),
        `Empieza de ${chords[1]}: mismo ciclo, pero cambia dónde se siente la casa. La tónica escrita no se mueve.`,
      ),
    translate: (target) => {
      const nextKey = { tonic, mode: target };
      transform(
        free((name) => translateChord(name, chordKey, target)),
        `Llevada a ${keyName(nextKey)}: cada acorde conserva su grado, y lo prestado queda igual.`,
        `Ya está en ${keyName(nextKey)}.`,
        nextKey,
      );
    },
  };

  const atMost = chords.length >= MAX_CHORDS;
  const atLeast = chords.length <= MIN_CHORDS;

  return (
    <div>
      <Slab className={chords.length > LONG_TITLE ? styles.longTitle : ''}>
        <PageTitle eyebrow="Armonía" title={chords.join(' – ')}>
          <p className={styles.degrees} data-testid="degrees">
            {degrees.join(' – ')}
          </p>
          <p>
            <strong>Regla →</strong> <span data-testid="harmony-rule">{rule}</span>
          </p>
        </PageTitle>
        <div className={styles.actions}>
          <Button variant="primary" onClick={roll} id="roll-harmony">
            Sortear
          </Button>
          <Button onClick={goBack} id="undo-harmony" disabled={undo.length === 0}>
            ↩ Volver
          </Button>
          <Button onClick={() => (playing ? stop() : play())} id="play-harmony">
            {playing ? '■ Parar' : '▶ Oír'}
          </Button>
          <Button onClick={() => setLoop(!loop)} ariaPressed={loop} id="loop-harmony">
            ⟳ En loop
          </Button>
          <Stepper
            label="Tempo"
            value={<span data-testid="harmony-bpm">{bpm} BPM</span>}
            onDown={() => setBpm(Math.max(40, bpm - 5))}
            onUp={() => setBpm(Math.min(220, bpm + 5))}
          />
          <Stepper
            label="Tiempos por acorde"
            value={
              <span data-testid="harmony-beats">
                {evenBeats
                  ? `${beats[0]} ${beats[0] === 1 ? 'tiempo' : 'tiempos'}`
                  : `${totalBeats} en total`}
              </span>
            }
            onDown={() => changeAllBeats(-1)}
            onUp={() => changeAllBeats(1)}
          />
          <Fader channel="instrumento" />
        </div>
      </Slab>

      <Slab>
        <SlabHead title="La progresión" />
        <div className={styles.actions}>
          <label className={styles.tuningField}>
            <span>Tónica</span>
            <select
              value={tonic}
              data-testid="harmony-key"
              onChange={(event) => show(chords, Number(event.target.value), modeFromUrl)}
            >
              {TONICS.map((name, index) => (
                <option key={name} value={index}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.tuningField}>
            <span>Modo</span>
            <select
              value={mode}
              data-testid="harmony-mode"
              onChange={(event) => show(chords, tonic, event.target.value as ModeId)}
            >
              {(Object.keys(MODES) as ModeId[]).map((id) => (
                <option key={id} value={id}>
                  {MODES[id].name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.tuningField}>
            <span>Afinación</span>
            <select
              value={tuningId}
              onChange={(event) => setTuningId(event.target.value)}
              data-testid="harmony-tuning"
            >
              {TUNINGS.map((tuning) => (
                <option key={tuning.id} value={tuning.id}>
                  {tuning.name}
                </option>
              ))}
            </select>
          </label>
          <Button ariaPressed={keepKey} onClick={() => setKeepKey(!keepKey)} id="keep-key">
            Sortear en este tono
          </Button>
        </div>
        <div className={styles.timeline} aria-hidden="true" data-testid="timeline">
          {chords.map((name, index) => (
            <span
              key={`${name}-${index}`}
              style={{ flexGrow: beats[index] }}
              data-playing={current === index}
              data-selected={chosen === index}
            />
          ))}
        </div>
        <ul className={styles.chords}>
          {chords.map((name, index) => {
            const voicing = voicings[index];
            const isLocked = Boolean(locked[index]);
            return (
              <li
                key={`${name}-${index}`}
                className={styles.chord}
                data-locked={isLocked}
                data-selected={chosen === index}
                data-playing={current === index}
                data-testid="chord"
              >
                <span className={styles.degree} data-testid="degree">
                  {degrees[index]}
                </span>
                <span className={styles.role} data-testid="role">
                  {roleOf(chords, index, chordKey)}
                </span>
                <h3>
                  <button
                    type="button"
                    className={styles.chordName}
                    aria-label={`Elegir ${name}`}
                    aria-pressed={chosen === index}
                    onClick={() => {
                      setSelected(index);
                      openPanel('acorde');
                    }}
                  >
                    {name}
                  </button>
                </h3>
                <p className={styles.frets} data-testid="frets">
                  {voicing
                    ? voicing.frets.map((fret) => (fret === null ? 'x' : fret)).join(' ')
                    : 'Sin digitación simple'}
                </p>
                <div className={styles.chordActions}>
                  <Button
                    variant="mini"
                    onClick={() => strum(midisOfName(name, voicing), a4)}
                    ariaLabel={`Oír ${name}`}
                  >
                    ▶
                  </Button>
                  <span className={styles.lockSlot}>
                    <Button
                      variant="mini"
                      full
                      ariaPressed={isLocked}
                      ariaLabel={`${isLocked ? 'Destrabar' : 'Trabar'} ${name}`}
                      onClick={() =>
                        setLocked(chords.map((_, i) => (i === index ? !isLocked : Boolean(locked[i]))))
                      }
                    >
                      {isLocked ? 'Trabado' : 'Trabar'}
                    </Button>
                  </span>
                  <Button
                    variant="mini"
                    ariaLabel={`Mover ${name} antes`}
                    disabled={index === 0}
                    onClick={() => moveChord(index, index - 1)}
                  >
                    ←
                  </Button>
                  <Button
                    variant="mini"
                    ariaLabel={`Mover ${name} después`}
                    disabled={index === chords.length - 1}
                    onClick={() => moveChord(index, index + 1)}
                  >
                    →
                  </Button>
                  <Button
                    variant="mini"
                    ariaLabel={`Sacar ${name}`}
                    disabled={atLeast}
                    onClick={() => removeChord(index)}
                  >
                    ✕
                  </Button>
                  <Button
                    variant="mini"
                    ariaLabel={`Acortar ${name}`}
                    disabled={beats[index] === 1}
                    onClick={() => changeBeats(index, -1)}
                  >
                    −
                  </Button>
                  <span className={styles.beatsCount} data-testid="chord-beats">
                    {beats[index]} t
                  </span>
                  <Button
                    variant="mini"
                    ariaLabel={`Alargar ${name}`}
                    disabled={beats[index] === MAX_CHORD_BEATS}
                    onClick={() => changeBeats(index, 1)}
                  >
                    +
                  </Button>
                </div>
              </li>
            );
          })}
          {!atMost && (
            <li className={styles.addSlot}>
              <button
                type="button"
                data-testid="add-chord"
                onClick={() => {
                  setSelected(null);
                  openPanel('sumar');
                }}
              >
                + Sumar acorde
              </button>
            </li>
          )}
        </ul>
        <p className={styles.hint}>
          Tocá el nombre de un acorde para variarlo, y con − y + cambiá cuántos tiempos (t) dura. Los números
          son trastes, de la 6.ª cuerda a la 1.ª, y una x es una cuerda que no se toca. Los grados se miden
          contra la escala mayor: en minúscula los acordes menores, y con bemol lo que queda abajo de esa
          escala.
        </p>
      </Slab>

      <Slab>
        <div ref={panel} className={styles.panel}>
          <Tabs
            label="Editar la progresión"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'sumar', label: 'Sumar' },
              { value: 'acorde', label: `Variar ${chords[panelChord]}` },
              { value: 'toda', label: 'Toda la progresión' },
              { value: 'formulas', label: 'Fórmulas' },
            ]}
          />
          <div className={styles.panelBody} data-testid={`panel-${tab}`}>
            {tab === 'sumar' && (
              <AddPanel
                chordKey={chordKey}
                count={chords.length}
                afterName={chosen === null ? null : chords[chosen]!}
                onAdd={addChord}
                onAddAtEnd={() => setSelected(null)}
              />
            )}
            {tab === 'acorde' && (
              <ChordPanel
                name={chords[panelChord]!}
                chordKey={chordKey}
                count={chords.length}
                onPick={pickVariation}
              />
            )}
            {tab === 'toda' && (
              <WholePanel tonicName={TONICS[tonic]!} mode={mode} full={atMost} actions={whole} />
            )}
            {tab === 'formulas' && <FormulasPanel tonic={tonic} onPick={pickFormula} />}
          </div>
        </div>
      </Slab>

      <Slab>
        <SlabHead title="Usar en la canción">
          <div className={styles.actions}>
            <SectionPicker />
            <Button
              id="save-harmony"
              onClick={() => {
                updateSection(active, { chords, chordBeats: customBeats(beats) });
                setSaved(true);
              }}
            >
              {saved ? `Guardada en ${active}` : `Guardar en ${active}`}
            </Button>
            {hydrated && stored && stored.length > 0 && (
              <Button
                id="load-harmony"
                onClick={() => {
                  setSelected(null);
                  commit(
                    stored.map((name, index) => ({
                      name,
                      locked: false,
                      beats: storedBeats?.[index] ?? DEFAULT_CHORD_BEATS,
                    })),
                    `Traída de la sección ${active}, para seguir variándola.`,
                  );
                  setSaved(true);
                }}
              >
                Traer de {active}
              </Button>
            )}
          </div>
        </SlabHead>
        <p className={styles.hint}>La melodía de esa sección va a usar estos acordes.</p>
        {hydrated && blockBeats !== undefined && (
          <p className={styles.hint} data-testid="harmony-fit">
            Una vuelta dura {totalBeats} tiempos y un bloque {active}, {blockBeats}.{' '}
            {totalBeats > blockBeats
              ? 'No entra: en el Estudio se comprime para que suenen todos, o sumale compases a la sección.'
              : totalBeats === blockBeats
                ? 'Entra justo.'
                : 'La vuelta se repite hasta llenar el bloque.'}
          </p>
        )}
      </Slab>
    </div>
  );
}
