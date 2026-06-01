import {
  getFuentes,
  getAlertasVivas,
  getMediciones,
  getObsSatelital,
} from "@/lib/davinci";
import { Card, Badge, PageHeader, MobileNav } from "@/components/ui";
import FuentesMapClient from "@/components/FuentesMapClient";
import TurbidezChart from "@/components/TurbidezChart";
import { fmtNum, fmtFecha, fmtFechaCorta, severidadBadge } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FuentesPage() {
  const [fuentes, alertas, mediciones, obs] = await Promise.all([
    getFuentes(),
    getAlertasVivas(),
    getMediciones(),
    getObsSatelital(),
  ]);
  const escena = obs[0]; // la más reciente (vista ordena por fecha desc)

  return (
    <div className="p-5 md:p-7">
      <MobileNav />
      <PageHeader
        title="Fuentes"
        subtitle="Monitoreo de fuentes de agua · alertas vivas, calidad y satélite"
        right={<Badge variant="b-teal">davinci_fuentes</Badge>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Mapa */}
        <div className="lg:col-span-2">
          <Card className="!p-2">
            <div className="h-[420px]">
              <FuentesMapClient fuentes={fuentes} alertas={alertas} />
            </div>
          </Card>
        </div>

        {/* Escena Sentinel-2 + chip */}
        <div className="flex flex-col gap-4">
          <Card>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-white">Escena Sentinel-2</h2>
              <Badge variant="b-blue">obs_satelital</Badge>
            </div>
            {escena ? (
              <div className="text-sm space-y-1.5">
                <div className="mono text-teal2 break-all">{escena.scene_id ?? "—"}</div>
                <div className="text-muted">Fuente: <span className="text-ink">{escena.fuente_nombre ?? "—"}</span></div>
                <div className="text-muted">Fecha: <span className="text-ink">{fmtFechaCorta(escena.fecha)}</span></div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="rounded-lg p-2" style={{ background: "var(--bg3)" }}>
                    <div className="text-[10px] uppercase text-muted">NDTI</div>
                    <div className="mono text-lg font-bold text-amber">{fmtNum(escena.ndti, 3)}</div>
                  </div>
                  <div className="rounded-lg p-2" style={{ background: "var(--bg3)" }}>
                    <div className="text-[10px] uppercase text-muted">Nubosidad</div>
                    <div className="mono text-lg font-bold text-blue">{fmtNum(escena.nubosidad_pct, 0)}%</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted">Sin escenas satelitales. Corré la ingesta Sentinel-2.</div>
            )}
          </Card>

          <Card>
            <h2 className="text-sm font-bold text-white mb-2">Tendencia de turbidez</h2>
            <TurbidezChart data={mediciones} />
          </Card>
        </div>
      </div>

      {/* Alertas vivas */}
      <Card className="mt-4">
        <h2 className="text-sm font-bold text-white mb-3">Alertas vivas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {alertas.map((a) => (
            <div
              key={a.id}
              className="rounded-lg p-3"
              style={{ background: "var(--bg3)", border: "1px solid var(--border2)" }}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-bold text-ink">{a.tipo ?? "alerta"}</span>
                <Badge variant={severidadBadge(a.severidad)}>{a.severidad}</Badge>
              </div>
              <div className="text-sm text-ink">{a.mensaje ?? "—"}</div>
              {a.recomendacion && (
                <div className="text-xs text-muted mt-1">→ {a.recomendacion}</div>
              )}
              <div className="text-[11px] text-muted mt-2 flex flex-wrap gap-x-3">
                <span>Fuente: {a.fuente_nombre ?? "—"}</span>
                <span>Parámetro: {a.parametro ?? "—"}</span>
                {a.horizonte_dias != null && <span>Horizonte: {a.horizonte_dias} d</span>}
                <span>{fmtFecha(a.emitida_at)}</span>
              </div>
            </div>
          ))}
          {alertas.length === 0 && (
            <div className="text-sm text-muted">No hay alertas vivas.</div>
          )}
        </div>
      </Card>

      {/* Mediciones recientes */}
      <Card className="mt-4">
        <h2 className="text-sm font-bold text-white mb-3">Mediciones de calidad</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-left text-xs uppercase tracking-wide">
                <th className="font-medium py-2">Fuente</th>
                <th className="font-medium py-2">Turbidez (NTU)</th>
                <th className="font-medium py-2">CE (µS/cm)</th>
                <th className="font-medium py-2">pH</th>
                <th className="font-medium py-2">OD (mg/L)</th>
                <th className="font-medium py-2">Caudal (lps)</th>
                <th className="font-medium py-2">Medido</th>
              </tr>
            </thead>
            <tbody>
              {[...mediciones].reverse().map((m) => (
                <tr key={m.id} className="border-t" style={{ borderColor: "var(--border2)" }}>
                  <td className="py-2">{m.fuente_nombre ?? "—"}</td>
                  <td className="py-2 mono">{fmtNum(m.turbidez_ntu, 1)}</td>
                  <td className="py-2 mono">{fmtNum(m.ce_us_cm, 0)}</td>
                  <td className="py-2 mono">{fmtNum(m.ph, 1)}</td>
                  <td className="py-2 mono">{fmtNum(m.od_mg_l, 1)}</td>
                  <td className="py-2 mono">{fmtNum(m.caudal_lps, 1)}</td>
                  <td className="py-2">{fmtFecha(m.medido_at)}</td>
                </tr>
              ))}
              {mediciones.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-muted">Sin mediciones.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
