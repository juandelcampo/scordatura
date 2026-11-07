import { index, layout, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  layout('shell/AppShell.tsx', [
    index('features/inicio/InicioRoute.tsx'),
    route('consigna', 'features/consigna/ConsignaRoute.tsx'),
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
