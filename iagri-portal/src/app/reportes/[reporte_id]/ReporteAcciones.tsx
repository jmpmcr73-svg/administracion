"use client";
// Botones cliente del reporte: descargar PDF y compartir link único.
import { useState } from "react";

export default function ReporteAcciones({ reporteId }: { reporteId: string }) {
  const [copiado, setCopiado] = useState(false);
  const pdfUrl = `/api/reportes/pdf/${reporteId}`;

  async function compartir() {
    const url = `${window.location.origin}/reportes/${reporteId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Reporte Alejandría", url });
        return;
      } catch {
        /* el usuario canceló: caemos a copiar */
      }
    }
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div style={{ display: "flex", gap: 12 }}>
      <a
        href={pdfUrl}
        download={`reporte-${reporteId}.pdf`}
        style={{
          background: "#0a7d4f",
          color: "#fff",
          padding: "10px 20px",
          borderRadius: 8,
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        ⬇ Descargar PDF
      </a>
      <button
        onClick={compartir}
        style={{
          background: "#fff",
          color: "#0a7d4f",
          border: "2px solid #0a7d4f",
          padding: "10px 20px",
          borderRadius: 8,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        {copiado ? "✓ Link copiado" : "🔗 Compartir"}
      </button>
    </div>
  );
}
