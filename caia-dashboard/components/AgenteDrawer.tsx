"use client";

import { useEffect, useState } from "react";
import type { Agente } from "@/lib/types";
import { Badge, estadoTone } from "./Badge";
import { fmtDateTime } from "@/lib/format";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <div className="label">{label}</div>
      <div className="mt-0.5 text-[12px] text-[#c9d6ea]">{value}</div>
    </div>
  );
}

export function AgenteDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [data, setData] = useState<Agente | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setData(null);
    setError(null);
    setLoading(true);
    fetch(`/api/caia/agente/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  if (!id) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="scroll-thin relative h-full w-full max-w-[560px] overflow-y-auto border-l border-line bg-panel p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="label">{id}</div>
            <h3 className="display mt-1 text-lg font-700 text-white">
              {data?.nombre ?? (loading ? "Cargando…" : id)}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-line px-3 py-1 font-mono text-xs text-muted transition hover:border-cyan/40 hover:text-cyan"
          >
            ✕ ESC
          </button>
        </div>

        {error && <p className="font-mono text-xs text-crit">Error: {error}</p>}

        {data && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {data.proyecto && <Badge tone="info">{data.proyecto}</Badge>}
              {data.estado && <Badge tone={estadoTone(data.estado)}>{data.estado}</Badge>}
              {data.tipo && <Badge tone="violeta">{data.tipo}</Badge>}
              {data.es_transversal && <Badge tone="ok">transversal</Badge>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Modelo IA" value={data.modelo_ia} />
              <Field label="Versión" value={data.version} />
              <Field label="Capa lógica" value={data.capa_logica} />
              <Field label="Código capa" value={data.capa_codigo} />
              <Field label="Último run" value={fmtDateTime(data.ultimo_run)} />
              <Field label="Actualizado" value={fmtDateTime(data.updated_at)} />
            </div>

            <Field label="Descripción" value={data.descripcion} />
            <Field label="Objetivo" value={data.objetivo} />
            <Field label="Función (resumen)" value={data.funcion_resumen} />
            <Field label="Rol completo" value={data.rol_completo} />

            {data.system_prompt && (
              <div>
                <div className="label mb-1">System prompt</div>
                <pre className="scroll-thin max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-ink/60 p-3 font-mono text-[11px] leading-relaxed text-[#a9bcd6]">
                  {data.system_prompt}
                </pre>
              </div>
            )}

            {data.config_json && (
              <div>
                <div className="label mb-1">config_json</div>
                <pre className="scroll-thin max-h-72 overflow-auto rounded-xl border border-line bg-ink/60 p-3 font-mono text-[11px] leading-relaxed text-cyan/90">
                  {JSON.stringify(data.config_json, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
