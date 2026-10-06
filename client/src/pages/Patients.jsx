import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Users, UserPlus, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/authCtx';
import { useFetch, useDebounced } from '../lib/hooks';
import { PageHeader, Empty, Avatar, Spinner } from '../components/ui';
import { caseFmt, fmtDate } from '../lib/format';

export default function Patients() {
  const { clinicId, clinic } = useAuth();
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);
  const { data, loading } = useFetch(clinicId ? `/patients?clinicId=${clinicId}&limit=60&q=${encodeURIComponent(dq)}` : null, { keep: true });

  return (
    <div className="animate-in">
      <PageHeader eyebrow={clinic?.name} title="Patients" subtitle="Search by name, case ID or mobile. A 9-digit case ID also finds patients registered at your other clinics."
        actions={<Link to="/app/register" className="btn-primary"><UserPlus size={17} /> New case</Link>} />
      <div className="relative mb-5">
        <Search size={18} className="absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
        <input autoFocus className="input h-12 pl-11 text-base" placeholder="Search patients…" value={q} onChange={(e) => setQ(e.target.value)} />
        {loading && <Spinner className="absolute top-1/2 right-4 -translate-y-1/2" />}
      </div>
      <div className="card overflow-hidden">
        {data && !data.length && <Empty icon={Users} title="No patients found" text="Try another spelling, the 9-digit case ID or the mobile number." />}
        <div className="hidden grid-cols-[2fr_1fr_1fr_1.4fr_1fr_24px] gap-4 border-b border-line bg-slate-50/70 px-5 py-3 text-[11px] font-bold tracking-wider text-muted uppercase md:grid">
          <span>Patient</span><span>Case ID</span><span>Mobile</span><span>Known case of</span><span>Last visit</span><span />
        </div>
        <ul className="divide-y divide-line/70">
          {data?.map((p) => (
            <li key={p.id}>
              <Link to={`/app/patients/${p.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 transition hover:bg-brand-50/50 md:grid-cols-[2fr_1fr_1fr_1.4fr_1fr_24px]">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={p.full_name} className="size-10 text-xs" />
                  <div className="min-w-0"><div className="truncate font-semibold">{p.full_name}</div><div className="text-xs text-muted">{p.age} yrs · {p.gender}{p.clinic_id !== clinicId && <span className="ml-1.5 rounded-full bg-sky-50 px-1.5 font-semibold text-sky-700">from {p.home_clinic}</span>}</div></div>
                </div>
                <span className="font-mono text-sm text-slate-600 max-md:hidden">{caseFmt(p.case_no)}</span>
                <span className="text-sm text-slate-600 tabular max-md:hidden">{p.phone || '—'}</span>
                <div className="flex flex-wrap gap-1 max-md:hidden">{p.known_conditions.slice(0, 3).map((c) => <span key={c} className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">{c}</span>)}</div>
                <span className="text-sm text-muted max-md:col-start-2 max-md:row-start-1">{p.last_visit ? fmtDate(p.last_visit) : 'Not seen'}</span>
                <ChevronRight size={18} className="text-slate-300 max-md:hidden" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
