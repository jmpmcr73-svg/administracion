"use client";

import { useEffect, useRef, useState } from "react";
import Globe from "react-globe.gl";

export interface GlobePoint {
  lat: number;
  lng: number;
  color: string;
  r: number;
  alt: number;
  kind: "volcan" | "so2" | "ndvi";
  label: string;
  tooltip: string;
  raw: unknown;
}

export interface GlobeRing {
  lat: number;
  lng: number;
  color: string;
}

export default function GlobeImpl({
  points,
  rings,
  labels,
  onSelect,
}: {
  points: GlobePoint[];
  rings: GlobeRing[];
  labels: { lat: number; lng: number; text: string }[];
  onSelect: (p: GlobePoint) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const onReady = () => {
    const g = globeRef.current;
    if (!g) return;
    // Enfocar Centroamérica
    g.pointOfView({ lat: 12.5, lng: -87, altitude: 1.9 }, 0);
    const controls = g.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    controls.enableZoom = true;
  };

  return (
    <div ref={wrapRef} className="absolute inset-0 h-full w-full">
      <Globe
        ref={globeRef}
        width={size.w}
        height={size.h}
        onGlobeReady={onReady}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        showAtmosphere
        atmosphereColor="#34e1d4"
        atmosphereAltitude={0.18}
        pointsData={points}
        pointLat={(d: any) => d.lat}
        pointLng={(d: any) => d.lng}
        pointColor={(d: any) => d.color}
        pointAltitude={(d: any) => d.alt}
        pointRadius={(d: any) => d.r}
        pointLabel={(d: any) => d.tooltip}
        onPointClick={(d: any) => onSelect(d as GlobePoint)}
        pointsTransitionDuration={600}
        ringsData={rings}
        ringLat={(d: any) => d.lat}
        ringLng={(d: any) => d.lng}
        ringColor={(d: any) => {
          const c = d.color as string;
          return (t: number) => `${c}${Math.round((1 - t) * 200).toString(16).padStart(2, "0")}`;
        }}
        ringMaxRadius={5}
        ringPropagationSpeed={2}
        ringRepeatPeriod={900}
        labelsData={labels}
        labelLat={(d: any) => d.lat}
        labelLng={(d: any) => d.lng}
        labelText={(d: any) => d.text}
        labelSize={0.9}
        labelDotRadius={0.25}
        labelColor={() => "rgba(201,214,234,0.85)"}
        labelResolution={2}
      />
    </div>
  );
}
