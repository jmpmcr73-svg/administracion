import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron diario (Vercel Cron -> vercel.json). Aplica las REGLAS DE ALERTA sobre
 * fuentes cruzando clima + mediciones de calidad + observación satelital:
 *   - lluvia alta + turbidez/NDTI en ascenso  -> alerta "lluvia" (turbidez)
 *   - CE al alza + estiaje (SPI bajo / poca lluvia) -> alerta "sequia" (ce_ph)
 *
 * NOTA: la INGESTA satelital (descarga de bandas Sentinel-2 + cálculo de NDTI
 * con rasterio) corre en scripts/ingest_sentinel.py — requiere GDAL/rasterio y
 * no puede ejecutarse en el runtime de Vercel. Esta route consume lo que ese
 * script ya dejó en davinci_fuentes.obs_satelital.
 */

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // si no hay secreto configurado, permitir (dev)
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function lastTwo<T>(rows: T[]): [T | undefined, T | undefined] {
  // rows ordenadas asc por fecha => penúltima y última
  return [rows[rows.length - 2], rows[rows.length - 1]];
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return new NextResponse("forbidden", { status: 401 });

  const sb = supabaseAdmin();
  const generadas: number[] = [];

  const [{ data: fuentes }, { data: med }, { data: clima }, { data: obs }, { data: vivas }] =
    await Promise.all([
      sb.from("davinci_v_fuentes").select("*"),
      sb.from("davinci_v_mediciones").select("*"),
      sb.from("davinci_v_clima").select("*"),
      sb.from("davinci_v_obs_satelital").select("*"),
      sb.from("davinci_v_alertas_vivas").select("tipo,fuente_id"),
    ]);

  const yaTiene = (fuenteId: string, tipo: string) =>
    (vivas ?? []).some((a) => a.fuente_id === fuenteId && a.tipo === tipo);

  for (const f of fuentes ?? []) {
    const fid = f.id as string;

    const medFuente = (med ?? [])
      .filter((m) => m.fuente_id === fid)
      .sort((a, b) => +new Date(a.medido_at) - +new Date(b.medido_at));
    const [medPrev, medLast] = lastTwo(medFuente);

    const climaFuente = (clima ?? [])
      .filter((c) => c.fuente_id === fid)
      .sort((a, b) => +new Date(a.fecha) - +new Date(b.fecha));
    const climaLast = climaFuente[climaFuente.length - 1];

    const obsFuente = (obs ?? [])
      .filter((o) => o.fuente_id === fid)
      .sort((a, b) => +new Date(a.fecha) - +new Date(b.fecha));
    const [obsPrev, obsLast] = lastTwo(obsFuente);

    const turbAsc =
      medPrev && medLast && medLast.turbidez_ntu != null && medPrev.turbidez_ntu != null
        ? Number(medLast.turbidez_ntu) > Number(medPrev.turbidez_ntu)
        : false;
    const ndtiAsc =
      obsPrev && obsLast && obsLast.ndti != null && obsPrev.ndti != null
        ? Number(obsLast.ndti) > Number(obsPrev.ndti)
        : (obsLast?.ndti != null ? Number(obsLast.ndti) > 0 : false);
    const ceAsc =
      medPrev && medLast && medLast.ce_us_cm != null && medPrev.ce_us_cm != null
        ? Number(medLast.ce_us_cm) > Number(medPrev.ce_us_cm)
        : false;

    const precip = climaLast?.precip_mm != null ? Number(climaLast.precip_mm) : 0;
    const spi = climaLast?.spi != null ? Number(climaLast.spi) : 0;

    // Regla 1: lluvia alta + turbidez/NDTI en ascenso
    if (precip >= 20 && (turbAsc || ndtiAsc) && !yaTiene(fid, "lluvia")) {
      const sev = precip >= 50 ? "alta" : "media";
      const { data } = await sb.rpc("davinci_alerta_insert", {
        p_fuente_id: fid,
        p_planta_id: null,
        p_tipo: "lluvia",
        p_parametro: "turbidez",
        p_severidad: sev,
        p_horizonte_dias: 2,
        p_mensaje: `Lluvia ${precip} mm con turbidez/NDTI en ascenso en ${f.nombre}.`,
        p_recomendacion: "Reforzar coagulación/sedimentación y vigilar entrada a planta.",
      });
      if (typeof data === "number") generadas.push(data);
    }

    // Regla 2: CE al alza + estiaje
    if (ceAsc && (spi <= -0.5 || precip < 5) && !yaTiene(fid, "sequia")) {
      const { data } = await sb.rpc("davinci_alerta_insert", {
        p_fuente_id: fid,
        p_planta_id: null,
        p_tipo: "sequia",
        p_parametro: "ce_ph",
        p_severidad: spi <= -1 ? "alta" : "media",
        p_horizonte_dias: 7,
        p_mensaje: `Conductividad eléctrica al alza con estiaje (SPI ${spi}) en ${f.nombre}.`,
        p_recomendacion: "Monitorear iones/pH; evaluar fuente alterna si persiste.",
      });
      if (typeof data === "number") generadas.push(data);
    }
  }

  return NextResponse.json({
    ok: true,
    fuentes_evaluadas: (fuentes ?? []).length,
    alertas_generadas: generadas.length,
    ids: generadas,
    ts: new Date().toISOString(),
  });
}
