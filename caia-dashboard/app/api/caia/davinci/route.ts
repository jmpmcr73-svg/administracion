import { NextResponse } from "next/server";
import { fromSchema } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Los 16 agentes proyecto='davinci' con su config_json (grupo, cluster,
// covenin[], normas internacionales[], ejecutor[], worker_required...).
export async function GET() {
  try {
    const { data, error } = await fromSchema("akasha")
      .from("agentes")
      .select("agente_id, nombre, descripcion, tipo, estado, capa_logica, objetivo, config_json")
      .eq("proyecto", "davinci")
      .order("nombre", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ agentes: data ?? [], total: data?.length ?? 0 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
