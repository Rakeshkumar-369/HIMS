import clsx from 'clsx';
import { Sun, Moon, MonitorSmartphone } from 'lucide-react';
import { setModePref } from '../lib/themes';
import { useMode } from '../lib/hooks';

const NEXT = { light: 'dark', dark: 'system', system: 'light' };
const META = {
  light: { icon: Sun, label: 'Light' },
  dark: { icon: Moon, label: 'Dark' },
  system: { icon: MonitorSmartphone, label: 'Auto' },
};

/** One-tap cycle: Light → Dark → Auto (follow device). */
export default function ModeToggle({ className, withLabel }) {
  const { pref } = useMode();
  const { icon: Icon, label } = META[pref];
  return (
    <button type="button" onClick={() => setModePref(NEXT[pref])} title={`Appearance: ${label} — tap to change`}
      className={clsx('btn-ghost p-2', withLabel && 'px-3', className)} aria-label={`Appearance: ${label}`}>
      <Icon size={19} />{withLabel && <span>{label}</span>}
    </button>
  );
}

export function ModeSegmented() {
  const { pref } = useMode();
  return (
    <div className="inline-flex rounded-2xl border border-line bg-white p-1">
      {Object.entries(META).map(([k, { icon: Icon, label }]) => (
        <button key={k} type="button" onClick={() => setModePref(k)}
          className={clsx('inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition', pref === k ? 'bg-brand-500 text-white shadow-sm' : 'text-muted hover:text-ink')}>
          <Icon size={16} /> {label === 'Auto' ? 'Same as device' : label}
        </button>
      ))}
    </div>
  );
}
