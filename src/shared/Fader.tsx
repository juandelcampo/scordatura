// Faders de volumen. El marco de la app le pasa los valores al audio.
import { useSettings, type ChannelId } from './settings';
import styles from './ui/ui.module.css';

const NAMES: Record<ChannelId, string> = {
  master: 'General',
  instrumento: 'Instrumento',
  ritmo: 'Ritmo',
  drone: 'Drone',
};

export function Fader({ channel, compact }: { channel: ChannelId; compact?: boolean }) {
  const value = useSettings((s) => s.volumes[channel]);
  const volumes = useSettings((s) => s.volumes);
  const set = useSettings((s) => s.set);
  const label = `Volumen ${NAMES[channel]}`;
  return (
    <label className={styles.fader} data-compact={compact}>
      {!compact && <span>{channel === 'master' ? 'Volumen general' : NAMES[channel]}</span>}
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(value * 100)}
        aria-label={label}
        data-channel={channel}
        onChange={(event) => set({ volumes: { ...volumes, [channel]: Number(event.target.value) / 100 } })}
      />
    </label>
  );
}

export function Mixer() {
  return (
    <div className={styles.mixer} role="group" aria-label="Mezcla" data-testid="mixer">
      {(Object.keys(NAMES) as ChannelId[]).map((channel) => (
        <Fader key={channel} channel={channel} />
      ))}
    </div>
  );
}
