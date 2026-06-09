// GET /api/reportes/pdf/[reporte_id]
// Genera el PDF del reporte server-side con @react-pdf/renderer y lo devuelve
// con Content-Type: application/pdf.
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import React from "react";
import { supabaseAdmin, type Reporte } from "@/lib/supabase/server";

export const runtime = "nodejs";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, color: "#1a1a1a", fontFamily: "Helvetica" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottom: "2 solid #0a7d4f",
    paddingBottom: 8,
    marginBottom: 16,
  },
  brand: { fontSize: 16, fontWeight: 700, color: "#0a7d4f" },
  meta: { fontSize: 9, color: "#666", textAlign: "right" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 11, color: "#555", marginBottom: 16 },
  section: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#0a7d4f",
    marginBottom: 4,
  },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  key: { color: "#444" },
  val: { fontWeight: 700 },
  pre: { fontSize: 9, color: "#333", fontFamily: "Courier" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#999",
    textAlign: "center",
    borderTop: "1 solid #ddd",
    paddingTop: 6,
  },
});

function kvRows(obj: Record<string, unknown>) {
  return Object.entries(obj ?? {}).map(([k, v]) =>
    React.createElement(
      View,
      { key: k, style: styles.row },
      React.createElement(Text, { style: styles.key }, k),
      React.createElement(
        Text,
        { style: styles.val },
        typeof v === "object" ? JSON.stringify(v) : String(v),
      ),
    ),
  );
}

function ReportePDF({ r }: { r: Reporte }) {
  const fecha = new Date(r.created_at).toLocaleString("es-CR");
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      // header con marca Alejandría
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(Text, { style: styles.brand }, "Alejandría Steam Labs"),
        React.createElement(
          View,
          null,
          React.createElement(Text, { style: styles.meta }, `Fecha: ${fecha}`),
          React.createElement(
            Text,
            { style: styles.meta },
            `Autor: ${r.generado_por ?? "CAIA"}`,
          ),
        ),
      ),
      React.createElement(Text, { style: styles.title }, r.titulo ?? "Reporte"),
      React.createElement(
        Text,
        { style: styles.subtitle },
        `Tipo: ${r.tipo}  ·  País: ${r.pais_id ?? "—"}  ·  Estado: ${r.estado}`,
      ),
      // parámetros
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Parámetros"),
        ...kvRows(r.parametros),
      ),
      // contenido
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Resultados"),
        r.contenido && Object.keys(r.contenido).length > 0
          ? React.createElement(
              Text,
              { style: styles.pre },
              JSON.stringify(r.contenido, null, 2),
            )
          : React.createElement(
              Text,
              { style: styles.key },
              r.estado === "generando"
                ? "El reporte aún se está generando."
                : "Sin contenido.",
            ),
      ),
      React.createElement(
        Text,
        { style: styles.footer, fixed: true },
        `Alejandría Steam Labs / BIOTEC SV — Reporte ${r.reporte_id}`,
      ),
    ),
  );
}

export async function GET(
  _req: Request,
  { params }: { params: { reporte_id: string } },
) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("caia_reportes")
    .select("*")
    .eq("reporte_id", params.reporte_id)
    .single();

  if (error || !data) {
    return new Response("Reporte no encontrado", { status: 404 });
  }

  const buffer = await renderToBuffer(
    React.createElement(ReportePDF, { r: data as Reporte }),
  );

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="reporte-${params.reporte_id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
