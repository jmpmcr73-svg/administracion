// Página de reporte individual. Lee caia_reportes por ID y renderiza según tipo.
import { notFound } from "next/navigation";
import { supabaseAdmin, type Reporte } from "@/lib/supabase/server";
import ReporteAcciones from "./ReporteAcciones";

export const dynamic = "force-dynamic";

const PAIS_NOMBRE: Record<string, string> = {
  CR: "Costa Rica",
  SV: "El Salvador",
  PA: "Panamá",
  VE: "Venezuela",
};

// Render específico por tipo de reporte ---------------------------------------
function CuerpoReporte({ r }: { r: Reporte }) {
  const c = r.contenido ?? {};
  if (r.estado === "generando") {
    return (
      <p style={{ color: "#b8860b" }}>
        ⏳ El reporte se está generando. Recargá en unos segundos.
      </p>
    );
  }
  if (r.estado === "error") {
    return (
      <p style={{ color: "#c0392b" }}>
        ❌ Error al generar: {r.error_msg ?? "desconocido"}
      </p>
    );
  }

  switch (r.tipo) {
    case "satelital_ndvi":
      return <Seccion titulo="Índices satelitales" data={c} />;
    case "sismico_psha":
      return <Seccion titulo="Peligro sísmico (PSHA)" data={c} />;
    case "agricola_caia":
      return <Seccion titulo="Diagnóstico agrícola CAIA" data={c} />;
    case "hidrico_davinci":
      return <Seccion titulo="Balance hídrico DaVinci" data={c} />;
    case "estructural_shm":
      return <Seccion titulo="Salud estructural (SHM)" data={c} />;
    default:
      return <Seccion titulo="Resultados" data={c} />;
  }
}

function Seccion({ titulo, data }: { titulo: string; data: Record<string, unknown> }) {
  const entries = Object.entries(data ?? {});
  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ color: "#0a7d4f", fontSize: 18 }}>{titulo}</h2>
      {entries.length === 0 ? (
        <p style={{ color: "#777" }}>Sin datos.</p>
      ) : (
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {entries.map(([k, v]) => (
            <div
              key={k}
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderBottom: "1px solid #eee",
                padding: "6px 0",
              }}
            >
              <span style={{ color: "#555" }}>{k}</span>
              <strong>
                {typeof v === "object" ? JSON.stringify(v) : String(v)}
              </strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function ReportePage({
  params,
}: {
  params: { reporte_id: string };
}) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("caia_reportes")
    .select("*")
    .eq("reporte_id", params.reporte_id)
    .single();

  if (error || !data) notFound();
  const r = data as Reporte;
  const fecha = new Date(r.created_at).toLocaleString("es-CR");

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: 32 }}>
      {/* Header con logo / marca Alejandría */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          borderBottom: "2px solid #0a7d4f",
          paddingBottom: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#0a7d4f" }}>
            Alejandría Steam Labs
          </div>
          <div style={{ fontSize: 12, color: "#888" }}>BIOTEC SV</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 12, color: "#666" }}>
          <div>Fecha: {fecha}</div>
          <div>Autor: {r.generado_por ?? "CAIA"}</div>
        </div>
      </header>

      <h1 style={{ fontSize: 26, marginBottom: 4 }}>{r.titulo ?? "Reporte"}</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        {r.tipo} · {PAIS_NOMBRE[r.pais_id ?? ""] ?? r.pais_id ?? "—"} ·{" "}
        <EstadoBadge estado={r.estado} />
      </p>

      <ReporteAcciones reporteId={r.reporte_id} />

      <CuerpoReporte r={r} />
    </main>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const color =
    estado === "listo" ? "#0a7d4f" : estado === "error" ? "#c0392b" : "#b8860b";
  return <span style={{ color, fontWeight: 700 }}>{estado}</span>;
}
