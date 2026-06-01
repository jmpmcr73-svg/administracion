"use client";

import { MapContainer, TileLayer, CircleMarker, Popup, GeoJSON } from "react-leaflet";
import type { PoiFuga, Zona } from "@/lib/types";
import { BASEMAP, MAP_DEFAULT } from "@/lib/config";
import { prioridadColor, fmtNum, fmtFechaCorta } from "@/lib/format";

export default function FugasMap({
  pois,
  zonas,
}: {
  pois: PoiFuga[];
  zonas: Zona[];
}) {
  const withCoords = pois.filter((p) => p.lat != null && p.lng != null);
  const center: [number, number] =
    withCoords.length > 0
      ? [withCoords[0].lat as number, withCoords[0].lng as number]
      : MAP_DEFAULT.center;

  return (
    <MapContainer
      center={center}
      zoom={MAP_DEFAULT.zoom}
      scrollWheelZoom
      style={{ height: "100%", width: "100%", borderRadius: 12 }}
    >
      <TileLayer
        url={BASEMAP.url}
        attribution={BASEMAP.attribution}
        subdomains={BASEMAP.subdomains}
        maxZoom={BASEMAP.maxZoom}
      />

      {zonas
        .filter((z) => z.geojson)
        .map((z) => (
          <GeoJSON
            key={z.id}
            data={z.geojson as GeoJSON.GeoJsonObject}
            style={{ color: "#00bcd4", weight: 1.5, fillOpacity: 0.05 }}
          />
        ))}

      {withCoords.map((p) => {
        const color = prioridadColor(p.prioridad);
        const r = p.prioridad === "alta" ? 11 : p.prioridad === "media" ? 9 : 7;
        return (
          <CircleMarker
            key={p.id}
            center={[p.lat as number, p.lng as number]}
            radius={r}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.55, weight: 2 }}
          >
            <Popup>
              <div style={{ minWidth: 180 }}>
                <strong>{p.id}</strong>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  Prioridad: <b style={{ color }}>{p.prioridad}</b>
                  <br />
                  Score: {fmtNum(p.score, 2)}
                  <br />
                  Caudal est.: {fmtNum(p.caudal_est_lpm, 1)} lpm
                  <br />
                  Estado: {p.estado ?? "—"}
                  <br />
                  Fuente: {p.fuente ?? "—"}
                  <br />
                  Zona: {p.zona_nombre ?? p.zona_id ?? "—"}
                  <br />
                  Detección: {fmtFechaCorta(p.fecha_deteccion)}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
