import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import type {
  PoiFuga,
  Zona,
  DashboardKpis,
  OrdenTrabajo,
  OtMaterial,
  BitacoraEntry,
  Fuente,
  AlertaViva,
  Medicion,
  ObsSatelital,
} from "@/lib/types";

// Acceso a datos sobre la capa public.davinci_v_* (service role, server-only).
// Cada función está envuelta para que un error de red/credenciales no tumbe la
// página: devolvemos un fallback vacío y dejamos el error en consola del server.

async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[davinci] ${label}:`, err);
    return fallback;
  }
}

export function getDashboardKpis(): Promise<DashboardKpis> {
  const empty: DashboardKpis = {
    total_pois: 0,
    pois_alta: 0,
    pois_media: 0,
    pois_baja: 0,
    caudal_total_lpm: 0,
    ot_activas: 0,
    ot_cerradas: 0,
    evidencias_count: 0,
    zonas_count: 0,
  };
  return safe(
    "getDashboardKpis",
    async () => {
      const { data, error } = await supabaseAdmin()
        .from("davinci_v_dashboard")
        .select("*")
        .single();
      if (error) throw error;
      return (data as DashboardKpis) ?? empty;
    },
    empty
  );
}

export function getPois(): Promise<PoiFuga[]> {
  return safe(
    "getPois",
    async () => {
      const { data, error } = await supabaseAdmin()
        .from("davinci_v_poi_fugas")
        .select("*")
        .order("score", { ascending: false });
      if (error) throw error;
      return (data as PoiFuga[]) ?? [];
    },
    []
  );
}

export function getZonas(): Promise<Zona[]> {
  return safe(
    "getZonas",
    async () => {
      const { data, error } = await supabaseAdmin()
        .from("davinci_v_zonas")
        .select("*");
      if (error) throw error;
      return (data as Zona[]) ?? [];
    },
    []
  );
}

export function getOrdenActiva(): Promise<OrdenTrabajo | null> {
  return safe(
    "getOrdenActiva",
    async () => {
      const { data, error } = await supabaseAdmin()
        .from("davinci_v_ordenes")
        .select("*")
        .neq("estado", "cerrada")
        .order("creada_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as OrdenTrabajo) ?? null;
    },
    null
  );
}

export function getOrdenes(): Promise<OrdenTrabajo[]> {
  return safe(
    "getOrdenes",
    async () => {
      const { data, error } = await supabaseAdmin()
        .from("davinci_v_ordenes")
        .select("*")
        .order("creada_at", { ascending: false });
      if (error) throw error;
      return (data as OrdenTrabajo[]) ?? [];
    },
    []
  );
}

export function getOtMateriales(otId: string): Promise<OtMaterial[]> {
  return safe(
    "getOtMateriales",
    async () => {
      const { data, error } = await supabaseAdmin()
        .from("davinci_v_ot_materiales")
        .select("*")
        .eq("ot_id", otId);
      if (error) throw error;
      return (data as OtMaterial[]) ?? [];
    },
    []
  );
}

export function getBitacora(limit = 100): Promise<BitacoraEntry[]> {
  return safe(
    "getBitacora",
    async () => {
      const { data, error } = await supabaseAdmin()
        .from("davinci_v_bitacora")
        .select("*")
        .order("ts", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data as BitacoraEntry[]) ?? [];
    },
    []
  );
}

export function getFuentes(): Promise<Fuente[]> {
  return safe(
    "getFuentes",
    async () => {
      const { data, error } = await supabaseAdmin()
        .from("davinci_v_fuentes")
        .select("*");
      if (error) throw error;
      return (data as Fuente[]) ?? [];
    },
    []
  );
}

export function getAlertasVivas(): Promise<AlertaViva[]> {
  return safe(
    "getAlertasVivas",
    async () => {
      const { data, error } = await supabaseAdmin()
        .from("davinci_v_alertas_vivas")
        .select("*");
      if (error) throw error;
      return (data as AlertaViva[]) ?? [];
    },
    []
  );
}

export function getMediciones(): Promise<Medicion[]> {
  return safe(
    "getMediciones",
    async () => {
      const { data, error } = await supabaseAdmin()
        .from("davinci_v_mediciones")
        .select("*");
      if (error) throw error;
      return (data as Medicion[]) ?? [];
    },
    []
  );
}

export function getObsSatelital(): Promise<ObsSatelital[]> {
  return safe(
    "getObsSatelital",
    async () => {
      const { data, error } = await supabaseAdmin()
        .from("davinci_v_obs_satelital")
        .select("*");
      if (error) throw error;
      return (data as ObsSatelital[]) ?? [];
    },
    []
  );
}
