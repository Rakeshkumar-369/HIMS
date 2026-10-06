import { useState } from 'react';
import clsx from 'clsx';
import { Table2, BarChart3 } from 'lucide-react';

// Validated categorical slots (CVD-safe in this order). Single-series charts use the clinic's brand colour.
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a'];
export const GRID = 'oklch(0.93 0.006 260)';
export const AXIS = { fontSize: 11, fill: 'oklch(0.55 0.02 260)' };

export function ChartTooltip({ active, payload, label, fmt = (v) => v, labelFmt = (l) => l }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-36 rounded-2xl border border-line bg-white/95 px-3 py-2.5 shadow-lift backdrop-blur">
      <div className="mb-1.5 text-xs font-semibold text-muted">{labelFmt(label ?? payload[0]?.payload?.name)}</div>
      {payload.map((p) => (
        <div key={p.dataKey + p.name} className="flex items-center gap-2 py-0.5 text-sm">
          <span className="h-0.5 w-3 rounded-full" style={{ background: p.color || p.payload?.fill }} />
          <span className="font-bold tabular">{fmt(p.value)}</span>
          <span className="text-xs text-muted">{p.name}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          {i.line ? <span className="h-0.5 w-3.5 rounded-full" style={{ background: i.color }} /> : <span className="size-2.5 rounded-[3px]" style={{ background: i.color }} />}
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Card with title, optional legend, and a chart ⇄ table toggle (so no value is colour-only). */
export function ChartCard({ title, subtitle, legend, table, children, className, height = 260, action }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={clsx('card p-5', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold">{title}</h3>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1">
          {action}
          {table && (
            <button className="btn-ghost p-1.5" title={asTable ? 'Show chart' : 'Show as table'} onClick={() => setAsTable(!asTable)}>
              {asTable ? <BarChart3 size={16} /> : <Table2 size={16} />}
            </button>
          )}
        </div>
      </div>
      {legend && !asTable && <div className="mb-3">{legend}</div>}
      {asTable && table ? (
        <div className="scrollbar-thin overflow-auto" style={{ maxHeight: height }}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white"><tr>{table.columns.map((c, i) => <th key={c} className={clsx('py-1.5 text-xs font-semibold text-muted', i ? 'text-right' : 'text-left')}>{c}</th>)}</tr></thead>
            <tbody className="divide-y divide-line/70">{table.rows.map((r, j) => <tr key={j}>{r.map((v, i) => <td key={i} className={clsx('py-1.5', i ? 'text-right font-semibold tabular' : '')}>{v}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div style={{ height }}>{children}</div>
      )}
    </section>
  );
}

/** Horizontal ranked bar list — crisp for long medical names, no axis gymnastics. */
export function RankBars({ data, color = 'var(--brand-500)', fmt = (v) => v, empty = 'No data in this period' }) {
  if (!data?.length) return <div className="grid h-full place-items-center text-sm text-muted">{empty}</div>;
  const max = Math.max(...data.map((d) => d.n), 1);
  return (
    <ul className="scrollbar-thin h-full space-y-2.5 overflow-y-auto pr-1">
      {data.map((d) => (
        <li key={d.name} className="group" title={`${d.name}: ${fmt(d.n)}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate font-medium text-slate-700">{d.name}</span>
            <span className="font-bold tabular">{fmt(d.n)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full transition-all duration-500 group-hover:brightness-95" style={{ width: `${Math.max(2, (d.n / max) * 100)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
