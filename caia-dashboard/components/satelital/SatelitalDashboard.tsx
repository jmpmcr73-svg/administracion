"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { fmtNum, fmtDate } from "@/lib/format";
import type { GlobePoint, GlobeRing } from "./GlobeImpl";

// El globo usa WebGL/Three.js → solo cliente.
const GlobeImpl = dynamic(() => import("./GlobeImpl"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="font-mono text-xs text-muted">Inicializando globo 3D…</span>
    </div>
  ),
});

interface Volcan {
  nombre: string; lat: number; lng: number; elevacion_m: number | null; alerta: number;
  aviacion: string | null; so2_td: number | null; sismos: number | null; magnitud: number | null; altura_km: number | null; fecha: string | null;
}
interface So2P { lat: number; lng: number; so2: number | null; no2: number | null; o3: number | null; fecha: string | null; nubes: number | null }
interface NdviP { lat: number; lng: number; ndvi: number | null; evi: number | null; fecha: string | null }
interface SatData {
  volcanoes: Volcan[]; so2Points: So2P[]; ndviPoints: NdviP[];
  sstNino34: { fecha: string | null; sst: number | null; anomaly: number | null }[];
  sstLatest: { region: string | null; sst: number | null; anomaly: number | null; el_nino: string | null; prob: number | null } | null;
  alarmas: { titulo: string; detalle: string; severidad: "crit" | "warn" | "info" }[];
  errors?: string[];
  error?: string;
}

