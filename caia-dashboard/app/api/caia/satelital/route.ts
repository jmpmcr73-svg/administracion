import { NextResponse } from "next/server";
import { table } from "@/lib/supabase";
import { errMsg } from "@/lib/err";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Datos satelitales reales vía vistas seguras public.caia_* (vulcano + clima).
async function safe<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<{ data: T | null; error: string | null }> {
  try {
    const { data, error } = await p;
    return { data: (data as T) ?? null, error: error ? errMsg(error) : null };
  } catch (e) {
    return { data: null, error: errMsg(e) };
  }
}

export async function GET() {
  try {
    const [vol, so2, ndvi, sst] = await Promise.all([
      safe(
        table("caia_vulcano")
          .select("volcan_nombre, latitud, longitud, elevacion_m, alertas_nivel, aviacion_codigo, so2_toneladas_dia, sismos_24h, magnitud_promedio, altura_columna_km, fecha")
          .order("fecha", { ascending: false })
      ),
      safe(
        table("caia_clima_so2")
          .select("fecha, latitud, longitud, so2_dobson_units, no2_molec_cm2, o3_dobson_units, cobertura_nubes_pct")
          .order("fecha", { ascending: false })
      ),
      safe(
        table("caia_clima_ndvi")
          .select("fecha, latitud, longitud, ndvi, evi, cobertura_nubes_pct")
          .order("fecha", { ascending: false })
      ),
      safe(
        table("caia_clima_sst")
          .select("fecha, region_id, sst_promedio_c, sst_anomaly_c, el_nino_estado, el_nino_probabilidad_pct")
          .order("fecha", { ascending: false })
      ),
    ]);

    const errors = [vol.error, so2.error, ndvi.error, sst.error].filter(Boolean) as string[];

    type V = {
      volcan_nombre: string; latitud: number; longitud: number; elevacion_m: number | null;
      alertas_nivel: number | null; aviacion_codigo: string | null; so2_toneladas_dia: number | null;
      sismos_24h: number | null; magnitud_promedio: number | null; altura_columna_km: number | null; fecha: string | null;
    };
    const seen = new Set<string>();
    const volcanoes = ((vol.data as V[] | null) ?? [])
      .filter((v) => {
        if (seen.has(v.volcan_nombre)) return false;
        seen.add(v.volcan_nombre);
        return true;
      })
      .map((v) => ({
        nombre: v.volcan_nombre,
        lat: Number(v.latitud),
        lng: Number(v.longitud),
        elevacion_m: v.elevacion_m,
        alerta: v.alertas_nivel ?? 0,
        aviacion: v.aviacion_codigo,
        so2_td: v.so2_toneladas_dia,
        sismos: v.sismos_24h,
        magnitud: v.magnitud_promedio,
        altura_km: v.altura_columna_km,
        fecha: v.fecha,
      }));

    type S = { fecha: string | null; latitud: number; longitud: number; so2_dobson_units: number | null; no2_molec_cm2: number | null; o3_dobson_units: number | null; cobertura_nubes_pct: number | null };
    const so2All = (so2.data as S[] | null) ?? [];
    const so2seen = new Set<string>();
    const so2Points = so2All
      .filter((s) => {
        const k = `${s.latitud},${s.longitud}`;
        if (so2seen.has(k)) return false;
        so2seen.add(k);
        return true;
      })
      .map((s) => ({ lat: Number(s.latitud), lng: Number(s.longitud), so2: s.so2_dobson_units, no2: s.no2_molec_cm2, o3: s.o3_dobson_units, fecha: s.fecha, nubes: s.cobertura_nubes_pct }));

    type N = { fecha: string | null; latitud: number; longitud: number; ndvi: number | null; evi: number | null; cobertura_nubes_pct: number | null };
    const ndviAll = (ndvi.data as N[] | null) ?? [];
    const ndviSeen = new Set<string>();
    const ndviPoints = ndviAll
      .filter((n) => {
        const k = `${n.latitud},${n.longitud}`;
        if (ndviSeen.has(k)) return false;
        ndviSeen.add(k);
        return true;
      })
      .map((n) => ({ lat: Number(n.latitud), lng: Number(n.longitud), ndvi: n.ndvi, evi: n.evi, fecha: n.fecha }));

    type T = { fecha: string | null; region_id: string | null; sst_promedio_c: number | null; sst_anomaly_c: number | null; el_nino_estado: string | null; el_nino_probabilidad_pct: number | null };
    const sstAll = (sst.data as T[] | null) ?? [];
    const sstNino34 = sstAll
      .filter((r) => r.region_id === "nino34")
      .sort((a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? ""));
    const sstLatest = sstAll[0] ?? null;

    const alarmas: { titulo: string; detalle: string; severidad: "crit" | "warn" | "info" }[] = [];
    for (const v of volcanoes) {
      if ((v.alerta ?? 0) >= 2) alarmas.push({ titulo: `Volcán ${v.nombre} · nivel ${v.alerta}`, detalle: `${v.so2_td ?? 0} t/día SO₂ · ${v.sismos ?? 0} sismos/24h`, severidad: "crit" });
      else if ((v.alerta ?? 0) === 1) alarmas.push({ titulo: `Volcán ${v.nombre} · vigilancia`, detalle: `${v.aviacion ?? ""} · ${v.so2_td ?? 0} t/día SO₂`, severidad: "warn" });
    }
    for (const s of so2Points) {
      if ((s.so2 ?? 0) >= 15) alarmas.push({ titulo: "SO₂ elevado (Sentinel-5P)", detalle: `${s.so2} DU @ ${s.lat.toFixed(2)}, ${s.lng.toFixed(2)}`, severidad: "warn" });
    }

    return NextResponse.json({
      volcanoes,
      so2Points,
      ndviPoints,
      sstNino34: sstNino34.map((r) => ({ fecha: r.fecha, sst: r.sst_promedio_c, anomaly: r.sst_anomaly_c })),
      sstLatest: sstLatest
        ? { region: sstLatest.region_id, sst: sstLatest.sst_promedio_c, anomaly: sstLatest.sst_anomaly_c, el_nino: sstLatest.el_nino_estado, prob: sstLatest.el_nino_probabilidad_pct }
        : null,
      alarmas,
      errors,
    });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
