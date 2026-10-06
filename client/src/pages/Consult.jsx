import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import clsx from 'clsx';
import {
  Stethoscope, FlaskConical, Pill, CalendarCheck2, Lock, Plus, Trash2, Repeat2, Printer, CheckCircle2, Coffee, AlertTriangle, History,
  ClipboardList, Eye, Activity, Sparkles, X, Search,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { useFetch, useLiveEvents } from '../lib/hooks';
import { Chips, PageLoader, Avatar } from '../components/ui';
import { Section } from '../components/intake';
import { LAB_TESTS, DOSAGES, TIMINGS, RX_DURATIONS, NEXT_VISITS, COMMON_MEDICINES } from '../lib/constants';
import { caseFmt, fmtDate, fmtShort, vitalFlag, todayISO, inr } from '../lib/format';

const ADVICE = ['Plenty of oral fluids', 'Adequate rest', 'Low salt diet', 'Avoid sugar & sweets', 'Steam inhalation', 'Daily 30 min walk', 'Avoid oily & spicy food', 'Review with reports'];
const blankRx = () => ({ medicine: '', dosage: '1-0-1', timing: 'After food', duration: '5 days', instructions: '' });
const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

function Vital({ label, value, unit, flag }) {
  return (
    <div className={clsx('rounded-2xl px-3 py-2', flag === 'high' ? 'bg-rose-50' : flag === 'low' ? 'bg-amber-50' : 'bg-slate-50')}>
      <div className="text-[10px] font-bold tracking-wider text-muted uppercase">{label}</div>
      <div className={clsx('text-[17px] font-extrabold tabular', flag === 'high' ? 'text-rose-700' : flag === 'low' ? 'text-amber-700' : 'text-ink')}>
        {value ?? '—'}<span className="ml-0.5 text-[11px] font-medium text-muted">{value != null && unit}</span>
      </div>
    </div>
  );
}

function MedicinePicker({ suggestions, onPick }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const all = useMemo(() => {
    const fromHistory = suggestions.map((s) => ({ ...s, freq: s.n }));
    const names = new Set(fromHistory.map((s) => s.medicine.toLowerCase()));
    return [...fromHistory, ...COMMON_MEDICINES.filter((m) => !names.has(m.toLowerCase())).map((m) => ({ medicine: m }))];
  }, [suggestions]);
  const list = all.filter((m) => m.medicine.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  const pick = (m) => { onPick(m); setQ(''); setOpen(false); };
  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
          <input className="input pl-10" placeholder="Type a medicine — frequent ones auto-fill dose & duration" value={q}
            onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (list[0] && q) pick(list[0]); else if (q.trim()) pick({ medicine: q.trim() }); } }} />
        </div>
        <button type="button" className="btn-soft" onClick={() => q.trim() && pick({ medicine: q.trim() })}><Plus size={16} /> Add</button>
      </div>
      {open && !!list.length && (
        <div className="animate-pop absolute z-20 mt-1.5 w-full overflow-hidden rounded-2xl border border-line bg-white p-1.5 shadow-lift">
          {list.map((m) => (
            <button type="button" key={m.medicine} onMouseDown={() => pick(m)} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-brand-50">
              <span className="font-semibold">{m.medicine}</span>
              <span className="text-xs text-muted">{m.freq ? `${m.dosage || ''} · ${m.duration || ''} · used ${m.freq}×` : 'common'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const Sel = ({ value, options, onChange }) => (
  <select value={value || ''} onChange={(e) => onChange(e.target.value)} className="rounded-xl border border-line bg-white px-2.5 py-1.5 text-[13px] font-semibold outline-none focus:border-brand-400">
    {!options.includes(value) && value && <option>{value}</option>}
    {options.map((o) => <option key={o}>{o}</option>)}
  </select>
);

function WaitingRoom({ clinicId }) {
  const navigate = useNavigate();
  const { data, reload } = useFetch(`/visits/queue?clinicId=${clinicId}`, [clinicId]);
  useLiveEvents((e) => e.type === 'queue' && reload(true));
  const waiting = (data?.visits || []).filter((v) => v.status === 'waiting');
  const next = async () => {
    try { await api.post(`/visits/${waiting[0].id}/call`); navigate(`/app/consult/${waiting[0].id}`); } catch (e) { toast.error(e.message); }
  };
  return (
    <div className="card animate-in mx-auto max-w-2xl overflow-hidden">
      <div className="bg-gradient-to-br from-brand-100 via-brand-50 to-white px-8 py-12 text-center">
        <div className="mx-auto mb-5 grid size-20 place-items-center rounded-[28px] bg-white text-brand-500 shadow-soft"><Coffee size={34} /></div>
        <h2 className="text-2xl font-extrabold">Ready for the next patient</h2>
        <p className="mx-auto mt-2 max-w-md text-muted">When the nurse taps <b>Display to doctor</b>, the case opens here automatically — on your laptop or phone.</p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-soft">
          <span className="live-dot size-2 rounded-full bg-emerald-500" /> Listening · {waiting.length} waiting
        </div>
      </div>
      {!!waiting.length && (
        <div className="p-6">
          <div className="mb-3 text-xs font-bold tracking-wider text-muted uppercase">No nurse today? Call directly</div>
          <ul className="space-y-2">
            {waiting.slice(0, 4).map((v) => (
              <li key={v.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2.5">
                <span className="grid size-9 place-items-center rounded-xl bg-white font-bold tabular">{v.token_no}</span>
                <span className="flex-1 truncate text-sm font-semibold">{v.full_name} <span className="font-normal text-muted">· {v.complaints}</span></span>
              </li>
            ))}
          </ul>
          <button className="btn-primary mt-4 w-full py-3" onClick={next}><Sparkles size={17} /> Call token #{waiting[0].token_no}</button>
        </div>
      )}
    </div>
  );
}

export default function Consult() {
  const { visitId } = useParams();
  const { clinicId } = useAuth();
  const navigate = useNavigate();
  const live = useFetch(!visitId && clinicId ? `/visits/live?clinicId=${clinicId}` : null, [clinicId, visitId]);
  useLiveEvents((e) => { if (!visitId && (e.type === 'display' || e.type === 'queue')) live.reload(true); });

  const activeId = visitId || live.data?.visits?.[0]?.id;
  if (!visitId && live.loading && !live.data) return <PageLoader />;
  if (!activeId) return <WaitingRoom clinicId={clinicId} />;
  return (
    <>
      {!visitId && live.data.visits.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {live.data.visits.map((v) => <button key={v.id} className={clsx('chip', v.id === activeId && 'chip-on')} onClick={() => navigate(`/app/consult/${v.id}`)}>#{v.token_no}</button>)}
        </div>
      )}
      <ConsultForm key={activeId} visitId={activeId} />
    </>
  );
}

function ConsultForm({ visitId }) {
  const navigate = useNavigate();
  const { clinic } = useAuth();
  const { data, loading } = useFetch(`/visits/${visitId}`, [visitId]);
  const patientId = data?.patient?.id;
  const history = useFetch(patientId ? `/patients/${patientId}` : null, [patientId]);
  const sugg = useFetch('/visits/suggestions', []);
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const draftKey = `cn.draft.${visitId}`;
  const loaded = useRef(false);

  useEffect(() => {
    if (!data || loaded.current) return;
    loaded.current = true;
    const v = data.visit;
    const saved = (() => { try { return JSON.parse(localStorage.getItem(draftKey)); } catch { return null; } })();
    setF(saved && v.status !== 'completed' ? saved : {
      observations: v.observations || '', diagnosis: v.diagnosis || '', lab_tests: v.lab_tests || [], lab_other: v.lab_other || '', advice: v.advice || '',
      doctor_comment: v.doctor_comment || '', next_visit_label: v.next_visit_label || '', next_visit_date: v.next_visit_date || '',
      fee: v.fee ?? clinic?.consultation_fee ?? 0, payment_mode: v.payment_mode || 'Cash',
      prescriptions: v.prescriptions?.length ? v.prescriptions.map(({ medicine, dosage, timing, duration, instructions }) => ({ medicine, dosage, timing, duration, instructions: instructions || '' })) : [],
    });
  }, [data]); // eslint-disable-line

  useEffect(() => { if (f && data?.visit.status !== 'completed') localStorage.setItem(draftKey, JSON.stringify(f)); }, [f]); // eslint-disable-line

  if (loading || !data || !f) return <PageLoader />;
  const { visit: v, patient: p } = data;
  const prev = (history.data?.visits || []).filter((x) => x.id !== v.id && x.status === 'completed');
  const set = (k) => (val) => setF((s) => ({ ...s, [k]: val?.target ? val.target.value : val }));
  const setRx = (i, patch) => setF((s) => ({ ...s, prescriptions: s.prescriptions.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  const addRx = (m) => setF((s) => ({ ...s, prescriptions: [...s.prescriptions, { ...blankRx(), ...Object.fromEntries(Object.entries({ medicine: m.medicine, dosage: m.dosage, timing: m.timing, duration: m.duration }).filter(([, x]) => x)) }] }));
  const repeatRx = (visit) => {
    setF((s) => ({ ...s, prescriptions: visit.prescriptions.map(({ medicine, dosage, timing, duration, instructions }) => ({ medicine, dosage, timing, duration, instructions: instructions || '' })),
      diagnosis: s.diagnosis || visit.diagnosis || '' }));
    toast.success(`Copied ${visit.prescriptions.length} medicines from ${fmtShort(visit.visit_date)}`);
  };
  const nextDate = f.next_visit_date || (NEXT_VISITS.find((n) => n.label === f.next_visit_label)?.days ? addDays(v.visit_date || todayISO(), NEXT_VISITS.find((n) => n.label === f.next_visit_label).days) : null);
  const toggleAdvice = (a) => {
    const lines = f.advice.split('\n').map((x) => x.trim()).filter(Boolean);
    set('advice')(lines.includes(a) ? lines.filter((x) => x !== a).join('\n') : [...lines, a].join('\n'));
  };

  const complete = async (print) => {
    if (!f.diagnosis.trim() && !window.confirm('No diagnosis entered. Complete anyway?')) return;
    setBusy(true);
    try {
      await api.post(`/visits/${v.id}/complete`, { ...f, next_visit_date: f.next_visit_label === 'custom' ? f.next_visit_date : '' });
      localStorage.removeItem(draftKey);
      toast.success(`${p.full_name} — consultation saved`, { description: 'Nurse can now print the A4 case sheet.' });
      if (print) window.open(`/print/visit/${v.id}`, '_blank');
      navigate(v.status === 'completed' ? '/app/today' : '/app/consult');
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const bmi = v.bmi;
  return (
    <div className="animate-in grid gap-5 xl:grid-cols-[380px_1fr]">
      {/* ---------- Patient panel ---------- */}
      <aside className="space-y-4 xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7rem)] xl:self-start xl:overflow-y-auto xl:pr-1 scrollbar-thin">
        <div className="card overflow-hidden">
          <div className="bg-gradient-to-br from-brand-100 to-brand-50 p-5">
            <div className="flex items-center gap-3">
              <Avatar name={p.full_name} className="size-14 bg-white text-lg" />
              <div className="min-w-0">
                <div className="text-xs font-bold tracking-wider text-brand-700 uppercase">Token #{v.token_no} · {v.visit_type === 'new' ? 'New' : 'Follow-up'}</div>
                <div className="truncate text-xl font-extrabold">{p.full_name}</div>
                <div className="text-sm text-slate-600">{p.age} yrs · {p.gender}{p.blood_group && ` · ${p.blood_group}`}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="font-mono font-semibold tracking-wider text-slate-600">#{caseFmt(p.case_no)}</span>
              <Link to={`/app/patients/${p.id}`} className="font-semibold text-brand-700 hover:underline">Full case file →</Link>
            </div>
          </div>
          <div className="space-y-4 p-5">
            {p.allergies && <div className="flex items-center gap-2 rounded-2xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700"><AlertTriangle size={16} /> Allergy: {p.allergies}</div>}
            {!!p.known_conditions.length && (
              <div><div className="mb-1.5 text-[11px] font-bold tracking-wider text-muted uppercase">Known case of</div>
                <div className="flex flex-wrap gap-1.5">{p.known_conditions.map((c) => <span key={c} className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-bold text-brand-800">{c}</span>)}</div></div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <Vital label="BP" value={v.bp_systolic ? `${v.bp_systolic}/${v.bp_diastolic}` : null} flag={vitalFlag('bp', v.bp_systolic, v.bp_diastolic)} />
              <Vital label="Pulse" value={v.pulse} unit="bpm" flag={vitalFlag('pulse', v.pulse)} />
              <Vital label="Temp" value={v.temperature} unit="°F" flag={vitalFlag('temperature', v.temperature)} />
              <Vital label="SpO₂" value={v.spo2} unit="%" flag={vitalFlag('spo2', v.spo2)} />
              <Vital label="Weight" value={v.weight_kg} unit="kg" />
              <Vital label="BMI" value={bmi} flag={vitalFlag('bmi', bmi)} />
              {v.blood_sugar && <Vital label="RBS" value={v.blood_sugar} unit="mg/dL" flag={vitalFlag('blood_sugar', v.blood_sugar)} />}
            </div>
            <div>
              <div className="mb-1 text-[11px] font-bold tracking-wider text-muted uppercase">Complaints {v.complaint_duration && `· ${v.complaint_duration}`}</div>
              <p className="text-[15px] font-semibold">{v.complaints || '—'}</p>
            </div>
            {v.current_medicines && <div><div className="mb-1 text-[11px] font-bold tracking-wider text-muted uppercase">Current medicines</div><p className="text-sm">{v.current_medicines}</p></div>}
            {v.nurse_notes && <div className="rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-900"><b>Nurse:</b> {v.nurse_notes}</div>}
          </div>
        </div>

        <div className="card p-5">
          <div className="section-title mb-3"><History size={15} /> Previous visits <span className="text-muted">({prev.length})</span></div>
          {!prev.length && <p className="text-sm text-muted">First visit — no history yet.</p>}
          <ol className="relative space-y-4 border-l-2 border-brand-100 pl-4">
            {prev.slice(0, 6).map((x) => (
              <li key={x.id} className="relative">
                <span className="absolute top-1.5 -left-[23px] size-3 rounded-full border-2 border-white bg-brand-400" />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-muted">{fmtDate(x.visit_date)}</span>
                  {!!x.prescriptions.length && <button className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700 hover:bg-brand-100" onClick={() => repeatRx(x)}><Repeat2 size={12} /> Repeat Rx</button>}
                </div>
                <div className="text-sm font-bold">{x.diagnosis || '—'}</div>
                <div className="text-xs text-muted">{x.bp_systolic && `BP ${x.bp_systolic}/${x.bp_diastolic} · `}{x.prescriptions.map((r) => r.medicine).join(', ')}</div>
                {x.doctor_comment && <div className="mt-1 flex gap-1.5 rounded-xl bg-amber-50 px-2 py-1 text-xs text-amber-900"><Lock size={12} className="mt-0.5 shrink-0" />{x.doctor_comment}</div>}
              </li>
            ))}
          </ol>
        </div>
      </aside>

      {/* ---------- Consultation form ---------- */}
      <div className="space-y-5 pb-24">
        <Section icon={Eye} title="Observations / examination">
          <textarea rows={3} className="input" placeholder="e.g. Throat congested, chest clear, no pedal oedema…" value={f.observations} onChange={set('observations')} />
        </Section>

        <Section icon={ClipboardList} title="Diagnosis">
          <input className="input text-base font-semibold" placeholder="Provisional / final diagnosis" value={f.diagnosis} onChange={set('diagnosis')} />
          {!!sugg.data?.diagnoses?.length && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {sugg.data.diagnoses.slice(0, 10).map((d) => (
                <button type="button" key={d.diagnosis} onClick={() => set('diagnosis')(d.diagnosis)} className={clsx('chip px-2.5 py-1 text-xs', f.diagnosis === d.diagnosis && 'chip-on')}>{d.diagnosis}</button>
              ))}
            </div>
          )}
        </Section>

        <Section icon={FlaskConical} title="Lab investigations" aside={!!f.lab_tests.length && <span className="text-xs font-semibold text-brand-700">{f.lab_tests.length} selected</span>}>
          <Chips multi options={LAB_TESTS} value={f.lab_tests} onChange={set('lab_tests')} />
          <input className="input mt-3" placeholder="Other tests (comma separated)" value={f.lab_other} onChange={set('lab_other')} />
        </Section>

        <Section icon={Pill} title="Prescription" aside={prev[0]?.prescriptions?.length ? <button className="btn-soft px-3 py-1.5 text-xs" onClick={() => repeatRx(prev[0])}><Repeat2 size={14} /> Repeat last</button> : null}>
          <MedicinePicker suggestions={sugg.data?.medicines || []} onPick={addRx} />
          {!f.prescriptions.length && <p className="mt-4 rounded-2xl border border-dashed border-line py-6 text-center text-sm text-muted">No medicines yet.</p>}
          <ul className="mt-3 space-y-2">
            {f.prescriptions.map((r, i) => (
              <li key={i} className="animate-in rounded-2xl border border-line bg-white p-3">
                <div className="flex items-center gap-2">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-100 text-xs font-bold text-brand-700">{i + 1}</span>
                  <input className="min-w-0 flex-1 bg-transparent text-[15px] font-bold outline-none" value={r.medicine} onChange={(e) => setRx(i, { medicine: e.target.value })} />
                  <button className="btn-ghost p-1.5 text-rose-500" onClick={() => setF((s) => ({ ...s, prescriptions: s.prescriptions.filter((_, j) => j !== i) }))} aria-label="Remove"><Trash2 size={16} /></button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 pl-9">
                  <Sel value={r.dosage} options={DOSAGES} onChange={(x) => setRx(i, { dosage: x })} />
                  <Sel value={r.timing} options={TIMINGS} onChange={(x) => setRx(i, { timing: x })} />
                  <Sel value={r.duration} options={RX_DURATIONS} onChange={(x) => setRx(i, { duration: x })} />
                  <input className="min-w-32 flex-1 rounded-xl border border-line px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-400" placeholder="Note (optional)" value={r.instructions} onChange={(e) => setRx(i, { instructions: e.target.value })} />
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={Activity} title="Advice">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {ADVICE.map((a) => <button type="button" key={a} onClick={() => toggleAdvice(a)} className={clsx('chip px-2.5 py-1 text-xs', f.advice.split('\n').includes(a) && 'chip-on')}>{a}</button>)}
          </div>
          <textarea rows={2} className="input" placeholder="Diet, lifestyle, precautions…" value={f.advice} onChange={set('advice')} />
        </Section>

        <div className="grid gap-5 lg:grid-cols-2">
          <Section icon={CalendarCheck2} title="Next visit">
            <Chips options={[...NEXT_VISITS.map((n) => n.label), { value: 'custom', label: 'Pick date' }]} value={f.next_visit_label} onChange={set('next_visit_label')} />
            {f.next_visit_label === 'custom' && <input type="date" className="input mt-3" min={todayISO()} value={f.next_visit_date} onChange={set('next_visit_date')} />}
            {nextDate && <p className="mt-3 text-sm font-semibold text-brand-700">Review on {fmtDate(nextDate, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</p>}
          </Section>
          <Section icon={Stethoscope} title="Fee">
            <div className="flex items-center gap-3">
              <div className="relative w-32"><span className="absolute top-1/2 left-3.5 -translate-y-1/2 font-bold text-muted">₹</span><input type="number" min="0" className="input pl-8 font-bold tabular" value={f.fee} onChange={set('fee')} /></div>
              <Chips size="sm" options={['Cash', 'UPI', 'Card', 'Free']} value={f.payment_mode} onChange={(m) => setF((s) => ({ ...s, payment_mode: m || 'Cash', fee: m === 'Free' ? 0 : s.fee || clinic?.consultation_fee || 0 }))} allowDeselect={false} />
            </div>
          </Section>
        </div>

        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[13px] font-bold tracking-wide text-amber-800 uppercase"><Lock size={15} /> Private note to self</h2>
            <span className="text-xs font-medium text-amber-700">Never printed · hidden from nurse & patient</span>
          </div>
          <textarea rows={2} className="w-full resize-y rounded-2xl border border-amber-200 bg-white/60 px-3.5 py-2.5 text-[15px] outline-none focus:ring-4 focus:ring-amber-100" placeholder="Review later: e.g. consider adding statin if LDL > 130" value={f.doctor_comment} onChange={set('doctor_comment')} />
        </section>
      </div>

      {/* Sticky action bar */}
      <div className="no-print fixed inset-x-0 bottom-[68px] z-20 border-t border-line/70 bg-white/85 backdrop-blur-xl lg:bottom-0 lg:left-72">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 sm:px-6">
          <div className="hidden min-w-0 flex-1 text-sm sm:block">
            <span className="font-bold">{p.full_name}</span>
            <span className="text-muted"> · {f.prescriptions.length} meds · {f.lab_tests.length} tests · {inr(f.fee)}</span>
          </div>
          <button className="btn-ghost max-sm:hidden" onClick={() => { localStorage.removeItem(draftKey); navigate(-1); }}><X size={16} /> Close</button>
          <button className="btn-outline flex-1 sm:flex-none" disabled={busy} onClick={() => complete(true)}><Printer size={16} /> Save & print</button>
          <button className="btn-primary flex-1 sm:flex-none sm:px-6" disabled={busy} onClick={() => complete(false)}><CheckCircle2 size={17} /> {v.status === 'completed' ? 'Update' : 'Complete & send out'}</button>
        </div>
      </div>
    </div>
  );
}

