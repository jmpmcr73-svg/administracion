import React from "react";

export function Card({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-xl p-4 ${className}`}
      style={{ background: "var(--bg2)", border: "1px solid var(--border2)", ...style }}
    >
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  accent = "#4dd0e1",
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: string;
}) {
  return (
    <Card>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-2xl font-extrabold mono" style={{ color: accent }}>
        {value}
      </div>
      {sub ? <div className="text-[11px] text-muted mt-1">{sub}</div> : null}
    </Card>
  );
}

export function Badge({
  children,
  variant = "b-blue",
}: {
  children: React.ReactNode;
  variant?: "b-ok" | "b-warn" | "b-crit" | "b-blue" | "b-teal";
}) {
  return <span className={`badge ${variant}`}>{children}</span>;
}

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
      <div>
        <h1 className="text-xl font-extrabold text-white tracking-tight">{title}</h1>
        {subtitle ? <p className="text-sm text-muted mt-0.5">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function MobileNav() {
  return (
    <nav className="md:hidden flex gap-2 mb-4">
      {[
        { href: "/fugas", label: "Fugas" },
        { href: "/fuentes", label: "Fuentes" },
        { href: "/cuadrillas", label: "Cuadrillas" },
      ].map((i) => (
        <a
          key={i.href}
          href={i.href}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: "var(--bg2)", border: "1px solid var(--border2)", color: "#7f9bb8" }}
        >
          {i.label}
        </a>
      ))}
    </nav>
  );
}
