import type { MetaFunction } from 'react-router';

export const meta: MetaFunction = () => [
  { title: 'Scordatura: una consigna para componer fuera de tus costumbres' },
  {
    name: 'description',
    content:
      'Sorteá restricciones con teoría real: afinación, ritmo, armonía, melodía, letra, forma, una carta y un drone. Se escuchan ahí mismo, y la música la hacés vos.',
  },
  // Se llega por / y por /consigna, y es una sola página.
  { tagName: 'link', rel: 'canonical', href: '/' },
];

/**
 * La consigna la dibuja su layout (ConsignaLayout), no esta ruta: así sigue montada cuando una
 * herramienta se abre encima, en un modal, y no se vuelve a cargar al cerrarlo.
 */
export default function ConsignaRoute() {
  return null;
}
