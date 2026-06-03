import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase SERVER-SIDE para caia-prod.
 *
 * Usa la SERVICE ROLE key, que bypassa RLS — por eso este módulo NUNCA debe
 * importarse desde un Client Component. Solo se consume en Route Handlers
 * (app/api/**) que corren en el servidor.
 *
 * Las tablas viven en schemas custom (akasha, kronos, war_room, clima,
 * vulcano). Se accede con `.schema(<schema>)`. Esos schemas deben estar
 * expuestos en la Data API del proyecto (Settings -> API -> Exposed schemas).
 */
let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  // Aceptamos ambas convenciones de nombre para la service key:
  // SUPABASE_SERVICE_ROLE_KEY (convención Supabase/Vercel) o SUPABASE_SERVICE_KEY.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error(
      "Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SERVICE_KEY) en el entorno (.env.local o variables de Vercel)."
    );
  }

  if (!_client) {
    _client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}

/** Atajo: cliente apuntando a un schema concreto. */
export function fromSchema(schema: string) {
  return getSupabase().schema(schema);
}

/**
 * Atajo a una tabla/vista del schema public (expuesto por defecto).
 * El dashboard lee vistas seguras public.caia_* que envuelven los schemas
 * akasha/kronos/war_room/clima/vulcano y solo otorgan acceso a service_role.
 */
export function table(name: string) {
  return getSupabase().from(name);
}
