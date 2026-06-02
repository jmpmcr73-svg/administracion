import { ReactNode } from "react";

export interface TimelineItem {
  id: string;
  title: string;
  meta?: string;
  body?: ReactNode;
  accent?: "cyan" | "azul" | "violeta" | "ambar";
}

const dot: Record<string, string> = {
  cyan: "bg-cyan",
  azul: "bg-azul",
  violeta: "bg-violeta",
  ambar: "bg-ambar",
};

export function Timeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return <p className="font-mono text-xs text-muted">Sin registros.</p>;
  }
  return (
    <ol className="scroll-thin relative max-h-[420px] space-y-4 overflow-y-auto pl-5 pr-1">
      <span className="absolute left-[5px] top-1 h-[calc(100%-0.5rem)] w-px bg-line" />
      {items.map((it) => (
        <li key={it.id} className="relative">
          <span
            className={`absolute -left-[18px] top-1 h-2.5 w-2.5 rounded-full ${dot[it.accent ?? "cyan"]} ring-4 ring-ink`}
          />
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[12px] font-700 text-white">{it.title}</p>
            {it.meta && <span className="shrink-0 font-mono text-[10px] text-muted">{it.meta}</span>}
          </div>
          {it.body && <div className="mt-0.5 text-[11px] leading-relaxed text-[#8fa3bf]">{it.body}</div>}
        </li>
      ))}
    </ol>
  );
}
