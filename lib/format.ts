// Helpers de formato (CR / es-CR).

export function fmtNum(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es-CR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(n);
}

export function fmtColones(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 0,
  }).format(n);
}

export function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function fmtFechaCorta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CR", { dateStyle: "medium" }).format(d);
}

export function prioridadColor(p?: string | null): string {
  switch ((p || "").toLowerCase()) {
    case "alta":
      return "#ff5252";
    case "media":
      return "#ffab00";
    case "baja":
      return "#00d44c";
    default:
      return "#448aff";
  }
}

export function severidadBadge(s?: string | null): "b-crit" | "b-warn" | "b-ok" | "b-blue" {
  switch ((s || "").toLowerCase()) {
    case "critica":
    case "alta":
      return "b-crit";
    case "media":
      return "b-warn";
    case "baja":
      return "b-ok";
    default:
      return "b-blue";
  }
}
