"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { Medicion } from "@/lib/types";

export default function TurbidezChart({ data }: { data: Medicion[] }) {
  const series = data
    .filter((m) => m.medido_at)
    .map((m) => ({
      fecha: new Date(m.medido_at as string).toLocaleDateString("es-CR", {
        day: "2-digit",
        month: "short",
      }),
      turbidez: m.turbidez_ntu != null ? Number(m.turbidez_ntu) : null,
      ce: m.ce_us_cm != null ? Number(m.ce_us_cm) : null,
    }));

  if (series.length === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center text-sm text-muted">
        Sin mediciones de calidad disponibles.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={series} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
        <XAxis dataKey="fecha" stroke="#4a6a8a" fontSize={11} />
        <YAxis stroke="#4a6a8a" fontSize={11} />
        <Tooltip
          contentStyle={{
            background: "#081320",
            border: "1px solid rgba(0,188,212,.25)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "#c8d8ea" }}
        />
        <Line
          type="monotone"
          dataKey="turbidez"
          name="Turbidez (NTU)"
          stroke="#ffab00"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
