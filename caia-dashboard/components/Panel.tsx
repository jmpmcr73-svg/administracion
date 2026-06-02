import { ReactNode } from "react";

export function Panel({
  title,
  subtitle,
  accent = "cyan",
  right,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  accent?: "cyan" | "azul" | "violeta" | "ambar";
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const bar: Record<string, string> = {
    cyan: "bg-cyan",
    azul: "bg-azul",
    violeta: "bg-violeta",
    ambar: "bg-ambar",
  };
  return (
    <section className={`glass p-5 ${className}`}>
      <div className="mb-4 flex items-start gap-3">
        <span className={`mt-1 h-3.5 w-1 rounded-full ${bar[accent]}`} />
        <div>
          <h2 className="display text-sm font-600 uppercase tracking-[0.16em] text-white">
            {title}
          </h2>
          {subtitle && <p className="label mt-0.5">{subtitle}</p>}
        </div>
        {right && <div className="ml-auto">{right}</div>}
      </div>
      {children}
    </section>
  );
}
