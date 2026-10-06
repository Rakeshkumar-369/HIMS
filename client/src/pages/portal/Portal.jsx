import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Download, LogOut, CalendarHeart, Pill, FileText, Building2, History } from 'lucide-react';
import { api } from '../../lib/api';
import { applyTheme } from '../../lib/themes';
import { PageLoader, Avatar } from '../../components/ui';
import { Logo } from '../../components/Brand';
import ModeToggle from '../../components/ModeToggle';
import CaseSheet from '../../components/CaseSheet';
import PrintFrame from '../../components/PrintFrame';
import VisitHistory from '../../components/VisitHistory';
import { caseFmt, fmtDate, todayISO } from '../../lib/format';

export default function Portal() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [sheet, setSheet] = useState(null); // null | 'full' | visit
  const [autoDl, setAutoDl] = useState(false);

  useEffect(() => {
    api.get('/portal/me', { patient: true })
      .then((d) => { setData(d); applyTheme(d.clinic.theme); })
      .catch(setError);
  }, []);

  if (error?.status === 401) return <Navigate to="/portal/login" replace />;
  if (error) return <p className="p-10 text-center text-rose-600">{error.message}</p>;
  if (!data) return <PageLoader />;
  const { patient: p, clinic, visits } = data;
  const logout = async () => {
    try { await api.post('/auth/patient-logout', {}, { patient: true }); } catch { /* already signed out */ }
    navigate('/portal/login');
  };

  if (sheet) {
    const full = sheet === 'full';
    return (
      <PrintFrame title={`${p.full_name} · ${full ? 'complete case record' : sheet.visit_date}`} back={() => { setSheet(null); setAutoDl(false); }}
        autoDownload={autoDl} filename={full ? `CaseRecord-${p.case_no}` : `CaseSheet-${p.case_no}-${sheet.visit_date}`}>
        <CaseSheet full={full} clinic={clinic} patient={p} visits={full ? visits : [sheet]} />
      </PrintFrame>
    );
  }

  const latest = visits[0];
  const upcoming = visits.map((v) => v.next_visit_date).filter((d) => d && d >= todayISO()).sort()[0];
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line/60 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Logo className="size-8" />
          <div className="flex-1 leading-tight"><div className="text-sm font-extrabold">{clinic.name}</div><div className="text-[11px] text-muted">Patient portal</div></div>
          <ModeToggle />
          <button className="btn-ghost" onClick={logout}><LogOut size={16} /> <span className="max-sm:hidden">Sign out</span></button>
        </div>
      </header>
      <main className="animate-in mx-auto max-w-6xl space-y-5 px-4 py-8">
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-4 bg-gradient-to-r from-brand-100 to-brand-50 p-6">
            <Avatar name={p.full_name} className="size-16 bg-white text-xl" />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-slate-600">Hello,</div>
              <h1 className="truncate text-2xl font-extrabold">{p.full_name}</h1>
              <div className="font-mono text-xs font-bold tracking-widest text-brand-700">CASE #{caseFmt(p.case_no)} · {p.age} yrs · {p.gender}</div>
            </div>
            <button className="btn-primary py-3 max-sm:w-full" onClick={() => { setAutoDl(true); setSheet('full'); }} disabled={!visits.length}>
              <Download size={17} /> Download full case sheet (PDF)
            </button>
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
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><History size={18} className="text-brand-600" /> Your visits</h2>
          <VisitHistory visits={visits} printable={false} onPrint={(v) => setSheet(v)} />
        </section>
      </main>
    </div>
  );
}
