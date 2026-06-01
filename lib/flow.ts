import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { OrdenTrabajo } from "@/lib/types";

// Lógica del flujo de cuadrilla, agnóstica al canal (Telegram / WhatsApp).
// Todas las escrituras pasan por funciones SECURITY DEFINER (public.davinci_*).

export interface Cuadrilla {
  id: string;
  nombre: string;
  responsable: string | null;
  canal: string | null;
  chat_id: string | null;
  activa: boolean | null;
}

export async function findCuadrillaByChat(chatId: string | number): Promise<Cuadrilla | null> {
  const { data, error } = await supabaseAdmin()
    .from("davinci_v_cuadrillas")
    .select("*")
    .eq("chat_id", String(chatId))
    .eq("activa", true)
    .maybeSingle();
  if (error) {
    console.error("[flow] findCuadrillaByChat:", error);
    return null;
  }
  return (data as Cuadrilla) ?? null;
}

export async function listOtForCuadrilla(cuadrillaId: string): Promise<OrdenTrabajo[]> {
  const { data, error } = await supabaseAdmin()
    .from("davinci_v_ordenes")
    .select("*")
    .eq("cuadrilla_id", cuadrillaId)
    .neq("estado", "cerrada")
    .order("creada_at", { ascending: false });
  if (error) {
    console.error("[flow] listOtForCuadrilla:", error);
    return [];
  }
  return (data as OrdenTrabajo[]) ?? [];
}

export async function getOrden(otId: string): Promise<OrdenTrabajo | null> {
  const { data, error } = await supabaseAdmin()
    .from("davinci_v_ordenes")
    .select("*")
    .eq("id", otId)
    .maybeSingle();
  if (error) {
    console.error("[flow] getOrden:", error);
    return null;
  }
  return (data as OrdenTrabajo) ?? null;
}

export async function confirmarOt(otId: string, actor: string): Promise<OrdenTrabajo | null> {
  const { data, error } = await supabaseAdmin().rpc("davinci_ot_confirmar", {
    p_ot: otId,
    p_actor: actor,
  });
  if (error) {
    console.error("[flow] confirmarOt:", error);
    return null;
  }
  return (data as OrdenTrabajo) ?? null;
}

export async function cerrarOt(otId: string, actor: string): Promise<OrdenTrabajo | null> {
  const { data, error } = await supabaseAdmin().rpc("davinci_ot_cerrar", {
    p_ot: otId,
    p_actor: actor,
  });
  if (error) {
    console.error("[flow] cerrarOt:", error);
    return null;
  }
  const ot = (data as OrdenTrabajo) ?? null;
  if (ot) await enviarReporteCierre(ot).catch((e) => console.error("[flow] reporte:", e));
  return ot;
}

export async function bitacora(otId: string, evento: string, detalle: Record<string, unknown>, actor: string) {
  const { error } = await supabaseAdmin().rpc("davinci_bitacora_insert", {
    p_ot: otId,
    p_evento: evento,
    p_detalle: detalle,
    p_actor: actor,
  });
  if (error) console.error("[flow] bitacora:", error);
}

// Sube un file a Supabase Storage e inserta la evidencia (con geo opcional).
export async function guardarEvidencia(params: {
  otId: string;
  buffer: Buffer;
  mime: string;
  name: string;
  tipo: "foto" | "video" | "documento";
  lat?: number | null;
  lng?: number | null;
  momento?: string | null;
  actor: string;
}): Promise<string | null> {
  const bucket = process.env.SUPABASE_EVIDENCIAS_BUCKET ?? "evidencias";
  const path = `${params.otId}/${Date.now()}_${params.name}`;

  const sb = supabaseAdmin();
  const { error: upErr } = await sb.storage
    .from(bucket)
    .upload(path, params.buffer, { contentType: params.mime, upsert: false });
  if (upErr) {
    console.error("[flow] storage.upload:", upErr);
    return null;
  }

  const { data: pub } = sb.storage.from(bucket).getPublicUrl(path);
  const url = pub.publicUrl;

  const { error: rpcErr } = await sb.rpc("davinci_evidencia_insert", {
    p_ot: params.otId,
    p_tipo: params.tipo,
    p_url: url,
    p_lat: params.lat ?? null,
    p_lng: params.lng ?? null,
    p_momento: params.momento ?? null,
    p_actor: params.actor,
  });
  if (rpcErr) {
    console.error("[flow] evidencia_insert:", rpcErr);
    return null;
  }
  return url;
}

// Reporte de cierre a supervisión (opcional vía Resend). Si no hay credenciales,
// solo deja traza en consola — el flujo no falla.
async function enviarReporteCierre(ot: OrdenTrabajo) {
  const to = process.env.SUPERVISION_EMAIL;
  const key = process.env.RESEND_API_KEY;
  const asunto = `OT ${ot.id} cerrada — ${ot.zona_nombre ?? ot.poi_id ?? ""}`;
  const cuerpo =
    `Orden de trabajo ${ot.id} cerrada.\n` +
    `Zona: ${ot.zona_nombre ?? "—"}\nPOI: ${ot.poi_id ?? "—"}\n` +
    `Cuadrilla: ${ot.cuadrilla_nombre ?? "—"}\nDiagnóstico: ${ot.diagnostico ?? "—"}`;

  if (!to || !key) {
    console.log("[flow] reporte de cierre (sin email configurado):", asunto);
    return;
  }
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "DaVinci Hídrico <onboarding@resend.dev>",
      to: [to],
      subject: asunto,
      text: cuerpo,
    }),
  });
}
