import { NextRequest, NextResponse } from "next/server";
import {
  sendMessage,
  answerCallback,
  downloadTelegramFile,
  type TgUpdate,
  type TgMessage,
} from "@/lib/telegram";
import {
  findCuadrillaByChat,
  listOtForCuadrilla,
  confirmarOt,
  cerrarOt,
  guardarEvidencia,
} from "@/lib/flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Valida el secreto del webhook (Telegram lo envía en este header).
function validSecret(req: NextRequest): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return false; // sin secreto configurado, rechazamos por defecto
  return req.headers.get("x-telegram-bot-api-secret-token") === expected;
}

export async function POST(req: NextRequest) {
  if (!validSecret(req)) {
    return new NextResponse("forbidden", { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: true }); // ignoramos payloads inválidos
  }

  try {
    if (update.callback_query) {
      await handleCallback(update.callback_query);
    } else if (update.message) {
      await handleMessage(update.message);
    }
  } catch (err) {
    console.error("[telegram] handler error:", err);
  }

  // Siempre 200 para que Telegram no reintente en bucle.
  return NextResponse.json({ ok: true });
}

async function handleMessage(msg: TgMessage) {
  const chatId = msg.chat.id;
  const actor = msg.from?.username ?? msg.from?.first_name ?? `tg:${chatId}`;
  const cuadrilla = await findCuadrillaByChat(chatId);

  // --- Foto / video / documento => evidencia -------------------------------
  const fileId =
    msg.photo?.[msg.photo.length - 1]?.file_id ??
    msg.video?.file_id ??
    msg.document?.file_id;
  if (fileId) {
    if (!cuadrilla) {
      await sendMessage(chatId, "No estás registrado como cuadrilla. Avisá a supervisión.");
      return;
    }
    const ots = await listOtForCuadrilla(cuadrilla.id);
    const ot = ots[0];
    if (!ot) {
      await sendMessage(chatId, "No tenés OTs activas para asociar la evidencia.");
      return;
    }
    const tipo = msg.photo ? "foto" : msg.video ? "video" : "documento";
    const { buffer, mime, name } = await downloadTelegramFile(fileId);
    const url = await guardarEvidencia({
      otId: ot.id,
      buffer,
      mime,
      name,
      tipo,
      lat: msg.location?.latitude ?? null,
      lng: msg.location?.longitude ?? null,
      momento: msg.caption ?? null,
      actor,
    });
    await sendMessage(
      chatId,
      url
        ? `📎 Evidencia (${tipo}) guardada en <b>${ot.id}</b>.`
        : "No se pudo guardar la evidencia. Intentá de nuevo."
    );
    return;
  }

  const text = (msg.text ?? "").trim();

  // --- /ot : lista de OTs asignadas ----------------------------------------
  if (text === "/ot" || text.startsWith("/ot ")) {
    if (!cuadrilla) {
      await sendMessage(chatId, "No estás registrado como cuadrilla.");
      return;
    }
    const ots = await listOtForCuadrilla(cuadrilla.id);
    if (ots.length === 0) {
      await sendMessage(chatId, "No tenés OTs activas. ✅");
      return;
    }
    for (const ot of ots) {
      await sendMessage(
        chatId,
        `<b>${ot.id}</b> — ${ot.zona_nombre ?? ot.poi_id ?? ""}\n` +
          `Prioridad: ${ot.prioridad} · Estado: ${ot.estado}\n` +
          (ot.diagnostico ? `Diagnóstico: ${ot.diagnostico}` : ""),
        {
          inline_keyboard: [
            [{ text: "✅ Confirmar recepción", callback_data: `confirm:${ot.id}` }],
            [{ text: "🔒 Cerrar OT", callback_data: `cerrar:${ot.id}` }],
          ],
        }
      );
    }
    return;
  }

  // --- /cerrar <OT> --------------------------------------------------------
  if (text.startsWith("/cerrar")) {
    const otId = text.split(/\s+/)[1];
    if (!otId) {
      await sendMessage(chatId, "Usá: <code>/cerrar &lt;OT&gt;</code>");
      return;
    }
    const ot = await cerrarOt(otId, actor);
    await sendMessage(
      chatId,
      ot ? `🔒 OT <b>${otId}</b> cerrada. POI marcado como verificado. Reporte enviado a supervisión.` : `No encontré la OT ${otId}.`
    );
    return;
  }

  // --- /start | /help ------------------------------------------------------
  if (text === "/start" || text === "/help" || text === "") {
    await sendMessage(
      chatId,
      "👷 <b>DaVinci Hídrico — cuadrillas</b>\n\n" +
        "/ot — ver mis órdenes de trabajo\n" +
        "Confirmá recepción con el botón.\n" +
        "Enviá foto/video como evidencia.\n" +
        "/cerrar &lt;OT&gt; — cerrar una orden\n\n" +
        (cuadrilla ? `Estás registrado como: <b>${cuadrilla.nombre}</b>` : "⚠️ Chat no vinculado a ninguna cuadrilla.")
    );
    return;
  }

  await sendMessage(chatId, "No entendí. Probá /ot o /help.");
}

async function handleCallback(cb: NonNullable<TgUpdate["callback_query"]>) {
  const chatId = cb.message?.chat.id;
  const actor = cb.from.first_name ?? `tg:${cb.from.id}`;
  const [action, otId] = (cb.data ?? "").split(":");
  if (!chatId || !otId) {
    await answerCallback(cb.id);
    return;
  }

  if (action === "confirm") {
    const ot = await confirmarOt(otId, actor);
    await answerCallback(cb.id, ot ? "Recepción confirmada" : "No se pudo confirmar");
    await sendMessage(chatId, ot ? `✅ Recepción de <b>${otId}</b> confirmada.` : `No encontré la OT ${otId}.`);
  } else if (action === "cerrar") {
    const ot = await cerrarOt(otId, actor);
    await answerCallback(cb.id, ot ? "OT cerrada" : "No se pudo cerrar");
    await sendMessage(chatId, ot ? `🔒 OT <b>${otId}</b> cerrada y POI verificado.` : `No encontré la OT ${otId}.`);
  } else {
    await answerCallback(cb.id);
  }
}
