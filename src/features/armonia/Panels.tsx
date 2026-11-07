// Los paneles que editan la progresión. No guardan nada: muestran opciones y avisan qué se eligió.
import { useState } from 'react';
import { degreeOf, parseChord } from '~/core/chords';
import { MODES, type ModeId } from '~/core/harmony';
import {
  borrowedChords,
  chordsOfFormula,
  chordVariations,
  diatonicChords,
  MAX_CHORDS,
  type Key,
  type Variation,
} from '~/core/variations';
import { FORMULAS, type Formula } from '~/data/formulas';
import { Button, Stepper } from '~/shared/ui/ui';
import styles from './armonia.module.css';

function Option({
  title,
  detail,
  note,
  onClick,
  disabled,
  testId,
}: {
  title: string;
  detail: string;
  note?: string;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      className={styles.option}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
    >
      {note && <small className={styles.optionNote}>{note}</small>}
      <strong>{title}</strong>
      <span>{detail}</span>
    </button>
  );
}

/** Quien escribe "am7" quiere decir Am7. */
const normalizeTyped = (text: string) => {
  const clean = text.trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
};

export function AddPanel({
  chordKey,
  count,
  afterName,
  onAdd,
  onAddAtEnd,
}: {
  chordKey: Key;
  count: number;
  /** El acorde después del cual entra lo nuevo; sin él, va al final. */
  afterName: string | null;
  onAdd: (name: string) => void;
  onAddAtEnd: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [invalid, setInvalid] = useState(false);
  const full = count >= MAX_CHORDS;

  const submit = () => {
    const name = normalizeTyped(typed);
    if (!parseChord(name)) {
      setInvalid(true);
      return;
    }
    onAdd(name);
    setTyped('');
    setInvalid(false);
  };

  const row = (title: string, list: ReturnType<typeof diatonicChords>) => (
    <div className={styles.group}>
      <h3>{title}</h3>
      <div className={styles.palette}>
        {list.map((chord) => (
          <button
            key={chord.name}
            type="button"
            className={styles.paletteChord}
            disabled={full}
            aria-label={`Sumar ${chord.name}`}
            data-testid="palette-chord"
            onClick={() => onAdd(chord.name)}
          >
            <small>{degreeOf(chord.name, chordKey.tonic)}</small>
            <strong>{chord.name}</strong>
            <small>{chord.role}</small>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <div className={styles.place}>
        <p data-testid="add-place">
          {full
            ? `Ya hay ${MAX_CHORDS} acordes, que es el máximo: sacá uno para sumar otro.`
            : afterName
              ? `Lo que sumes entra después de ${afterName}.`
              : 'Lo que sumes entra al final.'}
        </p>
        {afterName && !full && (
          <Button variant="mini" onClick={onAddAtEnd}>
            Mejor al final
          </Button>
        )}
      </div>
      {row('De la tonalidad', diatonicChords(chordKey))}
      {row('Prestados del modo paralelo', borrowedChords(chordKey))}
      <div className={styles.group}>
        <h3>Cualquier otro</h3>
        <div className={styles.typed}>
          <label className={styles.tuningField}>
            <span>Acorde</span>
            <input
              value={typed}
              aria-invalid={invalid}
              placeholder="F#m7, C/E, Gsus4…"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              data-testid="chord-input"
              onChange={(event) => {
                setTyped(event.target.value);
                setInvalid(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit();
              }}
            />
          </label>
          <Button onClick={submit} disabled={full || typed.trim() === ''} id="add-typed-chord">
            Sumar
          </Button>
        </div>
        {invalid && (
          <p className={styles.problem} role="alert">
            No reconozco ese acorde. Probá con Am7, C6, F#m7b5, Gsus4, Dadd9 o C/E.
          </p>
        )}
      </div>
    </div>
  );
}

export function ChordPanel({
  name,
  chordKey,
  count,
  onPick,
}: {
  name: string;
  chordKey: Key;
  count: number;
  onPick: (variation: Variation) => void;
}) {
  return (
    <div>
      {chordVariations(name, chordKey).map((group) => (
        <div className={styles.group} key={group.title}>
          <h3>{group.title}</h3>
          <div className={styles.options}>
            {group.items.map((item) => (
              <Option
                key={item.label}
                title={item.label}
                detail={item.why}
                testId="variation"
                disabled={item.action === 'before' && count + item.chords.length > MAX_CHORDS}
                onClick={() => onPick(item)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export interface WholeActions {
  transpose: (semitones: number) => void;
  sevenths: () => void;
  triads: () => void;
  smoothBass: () => void;
  dominants: () => void;
  reverse: () => void;
  rotate: () => void;
  translate: (mode: ModeId) => void;
}

export function WholePanel({
  tonicName,
  mode,
  full,
  actions,
}: {
  tonicName: string;
  mode: ModeId;
  full: boolean;
  actions: WholeActions;
}) {
  return (
    <div>
      <div className={styles.group}>
        <h3>Altura</h3>
        <Stepper
          label="Transponer"
          value={<span data-testid="transpose-value">En {tonicName}</span>}
          onDown={() => actions.transpose(-1)}
          onUp={() => actions.transpose(1)}
        />
      </div>
      <div className={styles.group}>
        <h3>Llevarla a otro modo</h3>
        <div className={styles.chips}>
          {(Object.keys(MODES) as ModeId[]).map((id) => (
            <Button key={id} variant="mini" ariaPressed={id === mode} onClick={() => actions.translate(id)}>
              {MODES[id].name}
            </Button>
          ))}
        </div>
        <p className={styles.hint}>Cada acorde conserva su grado. Lo prestado y lo trabado quedan igual.</p>
      </div>
      <div className={styles.group}>
        <h3>Color y bajo</h3>
        <div className={styles.options}>
          <Option
            title="Sumar séptimas"
            detail="Cada tríada suma la séptima que le da la tonalidad."
            onClick={actions.sevenths}
            testId="whole-sevenths"
          />
          <Option
            title="Volver a tríadas"
            detail="Saca colores e inversiones, para oír el esqueleto."
            onClick={actions.triads}
            testId="whole-triads"
          />
          <Option
            title="Bajo por grados"
            detail="Elige inversiones para que el bajo se mueva lo menos posible."
            onClick={actions.smoothBass}
            testId="whole-bass"
          />
          <Option
            title="Preparar con dominantes"
            detail="Le suma un V7 a cada acorde que llega sin preparar."
            onClick={actions.dominants}
            disabled={full}
            testId="whole-dominants"
          />
        </div>
      </div>
      <div className={styles.group}>
        <h3>Orden</h3>
        <div className={styles.options}>
          <Option
            title="Empezar del siguiente"
            detail="Mismo ciclo, otro punto de partida: cambia dónde se siente la casa."
            onClick={actions.rotate}
            testId="whole-rotate"
          />
          <Option
            title="Dar vuelta"
            detail="De atrás para adelante: las cadencias se invierten."
            onClick={actions.reverse}
            testId="whole-reverse"
          />
        </div>
      </div>
    </div>
  );
}

export function FormulasPanel({ tonic, onPick }: { tonic: number; onPick: (formula: Formula) => void }) {
  return (
    <div>
      <p className={styles.hint}>
        Partir de algo conocido para romperlo. Reemplaza la progresión actual, y “Volver” la trae de nuevo.
      </p>
      <div className={styles.options}>
        {FORMULAS.map((formula) => {
          const chords = chordsOfFormula(formula, tonic);
          return (
            <Option
              key={formula.id}
              title={formula.name}
              note={chords.map((name) => degreeOf(name, tonic)).join(' – ')}
              detail={formula.why}
              testId={`formula-${formula.id}`}
              onClick={() => onPick(formula)}
            />
          );
        })}
      </div>
    </div>
  );
}
