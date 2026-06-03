import { NextResponse } from "next/server";
import { table } from "@/lib/supabase";
import { errMsg } from "@/lib/err";
import { normEstado } from "@/lib/format";
import type { WarRoomData } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const [crisisRes, kpisRes, eventosRes] = await Promise.all([
      table("caia_wr_crisis")
        .select("crisis_id, codigo, titulo, dimension, tipo_evento, descripcion, defcon, estado, capital_riesgo, capital_mitigado, timestamp_inicio")
        .order("defcon", { ascending: true })
        .order("timestamp_inicio", { ascending: false }),
      table("caia_wr_kpis")
        .select("kpi_id, nombre, categoria, valor_actual, valor_meta, unidad, tendencia, alerta_activa, dimension")
        .order("alerta_activa", { ascending: false }),
      table("caia_wr_eventos")
        .select("evento_id, origen_modulo, tipo_evento, severidad, titulo, descripcion, created_at")
        .order("created_at", { ascending: false })
        .limit(15),
    ]);

    for (const r of [crisisRes, kpisRes, eventosRes]) {
      if (r.error) throw r.error;
    }

    const crisis = crisisRes.data ?? [];
    const data: WarRoomData = {
      crisis,
      crisis_activas: crisis.filter((c) => normEstado(c.estado) === "activo").length,
      kpis: kpisRes.data ?? [],
      eventos: eventosRes.data ?? [],
    };

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
