"use client";

import { useEffect, useState } from "react";
import { KpiCard } from "./KpiCard";
import { BarChart } from "./BarChart";
import { Panel } from "./Panel";
import { AgentesExplorer } from "./AgentesExplorer";
import { KronosPanel } from "./KronosPanel";
import { WarRoomPanel } from "./WarRoomPanel";
import { DaVinciSpotlight } from "./DaVinciSpotlight";
import type { OverviewData } from "@/lib/types";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="display mb-3 mt-2 flex items-center gap-2 text-xs font-600 uppercase tracking-[0.22em] text-muted">
      <span className="h-px w-6 bg-cyan/50" />
      {children}
    </h2>
  );
}

export function Dashboard() {
  const [ov, setOv] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/caia/overview")
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setOv(d)))
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <main className="mx-auto max-w-[1400px] space-y-8 px-5 py-7">
      {error && (
        <div className="glass border-crit/40 p-4">
          <p className="font-mono text-xs text-crit">
            No se pudo cargar overview: {error}
          </p>
          <p className="mt-2 font-mono text-[11px] text-muted">
            Verificá que SUPABASE_URL / SUPABASE_SERVICE_KEY estén en el entorno y que los
            schemas (akasha, kronos, war_room) estén expuestos en la Data API de Supabase.
          </p>
        </div>
      )}

      {/* KPIs */}
      <section>
        <SectionTitle>Estado general del cerebro</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="Agentes totales" value={ov?.total_agentes ?? 0} accent="cyan" sub="akasha.agentes" />
          <KpiCard label="Agentes activos" value={ov?.agentes_activos ?? 0} accent="azul" sub="estado = activo" />
          <KpiCard label="Proyectos" value={ov?.proyectos_distintos ?? 0} accent="violeta" sub="distintos" />
          <KpiCard label="Sesiones KRONOS" value={ov?.kronos.sesiones ?? "—"} accent="cyan" />
          <KpiCard
            label="Pendientes abiertos"
            value={ov?.kronos.pendientes_abiertos ?? "—"}
            accent="ambar"
            sub={`de ${ov?.kronos.pendientes_total ?? "—"} totales`}
          />
          <KpiCard
            label="Crisis activas"
            value={ov?.warroom.crisis_activas ?? 0}
            accent="ambar"
            sub={`de ${ov?.warroom.crisis_total ?? 0} · War Room`}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Avances" value={ov?.kronos.avances ?? "—"} accent="violeta" />
          <KpiCard label="Decisiones" value={ov?.kronos.decisiones ?? "—"} accent="azul" />
          <KpiCard label="Eventos War Room" value={ov?.warroom.eventos ?? 0} accent="cyan" />
          <KpiCard
            label="Modelos IA"
            value={ov?.por_modelo.length ?? 0}
            accent="ambar"
            sub="distintos en uso"
          />
        </div>
      </section>

      {/* Distribuciones */}
      <section>
        <SectionTitle>Distribución de agentes</SectionTitle>
        <div className="grid gap-5 lg:grid-cols-3">
          <Panel title="Agentes por proyecto" subtitle="akasha.agentes · proyecto" accent="cyan">
            <BarChart data={ov?.por_proyecto ?? []} max={15} />
          </Panel>
          <Panel title="Por capa lógica" subtitle="mapa de capas / lógica" accent="violeta">
            <BarChart data={ov?.por_capa ?? []} max={15} />
          </Panel>
          <Panel title="Por tipo de agente" subtitle="tipo" accent="azul">
            <BarChart data={ov?.por_tipo ?? []} max={15} />
          </Panel>
          <Panel title="Por estado" subtitle="estado operativo" accent="ambar">
            <BarChart data={ov?.por_estado ?? []} max={12} />
          </Panel>
          <Panel title="Por modelo IA" subtitle="modelo_ia" accent="cyan" className="lg:col-span-2">
            <BarChart data={ov?.por_modelo ?? []} />
          </Panel>
        </div>
      </section>

      {/* DaVinci spotlight */}
      <section>
        <SectionTitle>Spotlight · DaVinci</SectionTitle>
        <DaVinciSpotlight />
      </section>

      {/* Explorador */}
      <section>
        <SectionTitle>Explorador de los 235 agentes</SectionTitle>
        <AgentesExplorer proyectos={ov?.por_proyecto ?? []} />
      </section>

      {/* KRONOS */}
      <section>
        <SectionTitle>KRONOS · Memoria del proyecto</SectionTitle>
        <KronosPanel />
      </section>

      {/* War Room */}
      <section>
        <SectionTitle>War Room · Crisis y operaciones</SectionTitle>
        <WarRoomPanel />
      </section>

      <footer className="border-t border-line pt-5 text-center font-mono text-[10px] text-muted">
        CAIA · Centro de Comando — datos reales de caia-prod (jmkkfmthysrvfkmkjtxf) ·
        motor de dashboards unificado
      </footer>
    </main>
  );
}
