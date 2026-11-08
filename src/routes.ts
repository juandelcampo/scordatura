import { index, layout, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  // El lienzo ocupa toda la pantalla: tiene su propio encabezado y su menú.
  route('lienzo', 'features/lienzo/LienzoRoute.tsx'),
  layout('shell/AppShell.tsx', [
    // La consigna es la entrada. /consigna sigue andando: hay links compartidos que apuntan ahí.
    index('features/consigna/ConsignaRoute.tsx', { id: 'consigna-inicio' }),
    route('consigna', 'features/consigna/ConsignaRoute.tsx', { id: 'consigna' }),
    route('acerca', 'features/inicio/InicioRoute.tsx'),
    route('herramientas', 'features/herramientas/HerramientasRoute.tsx'),
    route('estudio', 'features/estudio/EstudioRoute.tsx'),
    route('afinador', 'features/afinador/AfinadorRoute.tsx', { id: 'afinador-index' }),
    route('afinador/:tuningId', 'features/afinador/AfinadorRoute.tsx', { id: 'afinador-tuning' }),
    route('ritmo', 'features/ritmo/RitmoRoute.tsx'),
    route('drone', 'features/drone/DroneRoute.tsx'),
    route('armonia', 'features/armonia/ArmoniaRoute.tsx'),
    route('melodia', 'features/melodia/MelodiaRoute.tsx'),
    route('letras', 'features/letras/LetrasRoute.tsx'),
    route('cartas', 'features/cartas/CartasRoute.tsx'),
    route('forma', 'features/forma/FormaRoute.tsx'),
    route('diario', 'features/diario/DiarioRoute.tsx'),
  ]),
] satisfies RouteConfig;
