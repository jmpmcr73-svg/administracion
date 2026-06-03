import { NextResponse } from "next/server";
import { fromSchema } from "@/lib/supabase";
import { errMsg } from "@/lib/err";
import { countBy } from "@/lib/aggregate";
import type { KronosData } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const kronos = fromSchema("kronos");

    const [sesionesRes, avancesRes, pendRes, pendEstadoRes] = await Promise.all([
      kronos
        .from("sesiones")
        .select("session_id, fecha_inicio, proyecto_activo, titulo, resumen_ejecutivo, estado, num_mensajes")
        .order("fecha_inicio", { ascending: false })
        .limit(12),
      kronos
        .from("avances")
        .select("avance_id, fecha, proyecto, modulo, descripcion, estado")
        .order("fecha", { ascending: false })
        .limit(15),
      kronos
        .from("pendientes")
        .select("pendiente_id, titulo, proyecto, prioridad, estado, asignado_a, fecha_creacion")
        .order("prioridad", { ascending: true })
        .order("fecha_creacion", { ascending: false })
        .limit(20),
      // Para la distribución por estado traemos solo la columna estado de todos.
      kronos.from("pendientes").select("estado"),
    ]);

    for (const r of [sesionesRes, avancesRes, pendRes, pendEstadoRes]) {
      if (r.error) throw r.error;
    }

    const data: KronosData = {
      sesiones: sesionesRes.data ?? [],
      avances: avancesRes.data ?? [],
      pendientes_recientes: pendRes.data ?? [],
      pendientes_por_estado: countBy(pendEstadoRes.data ?? [], (r) => r.estado, "(sin estado)"),
    };

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: errMsg(e) },
      { status: 500 }
    );
  }
}
