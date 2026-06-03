import { NextResponse } from "next/server";
import { fromSchema } from "@/lib/supabase";
import { countBy } from "@/lib/aggregate";
import { normEstado } from "@/lib/format";
import type { OverviewData } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Conteo tolerante a fallos: si el schema no está expuesto en la Data API
// (p.ej. kronos no expuesto a propósito por seguridad), devuelve null en vez
// de tumbar toda la respuesta. Así overview sigue sirviendo akasha + war_room.
async function count(
  schema: string,
  table: string,
  filter?: [string, string]
): Promise<number | null> {
  try {
    let q = fromSchema(schema).from(table).select("*", { count: "exact", head: true });
    if (filter) q = q.eq(filter[0], filter[1]);
    const { count, error } = await q;
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    // Los 235 agentes: traemos solo las columnas que agregamos (rápido).
    const { data: agentes, error } = await fromSchema("akasha")
      .from("agentes")
      .select("proyecto, estado, capa_logica, tipo, modelo_ia");
    if (error) throw error;
    const rows = agentes ?? [];

    const [
      sesiones,
      avances,
      decisiones,
      pendientes_total,
      pendientes_abiertos,
      crisis_total,
      crisis_activas,
      eventos,
    ] = await Promise.all([
      count("kronos", "sesiones"),
      count("kronos", "avances"),
      count("kronos", "decisiones"),
      count("kronos", "pendientes"),
      count("kronos", "pendientes", ["estado", "abierto"]),
      count("war_room", "crisis"),
      count("war_room", "crisis", ["estado", "Activo"]),
      count("war_room", "eventos"),
    ]);

    const por_proyecto = countBy(rows, (r) => r.proyecto, "(sin proyecto)");
    const por_estado = countBy(rows, (r) => r.estado, "(sin estado)");
    const por_capa = countBy(rows, (r) => r.capa_logica, "(sin capa)");
    const por_tipo = countBy(rows, (r) => r.tipo, "(sin tipo)");
    const por_modelo = countBy(rows, (r) => r.modelo_ia, "(sin modelo)");

    const agentes_activos = rows.filter((r) => normEstado(r.estado) === "activo").length;

    const data: OverviewData = {
      total_agentes: rows.length,
      agentes_activos,
      proyectos_distintos: por_proyecto.filter((p) => p.label !== "(sin proyecto)").length,
      por_proyecto,
      por_estado,
      por_capa,
      por_tipo,
      por_modelo,
      kronos: { sesiones, avances, decisiones, pendientes_total, pendientes_abiertos },
      warroom: { crisis_total, crisis_activas, eventos },
    };

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
