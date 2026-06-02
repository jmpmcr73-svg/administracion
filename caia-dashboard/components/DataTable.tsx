"use client";

import { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty = "Sin datos",
  maxHeight = "560px",
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: string;
  maxHeight?: string;
}) {
  return (
    <div className="scroll-thin overflow-auto rounded-xl border border-line" style={{ maxHeight }}>
      <table className="w-full border-collapse text-left">
        <thead className="sticky top-0 z-10 bg-panel/95 backdrop-blur">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className="label whitespace-nowrap border-b border-line px-3 py-2.5"
                style={{ width: c.width }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center font-mono text-xs text-muted">
                {empty}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-line/60 transition-colors ${
                onRowClick ? "cursor-pointer hover:bg-cyan/[0.05]" : ""
              }`}
            >
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-2.5 align-middle text-[12px]">
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
