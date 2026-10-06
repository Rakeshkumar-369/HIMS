import { useEffect } from 'react';
import clsx from 'clsx';
import { X, Loader2 } from 'lucide-react';
import { STATUS } from '../lib/constants';
import { initials } from '../lib/format';

export function Field({ label, hint, children, className, required }) {
  // Group-style controls (chip rows, pickers) must not sit inside <label>, or clicking the caption activates the first button.
  const Tag = [children].flat().some((c) => c && typeof c.type !== 'string') ? 'div' : 'label';
  return (
    <Tag className={clsx('block', className)}>
      {label && (
        <span className="label">
          {label}
          {required && <span className="text-rose-400"> *</span>}
        </span>
      )}
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </Tag>
  );
}

/** Pill selector. multi=true → value is an array. */
export function Chips({ options, value, onChange, multi = false, size = 'md', className, allowDeselect = true }) {
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const isOn = (v) => (multi ? (value || []).includes(v) : value === v);
  const toggle = (v) => {
    if (multi) onChange(isOn(v) ? value.filter((x) => x !== v) : [...(value || []), v]);
    else onChange(isOn(v) && allowDeselect ? '' : v);
  };
  return (
    <div className={clsx('flex flex-wrap gap-1.5', className)} role={multi ? 'group' : 'radiogroup'}>
      {opts.map((o) => (
        <button
          type="button"
          key={o.value}
          role={multi ? 'checkbox' : 'radio'}
          aria-checked={isOn(o.value)}
          onClick={() => toggle(o.value)}
          className={clsx('chip', isOn(o.value) && 'chip-on', size === 'sm' && 'px-2.5 py-1 text-xs')}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/25 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className={clsx('animate-pop flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-lift sm:rounded-3xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h3 className="text-lg font-bold">{title}</h3>
          <button className="btn-ghost -mr-2 p-2" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="scrollbar-thin overflow-y-auto px-6 pb-6">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export const Spinner = ({ className }) => <Loader2 className={clsx('animate-spin text-brand-500', className)} size={20} />;

export function PageLoader() {
  return <div className="flex h-64 items-center justify-center"><Spinner className="size-7" /></div>;
}

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {Icon && <div className="mb-4 grid size-16 place-items-center rounded-3xl bg-brand-50 text-brand-500"><Icon size={28} /></div>}
      <p className="font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.waiting;
  return <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', s.cls)}>{s.label}</span>;
}

export function Avatar({ name, className, tone = 'brand' }) {
  return (
    <div className={clsx('grid shrink-0 place-items-center rounded-2xl font-bold',
      tone === 'brand' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600', className || 'size-10 text-sm')}>
      {initials(name)}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-bold tracking-wider text-brand-600 uppercase">{eyebrow}</div>}
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Segmented({ options, value, onChange, className }) {
  return (
    <div className={clsx('inline-flex rounded-2xl border border-line bg-white p-1', className)}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        return (
          <button key={v} type="button" onClick={() => onChange(v)}
            className={clsx('rounded-xl px-3 py-1.5 text-[13px] font-semibold transition', value === v ? 'bg-brand-500 text-white shadow-sm' : 'text-muted hover:text-ink')}>
            {l}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="inline-flex items-center gap-2.5 text-sm font-medium">
      <span className={clsx('relative h-6 w-10 rounded-full transition', checked ? 'bg-brand-500' : 'bg-slate-200')}>
        <span className={clsx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
      {label}
    </button>
  );
}
