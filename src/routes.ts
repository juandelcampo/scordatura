import { index, layout, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  layout('shell/AppShell.tsx', [
    // La consigna envuelve a las herramientas: abiertas desde ella, se ven encima, en un modal.
    layout('features/consigna/ConsignaLayout.tsx', [
      // La consigna es la entrada. /consigna sigue andando: hay links compartidos que apuntan ahí.
      index('features/consigna/ConsignaRoute.tsx', { id: 'consigna-inicio' }),
      route('consigna', 'features/consigna/ConsignaRoute.tsx', { id: 'consigna' }),
      route('afinador', 'features/afinador/AfinadorRoute.tsx', { id: 'afinador-index' }),
      route('afinador/:tuningId', 'features/afinador/AfinadorRoute.tsx', { id: 'afinador-tuning' }),
      route('ritmo', 'features/ritmo/RitmoRoute.tsx'),
      route('drone', 'features/drone/DroneRoute.tsx'),
      route('armonia', 'features/armonia/ArmoniaRoute.tsx'),
      route('melodia', 'features/melodia/MelodiaRoute.tsx'),
      route('letras', 'features/letras/LetrasRoute.tsx'),
      route('cartas', 'features/cartas/CartasRoute.tsx'),
      route('forma', 'features/forma/FormaRoute.tsx'),
    ]),
    route('acerca', 'features/inicio/InicioRoute.tsx'),
    route('herramientas', 'features/herramientas/HerramientasRoute.tsx'),
    route('estudio', 'features/estudio/EstudioRoute.tsx'),
    route('diario', 'features/diario/DiarioRoute.tsx'),
  ]),
] satisfies RouteConfig;
