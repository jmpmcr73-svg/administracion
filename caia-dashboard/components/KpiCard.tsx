import { fmtInt } from "@/lib/format";

export function KpiCard({
  label,
  value,
  sub,
  accent = "cyan",
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent?: "cyan" | "azul" | "violeta" | "ambar";
}) {
  const color: Record<string, string> = {
    cyan: "text-cyan",
    azul: "text-azul",
    violeta: "text-violeta",
    ambar: "text-ambar",
  };
  const glow: Record<string, string> = {
    cyan: "from-cyan/15",
    azul: "from-azul/15",
    violeta: "from-violeta/15",
    ambar: "from-ambar/15",
  };
  return (
    <div className="glass relative overflow-hidden p-4">
      <div
        className={`pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-gradient-to-br ${glow[accent]} to-transparent blur-xl`}
      />
      <div className="label">{label}</div>
      <div className={`display mt-1 text-3xl font-700 tabular-nums ${color[accent]}`}>
        {typeof value === "number" ? fmtInt(value) : value}
      </div>
      {sub && <div className="mt-1 font-mono text-[11px] text-muted">{sub}</div>}
    </div>
  );
}
