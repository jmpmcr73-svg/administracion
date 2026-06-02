import { NextRequest, NextResponse } from "next/server";
import { fromSchema } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Lista filtrable de agentes. Campos ligeros para la tabla (el system_prompt
// y config_json completos se cargan en el detalle /api/caia/agente/[id]).
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const proyecto = sp.get("proyecto")?.trim() || "";
    const q = sp.get("q")?.trim() || "";

    let query = fromSchema("akasha")
      .from("agentes")
      .select(
        "agente_id, nombre, tipo, estado, modelo_ia, proyecto, capa_logica, es_transversal"
      )
      .order("proyecto", { ascending: true })
      .order("nombre", { ascending: true });

    if (proyecto) query = query.eq("proyecto", proyecto);
    if (q) query = query.or(`nombre.ilike.%${q}%,agente_id.ilike.%${q}%`);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ agentes: data ?? [], total: data?.length ?? 0 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
