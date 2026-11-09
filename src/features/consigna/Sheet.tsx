// La hoja para llevar al ensayo: solo se ve al imprimir. Lo que hace falta con el instrumento en la
// mano: cómo afinar, qué acordes y dónde se ponen los dedos, la forma y la letra de cada sección.
import { degreeOf, voicingFor } from '~/core/chords';
import { MODES } from '~/core/harmony';
import { melodyExample, type MelodyKind } from '~/core/melodyRules';
import { noteLabel } from '~/core/notes';
import { createRng } from '~/core/rng';
import { sectionHarmony, type BaseHarmony } from '~/core/sections';
import { DEFAULT_BARS } from '~/core/song';
import { spellInKey, type Key } from '~/core/variations';
import { useForm } from '~/shared/consigna';
import { useProject } from '~/shared/project';
import { useSettings } from '~/shared/settings';
import styles from './consigna.module.css';

interface SheetProps {
  tuningLabel: string;
  tuningNotes: string[];
  rhythmLabel: string;
  harmony: BaseHarmony;
  harmonyKey: Key;
  melody: { label: string; kind: MelodyKind | null; seed: number };
}

export function Sheet({ tuningLabel, tuningNotes, rhythmLabel, harmony, harmonyKey, melody }: SheetProps) {
  const notation = useSettings((s) => s.notation);
  const sections = useProject((s) => s.sections);
  const { blocks, names } = useForm();
  const letters = [...new Set(blocks)];
  const name = (pitchClass: number) => noteLabel(`${spellInKey(pitchClass, harmonyKey)}4`, notation);
  const frets = (chord: string) =>
    voicingFor(tuningNotes, chord)
      ?.frets.map((fret) => fret ?? 'x')
      .join(' ') ?? '—';
  const hint = melody.kind
    ? melodyExample(melody.kind, { ...harmonyKey, chords: harmony.chords, rng: createRng(melody.seed), name })
        .hint
    : null;
  // Todos los acordes que aparecen en la canción, una sola vez, con su digitación.
  const chordsBySection = letters.map((letter) => {
    const own = sections[letter]?.chords;
    return { letter, chords: own ?? sectionHarmony(letter, blocks, harmony).chords };
  });
  const allChords = [...new Set(chordsBySection.flatMap((section) => section.chords))];

  return (
    <section className={styles.sheet} aria-label="Hoja para tocar">
      <h2>Para tocar</h2>
      <p>
        <strong>Afinación:</strong> {tuningLabel} —{' '}
        {tuningNotes.map((note) => noteLabel(note, notation)).join(' ')} (de la 6.ª a la 1.ª)
      </p>
      <p>
        <strong>Tono:</strong> {name(harmonyKey.tonic)} {MODES[harmonyKey.mode].name} ·{' '}
        <strong>Ritmo:</strong> {rhythmLabel}
      </p>
      <p>
        <strong>Melodía:</strong> {melody.label}
        {hint ? `. ${hint}` : ''}
      </p>
      <table className={styles.sheetChords}>
        <tbody>
          <tr>
            {allChords.map((chord) => (
              <th key={chord}>
                {chord} <small>{degreeOf(chord, harmonyKey.tonic)}</small>
              </th>
            ))}
          </tr>
          <tr>
            {allChords.map((chord) => (
              <td key={chord}>{frets(chord)}</td>
            ))}
          </tr>
        </tbody>
      </table>
      <p>
        <strong>Forma:</strong> {blocks.join(' ')}
      </p>
      {chordsBySection.map(({ letter, chords }) => {
        const text = sections[letter]?.text?.trim();
        const bars = sections[letter]?.bars ?? DEFAULT_BARS;
        return (
          <div key={letter} className={styles.sheetSection}>
            <h3>
              {letter}
              {names[letter] ? ` · ${names[letter]}` : ''} <small>({bars} compases)</small>
            </h3>
            <p className={styles.sheetLine}>{chords.join('  |  ')}</p>
            {text ? (
              <pre className={styles.sheetLyric}>{text}</pre>
            ) : (
              <p className={styles.sheetEmpty}>Sin letra todavía.</p>
            )}
          </div>
        );
      })}
    </section>
  );
}
