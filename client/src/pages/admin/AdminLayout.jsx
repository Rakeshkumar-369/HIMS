import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { LayoutDashboard, Stethoscope, UserPlus, ScrollText, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/authCtx';
import { Logo } from '../../components/Brand';
import { Avatar } from '../../components/ui';
import ModeToggle from '../../components/ModeToggle';
import MobileNav from '../../components/MobileNav';
import { applyTheme } from '../../lib/themes';

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/doctors', label: 'Doctors', icon: Stethoscope, end: true },
  { to: '/admin/doctors/new', label: 'New doctor', icon: UserPlus },
  { to: '/admin/audit', label: 'Security log', icon: ScrollText },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { applyTheme('ocean'); }, []);
  const signOut = () => logout().then(() => navigate('/login'));

  return (
    <div className="min-h-dvh overflow-x-clip lg:pl-72">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col gap-6 border-r border-line/70 bg-white/40 p-5 backdrop-blur-xl lg:flex">
        <div className="flex items-center gap-2.5">
          <Logo />
          <div className="leading-tight">
            <div className="text-[17px] font-bold tracking-tight">CareNest</div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-700"><ShieldCheck size={12} /> Platform admin</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => clsx('flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition',
                isActive ? 'bg-brand-500 text-white shadow-[0_8px_20px_-8px_var(--brand-500)]' : 'text-slate-600 hover:bg-white hover:text-ink')}>
              <Icon size={19} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-3xl border border-line/70 bg-white/70 p-3">
          <div className="flex items-center gap-3">
            <Avatar name={user.full_name} />
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{user.full_name}</div><div className="truncate text-xs text-muted">{user.email}</div></div>
            <button onClick={signOut} className="btn-ghost p-2" title="Sign out"><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-line/60 bg-white/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1300px] items-center gap-3 px-4 sm:px-6">
          <span className="flex items-center gap-2 lg:hidden"><Logo className="size-8" /><span className="leading-tight"><b className="block text-sm">CareNest</b><span className="text-[11px] font-bold text-brand-700">Platform admin</span></span></span>
          <div className="text-sm font-semibold text-muted max-lg:hidden">Accounts & clinics for every doctor on CareNest</div>
          <div className="flex-1" />
          <ModeToggle className="max-lg:hidden" />
        </div>
      </header>
      <main className="mx-auto max-w-[1300px] px-4 pt-5 pb-32 sm:px-6 sm:pt-6 lg:pb-16"><Outlet /></main>

      <MobileNav tabs={[NAV[0], NAV[1], NAV[3]]} fab={{ to: '/admin/doctors/new', label: 'New doctor', icon: UserPlus }}
        header={<div className="flex min-w-0 items-center gap-3"><Avatar name={user.full_name} /><div className="min-w-0"><div className="truncate font-bold">{user.full_name}</div><div className="truncate text-xs text-muted">{user.email}</div></div></div>}
        footer={<button onClick={signOut} className="btn-outline w-full py-3 text-rose-600"><LogOut size={17} /> Sign out</button>} />
    </div>
  );
}
