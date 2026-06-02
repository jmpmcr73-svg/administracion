"use client";

import { useEffect, useState } from "react";
import { Panel } from "./Panel";
import { Badge, severidadTone, estadoTone } from "./Badge";
import { fmtDateTime, fmtMoney } from "@/lib/format";
import type { WarRoomData } from "@/lib/types";

function defconTone(d: number | null): "crit" | "warn" | "info" | "ok" {
  if (d === null) return "info";
  if (d <= 2) return "crit";
  if (d === 3) return "warn";
  if (d === 4) return "info";
  return "ok";
}

export function WarRoomPanel() {
  const [data, setData] = useState<WarRoomData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/caia/warroom")
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <Panel title="War Room" accent="ambar">
        <p className="font-mono text-xs text-crit">Error: {error}</p>
      </Panel>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Panel
        title="War Room · Crisis"
        subtitle={`${data?.crisis_activas ?? 0} activas de ${data?.crisis.length ?? 0}`}
        accent="ambar"
        className="lg:col-span-2"
      >
        <div className="scroll-thin max-h-[420px] space-y-2.5 overflow-y-auto pr-1">
          {(data?.crisis ?? []).map((c) => (
            <div key={c.crisis_id} className="rounded-xl border border-line bg-ink/40 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[13px] font-700 text-white">{c.titulo}</div>
                  <div className="font-mono text-[10px] text-muted">
                    {c.codigo ?? c.crisis_id.slice(0, 8)} · {fmtDateTime(c.timestamp_inicio)}
                  </div>
                </div>
                <Badge tone={defconTone(c.defcon)}>DEFCON {c.defcon ?? "?"}</Badge>
              </div>
              {c.descripcion && (
                <p className="mt-1.5 text-[11px] leading-relaxed text-[#8fa3bf]">{c.descripcion}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge tone="violeta">{c.dimension}</Badge>
                <Badge tone="info">{c.tipo_evento}</Badge>
                {c.estado && <Badge tone={estadoTone(c.estado)}>{c.estado}</Badge>}
                {c.capital_riesgo ? (
                  <span className="font-mono text-[10px] text-crit">
                    Riesgo {fmtMoney(c.capital_riesgo)}
                  </span>
                ) : null}
                {c.capital_mitigado ? (
                  <span className="font-mono text-[10px] text-cyan">
                    Mitigado {fmtMoney(c.capital_mitigado)}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="KPIs operativos" subtitle="war_room.kpis" accent="cyan">
        <div className="scroll-thin max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {(data?.kpis ?? []).map((k) => (
            <div key={k.kpi_id} className="rounded-lg border border-line bg-ink/40 p-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] text-white">{k.nombre}</span>
                {k.alerta_activa && <Badge tone="crit">alerta</Badge>}
              </div>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="display text-lg font-700 text-cyan tabular-nums">
                  {k.valor_actual ?? "—"}
                  {k.unidad ? <span className="text-xs text-muted"> {k.unidad}</span> : null}
                </span>
                {k.valor_meta != null && (
                  <span className="font-mono text-[10px] text-muted">meta {k.valor_meta}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Eventos recientes"
        subtitle="war_room.eventos"
        accent="azul"
        className="lg:col-span-3"
      >
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {(data?.eventos ?? []).map((e) => (
            <div key={e.evento_id} className="rounded-lg border border-line bg-ink/40 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[12px] font-700 text-white">{e.titulo ?? e.tipo_evento}</span>
                {e.severidad && <Badge tone={severidadTone(e.severidad)}>{e.severidad}</Badge>}
              </div>
              {e.descripcion && (
                <p className="mt-1 text-[11px] leading-relaxed text-[#8fa3bf]">{e.descripcion}</p>
              )}
              <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-muted">
                <span>{e.origen_modulo}</span>
                <span>{fmtDateTime(e.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
