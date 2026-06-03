import { NextResponse } from "next/server";
import { table } from "@/lib/supabase";
import { errMsg } from "@/lib/err";
import { countBy } from "@/lib/aggregate";
import { normEstado } from "@/lib/format";
import type { OverviewData } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Conteo tolerante: si la vista falla, devuelve null en vez de tumbar todo.
async function count(view: string, filter?: [string, string]): Promise<number | null> {
  try {
    let q = table(view).select("*", { count: "exact", head: true });
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
    const { data: agentes, error } = await table("caia_agentes").select(
      "proyecto, estado, capa_logica, tipo, modelo_ia"
    );
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
      count("caia_kr_sesiones"),
      count("caia_kr_avances"),
      count("caia_kr_decisiones"),
      count("caia_kr_pendientes"),
      count("caia_kr_pendientes", ["estado", "abierto"]),
      count("caia_wr_crisis"),
      count("caia_wr_crisis", ["estado", "Activo"]),
      count("caia_wr_eventos"),
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
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
