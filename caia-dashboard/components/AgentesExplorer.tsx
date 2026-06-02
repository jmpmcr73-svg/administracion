"use client";

import { useEffect, useMemo, useState } from "react";
import { DataTable, Column } from "./DataTable";
import { AgenteDrawer } from "./AgenteDrawer";
import { Badge, estadoTone } from "./Badge";
import { Panel } from "./Panel";
import { fmtInt } from "@/lib/format";
import type { Conteo } from "@/lib/types";

interface Row {
  agente_id: string;
  nombre: string | null;
  tipo: string | null;
  estado: string | null;
  modelo_ia: string | null;
  proyecto: string | null;
  capa_logica: string | null;
  es_transversal: boolean | null;
}

export function AgentesExplorer({ proyectos }: { proyectos: Conteo[] }) {
  const [q, setQ] = useState("");
  const [proyecto, setProyecto] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams();
      if (proyecto) params.set("proyecto", proyecto);
      if (q) params.set("q", q);
      fetch(`/api/caia/agentes?${params.toString()}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d) => setRows(d.agentes ?? []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250); // debounce
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, proyecto]);

  const columns: Column<Row>[] = useMemo(
    () => [
      {
        key: "nombre",
        header: "Agente",
        render: (r) => (
          <div>
            <div className="font-700 text-white">{r.nombre ?? r.agente_id}</div>
            <div className="font-mono text-[10px] text-muted">{r.agente_id}</div>
          </div>
        ),
      },
      {
        key: "proyecto",
        header: "Proyecto",
        render: (r) => (r.proyecto ? <Badge tone="info">{r.proyecto}</Badge> : "—"),
      },
      { key: "tipo", header: "Tipo", render: (r) => <span className="text-[#9fb2cc]">{r.tipo ?? "—"}</span> },
      {
        key: "modelo",
        header: "Modelo",
        render: (r) => <span className="font-mono text-[11px] text-[#9fb2cc]">{r.modelo_ia ?? "—"}</span>,
      },
      {
        key: "estado",
        header: "Estado",
        render: (r) => (r.estado ? <Badge tone={estadoTone(r.estado)}>{r.estado}</Badge> : "—"),
      },
    ],
    []
  );

  return (
    <Panel
      title="Explorador de agentes"
      subtitle="Filtrable y buscable · clic en una fila para ver detalle"
      accent="cyan"
      right={
        <span className="font-mono text-xs text-muted">
          {loading ? "…" : fmtInt(rows.length)} resultados
        </span>
      }
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o ID…"
          className="min-w-[220px] flex-1 rounded-lg border border-line bg-ink/50 px-3 py-2 font-mono text-xs text-white outline-none transition placeholder:text-muted focus:border-cyan/50"
        />
        <select
          value={proyecto}
          onChange={(e) => setProyecto(e.target.value)}
          className="rounded-lg border border-line bg-ink/50 px-3 py-2 font-mono text-xs text-white outline-none focus:border-cyan/50"
        >
          <option value="">Todos los proyectos</option>
          {proyectos
            .filter((p) => p.label !== "(sin proyecto)")
            .map((p) => (
              <option key={p.label} value={p.label}>
                {p.label} ({p.n})
              </option>
            ))}
        </select>
        {(q || proyecto) && (
          <button
            onClick={() => {
              setQ("");
              setProyecto("");
            }}
            className="rounded-lg border border-line px-3 py-2 font-mono text-xs text-muted transition hover:border-cyan/40 hover:text-cyan"
          >
            Limpiar
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.agente_id}
        onRowClick={(r) => setSelected(r.agente_id)}
        empty={loading ? "Cargando agentes…" : "Sin resultados"}
      />

      <AgenteDrawer id={selected} onClose={() => setSelected(null)} />
    </Panel>
  );
}
