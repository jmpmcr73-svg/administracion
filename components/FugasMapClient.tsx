"use client";

import dynamic from "next/dynamic";
import type { PoiFuga, Zona } from "@/lib/types";

const FugasMap = dynamic(() => import("./FugasMap"), {
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

export default function FugasMapClient(props: { pois: PoiFuga[]; zonas: Zona[] }) {
  return <FugasMap {...props} />;
}
