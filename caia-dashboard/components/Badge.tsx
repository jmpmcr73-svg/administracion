import { normEstado } from "@/lib/format";

type Tone = "ok" | "warn" | "crit" | "info" | "muted" | "violeta";

const tones: Record<Tone, string> = {
  ok: "border-cyan/30 bg-cyan/10 text-cyan",
  warn: "border-ambar/30 bg-ambar/10 text-ambar",
  crit: "border-crit/30 bg-crit/10 text-crit",
  info: "border-azul/30 bg-azul/10 text-azul",
  violeta: "border-violeta/30 bg-violeta/10 text-violeta",
  muted: "border-line bg-white/[0.03] text-muted",
};

export function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[10px] font-700 uppercase tracking-wider ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Mapea estados de agentes/pendientes (normalizados) a un tono. */
export function estadoTone(estado: string | null | undefined): Tone {
  const e = normEstado(estado);
  if (["activo", "completado", "cerrado", "resuelto", "migrado"].includes(e)) return "ok";
  if (["desarrollo", "diseñado", "en_proceso", "en_progreso", "en_curso", "investigacion"].includes(e))
    return "info";
  if (["pausado", "abierto", "pendiente"].includes(e)) return "warn";
  if (["deprecado", "fusionado_en_jarvis"].includes(e)) return "crit";
  return "muted";
}

export function severidadTone(sev: string | null | undefined): Tone {
  const s = normEstado(sev);
  if (["critico", "crítico", "alta", "alto", "error"].includes(s)) return "crit";
  if (["media", "medio", "warning", "advertencia"].includes(s)) return "warn";
  if (["info", "baja", "bajo"].includes(s)) return "info";
  return "muted";
}
