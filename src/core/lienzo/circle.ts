// El círculo como modelo, sin dibujo: qué nodo va en cada lugar, de qué tipo es y por dónde pasa la
// sección. La interfaz convierte las posiciones (0 a 11) en ángulos.
import { borrowedDegrees, chordOf, degOfCh, roleOf, type ChordInfo } from './harmony';
import type { Chord, Key } from './types';

export type NodeKind = 'tonic' | 'dia' | 'bor' | 'out';

export interface CircleNode {
  ring: 'outer' | 'inner' | 'chromatic';
  /** Posición en el círculo, de 0 a 11 (0 arriba, en sentido horario). */
  pos: number;
  chord: ChordInfo;
  label: string;
  /** Grado: romano en el de quintas, número de la escala en el cromático. */
  sub: string;
  kind: NodeKind;
  /** El acorde de la tonalidad que representa, para sumarlo a la sección. */
  source?: Chord;
  role?: string;
}

const pc = (n: number) => ((n % 12) + 12) % 12;
const triadOf = (root: number, kind: 'M' | 'm' | 'dim'): Pick<ChordInfo, 'pcs' | 'quality'> => ({
  pcs: (kind === 'M' ? [0, 4, 7] : kind === 'm' ? [0, 3, 7] : [0, 3, 6]).map((s) => pc(root + s)),
  quality: kind === 'M' ? '' : kind,
});

function family(key: Key) {
  const own = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ c: { d } as Chord, ch: chordOf({ d }, key) }));
  const bor = borrowedDegrees(key).map((d) => ({
    c: { d, b: true } as Chord,
    ch: chordOf({ d, b: true }, key),
  }));
  return { own, bor };
}

const same = (a: Pick<ChordInfo, 'root' | 'quality'>, b: Pick<ChordInfo, 'root' | 'quality'>) =>
  a.root === b.root && a.quality === b.quality;

export interface FifthsCircle {
  nodes: CircleNode[];
  /** Posición del centro del sector de la familia (3 mayores contiguos), si existe. */
  sector: number | null;
  /** Índices de nodos del recorrido de la sección, sin repetir el que vuelve al principio. */
  route: number[];
  short: number;
  jumps: number;
  read: string;
}

/** Por quintas: afuera los 12 mayores, adentro sus relativos. */
export function fifthsCircle(key: Key, chords: readonly Chord[]): FifthsCircle {
  const { own, bor } = family(key);
  const findSource = (info: Pick<ChordInfo, 'root' | 'quality'>) =>
    own.find((f) => same(f.ch, info)) ?? bor.find((f) => same(f.ch, info));
  const kindOf = (info: Pick<ChordInfo, 'root' | 'quality'>): NodeKind =>
    same(own[0]!.ch, info)
      ? 'tonic'
      : own.some((f) => same(f.ch, info))
        ? 'dia'
        : bor.some((f) => same(f.ch, info))
          ? 'bor'
          : 'out';
  const nodes: CircleNode[] = [];
  const build = (ring: 'outer' | 'inner', pos: number, root: number, kind: 'M' | 'm' | 'dim') => {
    const named = own.find((f) => f.ch.root === root && f.ch.quality === (kind === 'M' ? '' : kind))?.ch;
    const info: ChordInfo = named ?? {
      ...triadOf(root, kind),
      root,
      name: chordOf({ r: pc(root - key.tonic), q: kind }, key).name,
    };
    const source = findSource(info);
    nodes.push({
      ring,
      pos,
      chord: info,
      label: info.name,
      sub: degOfCh(info, key.tonic),
      kind: kindOf(info),
      ...(source ? { source: source.c, role: roleOf(source.c, key) } : {}),
    });
  };
  for (let k = 0; k < 12; k++) build('outer', k, pc(k * 7), 'M');
  for (let k = 0; k < 12; k++) {
    const root = pc(k * 7 + 9);
    const dim = own.some((f) => f.ch.root === root && f.ch.quality === 'dim');
    build('inner', k, root, dim ? 'dim' : 'm');
  }
  const majorPos = own.filter((f) => f.ch.quality === '').map((f) => pc(f.ch.root * 7));
  const sector = majorPos.find((k) => majorPos.includes(pc(k + 1)) && majorPos.includes(pc(k - 1))) ?? null;

  const seq = chords
    .map((c) => chordOf(c, key))
    .filter((c, i, all) => i === 0 || !same(c, all[i - 1]!))
    .filter((c, i, all) => !(i === all.length - 1 && all.length > 1 && same(c, all[0]!)));
  const nodeOf = (info: ChordInfo) => {
    const minor = info.quality === 'm' || info.quality === 'dim';
    const pos = minor ? pc((info.root + 3) * 7) : pc(info.root * 7);
    return nodes.findIndex((n) => n.ring === (minor ? 'inner' : 'outer') && n.pos === pos);
  };
  const route = seq.map(nodeOf).filter((i) => i >= 0);
  let short = 0;
  let jumps = 0;
  const loop = route.length > 2 ? [...route, route[0]!] : route;
  for (let i = 1; i < loop.length; i++) {
    const d0 = Math.abs(nodes[loop[i]!]!.pos - nodes[loop[i - 1]!]!.pos);
    if (Math.min(d0, 12 - d0) <= 1) short += 1;
    else jumps += 1;
  }
  const read =
    seq.length < 2
      ? seq.length
        ? `${seq[0]!.name}: no se mueve.`
        : 'Sin acordes.'
      : `${seq.map((c) => c.name).join(' → ')} · ${short} ${short === 1 ? 'corto' : 'cortos'}, ${jumps} ${jumps === 1 ? 'salto' : 'saltos'}`;
  return { nodes, sector, route, short, jumps, read };
}

export interface ChromaticCircle {
  nodes: CircleNode[];
  /** Posiciones (clases de altura) de la escala, para el polígono. */
  scale: number[];
}

/** Las doce notas de medio tono en medio tono, con la escala como polígono. */
export function chromaticCircle(key: Key): ChromaticCircle {
  const scale = [0, 1, 2, 3, 4, 5, 6].map((d) => chordOf({ d }, key).root);
  const nodes = Array.from({ length: 12 }, (_, p): CircleNode => {
    const degree = scale.indexOf(p);
    const info = chordOf({ r: pc(p - key.tonic) }, key);
    return {
      ring: 'chromatic',
      pos: p,
      chord: { ...info, pcs: [p] },
      label: info.name,
      sub: degree >= 0 ? String(degree + 1) : '',
      kind: p === key.tonic ? 'tonic' : degree >= 0 ? 'dia' : 'out',
    };
  });
  return { nodes, scale };
}
