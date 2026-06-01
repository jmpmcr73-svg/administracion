"use client";

import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import type { Fuente, AlertaViva } from "@/lib/types";
import { BASEMAP, MAP_DEFAULT } from "@/lib/config";
import { severidadBadge } from "@/lib/format";

const SEV_COLOR: Record<string, string> = {
  "b-crit": "#ff5252",
  "b-warn": "#ffab00",
  "b-ok": "#00d44c",
  "b-blue": "#448aff",
};

export default function FuentesMap({
  fuentes,
  alertas,
}: {
  fuentes: Fuente[];
  alertas: AlertaViva[];
}) {
  const withCoords = fuentes.filter((f) => f.lat != null && f.lng != null);
  const center: [number, number] =
    withCoords.length > 0
      ? [withCoords[0].lat as number, withCoords[0].lng as number]
      : MAP_DEFAULT.center;

  // Mapea fuente -> peor severidad de sus alertas vivas para colorear.
  const sevByFuente = new Map<string, string>();
  for (const a of alertas) {
    if (!a.fuente_id) continue;
    sevByFuente.set(a.fuente_id, SEV_COLOR[severidadBadge(a.severidad)] ?? "#448aff");
  }

  return (
    <MapContainer
      center={center}
      zoom={11}
      scrollWheelZoom
      style={{ height: "100%", width: "100%", borderRadius: 12 }}
    >
      <TileLayer
        url={BASEMAP.url}
        attribution={BASEMAP.attribution}
        subdomains={BASEMAP.subdomains}
        maxZoom={BASEMAP.maxZoom}
      />

      {withCoords.map((f) => {
        const color = sevByFuente.get(f.id) ?? "#00bcd4";
        const alertasFuente = alertas.filter((a) => a.fuente_id === f.id);
        return (
          <CircleMarker
            key={f.id}
            center={[f.lat as number, f.lng as number]}
            radius={10}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.5, weight: 2 }}
          >
            <Popup>
              <div style={{ minWidth: 200 }}>
                <strong>{f.nombre}</strong>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  Tipo: {f.tipo ?? "—"}
                  <br />
                  Planta: {f.planta_nombre ?? "—"}
                </div>
                {alertasFuente.length > 0 && (
                  <div style={{ fontSize: 12, marginTop: 6 }}>
                    <b>Alertas vivas:</b>
                    <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                      {alertasFuente.map((a) => (
                        <li key={a.id}>
                          {a.tipo} ({a.severidad}) — {a.mensaje}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
