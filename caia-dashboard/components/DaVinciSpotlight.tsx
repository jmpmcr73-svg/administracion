"use client";

import { useEffect, useState } from "react";
import { Panel } from "./Panel";
import { Badge } from "./Badge";

interface DvConfig {
  grupo?: string;
  cluster?: string;
  covenin?: string[];
  internacional?: string[];
  ejecutor?: string[];
  worker_required?: boolean;
  computo_pesado?: boolean;
  sustituye_firma_colegiado?: boolean;
}

interface DvAgente {
  agente_id: string;
  nombre: string | null;
  descripcion: string | null;
  objetivo: string | null;
  estado: string | null;
  config_json: DvConfig | null;
}

export function DaVinciSpotlight() {
  const [rows, setRows] = useState<DvAgente[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/caia/davinci")
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setRows(d.agentes ?? [])))
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <Panel
      title="DaVinci · Motor de Ingeniería"
      subtitle={`${rows.length} disciplinas · normas COVENIN + estándares internacionales`}
      accent="violeta"
    >
      {error && <p className="font-mono text-xs text-crit">Error: {error}</p>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((a) => {
          const c = a.config_json ?? {};
          return (
            <div
              key={a.agente_id}
              className="relative overflow-hidden rounded-xl border border-violeta/20 bg-gradient-to-br from-violeta/[0.07] to-transparent p-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[13px] font-700 text-white">
                  {a.nombre?.replace(/^DaVinci · /, "") ?? a.agente_id}
                </span>
                {c.grupo && <Badge tone="violeta">{c.grupo}</Badge>}
              </div>
              {(a.objetivo || a.descripcion) && (
                <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-[#8fa3bf]">
                  {a.objetivo || a.descripcion}
                </p>
              )}

              {c.covenin && c.covenin.length > 0 && (
                <div className="mt-2.5">
                  <div className="label mb-1">COVENIN</div>
                  <div className="flex flex-wrap gap-1">
                    {c.covenin.map((n) => (
                      <Badge key={n} tone="ok">
                        {n}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {c.internacional && c.internacional.length > 0 && (
                <div className="mt-2">
                  <div className="label mb-1">Internacional</div>
                  <div className="flex flex-wrap gap-1">
                    {c.internacional.map((n) => (
                      <Badge key={n} tone="info">
                        {n}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-line pt-2">
                {c.ejecutor?.map((e) => (
                  <span key={e} className="font-mono text-[10px] text-cyan">
                    {e}
                  </span>
                ))}
                {c.computo_pesado && <Badge tone="warn">cómputo pesado</Badge>}
                {c.worker_required && <Badge tone="muted">worker</Badge>}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
