import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, UserPlus, ChevronRight, Stethoscope } from 'lucide-react';
import { useFetch, useDebounced } from '../../lib/hooks';
import { PageHeader, Avatar, Empty, Spinner } from '../../components/ui';
import { fmtDate, num } from '../../lib/format';
import DoctorStatus from '../../components/DoctorStatus';

export default function AdminDoctors() {
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);
  const { data, loading } = useFetch(`/admin/doctors?q=${encodeURIComponent(dq)}`, { keep: true });
  return (
    <div className="animate-in">
      <PageHeader eyebrow="Accounts" title="Doctors" subtitle="Every doctor account on the platform, with their clinics and sign-in status."
        actions={<Link to="/admin/doctors/new" className="btn-primary"><UserPlus size={17} /> New doctor</Link>} />
      <div className="relative mb-5">
        <Search size={18} className="absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
        <input className="input h-12 pl-11 text-base" placeholder="Search by name, email, mobile or city…" value={q} onChange={(e) => setQ(e.target.value)} />
        {loading && <Spinner className="absolute top-1/2 right-4 -translate-y-1/2" />}
      </div>
      <div className="card overflow-hidden">
        {data && !data.length && <Empty icon={Stethoscope} title="No doctors found" action={<Link to="/admin/doctors/new" className="btn-primary"><UserPlus size={16} /> Create the first one</Link>} />}
        <div className="hidden grid-cols-[2fr_1.3fr_0.8fr_0.8fr_1fr_1fr_20px] gap-4 border-b border-line bg-slate-50/70 px-5 py-3 text-[11px] font-bold tracking-wider text-muted uppercase lg:grid">
          <span>Doctor</span><span>Contact</span><span>Clinics</span><span>Patients</span><span>Status</span><span>Last sign-in</span><span />
        </div>
        <ul className="divide-y divide-line/70">
          {data?.map((d) => (
            <li key={d.id}>
              <Link to={`/admin/doctors/${d.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 transition hover:bg-brand-50/50 lg:grid-cols-[2fr_1.3fr_0.8fr_0.8fr_1fr_1fr_20px]">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={d.full_name} className="size-10 text-xs" />
                  <div className="min-w-0"><div className="truncate font-semibold">{d.full_name}</div><div className="truncate text-xs text-muted">{{ clinic: 'Clinic owner', freelance: 'Freelance', both: 'Clinic + freelance' }[d.practice_type]}{(d.specialization || d.qualification) && ` · ${d.specialization || d.qualification}`}</div></div>
                </div>
                <div className="min-w-0 text-sm max-lg:hidden"><div className="truncate">{d.email}</div><div className="truncate text-xs text-muted">{[d.phone, d.city].filter(Boolean).join(' · ') || '—'}</div></div>
                <span className="text-sm font-semibold tabular max-lg:hidden">{d.clinics_owned} <span className="font-normal text-muted">/ {d.max_clinics}</span></span>
                <span className="text-sm tabular max-lg:hidden">{num(d.patients)}</span>
                <span className="max-lg:col-start-2 max-lg:row-start-1"><DoctorStatus d={d} /></span>
                <span className="text-sm text-muted max-lg:hidden">{d.last_login_at ? fmtDate(d.last_login_at.slice(0, 10)) : 'Never'}</span>
                <ChevronRight size={18} className="text-slate-300 max-lg:hidden" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
