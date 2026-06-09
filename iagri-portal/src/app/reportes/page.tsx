// Listado de reportes del usuario con filtros por tipo, fecha y país.
import Link from "next/link";
import { supabaseAdmin, type Reporte } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PAIS_NOMBRE: Record<string, string> = {
  CR: "Costa Rica",
  SV: "El Salvador",
  PA: "Panamá",
  VE: "Venezuela",
};

type Search = {
  tipo?: string;
  pais?: string;
  desde?: string;
  usuario_id?: string;
};

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const sb = supabaseAdmin();
  let q = sb
    .from("caia_reportes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (searchParams.tipo) q = q.eq("tipo", searchParams.tipo);
  if (searchParams.pais) q = q.eq("pais_id", searchParams.pais);
  if (searchParams.desde) q = q.gte("created_at", searchParams.desde);
  if (searchParams.usuario_id) q = q.eq("usuario_id", searchParams.usuario_id);

  const { data } = await q;
  const reportes = (data ?? []) as Reporte[];

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: 32 }}>
      <header style={{ borderBottom: "2px solid #0a7d4f", paddingBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#0a7d4f" }}>
          Alejandría Steam Labs
        </div>
        <h1 style={{ fontSize: 26, marginTop: 8 }}>Mis reportes</h1>
      </header>

      {/* Filtros (GET form: se reflejan en la URL) */}
      <form
        method="get"
        style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "20px 0" }}
      >
        <select name="tipo" defaultValue={searchParams.tipo ?? ""} style={selStyle}>
          <option value="">Todos los tipos</option>
          <option value="satelital_ndvi">Satelital NDVI</option>
          <option value="sismico_psha">Sísmico PSHA</option>
          <option value="agricola_caia">Agrícola CAIA</option>
          <option value="hidrico_davinci">Hídrico DaVinci</option>
          <option value="estructural_shm">Estructural SHM</option>
        </select>
        <select name="pais" defaultValue={searchParams.pais ?? ""} style={selStyle}>
          <option value="">Todos los países</option>
          {Object.entries(PAIS_NOMBRE).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input
          type="date"
          name="desde"
          defaultValue={searchParams.desde ?? ""}
          style={selStyle}
        />
        <button type="submit" style={btnStyle}>
          Filtrar
        </button>
      </form>

      {reportes.length === 0 ? (
        <p style={{ color: "#777" }}>No hay reportes con esos filtros.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {reportes.map((r) => (
            <Card key={r.reporte_id} r={r} />
          ))}
        </div>
      )}
    </main>
  );
}

function Card({ r }: { r: Reporte }) {
  const fecha = new Date(r.created_at).toLocaleDateString("es-CR");
  const colores: Record<string, string> = {
    listo: "#0a7d4f",
    error: "#c0392b",
    generando: "#b8860b",
  };
  return (
    <Link
      href={`/reportes/${r.reporte_id}`}
      style={{
        border: "1px solid #e3e3e3",
        borderRadius: 12,
        padding: 16,
        textDecoration: "none",
        color: "inherit",
        display: "block",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: "#888" }}>{r.tipo}</span>
        <span
          style={{ fontSize: 12, fontWeight: 700, color: colores[r.estado] ?? "#555" }}
        >
          {r.estado}
        </span>
      </div>
      <h3 style={{ margin: "8px 0", fontSize: 16 }}>{r.titulo ?? "Reporte"}</h3>
      <div style={{ fontSize: 13, color: "#666" }}>
        {PAIS_NOMBRE[r.pais_id ?? ""] ?? r.pais_id ?? "—"} · {fecha}
      </div>
    </Link>
  );
}

const selStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #ccc",
};
const btnStyle: React.CSSProperties = {
  padding: "8px 20px",
  borderRadius: 8,
  border: "none",
  background: "#0a7d4f",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};
