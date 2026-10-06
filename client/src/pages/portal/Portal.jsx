import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Download, LogOut, CalendarHeart, Pill, FileText, FlaskConical, Building2, Printer } from 'lucide-react';
import { api, tokens } from '../../lib/api';
import { applyTheme } from '../../lib/themes';
import { PageLoader, Avatar } from '../../components/ui';
import { Logo } from '../../components/Brand';
import CaseSheet from '../../components/CaseSheet';
import PrintFrame from '../../components/PrintFrame';
import { caseFmt, fmtDate, todayISO } from '../../lib/format';

export default function Portal() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [sheet, setSheet] = useState(null); // null | 'full' | visit

  useEffect(() => {
    if (!tokens.patient()) return;
    api.get('/portal/me', { patient: true }).then((d) => { setData(d); applyTheme(d.clinic.theme); }).catch(setError);
  }, []);

  if (!tokens.patient() || error?.status === 401) return <Navigate to="/portal/login" replace />;
  if (error) return <p className="p-10 text-center text-rose-600">{error.message}</p>;
  if (!data) return <PageLoader />;
  const { patient: p, clinic, visits } = data;
  const logout = () => { tokens.setPatient(null); navigate('/portal/login'); };

  if (sheet) {
    return (
      <PrintFrame title={`${p.full_name} · ${sheet === 'full' ? 'complete case record' : sheet.visit_date}`} back={() => setSheet(null)}>
        <CaseSheet full={sheet === 'full'} clinic={clinic} patient={p} visits={sheet === 'full' ? visits : [sheet]} />
      </PrintFrame>
    );
  }

  const latest = visits[0];
  const upcoming = visits.map((v) => v.next_visit_date).filter((d) => d && d >= todayISO()).sort()[0];
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line/60 bg-white/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4">
          <Logo className="size-8" />
          <div className="flex-1 leading-tight"><div className="text-sm font-extrabold">{clinic.name}</div><div className="text-[11px] text-muted">Patient portal</div></div>
          <button className="btn-ghost" onClick={logout}><LogOut size={16} /> Sign out</button>
        </div>
      </header>
      <main className="animate-in mx-auto max-w-4xl space-y-5 px-4 py-8">
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-4 bg-gradient-to-r from-brand-100 to-brand-50 p-6">
            <Avatar name={p.full_name} className="size-16 bg-white text-xl" />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-slate-600">Hello,</div>
              <h1 className="truncate text-2xl font-extrabold">{p.full_name}</h1>
              <div className="font-mono text-xs font-bold tracking-widest text-brand-700">CASE #{caseFmt(p.case_no)} · {p.age} yrs · {p.gender}</div>
            </div>
            <button className="btn-primary py-3" onClick={() => setSheet('full')} disabled={!visits.length}><Download size={17} /> Download full case sheet</button>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <div className="flex gap-3"><div className="grid size-10 place-items-center rounded-2xl bg-brand-100 text-brand-700"><CalendarHeart size={18} /></div><div><div className="text-xs font-semibold text-muted">Next visit</div><div className="font-bold">{upcoming ? fmtDate(upcoming) : 'Not scheduled'}</div></div></div>
            <div className="flex gap-3"><div className="grid size-10 place-items-center rounded-2xl bg-brand-100 text-brand-700"><FileText size={18} /></div><div><div className="text-xs font-semibold text-muted">Consultations</div><div className="font-bold">{visits.length}</div></div></div>
            <div className="flex gap-3"><div className="grid size-10 place-items-center rounded-2xl bg-brand-100 text-brand-700"><Building2 size={18} /></div><div><div className="text-xs font-semibold text-muted">Clinic</div><div className="font-bold">{clinic.phone || clinic.city}</div></div></div>
          </div>
        </div>

        {latest?.prescriptions?.length > 0 && (
          <section className="card p-5">
            <h2 className="section-title mb-3"><Pill size={15} /> Current medicines · from {fmtDate(latest.visit_date)}</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {latest.prescriptions.map((r) => (
                <li key={r.id} className="rounded-2xl bg-brand-50/70 px-4 py-3">
                  <div className="font-bold">{r.medicine}</div>
                  <div className="text-sm text-slate-600">{[r.dosage, r.timing, r.duration].filter(Boolean).join(' · ')}</div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-lg font-bold">Visit history</h2>
          <ul className="space-y-2.5">
            {visits.map((v) => (
              <li key={v.id} className="card flex flex-wrap items-center gap-4 p-4">
                <div className="w-14 shrink-0 text-center">
                  <div className="text-lg leading-none font-extrabold">{fmtDate(v.visit_date, { day: '2-digit' })}</div>
                  <div className="text-[11px] font-bold text-muted uppercase">{fmtDate(v.visit_date, { month: 'short', year: '2-digit' })}</div>
                </div>
                <div className="min-w-0 flex-1 basis-48">
                  <div className="font-bold">{v.diagnosis || 'Consultation'}</div>
                  <div className="text-sm text-muted">{v.complaints}</div>
                  {!!v.lab_tests.length && <div className="mt-1 flex items-center gap-1 text-xs text-brand-700"><FlaskConical size={13} /> {v.lab_tests.join(', ')}</div>}
                </div>
                <button className="btn-soft max-sm:w-full" onClick={() => setSheet(v)}><Printer size={15} /> A4 sheet</button>
              </li>
            ))}
            {!visits.length && <li className="card p-8 text-center text-muted">No consultations yet.</li>}
          </ul>
        </section>
      </main>
    </div>
  );
}
