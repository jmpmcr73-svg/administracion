"use client";

import dynamic from "next/dynamic";
import type { Fuente, AlertaViva } from "@/lib/types";

const FuentesMap = dynamic(() => import("./FuentesMap"), {
  ssr: false,
  loading: () => (
    <div
      className="h-full w-full rounded-xl flex items-center justify-center text-sm text-muted"
      style={{ background: "var(--bg3)" }}
    >
      Cargando mapa…
    </div>
  ),
});

export default function FuentesMapClient(props: {
  fuentes: Fuente[];
  alertas: AlertaViva[];
}) {
  return <FuentesMap {...props} />;
}
