import clsx from 'clsx';
import { inr } from '../lib/format';

const TONES = {
  default: 'text-ink',
  good: 'text-emerald-700',
  bad: 'text-rose-600',
  warn: 'text-amber-700',
  brand: 'text-brand-700',
};

/** Compact money tile used across vendor and earnings screens. */
export function MoneyTile({ label, value, sub, tone = 'default', icon: Icon, money = true, onClick, active }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={clsx('card min-w-0 p-3.5 text-left sm:p-4', onClick && 'transition hover:shadow-lift', active && 'ring-2 ring-brand-300')}>
      <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-muted uppercase sm:text-xs">
        {Icon && <Icon size={14} className="shrink-0" />}<span className="truncate">{label}</span>
      </div>
      <div className={clsx('mt-1 truncate text-lg font-extrabold tabular sm:text-2xl', TONES[tone])}>{money ? inr(value) : value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-muted">{sub}</div>}
    </Tag>
  );
}

const PILL = {
  received: ['Received', 'bg-emerald-50 text-emerald-700'],
  paid: ['Paid', 'bg-emerald-50 text-emerald-700'],
  partial: ['Part paid', 'bg-amber-50 text-amber-800'],
  'part-paid': ['Part paid', 'bg-amber-50 text-amber-800'],
  pending: ['Pending', 'bg-sky-50 text-sky-700'],
  unpaid: ['Unpaid', 'bg-sky-50 text-sky-700'],
  overdue: ['Overdue', 'bg-rose-50 text-rose-700'],
  written_off: ['Written off', 'bg-slate-100 text-slate-500'],
  free: ['No charge', 'bg-slate-100 text-slate-500'],
  unbilled: ['Not delivered', 'bg-slate-100 text-slate-500'],
  ordered: ['Ordered', 'bg-sky-50 text-sky-700'],
  delivered: ['Delivered', 'bg-emerald-50 text-emerald-700'],
  cancelled: ['Cancelled', 'bg-slate-100 text-slate-500'],
};
const ORDER_PARTIAL = ['Partly delivered', 'bg-amber-50 text-amber-800'];

export function Pill({ status, kind }) {
  const [label, cls] = kind === 'order' && status === 'partial' ? ORDER_PARTIAL : PILL[status] || [status, 'bg-slate-100 text-slate-600'];
  return <span className={clsx('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap', cls)}>{label}</span>;
}
