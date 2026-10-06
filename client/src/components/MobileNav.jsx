import { useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { CircleEllipsis, X, Download, Share } from 'lucide-react';
import { toast } from 'sonner';
import { useInstallPrompt } from '../lib/pwa';
import { ModeSegmented } from './ModeToggle';

function InstallTile() {
  const { installed, canInstall, iosHint, install } = useInstallPrompt();
  if (installed) return null;
  if (canInstall) {
    return (
      <button onClick={async () => { if (await install()) toast.success('CareNest added to your home screen'); }}
        className="flex w-full items-center gap-3 rounded-2xl bg-brand-500 px-4 py-3 text-left text-white">
        <Download size={20} /><span className="flex-1"><b className="block text-sm">Install the app</b><span className="text-xs opacity-80">Opens full-screen from your home screen</span></span>
      </button>
    );
  }
  if (iosHint) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
        <Share size={20} className="shrink-0" /><span>To install: tap <b>Share</b> in Safari, then <b>Add to Home Screen</b>.</span>
      </div>
    );
  }
  return null;
}

/**
 * Phone navigation: four tabs, a raised centre action and a "More" sheet that reaches every other screen.
 * tabs: [{ to, label, icon, end? }] (exactly 4 recommended), fab: { to, label, icon }, more: [{ to, label, icon, hint }]
 */
export default function MobileNav({ tabs, fab, more = [], header, footer }) {
  const { pathname } = useLocation();
  // remembers the page it was opened on, so navigating anywhere closes it
  const [openAt, setOpenAt] = useState(null);
  const open = openAt === pathname;
  const left = tabs.slice(0, 2);
  const right = tabs.slice(2);
  const moreActive = more.some((m) => pathname.startsWith(m.to));

  const tab = ({ to, label, icon: Icon, end }) => (
    <NavLink key={to} to={to} end={end} className={({ isActive }) => clsx('flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-semibold', isActive ? 'text-brand-700' : 'text-slate-500')}>
      {({ isActive }) => (<><span className={clsx('grid h-8 w-14 place-items-center rounded-full transition', isActive && 'bg-brand-100')}><Icon size={21} strokeWidth={isActive ? 2.4 : 2} /></span>{label}</>)}
    </NavLink>
  );

  return (
    <>
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-white/90 pb-safe backdrop-blur-xl lg:hidden" aria-label="Main">
        <div className="mx-auto flex max-w-lg items-end">
          {left.map(tab)}
          {fab && (
            <Link to={fab.to} className="flex flex-1 flex-col items-center gap-0.5 pb-1.5 text-[11px] font-semibold text-brand-700" aria-label={fab.label}>
              <span className="-mt-5 grid size-14 place-items-center rounded-2xl bg-brand-500 text-white shadow-[0_10px_24px_-8px_var(--brand-500)] ring-4 ring-[var(--page)] transition active:scale-95">
                <fab.icon size={24} strokeWidth={2.4} />
              </span>
              {fab.label}
            </Link>
          )}
          {right.map(tab)}
          <button onClick={() => setOpenAt(open ? null : pathname)} aria-expanded={open}
            className={clsx('flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-semibold', open || moreActive ? 'text-brand-700' : 'text-slate-500')}>
            <span className={clsx('grid h-8 w-14 place-items-center rounded-full transition', (open || moreActive) && 'bg-brand-100')}><CircleEllipsis size={21} /></span>More
          </button>
        </div>
      </nav>

      {open && createPortal(
        <div className="fixed inset-0 z-40 flex items-end bg-black/40 lg:hidden" onClick={() => setOpenAt(null)}>
          <div className="animate-sheet max-h-[85dvh] w-full overflow-y-auto rounded-t-[28px] bg-[var(--page)] px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] shadow-lift" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300" />
            <div className="mb-4 flex items-center justify-between">
              {header}
              <button className="btn-ghost p-2" onClick={() => setOpenAt(null)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {more.map(({ to, label, icon: Icon, hint }) => {
                const active = pathname.startsWith(to);
                return (
                  <Link key={to} to={to} className={clsx('flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition', active ? 'border-brand-300 bg-brand-50' : 'border-line bg-white')}>
                    <span className={clsx('grid size-11 place-items-center rounded-2xl', active ? 'bg-brand-500 text-white' : 'bg-brand-100 text-brand-700')}><Icon size={21} /></span>
                    <span className="text-[13px] leading-tight font-semibold">{label}</span>
                    {hint && <span className="-mt-1.5 text-[10px] leading-tight text-muted">{hint}</span>}
                  </Link>
                );
              })}
            </div>
            <div className="mt-4 space-y-3">
              <InstallTile />
              <div className="rounded-2xl border border-line bg-white p-3">
                <div className="mb-2 text-[11px] font-bold tracking-wider text-muted uppercase">Appearance</div>
                <div className="overflow-x-auto no-scrollbar"><ModeSegmented /></div>
              </div>
              {footer}
            </div>
          </div>
        </div>,
        document.getElementById('root'),
      )}
    </>
  );
}
