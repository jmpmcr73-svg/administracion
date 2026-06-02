import type { Conteo } from "./types";

/** Agrupa y cuenta por una clave, ordenado desc. Filas null -> etiqueta dada. */
export function countBy<T>(
  rows: T[],
  key: (r: T) => string | null | undefined,
  nullLabel = "(sin dato)"
): Conteo[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const raw = key(r);
    const label = raw === null || raw === undefined || raw === "" ? nullLabel : String(raw);
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, n]) => ({ label, n }))
    .sort((a, b) => b.n - a.n);
}
