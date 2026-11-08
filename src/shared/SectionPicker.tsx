// Elige a qué sección de la forma va lo que se está haciendo.
import { useBlocks } from './consigna';
import { letterList, useProject } from './project';
import styles from './ui/ui.module.css';

export function SectionPicker({ label = 'Sección' }: { label?: string }) {
  const blocks = useBlocks();
  const active = useProject((s) => s.active);
  const setActive = useProject((s) => s.setActive);
  return (
    <label className={styles.selectField}>
      <span>{label}</span>
      <select value={active} onChange={(event) => setActive(event.target.value)} data-testid="section-picker">
        {letterList(blocks).map((letter) => (
          <option key={letter} value={letter}>
            {letter}
          </option>
        ))}
      </select>
    </label>
  );
}
