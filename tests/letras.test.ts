import { describe, expect, it } from 'vitest';
import { findRhymes, groupBySyllables, parseRhymeIndex } from '~/core/rhymes';
import { consonantKey, metricCount, syllabify } from '~/core/spanish';
import { FREE, analyze, lupa, pautaFromConsigna, problems, stressRows } from '~/core/verse';

describe('métrica', () => {
  it.each([
    ['y el caballo en la montaña', 8],
    ['aquí me pongo a cantar', 8],
    ['Yo soy un hombre sincero', 8],
    ['Ahí está la huella', 6],
    ['Verde que te quiero verde', 8],
    ['Volverán las oscuras golondrinas', 11],
  ])('«%s» tiene %i sílabas', (line, total) => {
    expect(metricCount(line).total).toBe(total);
  });

  it('la u de "qu" y "gu" no se separa', () => {
    expect(syllabify('aquí')).toEqual(['a', 'quí']);
    expect(syllabify('guitarra')).toEqual(['gui', 'ta', 'rra']);
  });
});

describe('pauta y estrofas', () => {
  it('lee la pauta de la consigna', () => {
    expect(pautaFromConsigna('Octosílabos, rima ABAB')).toEqual({ pattern: [8], scheme: 'abab' });
    expect(pautaFromConsigna('Versos de 6 sílabas')).toEqual({ pattern: [6], scheme: '' });
    expect(pautaFromConsigna('Sin rimar los finales')).toEqual({ pattern: [], scheme: '-' });
    expect(pautaFromConsigna('Todo en presente')).toBeNull();
  });

  it('una línea vacía separa estrofas, y el esquema vuelve a empezar', () => {
    const text = 'tengo un camino\nmi corazón\nvos tenés destino\nesta canción\n\nla luna\nel mar';
    const stanzas = analyze(text, { pattern: [], scheme: 'abab' }, 'consonante');
    expect(stanzas).toHaveLength(2);
    expect(stanzas[0]!.lines.map((line) => line.letter)).toEqual(['A', 'B', 'A', 'B']);
    expect(stanzas[0]!.lines.every((line) => line.missesRow === -1)).toBe(true);
    expect(stanzas[1]!.lines[0]!.row).toBe(5);
  });

  it('marca el verso que no rima donde pide el esquema', () => {
    const text =
      'Verde que te quiero verde\nverde viento verdes ramas\nel barco sobre la mar\ny el caballo en la noche';
    const stanzas = analyze(text, { pattern: [8], scheme: 'xaxa' }, 'asonante');
    expect(stanzas[0]!.lines[3]!.missesRow).toBe(1);
    expect(problems(stanzas, { pattern: [8], scheme: 'xaxa' })).toContain('Verso 4: no rima con el 2.');
  });

  it('junta los versos con el mismo problema', () => {
    const stanzas = analyze('en un lugar\nla casa vieja\nsol', { pattern: [8], scheme: '' }, 'asonante');
    expect(problems(stanzas, { pattern: [8], scheme: '' })).toEqual([
      'Versos 1 y 2: 5 sílabas, piden 8.',
      'Verso 3: 2 sílabas, pide 8.',
    ]);
  });

  it('avisa de la palabra prohibida', () => {
    const stanzas = analyze('Toda la noche despierto', FREE, 'asonante', 'noche');
    expect(stanzas[0]!.lines[0]!.forbidden).toBe(true);
  });
});

describe('acentos', () => {
  it('alinea por el último acento y marca lo que no coincide con la referencia', () => {
    const lines = analyze('verde viento verdes ramas\nel barco sobre la mar', FREE, 'asonante')[0]!.lines;
    const [first, second] = stressRows(lines, 0, 'final');
    expect(first!.positions).toEqual([1, 3, 5, 7]);
    expect(second!.positions).toEqual([2, 4, 7]);
    // Las dos terminan en la séptima: no hace falta correr ninguna.
    expect(second!.offset).toBe(0);
    expect(second!.cells[1]).toMatchObject({ text: 'bar', clash: true });
    expect(second!.cells[0]).toMatchObject({ text: 'el', missing: true });
  });

  it('un verso más corto se corre hasta que los finales coinciden', () => {
    const lines = analyze('Verde que te quiero verde\nla mar', FREE, 'asonante')[0]!.lines;
    const rows = stressRows(lines, 0, 'final');
    expect(rows[1]!.offset).toBe(5);
    expect(rows[1]!.cells[1]).toMatchObject({ text: 'mar', clash: false });
  });
});

describe('lupa', () => {
  it('señala abstracciones, repeticiones y quién habla', () => {
    const notes = lupa('mi corazón y tu corazón\nel corazón de la tarde').map((note) => note.text);
    expect(notes[0]).toContain('corazón');
    expect(notes.some((note) => note.includes('“corazón” (3)'))).toBe(true);
    expect(notes).toContain('Habla un yo a un vos.');
  });
});

describe('diccionario de rimas', () => {
  const words = ['canción', 'corazón', 'razón', 'camino', 'destino', 'olvido', 'vino', 'acción'];
  const groups = new Map<string, string[]>();
  for (const word of words) groups.set(consonantKey(word), [...(groups.get(consonantKey(word)) ?? []), word]);
  const index = parseRhymeIndex([...groups].map(([key, list]) => `${key}\t${list.join(' ')}`).join('\n'));

  it('la consonante sale de un grupo, sin la palabra buscada', () => {
    expect(findRhymes(index, 'corazón', 'consonante')).toEqual(['canción', 'razón', 'acción']);
  });

  it('la asonante deja afuera a las consonantes', () => {
    expect(findRhymes(index, 'camino', 'asonante')).toEqual(['olvido']);
  });

  it('busca por terminación', () => {
    expect(findRhymes(index, 'ción', 'final')).toEqual(['acción', 'canción']);
  });

  it('agrupa por sílabas y muestra una muestra repartida', () => {
    const grouped = groupBySyllables(['vino', 'camino', 'destino', 'pino', 'tino'], 2, 0);
    expect(grouped.map((group) => group.syllables)).toEqual([2, 3]);
    expect(grouped[0]).toMatchObject({ total: 3 });
    expect(grouped[0]!.words).toHaveLength(2);
  });
});
