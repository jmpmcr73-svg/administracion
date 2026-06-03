/**
 * Extrae un mensaje legible de cualquier error.
 * Los errores de supabase-js (PostgrestError) NO son instancias de Error:
 * son objetos planos con { message, details, hint, code }. Sin esto, el
 * catch genérico los mostraba como "Error desconocido".
 */
export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    const parts = [o.message, o.details, o.hint, o.code]
      .filter((p): p is string => typeof p === "string" && p.length > 0);
    if (parts.length) return parts.join(" · ");
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }
  return String(e ?? "Error desconocido");
}
