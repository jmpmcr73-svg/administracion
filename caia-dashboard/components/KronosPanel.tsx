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
      <Panel
        title="KRONOS · Memoria del proyecto"
        subtitle="Sesiones · avances · decisiones · pendientes"
        accent="violeta"
      >
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-violeta/30 bg-violeta/[0.04] px-6 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-violeta/30 bg-violeta/10 text-xl">
            🔒
          </div>
          <p className="display text-sm font-600 text-white">Schema `kronos` no expuesto</p>
          <p className="max-w-md text-[12px] leading-relaxed text-[#8fa3bf]">
            Este panel se activa cuando el schema <span className="text-violeta">kronos</span> esté
            disponible en la Data API. Se mantiene fuera por seguridad: tiene RLS deshabilitado y la
            anon key con acceso total. Al habilitar RLS (o exponerlo con políticas), acá vas a ver
            las <strong>59 sesiones</strong>, <strong>171 avances</strong>,{" "}
            <strong>99 decisiones</strong> y <strong>321 pendientes</strong> reales.
          </p>
          <details className="mt-1 w-full max-w-md text-left">
            <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wider text-muted">
              Detalle técnico
            </summary>
            <p className="mt-1 break-words font-mono text-[10px] text-muted">{error}</p>
          </details>
        </div>
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
