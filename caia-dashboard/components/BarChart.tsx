"use client";

import { fmtInt } from "@/lib/format";
import type { Conteo } from "@/lib/types";

const PALETTE = ["#34e1d4", "#4d9bff", "#9b8cff", "#ffb84d"];

export function BarChart({
  data,
  max,
  onSelect,
  active,
}: {
  data: Conteo[];
  max?: number;
  onSelect?: (label: string) => void;
  active?: string;
}) {
  const top = max ? data.slice(0, max) : data;
  const peak = Math.max(1, ...top.map((d) => d.n));

  return (
    <div className="scroll-thin max-h-[420px] space-y-2 overflow-y-auto pr-1">
      {top.map((d, i) => {
        const pct = (d.n / peak) * 100;
        const color = PALETTE[i % PALETTE.length];
        const isActive = active === d.label;
        return (
          <button
            key={d.label}
            type="button"
            onClick={onSelect ? () => onSelect(d.label) : undefined}
            className={`group block w-full text-left ${onSelect ? "cursor-pointer" : "cursor-default"}`}
          >
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span
                className={`truncate font-mono text-[11px] ${
                  isActive ? "text-white" : "text-[#9fb2cc] group-hover:text-white"
                }`}
                title={d.label}
              >
                {d.label}
              </span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted">
                {fmtInt(d.n)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.04]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${color}, ${color}66)`,
                  boxShadow: isActive ? `0 0 12px ${color}99` : "none",
                }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
