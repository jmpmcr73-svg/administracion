import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "DaVinci Hídrico — AyA",
  description:
    "Detección de fugas y monitoreo de fuentes de agua para AyA, Costa Rica.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@300;400;500;600;700;800;900&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="min-h-screen">
          <Sidebar />
          <main className="md:ml-[244px] min-h-screen">{children}</main>
        </div>
      </body>
    </html>
  );
}
