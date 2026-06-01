import "server-only";

// Helpers mínimos para la Bot API de Telegram. El token se lee de
// process.env.TELEGRAM_BOT_TOKEN (definido SOLO en .env.local / Vercel).

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("Falta TELEGRAM_BOT_TOKEN en el entorno.");
  return t;
}

const API = (method: string) => `https://api.telegram.org/bot${token()}/${method}`;
const FILE = (path: string) => `https://api.telegram.org/file/bot${token()}/${path}`;

export async function tgApi<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(API(method), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) throw new Error(`Telegram ${method}: ${json.description ?? "error"}`);
  return json.result as T;
}

export function sendMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: unknown
) {
  return tgApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: replyMarkup,
  });
}

export function answerCallback(callbackQueryId: string, text?: string) {
  return tgApi("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
}

// Descarga un file de Telegram y devuelve {buffer, mime, name}.
export async function downloadTelegramFile(fileId: string): Promise<{
  buffer: Buffer;
  mime: string;
  name: string;
}> {
  const file = await tgApi<{ file_path: string }>("getFile", { file_id: fileId });
  const res = await fetch(FILE(file.file_path));
  if (!res.ok) throw new Error(`No se pudo descargar el file de Telegram (${res.status})`);
  const arrayBuf = await res.arrayBuffer();
  const mime = res.headers.get("content-type") ?? "application/octet-stream";
  const name = file.file_path.split("/").pop() ?? `${fileId}`;
  return { buffer: Buffer.from(arrayBuf), mime, name };
}

// --- Tipos parciales del update de Telegram que usamos -----------------------
export interface TgLocation {
  latitude: number;
  longitude: number;
}
export interface TgPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}
export interface TgMessage {
  message_id: number;
  chat: { id: number; type: string };
  from?: { id: number; first_name?: string; username?: string };
  text?: string;
  caption?: string;
  location?: TgLocation;
  photo?: TgPhotoSize[];
  video?: { file_id: string };
  document?: { file_id: string; mime_type?: string };
}
export interface TgCallbackQuery {
  id: string;
  from: { id: number; first_name?: string };
  message?: TgMessage;
  data?: string;
}
export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
}
