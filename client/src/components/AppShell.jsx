import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import clsx from 'clsx';
import { toast } from 'sonner';
import {
  CalendarClock, UserPlus, Stethoscope, Users, BarChart3, Wallet, Building2, Settings, LogOut, Search, ChevronDown, Check, Palette, Menu, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLive, useHotkey } from '../lib/hooks';
import { api } from '../lib/api';
import { Wordmark } from './Brand';
import { Avatar } from './ui';
import ThemePicker from './ThemePicker';
import CommandSearch from './CommandSearch';
import { palette } from '../lib/themes';

const NAV = [
  { to: '/app/today', label: 'Today', icon: CalendarClock, hint: 'Day queue' },
  { to: '/app/register', label: 'New case', icon: UserPlus, hint: 'Register patient' },
  { to: '/app/consult', label: 'Consult room', icon: Stethoscope, doctor: true, hint: 'Live patient' },
  { to: '/app/patients', label: 'Patients', icon: Users, hint: 'Case files' },
  { to: '/app/dashboard', label: 'Insights', icon: BarChart3, doctor: true, hint: 'Analytics' },
  { to: '/app/accounts', label: 'Accounts', icon: Wallet, doctor: true, hint: 'Income & expenses' },
  { to: '/app/clinics', label: 'Clinics', icon: Building2, doctor: true, hint: 'Clinic mapping & staff' },
  { to: '/app/settings', label: 'Settings', icon: Settings, hint: 'Profile & theme' },
];

