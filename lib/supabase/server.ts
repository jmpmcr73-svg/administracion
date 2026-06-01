import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase para uso EXCLUSIVO en el servidor (Server Components, Route
 * Handlers, cron). Usa la SERVICE ROLE KEY, que bypassa RLS — NUNCA debe llegar
 * al navegador. El import "server-only" hace fallar el build si este módulo se
 * importa accidentalmente desde un Client Component.
 */
let _client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error(
      "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno. " +
        "Definilas en .env.local / Vercel (nunca en el código)."
    );
  }

  _client = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}
