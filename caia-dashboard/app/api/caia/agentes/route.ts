import { NextRequest, NextResponse } from "next/server";
import { table } from "@/lib/supabase";
import { errMsg } from "@/lib/err";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const proyecto = sp.get("proyecto")?.trim() || "";
    const q = sp.get("q")?.trim() || "";

    let query = table("caia_agentes")
      .select("agente_id, nombre, tipo, estado, modelo_ia, proyecto, capa_logica, es_transversal")
      .order("proyecto", { ascending: true })
      .order("nombre", { ascending: true });

    if (proyecto) query = query.eq("proyecto", proyecto);
    if (q) query = query.or(`nombre.ilike.%${q}%,agente_id.ilike.%${q}%`);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ agentes: data ?? [], total: data?.length ?? 0 });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
