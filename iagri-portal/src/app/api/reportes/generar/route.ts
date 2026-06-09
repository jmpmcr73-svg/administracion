// POST /api/reportes/generar
// Crea un registro en caia_reportes (estado: generando), dispara la edge
// function `generar-reporte` y devuelve { reporte_id, url }.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const TIPOS_VALIDOS = new Set([
  "satelital_ndvi",
  "sismico_psha",
  "agricola_caia",
  "hidrico_davinci",
  "estructural_shm",
]);
const PAISES_VALIDOS = new Set(["CR", "SV", "PA", "VE"]);

type Body = {
  tipo?: string;
  pais?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  parametros?: Record<string, unknown>;
  usuario_id?: string;
  wa_numero?: string;
};

const TITULOS: Record<string, string> = {
  satelital_ndvi: "Reporte Satelital NDVI",
  sismico_psha: "Reporte Sísmico PSHA",
  agricola_caia: "Reporte Agrícola CAIA",
  hidrico_davinci: "Reporte Hídrico DaVinci",
  estructural_shm: "Reporte Estructural SHM",
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { tipo, pais, fecha_inicio, fecha_fin } = body;
  if (!tipo || !TIPOS_VALIDOS.has(tipo)) {
    return NextResponse.json(
      { error: `tipo inválido. Opciones: ${[...TIPOS_VALIDOS].join(", ")}` },
      { status: 400 },
    );
  }
  if (!pais || !PAISES_VALIDOS.has(pais)) {
    return NextResponse.json(
      { error: `pais inválido. Opciones: ${[...PAISES_VALIDOS].join(", ")}` },
      { status: 400 },
    );
  }

  const sb = supabaseAdmin();
  const parametros = {
    ...(body.parametros ?? {}),
    fecha_inicio: fecha_inicio ?? null,
    fecha_fin: fecha_fin ?? null,
  };

  // 1) crear el registro en estado "generando"
  const { data: rep, error } = await sb
    .from("caia_reportes")
    .insert({
      tipo,
      titulo: TITULOS[tipo] ?? "Reporte",
      pais_id: pais,
      parametros,
      estado: "generando",
      generado_por: "CAIA",
      usuario_id: body.usuario_id ?? null,
      wa_numero: body.wa_numero ?? null,
    })
    .select("reporte_id")
    .single();

  if (error || !rep) {
    return NextResponse.json(
      { error: error?.message ?? "No se pudo crear el reporte" },
      { status: 500 },
    );
  }

  const reporteId = rep.reporte_id as string;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const url = `${base}/reportes/${reporteId}`;

  // 2) disparar la edge function que procesa los datos (no bloqueante para el cliente)
  try {
    const { error: fnErr } = await sb.functions.invoke("generar-reporte", {
      body: { reporte_id: reporteId, tipo, pais, parametros },
    });
    if (fnErr) {
      // dejamos el registro como "generando"; un worker/edge puede reintentar.
      console.error("edge function generar-reporte:", fnErr.message);
    }
  } catch (e) {
    console.error("invoke generar-reporte falló:", e);
  }

  return NextResponse.json({ reporte_id: reporteId, url }, { status: 201 });
}
