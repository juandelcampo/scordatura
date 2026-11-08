// Baja lo que suena en el Estudio como archivo MIDI, para seguir la idea en otro programa.
import { consignaNumber } from '~/core/consigna';
import { songToMidi } from '~/core/midi';
import { useConsigna } from './consigna';
import { useSong } from './song';
import { Button } from './ui/ui';

export function ExportMidiButton({ variant }: { variant?: 'ghost' | 'mini' }) {
  const plan = useSong();
  const number = consignaNumber(useConsigna((s) => s.consigna));

  const download = () => {
    const url = URL.createObjectURL(new Blob([songToMidi(plan)], { type: 'audio/midi' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `scordatura-consigna-${number}.mid`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant={variant} id="export-midi" onClick={download}>
      Bajar MIDI
    </Button>
  );
}
