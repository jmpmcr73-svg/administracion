// Cliente Supabase server-side (service role) para el portal de reportes.
// Úsalo SOLO en Server Components / Route Handlers — nunca lo expongas al cliente.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno",
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

// Tipado mínimo de un reporte (refleja public.caia_reportes en iAgri).
export type Reporte = {
  reporte_id: string;
  usuario_id: string | null;
  wa_numero: string | null;
  tipo: string;
  subtipo: string | null;
  titulo: string | null;
  pais_id: string | null;
  parametros: Record<string, unknown>;
  contenido: Record<string, unknown>;
  estado: "generando" | "listo" | "error" | string;
  error_msg: string | null;
  url_publica: string | null;
  generado_por: string | null;
  agente_id: string | null;
  created_at: string;
  completado_at: string | null;
};
