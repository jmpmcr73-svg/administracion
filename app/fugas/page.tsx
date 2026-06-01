import {
  getDashboardKpis,
  getPois,
  getZonas,
  getOrdenActiva,
  getOtMateriales,
} from "@/lib/davinci";
import { Card, KpiCard, Badge, PageHeader, MobileNav } from "@/components/ui";
import FugasMapClient from "@/components/FugasMapClient";
import {
  fmtNum,
  fmtColones,
  fmtFechaCorta,
  severidadBadge,
} from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FugasPage() {
  const [kpis, pois, zonas, ot] = await Promise.all([
    getDashboardKpis(),
    getPois(),
    getZonas(),
    getOrdenActiva(),
  ]);
  const materiales = ot ? await getOtMateriales(ot.id) : [];
  const totalMateriales = materiales.reduce((s, m) => s + (m.subtotal ?? 0), 0);

  return (
    <div className="p-5 md:p-7">
      <MobileNav />
      <PageHeader
        title="Fugas"
        subtitle="Detección y priorización de fugas · datos vivos desde Supabase"
        right={<Badge variant="b-teal">davinci_fugas</Badge>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard label="POIs activos" value={fmtNum(kpis.total_pois, 0)} sub={`${fmtNum(kpis.zonas_count, 0)} zonas piloto`} />
        <KpiCard label="Prioridad alta" value={fmtNum(kpis.pois_alta, 0)} accent="#ff5252" sub={`${fmtNum(kpis.pois_media, 0)} media · ${fmtNum(kpis.pois_baja, 0)} baja`} />
        <KpiCard label="Caudal estimado" value={`${fmtNum(kpis.caudal_total_lpm, 1)}`} accent="#ffab00" sub="lpm en pérdidas" />
        <KpiCard label="Órdenes de trabajo" value={fmtNum(kpis.ot_activas, 0)} accent="#00d44c" sub={`${fmtNum(kpis.ot_cerradas, 0)} cerradas · ${fmtNum(kpis.evidencias_count, 0)} evidencias`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Mapa */}
        <div className="lg:col-span-2">
          <Card className="!p-2">
            <div className="h-[460px]">
              <FugasMapClient pois={pois} zonas={zonas} />
            </div>
          </Card>
        </div>

        {/* OT activa + materiales */}
        <div className="flex flex-col gap-4">
          <Card>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-white">Orden de trabajo activa</h2>
              {ot?.prioridad && (
                <Badge variant={severidadBadge(ot.prioridad)}>{ot.prioridad}</Badge>
              )}
            </div>
            {ot ? (
              <div className="text-sm space-y-1.5">
                <div className="mono text-teal2 text-base font-bold">{ot.id}</div>
                <div className="text-muted">
                  Estado: <span className="text-ink font-semibold">{ot.estado}</span>
                </div>
                <div className="text-muted">POI: <span className="text-ink">{ot.poi_id ?? "—"}</span></div>
                <div className="text-muted">Zona: <span className="text-ink">{ot.zona_nombre ?? "—"}</span></div>
                <div className="text-muted">Cuadrilla: <span className="text-ink">{ot.cuadrilla_nombre ?? "—"}</span></div>
                <div className="text-muted">Creada: <span className="text-ink">{fmtFechaCorta(ot.creada_at)}</span></div>
                {ot.diagnostico && (
                  <div className="text-muted pt-1">Diagnóstico: <span className="text-ink">{ot.diagnostico}</span></div>
                )}

                <div className="pt-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted mb-1">Materiales</div>
                  {materiales.length > 0 ? (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted text-left">
                          <th className="font-medium py-1">Material</th>
                          <th className="font-medium py-1 text-right">Plan</th>
                          <th className="font-medium py-1 text-right">Usado</th>
                          <th className="font-medium py-1 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materiales.map((m) => (
                          <tr key={m.id} className="border-t" style={{ borderColor: "var(--border2)" }}>
                            <td className="py-1">{m.descripcion ?? m.material_id}</td>
                            <td className="py-1 text-right mono">{fmtNum(m.cant_plan, 0)}</td>
                            <td className="py-1 text-right mono">{fmtNum(m.cant_usada, 0)}</td>
                            <td className="py-1 text-right mono">{fmtColones(m.subtotal)}</td>
                          </tr>
                        ))}
                        <tr className="border-t" style={{ borderColor: "var(--border)" }}>
                          <td className="py-1 font-bold" colSpan={3}>Total</td>
                          <td className="py-1 text-right font-bold mono text-teal2">{fmtColones(totalMateriales)}</td>
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-xs text-muted">Sin materiales registrados.</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted">No hay órdenes de trabajo activas.</div>
            )}
          </Card>
        </div>
      </div>

      {/* Lista de POIs */}
      <Card className="mt-4">
        <h2 className="text-sm font-bold text-white mb-3">POIs de fuga</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-left text-xs uppercase tracking-wide">
                <th className="font-medium py-2">ID</th>
                <th className="font-medium py-2">Prioridad</th>
                <th className="font-medium py-2">Score</th>
                <th className="font-medium py-2">Caudal (lpm)</th>
                <th className="font-medium py-2">Estado</th>
                <th className="font-medium py-2">Fuente</th>
                <th className="font-medium py-2">Zona</th>
                <th className="font-medium py-2">Detección</th>
              </tr>
            </thead>
            <tbody>
              {pois.map((p) => (
                <tr key={p.id} className="border-t" style={{ borderColor: "var(--border2)" }}>
                  <td className="py-2 mono">{p.id}</td>
                  <td className="py-2"><Badge variant={severidadBadge(p.prioridad)}>{p.prioridad}</Badge></td>
                  <td className="py-2 mono">{fmtNum(p.score, 2)}</td>
                  <td className="py-2 mono">{fmtNum(p.caudal_est_lpm, 1)}</td>
                  <td className="py-2">{p.estado ?? "—"}</td>
                  <td className="py-2">{p.fuente ?? "—"}</td>
                  <td className="py-2">{p.zona_nombre ?? "—"}</td>
                  <td className="py-2">{fmtFechaCorta(p.fecha_deteccion)}</td>
                </tr>
              ))}
              {pois.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-muted">Sin POIs.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
