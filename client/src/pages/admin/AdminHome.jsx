import { Link } from 'react-router-dom';
import { Stethoscope, Building2, Users, Activity, UserPlus, ShieldAlert, ChevronRight } from 'lucide-react';
import { useFetch } from '../../lib/hooks';
import { PageHeader, PageLoader, Avatar } from '../../components/ui';
import { num, fmtDate, fmtTime } from '../../lib/format';
import { ACTION_LABEL } from '../../lib/auditLabels';

function Tile({ icon: Icon, label, value, sub }) {
  return (
    <div className="card p-5">
      <div className="grid size-10 place-items-center rounded-2xl bg-brand-100 text-brand-700"><Icon size={19} /></div>
      <div className="mt-4 text-[28px] leading-none font-extrabold tabular">{value}</div>
      <div className="mt-1.5 text-xs font-semibold text-muted">{label}{sub && <span className="font-normal"> · {sub}</span>}</div>
    </div>
  );
}

export default function AdminHome() {
  const stats = useFetch('/admin/stats');
  const doctors = useFetch('/admin/doctors');
  const alerts = useFetch('/admin/audit?limit=200');
  if (!stats.data) return <PageLoader />;
  const s = stats.data;
  const security = (alerts.data || []).filter((a) => ['login_failed', 'login_locked', 'portal_login_failed'].includes(a.action)).slice(0, 8);

  return (
    <div className="animate-in">
      <PageHeader eyebrow="Platform" title="Overview" subtitle="Everything running on CareNest at a glance."
        actions={<Link to="/admin/doctors/new" className="btn-primary"><UserPlus size={17} /> New doctor</Link>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={Stethoscope} label="Doctor accounts" value={num(s.doctors)} sub={`${num(s.activeDoctors)} active`} />
        <Tile icon={Building2} label="Clinics" value={num(s.clinics)} />
        <Tile icon={Users} label="Patients" value={num(s.patients)} />
        <Tile icon={Activity} label="Consultations" value={num(s.visits30)} sub="last 30 days" />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line/70 px-5 py-4">
            <h2 className="font-bold">Recently added doctors</h2>
            <Link to="/admin/doctors" className="text-sm font-semibold text-brand-700 hover:underline">See all</Link>
          </div>
          <ul className="divide-y divide-line/70">
            {(doctors.data || []).slice(0, 6).map((d) => (
              <li key={d.id}>
                <Link to={`/admin/doctors/${d.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-brand-50/50">
                  <Avatar name={d.full_name} className="size-10 text-xs" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{d.full_name}</div>
                    <div className="truncate text-xs text-muted">{d.email}{d.city && ` · ${d.city}`}</div>
                  </div>
                  <span className="text-xs text-muted tabular">{d.clinics_owned}/{d.max_clinics} clinics</span>
                  <ChevronRight size={16} className="text-slate-300" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line/70 px-5 py-4">
            <h2 className="flex items-center gap-2 font-bold"><ShieldAlert size={17} className="text-rose-500" /> Failed sign-ins</h2>
            <Link to="/admin/audit" className="text-sm font-semibold text-brand-700 hover:underline">Security log</Link>
          </div>
          {!security.length && <p className="px-5 py-8 text-center text-sm text-muted">No failed sign-ins recently. 🎉</p>}
          <ul className="divide-y divide-line/70">
            {security.map((a) => (
              <li key={a.id} className="px-5 py-3 text-sm">
                <div className="flex justify-between gap-3"><span className="font-semibold">{ACTION_LABEL[a.action] || a.action}</span><span className="shrink-0 text-xs text-muted">{fmtDate(a.at.slice(0, 10), { day: 'numeric', month: 'short' })} {fmtTime(a.at)}</span></div>
                <div className="truncate text-xs text-muted">{a.actor_name || a.detail || 'Unknown'} · IP {a.ip || '—'}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
