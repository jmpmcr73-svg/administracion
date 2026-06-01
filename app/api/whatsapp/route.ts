import { NextRequest } from "next/server";
import {
  findCuadrillaByChat,
  listOtForCuadrilla,
  confirmarOt,
  cerrarOt,
  guardarEvidencia,
} from "@/lib/flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Respuesta TwiML (Twilio espera XML).
function twiml(message: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(
    message
  )}</Message></Response>`;
  return new Response(xml, { headers: { "Content-Type": "text/xml" } });
}
function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string)
  );
}

// Descarga un media de Twilio (requiere basic-auth con las credenciales).
async function downloadTwilioMedia(url: string): Promise<{ buffer: Buffer; mime: string; name: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID ?? "";
  const token = process.env.TWILIO_AUTH_TOKEN ?? "";
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) throw new Error(`Twilio media ${res.status}`);
  const mime = res.headers.get("content-type") ?? "application/octet-stream";
  const ext = mime.split("/")[1] ?? "bin";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, mime, name: `${Date.now()}.${ext}` };
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const from = String(form.get("From") ?? ""); // p.ej. whatsapp:+506...
  const body = String(form.get("Body") ?? "").trim();
  const numMedia = parseInt(String(form.get("NumMedia") ?? "0"), 10) || 0;
  const chatKey = from.replace("whatsapp:", "");
  const actor = `wa:${chatKey}`;

  const cuadrilla = await findCuadrillaByChat(chatKey);

  try {
    // Media => evidencia
    if (numMedia > 0) {
      if (!cuadrilla) return twiml("No estás registrado como cuadrilla.");
      const ots = await listOtForCuadrilla(cuadrilla.id);
      const ot = ots[0];
      if (!ot) return twiml("No tenés OTs activas para asociar la evidencia.");
      const mediaUrl = String(form.get("MediaUrl0") ?? "");
      const mediaType = String(form.get("MediaContentType0") ?? "");
      const { buffer, mime, name } = await downloadTwilioMedia(mediaUrl);
      const tipo = mediaType.startsWith("video") ? "video" : mediaType.startsWith("image") ? "foto" : "documento";
      const lat = form.get("Latitude") ? Number(form.get("Latitude")) : null;
      const lng = form.get("Longitude") ? Number(form.get("Longitude")) : null;
      const url = await guardarEvidencia({ otId: ot.id, buffer, mime, name, tipo, lat, lng, momento: body || null, actor });
      return twiml(url ? `📎 Evidencia guardada en ${ot.id}.` : "No se pudo guardar la evidencia.");
    }

    // /ot
    if (body.toLowerCase() === "/ot" || body.toLowerCase() === "ot") {
      if (!cuadrilla) return twiml("No estás registrado como cuadrilla.");
      const ots = await listOtForCuadrilla(cuadrilla.id);
      if (ots.length === 0) return twiml("No tenés OTs activas. ✅");
      const lines = ots
        .map((o) => `• ${o.id} — ${o.zona_nombre ?? o.poi_id ?? ""} (${o.estado})`)
        .join("\n");
      return twiml(
        `Tus OTs:\n${lines}\n\nResponder:\n"confirmar <OT>"  ·  "cerrar <OT>"`
      );
    }

    // confirmar <OT>
    const mConfirm = body.match(/^confirmar\s+(\S+)/i);
    if (mConfirm) {
      const ot = await confirmarOt(mConfirm[1], actor);
      return twiml(ot ? `✅ Recepción de ${mConfirm[1]} confirmada.` : `No encontré la OT ${mConfirm[1]}.`);
    }

    // cerrar <OT> | /cerrar <OT>
    const mClose = body.match(/^\/?cerrar\s+(\S+)/i);
    if (mClose) {
      const ot = await cerrarOt(mClose[1], actor);
      return twiml(ot ? `🔒 OT ${mClose[1]} cerrada y POI verificado.` : `No encontré la OT ${mClose[1]}.`);
    }

    return twiml(
      "👷 DaVinci Hídrico\n/ot — ver órdenes\n\"confirmar <OT>\"\nenviá foto/video como evidencia\n\"cerrar <OT>\""
    );
  } catch (err) {
    console.error("[whatsapp] error:", err);
    return twiml("Ocurrió un error procesando tu mensaje.");
  }
}
