import clsx from 'clsx';
import { Check } from 'lucide-react';
import { THEMES, palette } from '../lib/themes';

export default function ThemePicker({ value, onChange, size = 'md' }) {
  return (
    <div className="flex flex-wrap gap-3">
      {THEMES.map((t) => {
        const p = palette(t.id);
        const on = value === t.id;
        return (
          <button key={t.id} type="button" onClick={() => onChange(t.id)} title={t.name}
            className={clsx('group flex flex-col items-center gap-1.5', size === 'sm' && 'gap-1')}>
            <span
              className={clsx('relative grid place-items-center rounded-2xl ring-offset-2 transition-all',
                size === 'sm' ? 'size-9' : 'size-12', on ? 'ring-2 scale-105' : 'group-hover:scale-105')}
              style={{ background: `linear-gradient(135deg, ${p[200]}, ${p[400]} 60%, ${p[600]})`, '--tw-ring-color': p[500] }}>
              {on && <Check size={size === 'sm' ? 15 : 18} className="text-white drop-shadow" strokeWidth={3} />}
            </span>
            {size !== 'sm' && <span className={clsx('text-xs font-semibold', on ? 'text-ink' : 'text-muted')}>{t.name}</span>}
          </button>
        );
      })}
    </div>
  );
}