function ClinicSwitcher() {
  const { clinics, clinic, setClinicId, isDoctor, upsertClinic } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  if (!clinic) return null;
  const setTheme = async (theme) => {
    upsertClinic({ ...clinic, theme });
    try { await api.patch(`/clinics/${clinic.id}`, { theme }); } catch (e) { toast.error(e.message); }
  };
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex max-w-[60vw] items-center gap-2.5 rounded-2xl border border-line bg-white/80 py-1.5 pr-3 pl-1.5 text-left transition hover:border-brand-300 sm:max-w-sm">
        <span className="grid h-8 min-w-8 shrink-0 place-items-center rounded-xl bg-brand-500 px-1.5 text-[10px] font-extrabold text-white">{clinic.code}</span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold">{clinic.name}</span>
          <span className="block truncate text-[11px] text-muted">{clinics.length > 1 ? `${clinics.length} clinics · tap to switch` : clinic.city || 'Your clinic'}</span>
        </span>
        <ChevronDown size={16} className={clsx('shrink-0 text-muted transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="animate-pop absolute top-full left-0 z-40 mt-2 w-80 rounded-3xl border border-line bg-white p-2 shadow-lift">
          <div className="px-3 pt-2 pb-1 text-[11px] font-bold tracking-wider text-muted uppercase">Switch clinic</div>
          {clinics.map((c) => (
            <button key={c.id} onClick={() => { setClinicId(c.id); setOpen(false); }}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-slate-50">
              <span className="size-4 rounded-full ring-4 ring-white" style={{ background: palette(c.theme)[400], boxShadow: `0 0 0 1px ${palette(c.theme)[300]}` }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{c.name}</span>
                <span className="block truncate text-xs text-muted">{c.city || c.code}</span>
              </span>
              {c.id === clinic.id && <Check size={16} className="text-brand-600" />}
            </button>
          ))}
          {isDoctor && (
            <>
              <div className="mx-3 my-2 border-t border-line" />
              <div className="flex items-center gap-2 px-3 pb-2 text-[11px] font-bold tracking-wider text-muted uppercase"><Palette size={13} /> Colour for this clinic</div>
              <div className="px-3 pb-3"><ThemePicker size="sm" value={clinic.theme} onChange={setTheme} /></div>
              <Link to="/app/clinics" onClick={() => setOpen(false)} className="btn-soft w-full">Manage clinics</Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function AppShell() {
  const { user, clinicId, isDoctor, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);

  // One live connection for the whole app; pages listen via a window event.
  const connected = useLive(clinicId, (type, data) => {
    window.dispatchEvent(new CustomEvent('cn:live', { detail: { type, ...data } }));
    if (type === 'display' && isDoctor && !location.pathname.startsWith('/app/consult')) {
      toast('Patient sent in', {
        description: 'A new case is waiting on your screen.',
        action: { label: 'Open', onClick: () => navigate('/app/consult') },
        duration: 8000,
      });
    }
  });

  useHotkey('mod+k', () => setSearchOpen(true));
  useHotkey('n', () => navigate('/app/register'));
  useHotkey('t', () => navigate('/app/today'));
  useEffect(() => setDrawer(false), [location.pathname]);

  const items = NAV.filter((n) => !n.doctor || isDoctor);
  const mobileTabs = items.filter((n) => ['/app/today', '/app/register', isDoctor ? '/app/consult' : '/app/patients', isDoctor ? '/app/dashboard' : '/app/settings'].includes(n.to));

  const navList = (
    <nav className="flex flex-col gap-1">
      {items.map(({ to, label, icon: Icon, hint }) => (
        <NavLink key={to} to={to}
          className={({ isActive }) => clsx('group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition',
            isActive ? 'bg-brand-500 text-white shadow-[0_8px_20px_-8px_var(--brand-500)]' : 'text-slate-600 hover:bg-white hover:text-ink')}>
          {({ isActive }) => (
            <>
              <Icon size={19} strokeWidth={isActive ? 2.4 : 2} />
              <span className="flex-1">{label}</span>
              <span className={clsx('text-[11px] font-medium', isActive ? 'text-white/75' : 'text-slate-400 opacity-0 group-hover:opacity-100')}>{hint}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );

  const userCard = (
    <div className="rounded-3xl border border-line/70 bg-white/70 p-3">
      <div className="flex items-center gap-3">
        <Avatar name={user.full_name} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{user.full_name}</div>
          <div className="text-xs text-muted capitalize">{user.role}</div>
        </div>
        <button onClick={() => { logout(); navigate('/login'); }} className="btn-ghost p-2" title="Sign out"><LogOut size={17} /></button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh overflow-x-clip lg:pl-72">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col gap-6 border-r border-line/70 bg-white/40 p-5 backdrop-blur-xl lg:flex">
        <Wordmark />
        {navList}
        <div className="mt-auto space-y-3">
          <div className="rounded-2xl bg-brand-50 px-3 py-2.5 text-xs text-brand-800">
            <b>Shortcuts</b> · <span className="kbd">N</span> new case · <span className="kbd">T</span> today · <span className="kbd">Ctrl K</span> search
          </div>
          {userCard}
        </div>
      </aside>

      {/* Drawer (mobile) */}
      {drawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/25 backdrop-blur-[2px] lg:hidden" onClick={() => setDrawer(false)}>
          <aside className="animate-in flex h-full w-80 max-w-[85vw] flex-col gap-6 bg-[oklch(0.985_0.004_260)] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><Wordmark /><button className="btn-ghost p-2" onClick={() => setDrawer(false)}><X size={20} /></button></div>
            {navList}
            <div className="mt-auto">{userCard}</div>
          </aside>
        </div>
      )}

      {/* Top bar */}
      <header className="no-print sticky top-0 z-20 border-b border-line/60 bg-white/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
          <button className="btn-ghost -ml-2 p-2 lg:hidden" onClick={() => setDrawer(true)} aria-label="Menu"><Menu size={22} /></button>
          <ClinicSwitcher />
          <div className="flex-1" />
          <button onClick={() => setSearchOpen(true)} className="hidden items-center gap-2 rounded-2xl border border-line bg-white/80 px-3 py-2 text-sm text-muted transition hover:border-brand-300 md:flex md:w-72">
            <Search size={16} /> <span className="flex-1 text-left">Find patient, case ID, phone…</span> <span className="kbd">Ctrl K</span>
          </button>
          <button onClick={() => setSearchOpen(true)} className="btn-ghost p-2 md:hidden" aria-label="Search"><Search size={20} /></button>
          <div title={connected ? 'Live sync on — doctor & nurse screens update instantly' : 'Reconnecting…'}
            className={clsx('hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold sm:flex', connected ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
            <span className={clsx('size-2 rounded-full', connected ? 'live-dot bg-emerald-500' : 'bg-amber-400')} />
            {connected ? 'Live' : 'Offline'}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 pt-6 pb-28 sm:px-6 lg:pb-12">
        <Outlet />
      </main>

      {/* Bottom tabs (mobile) */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {mobileTabs.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => clsx('flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold', isActive ? 'text-brand-700' : 'text-slate-500')}>
              {({ isActive }) => (<><span className={clsx('grid h-8 w-12 place-items-center rounded-full transition', isActive && 'bg-brand-100')}><Icon size={20} /></span>{label}</>)}
            </NavLink>
          ))}
        </div>
      </nav>

      <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
