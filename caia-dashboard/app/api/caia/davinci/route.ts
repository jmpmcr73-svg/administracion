import { NextResponse } from "next/server";
import { table } from "@/lib/supabase";
import { errMsg } from "@/lib/err";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Los 16 agentes proyecto='davinci' con su config_json (COVENIN, etc.).
export async function GET() {
  try {
    const { data, error } = await table("caia_agentes")
      .select("agente_id, nombre, descripcion, tipo, estado, capa_logica, objetivo, config_json")
      .eq("proyecto", "davinci")
      .order("nombre", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ agentes: data ?? [], total: data?.length ?? 0 });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
