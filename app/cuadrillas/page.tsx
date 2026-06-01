import { getBitacora, getOrdenes } from "@/lib/davinci";
import { Card, Badge, PageHeader, MobileNav } from "@/components/ui";
import { fmtFecha, severidadBadge } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const EVENTO_LABEL: Record<string, string> = {
  recepcion_confirmada: "Recepción confirmada",
  evidencia_recibida: "Evidencia recibida",
  ot_cerrada: "OT cerrada",
  ot_creada: "OT creada",
  despacho: "Despacho",
};

export default async function CuadrillasPage() {
  const [bitacora, ordenes] = await Promise.all([getBitacora(200), getOrdenes()]);
  const otById = new Map(ordenes.map((o) => [o.id, o]));

  return (
    <div className="p-5 md:p-7">
      <MobileNav />
      <PageHeader
        title="Cuadrillas"
        subtitle="Bitácora del flujo de OT · mensajes desde Telegram / WhatsApp"
        right={<Badge variant="b-teal">bitacora</Badge>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bitácora (timeline) */}
        <div className="lg:col-span-2">
          <Card>
            <h2 className="text-sm font-bold text-white mb-3">Bitácora de campo</h2>
            <ol className="relative border-l pl-4" style={{ borderColor: "var(--border)" }}>
              {bitacora.map((b) => (
                <li key={b.id} className="mb-4 ml-2">
                  <div
                    className="absolute -left-[5px] w-2.5 h-2.5 rounded-full"
                    style={{ background: "#00bcd4" }}
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-ink">
                      {EVENTO_LABEL[b.evento ?? ""] ?? b.evento ?? "evento"}
                    </span>
                    {b.ot_id && <Badge variant="b-blue">{b.ot_id}</Badge>}
                    {b.actor && <span className="text-[11px] text-muted">por {b.actor}</span>}
                  </div>
                  {b.detalle && Object.keys(b.detalle).length > 0 && (
                    <pre className="text-[11px] text-muted mono mt-1 whitespace-pre-wrap break-all">
                      {JSON.stringify(b.detalle)}
                    </pre>
                  )}
                  <div className="text-[11px] text-muted mt-0.5">{fmtFecha(b.ts)}</div>
                </li>
              ))}
              {bitacora.length === 0 && (
                <li className="text-sm text-muted ml-2">
                  Sin actividad registrada todavía. La bitácora se llena cuando las
                  cuadrillas interactúan con el bot (confirmar OT, enviar evidencia, cerrar).
                </li>
              )}
            </ol>
          </Card>
        </div>

        {/* Estado de OTs */}
        <div>
          <Card>
            <h2 className="text-sm font-bold text-white mb-3">Órdenes de trabajo</h2>
            <div className="flex flex-col gap-2">
              {ordenes.map((o) => (
                <div
                  key={o.id}
                  className="rounded-lg p-3"
                  style={{ background: "var(--bg3)", border: "1px solid var(--border2)" }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="mono text-teal2 font-bold">{o.id}</span>
                    <Badge variant={severidadBadge(o.prioridad)}>{o.estado}</Badge>
                  </div>
                  <div className="text-[12px] text-muted mt-1">
                    {o.cuadrilla_nombre ?? "Sin cuadrilla"} · {o.zona_nombre ?? o.poi_id ?? "—"}
                  </div>
                </div>
              ))}
              {ordenes.length === 0 && (
                <div className="text-sm text-muted">Sin órdenes de trabajo.</div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
