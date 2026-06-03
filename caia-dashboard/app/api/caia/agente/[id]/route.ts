import { NextRequest, NextResponse } from "next/server";
import { fromSchema } from "@/lib/supabase";
import { errMsg } from "@/lib/err";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Detalle completo de un agente: incluye system_prompt y config_json.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await fromSchema("akasha")
      .from("agentes")
      .select("*")
      .eq("agente_id", params.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Agente no encontrado" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: errMsg(e) },
      { status: 500 }
    );
  }
}