function Clock() {
  const [t, setT] = useState("--:--:--");
  useEffect(() => {
    const f = () => setT(new Date().toLocaleTimeString("en-GB", { timeZone: "UTC", hour12: false }) + " GMT");
    f();
    const id = setInterval(f, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-sm tabular-nums text-[#9fb2cc]">🕑 {t}</span>;
}

function Sparkline({ values, w = 220, h = 56 }: { values: number[]; w?: number; h?: number }) {
  if (values.length < 2) return <div className="font-mono text-[10px] text-muted">datos insuficientes</div>;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (w - 8) + 4;
    const y = h - 6 - ((v - min) / span) * (h - 16);
    return `${x},${y}`;
  });
  const area = `4,${h - 6} ${pts.join(" ")} ${w - 4},${h - 6}`;
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polygon points={area} fill="url(#sg)" opacity="0.25" />
      <polyline points={pts.join(" ")} fill="none" stroke="#4d9bff" strokeWidth="2" />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r="3" fill="#4d9bff" />
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4d9bff" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Gauge({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const r = 52, cx = 70, cy = 70;
  const start = Math.PI * 0.8, end = Math.PI * 2.2;
  const ang = start + (end - start) * pct;
  const arc = (a0: number, a1: number) => {
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
  };
  const color = pct < 0.33 ? "#34e1d4" : pct < 0.66 ? "#ffb84d" : "#ff6b6b";
  return (
    <svg width="140" height="120" viewBox="0 0 140 130">
      <path d={arc(start, end)} fill="none" stroke="rgba(120,160,220,0.12)" strokeWidth="10" strokeLinecap="round" />
      <path d={arc(start, ang)} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />
      <text x="70" y="68" textAnchor="middle" className="fill-white" style={{ fontSize: 26, fontWeight: 700 }}>
        {fmtNum(value, 1)}
      </text>
      <text x="70" y="86" textAnchor="middle" style={{ fontSize: 10, fill: color }}>{label}</text>
    </svg>
  );
}

export function SatelitalDashboard() {
  const [data, setData] = useState<SatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [layers, setLayers] = useState({ volcan: true, so2: true, ndvi: true });
  const [sel, setSel] = useState<GlobePoint | null>(null);

  useEffect(() => {
    fetch("/api/caia/satelital")
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setData({ volcanoes: [], so2Points: [], ndviPoints: [], sstNino34: [], sstLatest: null, alarmas: [], error: String(e) }))
      .finally(() => setLoading(false));
  }, []);

  const { points, rings, labels } = useMemo(() => {
    const pts: GlobePoint[] = [];
    const rgs: GlobeRing[] = [];
    const lbl: { lat: number; lng: number; text: string }[] = [];
    if (!data) return { points: pts, rings: rgs, labels: lbl };

    if (layers.volcan) {
      for (const v of data.volcanoes) {
        const color = v.alerta >= 2 ? "#ff6b6b" : v.alerta === 1 ? "#ffb84d" : "#34e1d4";
        pts.push({
          lat: v.lat, lng: v.lng, color, r: v.alerta >= 1 ? 0.65 : 0.42, alt: 0.07, kind: "volcan",
          label: v.nombre,
          tooltip: `<div style="font:12px monospace;color:#c9d6ea;background:#0b0f1a;border:1px solid rgba(120,160,220,.3);padding:6px 8px;border-radius:8px"><b>${v.nombre}</b><br/>Nivel ${v.alerta} · ${v.aviacion ?? ""}<br/>SO₂ ${v.so2_td ?? 0} t/día · ${v.sismos ?? 0} sismos/24h</div>`,
          raw: v,
        });
        lbl.push({ lat: v.lat, lng: v.lng, text: v.nombre });
        if (v.alerta >= 1) rgs.push({ lat: v.lat, lng: v.lng, color: v.alerta >= 2 ? "#ff6b6b" : "#ffb84d" });
      }
    }
    if (layers.so2) {
      for (const s of data.so2Points) {
        const high = (s.so2 ?? 0) >= 15;
        pts.push({
          lat: s.lat, lng: s.lng, color: high ? "#ffb84d" : "#4d9bff", r: 0.4, alt: 0.04, kind: "so2",
          label: "SO₂",
          tooltip: `<div style="font:12px monospace;color:#c9d6ea;background:#0b0f1a;border:1px solid rgba(120,160,220,.3);padding:6px 8px;border-radius:8px">Sentinel-5P SO₂<br/>${s.so2 ?? "—"} DU · O₃ ${s.o3 ?? "—"}</div>`,
          raw: s,
        });
        if (high) rgs.push({ lat: s.lat, lng: s.lng, color: "#ffb84d" });
      }
    }
    if (layers.ndvi) {
      for (const n of data.ndviPoints) {
        pts.push({
          lat: n.lat, lng: n.lng, color: "#34e1d4", r: 0.36, alt: 0.03, kind: "ndvi",
          label: "NDVI",
          tooltip: `<div style="font:12px monospace;color:#c9d6ea;background:#0b0f1a;border:1px solid rgba(120,160,220,.3);padding:6px 8px;border-radius:8px">Sentinel-2 NDVI ${n.ndvi ?? "—"}<br/>EVI ${n.evi ?? "—"}</div>`,
          raw: n,
        });
      }
    }
    return { points: pts, rings: rgs, labels: lbl };
  }, [data, layers]);

  const sstValues = (data?.sstNino34 ?? []).map((r) => Number(r.sst ?? 0)).filter((n) => n > 0);
  const latestSo2 = data?.so2Points?.[0]?.so2 ?? null;
  const schemaErr =
    !loading && data && (data.error || (data.errors && data.errors.length > 0)) &&
    data.volcanoes.length === 0 && data.so2Points.length === 0;

  const LayerToggle = ({ k, label, dot }: { k: keyof typeof layers; label: string; dot: string }) => (
    <button
      onClick={() => setLayers((s) => ({ ...s, [k]: !s[k] }))}
      className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12px] transition ${
        layers[k] ? "border-cyan/40 bg-cyan/[0.07] text-white" : "border-line bg-white/[0.02] text-muted"
      }`}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: layers[k] ? dot : "transparent", border: `1.5px solid ${dot}` }} />
      {label}
    </button>
  );

  return (
    <div className="relative h-screen w-full overflow-hidden grid-bg">
      {/* Globo de fondo */}
      <div className="absolute inset-0">
        {!schemaErr && <GlobeImpl points={points} rings={rings} labels={labels} onSelect={setSel} />}
      </div>

      {/* Topbar */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center gap-3 border-b border-line bg-ink/55 px-5 py-2.5 backdrop-blur-xl">
        <Logo size={30} />
        <div className="display text-[14px] font-700 tracking-[0.2em] text-white">
          CAIA <span className="text-cyan">·</span> SCADA SATELITAL 3D
        </div>
        <div className="ml-4 hidden items-center gap-2 rounded-full border border-line bg-white/[0.03] px-3 py-1 font-mono text-[11px] text-muted md:flex">
          <span className="text-cyan">idworld</span> · SteamFire · AyA · COSA
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Clock />
          <span className="flex items-center gap-1.5 rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1">
            <span className="h-2 w-2 animate-pulseDot rounded-full bg-cyan" />
            <span className="font-mono text-[10px] font-700 uppercase tracking-widest text-cyan">En vivo</span>
          </span>
          <Link href="/" className="rounded-lg border border-line px-3 py-1 font-mono text-[11px] text-muted transition hover:border-cyan/40 hover:text-cyan">
            ← Centro de Comando
          </Link>
        </div>
      </header>

      {/* Panel izquierdo: capas */}
      <aside className="absolute left-5 top-20 z-20 w-60 glass p-4">
        <div className="label mb-3">Capas satelitales</div>
        <div className="space-y-2">
          <LayerToggle k="volcan" label="Volcanes · USGS" dot="#ff6b6b" />
          <LayerToggle k="so2" label="SO₂ · Sentinel-5P" dot="#4d9bff" />
          <LayerToggle k="ndvi" label="NDVI · Sentinel-2" dot="#34e1d4" />
        </div>
        <div className="mt-4 border-t border-line pt-3 font-mono text-[10px] text-muted">
          {loading ? "Cargando…" : `${data?.volcanoes.length ?? 0} volcanes · ${data?.so2Points.length ?? 0} SO₂ · ${data?.ndviPoints.length ?? 0} NDVI`}
        </div>
      </aside>

      {/* Panel derecho: telemetría */}
      <aside className="scroll-thin absolute right-5 top-20 z-20 w-72 space-y-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 11rem)" }}>
        <div className="glass p-4">
          <div className="label mb-1">Temperatura superficial (SST · Niño 3.4)</div>
          <div className="flex items-end justify-between">
            <Sparkline values={sstValues} />
            <div className="text-right">
              <div className="display text-2xl font-700 text-azul">{fmtNum(data?.sstLatest?.sst, 1)}°C</div>
              <div className="font-mono text-[10px] text-ambar">anom +{fmtNum(data?.sstLatest?.anomaly, 1)}°C</div>
            </div>
          </div>
          {data?.sstLatest?.el_nino && (
            <div className="mt-2 font-mono text-[10px] text-muted">
              {data.sstLatest.el_nino} · prob {fmtNum(data.sstLatest.prob, 0)}%
            </div>
          )}
        </div>

        <div className="glass p-4">
          <div className="label mb-1">Calidad de aire · SO₂ (Sentinel-5P)</div>
          <div className="flex items-center justify-center">
            <Gauge value={Number(latestSo2 ?? 0)} max={30} label={Number(latestSo2 ?? 0) < 5 ? "Bajo" : Number(latestSo2 ?? 0) < 15 ? "Moderado" : "Alto"} />
          </div>
          <div className="text-center font-mono text-[10px] text-muted">Dobson Units · último dato</div>
        </div>

        <div className="glass p-4">
          <div className="label mb-2">Alarmas activas</div>
          <div className="space-y-1.5">
            {(data?.alarmas ?? []).length === 0 && <div className="font-mono text-[11px] text-muted">Sin alarmas activas</div>}
            {(data?.alarmas ?? []).map((a, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${a.severidad === "crit" ? "bg-crit" : a.severidad === "warn" ? "bg-ambar" : "bg-azul"}`} />
                <div>
                  <div className="text-[12px] text-white">{a.titulo}</div>
                  <div className="font-mono text-[10px] text-muted">{a.detalle}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Detalle de punto seleccionado */}
      {sel && (
        <div className="absolute bottom-24 left-1/2 z-30 w-[340px] -translate-x-1/2 glass p-4">
          <div className="flex items-start justify-between">
            <div className="display text-sm font-700 text-white">{sel.label}</div>
            <button onClick={() => setSel(null)} className="font-mono text-xs text-muted hover:text-cyan">✕</button>
          </div>
          <div className="mt-1 font-mono text-[11px] text-muted">
            {sel.lat.toFixed(3)}, {sel.lng.toFixed(3)} · capa {sel.kind}
          </div>
          <pre className="scroll-thin mt-2 max-h-40 overflow-auto rounded-lg border border-line bg-ink/60 p-2 font-mono text-[10px] text-cyan/90">
            {JSON.stringify(sel.raw, null, 2)}
          </pre>
        </div>
      )}

      {/* Timeline inferior */}
      <footer className="absolute inset-x-0 bottom-0 z-20 border-t border-line bg-ink/55 px-5 py-3 backdrop-blur-xl">
        <div className="label mb-2">Línea de tiempo · pasadas satelitales</div>
        <div className="relative h-1.5 w-full rounded-full bg-white/[0.06]">
          <div className="absolute left-0 top-0 h-full w-2/3 rounded-full bg-gradient-to-r from-azul to-cyan" />
        </div>
      </footer>

      {/* Overlay: schemas no expuestos */}
      {schemaErr && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/70 backdrop-blur-sm">
          <div className="glass max-w-md p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-cyan/30 bg-cyan/10 text-xl">🛰️</div>
            <p className="display text-sm font-600 text-white">Schemas satelitales no expuestos</p>
            <p className="mt-2 text-[12px] leading-relaxed text-[#8fa3bf]">
              Para ver el globo con datos reales, exponé los schemas <span className="text-cyan">clima</span> y{" "}
              <span className="text-cyan">vulcano</span> en Supabase → Settings → API → Exposed schemas.
              (Ambos tienen RLS habilitado → seguros de exponer.)
            </p>
            <p className="mt-3 break-words font-mono text-[10px] text-muted">{data?.error || data?.errors?.[0]}</p>
          </div>
        </div>
      )}
    </div>
  );
}
