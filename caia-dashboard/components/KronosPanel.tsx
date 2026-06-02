"use client";

import { useEffect, useState } from "react";
import { Panel } from "./Panel";
import { Timeline, TimelineItem } from "./Timeline";
import { BarChart } from "./BarChart";
import { Badge, estadoTone } from "./Badge";
import { fmtDate } from "@/lib/format";
import type { KronosData } from "@/lib/types";

export function KronosPanel() {
  const [data, setData] = useState<KronosData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/caia/kronos")
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((e) => setError(String(e)));
  }, []);

  const avancesItems: TimelineItem[] = (data?.avances ?? []).map((a) => ({
    id: String(a.avance_id),
    title: a.descripcion?.slice(0, 90) ?? `Avance #${a.avance_id}`,
    meta: fmtDate(a.fecha),
    accent: "cyan",
    body: (
      <span className="flex flex-wrap items-center gap-1.5">
        {a.proyecto && <Badge tone="info">{a.proyecto}</Badge>}
        {a.modulo && <span className="text-muted">{a.modulo}</span>}
        {a.estado && <Badge tone={estadoTone(a.estado)}>{a.estado}</Badge>}
      </span>
    ),
  }));

  if (error) {
    return (
      <Panel title="KRONOS · Memoria" accent="violeta">
        <p className="font-mono text-xs text-crit">Error: {error}</p>
      </Panel>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Panel
        title="KRONOS · Avances recientes"
        subtitle="Timeline de la memoria de construcción"
        accent="violeta"
        className="lg:col-span-2"
      >
        <Timeline items={avancesItems} />
      </Panel>

      <div className="space-y-5">
        <Panel title="Pendientes por estado" accent="ambar">
          <BarChart data={data?.pendientes_por_estado ?? []} />
        </Panel>
      </div>

      <Panel
        title="Sesiones recientes"
        subtitle="Conversaciones registradas en KRONOS"
        accent="azul"
        className="lg:col-span-2"
      >
        <Timeline
          items={(data?.sesiones ?? []).map((s) => ({
            id: s.session_id,
            title: s.titulo ?? s.session_id,
            meta: fmtDate(s.fecha_inicio),
            accent: "azul",
            body: (
              <span className="flex flex-wrap items-center gap-1.5">
                {s.proyecto_activo && <Badge tone="info">{s.proyecto_activo}</Badge>}
                {s.estado && <Badge tone={estadoTone(s.estado)}>{s.estado}</Badge>}
                {s.resumen_ejecutivo && (
                  <span className="text-muted">{s.resumen_ejecutivo.slice(0, 80)}</span>
                )}
              </span>
            ),
          }))}
        />
      </Panel>

      <Panel title="Pendientes prioritarios" subtitle="Top por prioridad" accent="ambar">
        <ul className="scroll-thin max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {(data?.pendientes_recientes ?? []).map((p) => (
            <li key={p.pendiente_id} className="rounded-lg border border-line bg-ink/40 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[12px] text-white">{p.titulo}</span>
                <Badge tone="violeta">P{p.prioridad ?? "?"}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {p.proyecto && <Badge tone="info">{p.proyecto}</Badge>}
                {p.estado && <Badge tone={estadoTone(p.estado)}>{p.estado}</Badge>}
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
