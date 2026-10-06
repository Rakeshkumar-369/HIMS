import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import clsx from 'clsx';
import {
  UserPlus, MonitorUp, Printer, Undo2, MoreHorizontal, Pencil, XCircle, Clock, Stethoscope, Users, CheckCircle2, IndianRupee, Siren,
  CalendarDays, ArrowRight, Sparkles, FileText,
} from 'lucide-react';
import { useAuth } from '../context/authCtx';
import { api } from '../lib/api';
import { useFetch, useLiveEvents } from '../lib/hooks';
import { fmtDay, fmtTime, todayISO, caseFmt, inr, vitalFlag, fmtShort } from '../lib/format';
import { PageHeader, PageLoader, Empty, Avatar } from '../components/ui';
import VisitIntakeModal from '../components/VisitIntakeModal';

const since = (ts) => {
  if (!ts) return '';
  const m = Math.max(0, Math.round((Date.now() - new Date(ts.replace(' ', 'T')).getTime()) / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

function Stat({ icon: Icon, label, value, tone }) {
  return (
    <div className="card flex items-center gap-3.5 p-4">
      <div className={clsx('grid size-11 place-items-center rounded-2xl', tone)}><Icon size={20} /></div>
      <div><div className="text-2xl leading-none font-extrabold tabular">{value}</div><div className="mt-1 text-xs font-semibold text-muted">{label}</div></div>
    </div>
  );
}

function VitalsMini({ v }) {
  const items = [
    v.bp_systolic && { k: 'BP', val: `${v.bp_systolic}/${v.bp_diastolic ?? '–'}`, f: vitalFlag('bp', v.bp_systolic, v.bp_diastolic) },
    v.pulse && { k: 'PR', val: v.pulse, f: vitalFlag('pulse', v.pulse) },
    v.temperature && { k: 'T', val: `${v.temperature}°`, f: vitalFlag('temperature', v.temperature) },
    v.spo2 && { k: 'SpO₂', val: `${v.spo2}%`, f: vitalFlag('spo2', v.spo2) },
    v.weight_kg && { k: 'Wt', val: `${v.weight_kg}kg` },
    v.blood_sugar && { k: 'RBS', val: v.blood_sugar, f: vitalFlag('blood_sugar', v.blood_sugar) },
  ].filter(Boolean);
  if (!items.length) return <span className="text-xs text-amber-600">Vitals not recorded</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((i) => (
        <span key={i.k} className={clsx('rounded-lg px-1.5 py-0.5 text-[11px] font-semibold tabular', i.f === 'high' ? 'bg-rose-50 text-rose-700' : i.f === 'low' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600')}>
          {i.k} {i.val}
        </span>
      ))}
    </div>
  );
}

function RowMenu({ items }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button className="btn-ghost p-2" onClick={() => setOpen(!open)} onBlur={() => setTimeout(() => setOpen(false), 150)} aria-label="Visit actions"><MoreHorizontal size={18} /></button>
      {open && (
        <div className="animate-pop absolute right-0 z-20 mt-1 w-48 rounded-2xl border border-line bg-white p-1.5 shadow-lift">
          {items.map(({ label, icon: Icon, onClick, danger }) => (
            <button key={label} onMouseDown={onClick} className={clsx('flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium hover:bg-slate-50', danger && 'text-rose-600')}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Today() {
  const { clinicId, clinic, isDoctor } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const highlight = Number(params.get('highlight'));
  const [date, setDate] = useState(todayISO());
  const [edit, setEdit] = useState(null);
  const [, tick] = useState(0);
  const { data, loading, reload } = useFetch(clinicId ? `/visits/queue?clinicId=${clinicId}&date=${date}` : null);
  useLiveEvents((e) => e.type === 'queue' && reload());
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(t); }, []);

  const visits = useMemo(() => data?.visits || [], [data]);
  const groups = useMemo(() => ({
    with: visits.filter((v) => v.status === 'with_doctor'),
    waiting: visits.filter((v) => v.status === 'waiting'),
    done: visits.filter((v) => v.status === 'completed'),
  }), [visits]);
  const collected = groups.done.reduce((s, v) => s + Number(v.fee || 0), 0);
  const isToday = date === todayISO();

  const act = async (fn, msg) => { try { await fn(); if (msg) toast.success(msg); reload(); } catch (e) { toast.error(e.message); } };
  const sendIn = (v) => act(async () => {
    await api.post(`/visits/${v.id}/call`);
    if (isDoctor) navigate(`/app/consult/${v.id}`);
  }, isDoctor ? null : `Token #${v.token_no} is now on the doctor's screen`);

  if (!clinicId) return null;
  return (
    <div className="animate-in">
      <PageHeader eyebrow={clinic.name} title={isToday ? 'Today' : fmtDay(date)} subtitle={isToday ? fmtDay(date) : 'Viewing a past day'}
        actions={<>
          <label className="btn-outline cursor-pointer"><CalendarDays size={16} /><input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value || todayISO())} className="w-[8.5rem] bg-transparent outline-none" /></label>
          <Link to="/app/register" className="btn-primary max-lg:hidden"><UserPlus size={17} /> New case</Link>
        </>} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Users} label="Waiting" value={groups.waiting.length} tone="bg-amber-50 text-amber-600" />
        <Stat icon={Stethoscope} label="With doctor" value={groups.with.length} tone="bg-brand-100 text-brand-700" />
        <Stat icon={CheckCircle2} label="Seen" value={groups.done.length} tone="bg-emerald-50 text-emerald-600" />
        <Stat icon={IndianRupee} label="Collected" value={inr(collected)} tone="bg-sky-50 text-sky-600" />
      </div>

      {loading && !data ? <PageLoader /> : (
        <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr] [&>*]:min-w-0">
          <div className="space-y-6">
            {/* Now with doctor */}
            {groups.with.map((v) => (
              <div key={v.id} className="card relative overflow-hidden border-brand-200 p-5">
                <div className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-brand-100 blur-2xl" />
                <div className="relative flex flex-wrap items-center gap-4">
                  <div className="live-dot grid size-14 place-items-center rounded-2xl bg-brand-500 text-xl font-extrabold text-white">{v.token_no}</div>
                  <div className="min-w-0 flex-1 basis-48">
                    <div className="text-xs font-bold tracking-wider text-brand-700 uppercase">Now with doctor · {since(v.called_at)}</div>
                    <div className="truncate text-lg font-bold">{v.full_name} <span className="text-sm font-medium text-muted">· {v.age}y {v.gender?.[0]}</span></div>
                    <div className="truncate text-sm text-muted">{v.complaints || 'No complaints noted'}</div>
                  </div>
                  <div className="flex w-full gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
                    {isDoctor && <Link to={`/app/consult/${v.id}`} className="btn-primary"><Stethoscope size={16} /> Open</Link>}
                    <button className="btn-outline" onClick={() => act(() => api.post(`/visits/${v.id}/return`), 'Moved back to queue')}><Undo2 size={16} /> Back to queue</button>
                  </div>
                </div>
              </div>
            ))}

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold">Queue <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-sm text-amber-700">{groups.waiting.length}</span></h2>
                {!!groups.waiting.length && isToday && !groups.with.length && (
                  <button className="btn-soft" onClick={() => sendIn(groups.waiting[0])}><Sparkles size={16} /> {isDoctor ? 'Call next' : 'Send next in'}</button>
                )}
              </div>
              {!groups.waiting.length ? (
                <div className="card"><Empty icon={Users} title={isToday ? 'No one waiting' : 'Nobody was left waiting'} text={isToday ? 'Register a new case or add a returning patient — they appear here instantly.' : null}
                  action={isToday && <Link to="/app/register" className="btn-primary"><UserPlus size={16} /> New case</Link>} /></div>
              ) : (
                <ul className="space-y-2.5">
                  {groups.waiting.map((v, i) => (
                    <li key={v.id} className={clsx('card group flex flex-wrap items-center gap-4 p-4 transition hover:shadow-lift sm:flex-nowrap', v.id === highlight && 'animate-pop ring-4 ring-brand-200', v.priority && 'border-rose-200 bg-rose-50/40')}>
                      <div className={clsx('grid size-12 shrink-0 place-items-center rounded-2xl text-lg font-extrabold tabular', v.priority ? 'bg-rose-500 text-white' : i === 0 ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-600')}>
                        {v.priority ? <Siren size={20} /> : v.token_no}
                      </div>
                      <div className="min-w-0 flex-1 basis-60">
                        <div className="flex flex-wrap items-center gap-x-2">
                          <span className="truncate font-bold">{v.full_name}</span>
                          <span className="text-sm text-muted">{v.age}y · {v.gender?.[0]}</span>
                          {v.visit_type === 'new' ? <span className="rounded-full bg-sky-50 px-2 text-[11px] font-bold text-sky-700">NEW</span> : <span className="rounded-full bg-violet-50 px-2 text-[11px] font-bold text-violet-700">FOLLOW-UP</span>}
                        </div>
                        <div className="mt-0.5 truncate text-sm text-slate-600">{v.complaints || <span className="text-muted">No complaints noted</span>}{v.complaint_duration && <span className="text-muted"> · {v.complaint_duration}</span>}</div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <VitalsMini v={v} />
                          {v.known_conditions?.map((c) => <span key={c} className="rounded-lg bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700">{c}</span>)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted"><Clock size={13} /> {since(v.created_at)}</div>
                      <div className="flex items-center gap-1">
                        {isToday && (
                          <button className="btn-primary" onClick={() => sendIn(v)}>
                            <MonitorUp size={16} /> <span className="sm:hidden">{isDoctor ? 'Call in' : 'Send in'}</span><span className="max-sm:hidden">{isDoctor ? 'Call in' : 'Display to doctor'}</span>
                          </button>
                        )}
                        <RowMenu items={[
                          { label: 'Update vitals', icon: Pencil, onClick: () => setEdit(v) },
                          { label: 'Open case file', icon: FileText, onClick: () => navigate(`/app/patients/${v.patient_id}`) },
                          { label: 'Cancel visit', icon: XCircle, danger: true, onClick: () => act(() => api.post(`/visits/${v.id}/cancel`), 'Visit cancelled') },
                        ]} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Completed */}
          <section>
            <h2 className="mb-3 text-lg font-bold">Seen & ready to hand over <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-sm text-emerald-700">{groups.done.length}</span></h2>
            <div className="card divide-y divide-line/70">
              {!groups.done.length && <Empty icon={CheckCircle2} title="No completed consultations yet" text="Once the doctor finishes, the patient shows up here with a one-tap A4 print." />}
              {groups.done.map((v) => (
                <div key={v.id} className={clsx('flex items-center gap-3 p-4', v.id === highlight && 'bg-brand-50')}>
                  <Avatar name={v.full_name} tone="slate" className="size-10 text-xs" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{v.full_name} <span className="font-normal text-muted">· #{v.token_no}</span></div>
                    <div className="truncate text-xs text-muted">{v.diagnosis || '—'}{v.next_visit_date && ` · next ${fmtShort(v.next_visit_date)}`}</div>
                    <div className="mt-0.5 text-[11px] text-slate-400 tabular">{caseFmt(v.case_no)} · {fmtTime(v.completed_at)} · {inr(v.fee)} {v.payment_mode}</div>
                  </div>
                  <Link to={`/print/visit/${v.id}`} target="_blank" className="btn-soft px-3" title="Print A4 case sheet"><Printer size={16} /><span className="hidden sm:inline">Print</span></Link>
                  {isDoctor && <Link to={`/app/consult/${v.id}`} className="btn-ghost p-2" title="Edit consultation"><ArrowRight size={16} /></Link>}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {edit && <VisitIntakeModal open mode="edit" visit={edit} patient={edit} onClose={() => setEdit(null)} onSaved={() => reload()} />}
    </div>
  );
}
