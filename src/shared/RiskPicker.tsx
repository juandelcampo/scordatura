// Qué tan lejos sortea todo: tres niveles, así que tres botones y no un deslizador.
import { RISK_NAMES, type Risk } from '~/core/roll';
import { useSettings } from './settings';
import { Segmented } from './ui/ui';

const OPTIONS = ([0, 1, 2] as const).map((risk) => ({ value: String(risk), label: RISK_NAMES[risk] }));

export function RiskPicker() {
  const risk = useSettings((s) => s.risk);
  const set = useSettings((s) => s.set);
  return (
    <Segmented
      label="Seguro ↔ raro"
      value={String(risk)}
      options={OPTIONS}
      onChange={(value) => set({ risk: Number(value) as Risk })}
    />
  );
}
