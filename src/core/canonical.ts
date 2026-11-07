/**
 * JSON con las claves ordenadas: dos objetos con el mismo contenido dan el mismo texto, sin
 * importar en qué orden se armaron. Sirve para comparar configuraciones y para que un link
 * siempre produzca el mismo código.
 */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_, item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    const entries = Object.entries(item as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1));
    return Object.fromEntries(entries);
  });
}
