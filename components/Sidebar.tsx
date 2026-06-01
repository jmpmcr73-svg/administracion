"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/fugas", label: "Fugas", icon: "💧" },
  { href: "/fuentes", label: "Fuentes", icon: "🛰️" },
  { href: "/cuadrillas", label: "Cuadrillas", icon: "🧰" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside
      className="hidden md:flex fixed top-0 left-0 z-40 w-[244px] min-h-screen flex-col border-r"
      style={{
        background: "linear-gradient(180deg,#030810,#06101e 60%,#081520)",
        borderColor: "var(--border)",
      }}
    >
      <div className="px-5 py-5 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="text-[15px] font-extrabold tracking-tight text-white">
          DaVinci <span className="text-teal">Hídrico</span>
        </div>
        <div className="text-[10px] mono text-muted mt-1">AyA · Costa Rica</div>
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
              style={{
                background: active ? "rgba(0,188,212,.12)" : "transparent",
                color: active ? "#4dd0e1" : "#7f9bb8",
                fontWeight: active ? 700 : 500,
              }}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t text-[10px] mono text-muted" style={{ borderColor: "var(--border)" }}>
        <div>move-idworld</div>
        <div className="opacity-60">davinci_fugas · davinci_fuentes</div>
      </div>
    </aside>
  );
}
