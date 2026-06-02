/** Helpers de presentación (puros, reutilizables por idworld/COSA/AyA). */

export function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-CR").format(n);
}

export function fmtNum(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-CR", {
    maximumFractionDigits: digits,
  }).format(n);
}

export function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Normaliza estados con mayúsc/minúsc mezcladas (Activo/activo -> activo). */
export function normEstado(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

export function titleCase(s: string | null | undefined): string {
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
