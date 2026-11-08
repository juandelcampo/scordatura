import type { Config } from '@react-router/dev/config';
import { TUNINGS } from './src/data/tunings';

// Sin servidor: cada herramienta y afinación se genera como HTML estático para que los
// buscadores las lean, y después la app sigue funcionando como una sola página.
export default {
  appDirectory: 'src',
  ssr: false,
  prerender: [
    '/',
    '/acerca',
    '/herramientas',
    '/afinador',
    '/afinador/tuya',
    '/consigna',
    '/estudio',
    '/ritmo',
    '/drone',
    '/armonia',
    '/melodia',
    '/letras',
    '/cartas',
    '/forma',
    '/diario',
    ...TUNINGS.map((tuning) => `/afinador/${tuning.id}`),
  ],
} satisfies Config;
