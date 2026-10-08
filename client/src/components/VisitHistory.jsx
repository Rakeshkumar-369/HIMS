import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  Search, Pill, FlaskConical, Lock, Printer, Repeat2, CalendarCheck2, Stethoscope, Eye, ClipboardList, Activity, MessageSquareText,
  ChevronLeft, ChevronRight, Building2, ArrowLeft,
} from 'lucide-react';
import { fmtDate, vitalFlag } from '../lib/format';
import { useMedia } from '../lib/hooks';
import { StatusBadge } from './ui';

function Vital({ label, value, unit, flag }) {
  return (
    <div className={clsx('rounded-2xl px-3 py-2', flag === 'high' ? 'bg-rose-50' : flag === 'low' ? 'bg-amber-50' : 'bg-slate-50')}>
      <div className="text-[11px] font-medium text-muted">{label}</div>
      <div className={clsx('text-[15px] font-semibold tabular', flag === 'high' ? 'text-rose-700' : flag === 'low' ? 'text-amber-700' : 'text-ink')}>
        {value ?? '—'}{value != null && unit && <span className="ml-0.5 text-[11px] font-medium text-muted">{unit}</span>}
      </div>
    </div>
  );
}

function Block({ icon: Icon, title, children }) {
  if (!children) return null;
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted"><Icon size={13} /> {title}</div>
      <div className="text-[15px] leading-relaxed">{children}</div>
    </div>
  );
}

/** Everything recorded in one visit. */
export function VisitDetail({ v, onRepeatRx, printable = true, onPrint, onPrev, onNext }) {
  const labs = [...(v.lab_tests || []), ...(v.lab_other ? [v.lab_other] : [])];
  return (
    <article className="animate-in">
      <header className="flex flex-wrap items-start gap-3 border-b border-line/70 pb-4">
        <div className="min-w-0 flex-1 basis-56">
          <div className="text-xs font-medium text-brand-700">{fmtDate(v.visit_date, { weekday: 'long' })}</div>
          <h3 className="text-xl font-semibold">{fmtDate(v.visit_date, { day: 'numeric', month: 'long', year: 'numeric' })}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span>Token #{v.token_no} · {v.visit_type === 'new' ? 'New' : 'Follow-up'}</span>
            {v.doctor_name && <span className="inline-flex items-center gap-1"><Stethoscope size={13} />{v.doctor_name}</span>}
            {v.clinic_name && <span className="inline-flex items-center gap-1"><Building2 size={13} />{v.clinic_name}</span>}
            {v.status !== 'completed' && <StatusBadge status={v.status} />}
          </div>
        </div>
        <div className="flex items-center gap-1 max-sm:w-full max-sm:justify-between">
          {onPrev && <button className="btn-ghost p-2" onClick={onPrev} disabled={!onPrev.enabled} title="Older visit (↓)" aria-label="Older visit"><ChevronLeft size={18} /></button>}
          {onNext && <button className="btn-ghost p-2" onClick={onNext} disabled={!onNext.enabled} title="Newer visit (↑)" aria-label="Newer visit"><ChevronRight size={18} /></button>}
          {onRepeatRx && !!v.prescriptions?.length && <button className="btn-soft px-3" onClick={() => onRepeatRx(v)}><Repeat2 size={15} /> Repeat Rx</button>}
          {onPrint && v.status === 'completed' && <button className="btn-outline px-3" onClick={() => onPrint(v)}><Printer size={15} /> A4 / PDF</button>}
          {printable && !onPrint && v.status === 'completed' && <Link to={`/print/visit/${v.id}`} target="_blank" className="btn-outline px-3"><Printer size={15} /> Print / PDF</Link>}
        </div>
      </header>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        <Vital label="BP" value={v.bp_systolic ? `${v.bp_systolic}/${v.bp_diastolic ?? '–'}` : null} flag={vitalFlag('bp', v.bp_systolic, v.bp_diastolic)} />
        <Vital label="Pulse" value={v.pulse} unit="bpm" flag={vitalFlag('pulse', v.pulse)} />
        <Vital label="Temp" value={v.temperature} unit="°F" flag={vitalFlag('temperature', v.temperature)} />
        <Vital label="SpO₂" value={v.spo2} unit="%" flag={vitalFlag('spo2', v.spo2)} />
        <Vital label="Weight" value={v.weight_kg} unit="kg" />
        <Vital label="BMI" value={v.bmi} flag={vitalFlag('bmi', v.bmi)} />
        <Vital label="RBS" value={v.blood_sugar} unit="mg/dL" flag={vitalFlag('blood_sugar', v.blood_sugar)} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <Block icon={MessageSquareText} title={`Complaints${v.complaint_duration ? ` · ${v.complaint_duration}` : ''}`}>{v.complaints}</Block>
          <Block icon={Pill} title="Medicines the patient was taking">{v.current_medicines}</Block>
          <Block icon={Eye} title="Observations">{v.observations}</Block>
          <Block icon={ClipboardList} title="Diagnosis">{v.diagnosis && <b>{v.diagnosis}</b>}</Block>
          <Block icon={FlaskConical} title="Investigations advised">{labs.length > 0 && (
            <div className="flex flex-wrap gap-1.5">{labs.map((l) => <span key={l} className="rounded-full bg-brand-50 px-2.5 py-0.5 text-sm font-semibold text-brand-800">{l}</span>)}</div>
          )}</Block>
        </div>
        <div className="space-y-4">
          <Block icon={Pill} title="Prescription">{v.prescriptions?.length > 0 && (
            <ol className="space-y-1.5">
              {v.prescriptions.map((r, i) => (
                <li key={r.id ?? i} className="flex items-start gap-2.5 rounded-xl bg-brand-50/60 px-3 py-2">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-white text-[11px] font-bold text-brand-700">{i + 1}</span>
                  <div className="min-w-0"><div className="font-semibold">{r.medicine}</div><div className="text-[13px] text-muted">{[r.dosage, r.timing, r.duration, r.instructions].filter(Boolean).join(' · ')}</div></div>
                </li>
              ))}
            </ol>
          )}</Block>
          <Block icon={Activity} title="Advice">{v.advice && <span className="whitespace-pre-line">{v.advice}</span>}</Block>
          <Block icon={CalendarCheck2} title="Next visit">{v.next_visit_date ? fmtDate(v.next_visit_date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : v.next_visit_label === 'SOS' ? 'If needed (SOS)' : null}</Block>
          {v.nurse_notes && <Block icon={MessageSquareText} title="Nurse note">{v.nurse_notes}</Block>}
          {v.doctor_comment && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-medium"><Lock size={12} /> Private note · only you see this</div>
              {v.doctor_comment}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

const rowText = (v) => [v.diagnosis, v.complaints, v.doctor_name, v.clinic_name, ...(v.prescriptions || []).map((r) => r.medicine), ...(v.lab_tests || [])]
  .filter(Boolean).join(' ').toLowerCase();

/**
 * Every visit of a patient, one line each (newest first, grouped by year).
 * Pick a date — or use ↑ / ↓ — to see the whole visit alongside.
 */
export default function VisitHistory({ visits, initialId, onRepeatRx, printable = true, onPrint, compact = false, className }) {
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState(initialId ?? visits[0]?.id);
  const wide = useMedia('(min-width: 1024px)');
  // phones: list first, tapping a date opens that visit full-width
  const [phoneDetail, setPhoneDetail] = useState(!!initialId);
  const listRef = useRef(null);
  const filtered = useMemo(() => (q ? visits.filter((v) => rowText(v).includes(q.toLowerCase())) : visits), [visits, q]);
  const sel = visits.find((v) => v.id === selId) || filtered[0];
  const idx = filtered.findIndex((v) => v.id === sel?.id);

  useEffect(() => { listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [sel?.id]);

  const move = (d) => { const n = filtered[idx + d]; if (n) setSelId(n.id); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
  };

  if (!visits.length) return <div className="card p-10 text-center text-muted">No visits yet.</div>;

  const detail = sel ? <VisitDetail key={sel.id} v={sel} onRepeatRx={onRepeatRx} printable={printable} onPrint={onPrint} onPrev={Object.assign(() => move(1), { enabled: idx < filtered.length - 1 })} onNext={Object.assign(() => move(-1), { enabled: idx > 0 })} /> : null;
  if (!wide && phoneDetail && sel) {
    return (
      <div className={className}>
        <button className="btn-soft mb-3" onClick={() => setPhoneDetail(false)}><ArrowLeft size={16} /> All visits</button>
        <div className="card p-4">{detail}</div>
      </div>
    );
  }

  return (
    <div className={clsx('grid gap-5', compact ? 'lg:grid-cols-[300px_1fr]' : 'lg:grid-cols-[340px_1fr]', className)}>
      <div className="card flex flex-col overflow-hidden lg:max-h-[calc(100dvh-9rem)]">
        <div className="border-b border-line/70 p-3">
          <div className="relative">
            <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input className="input py-2 pl-9 text-sm" placeholder="Find diagnosis, medicine, test…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} />
          </div>
          <div className="mt-2 flex items-center justify-between px-1 text-xs text-muted">
            <span><b className="text-ink">{filtered.length}</b> of {visits.length} visits</span>
            <span className="max-sm:hidden"><span className="kbd">↑</span> <span className="kbd">↓</span> to browse</span>
          </div>
        </div>
        <ul ref={listRef} role="listbox" aria-label="Visits" tabIndex={0} onKeyDown={onKey} className="scrollbar-thin flex-1 overflow-y-auto p-2 outline-none">
          {filtered.map((v, i) => {
            const year = v.visit_date.slice(0, 4);
            const head = i === 0 || filtered[i - 1].visit_date.slice(0, 4) !== year;
            const on = wide && v.id === sel?.id;
            return (
              <li key={v.id}>
                {head && <div className="sticky top-0 z-10 bg-white/95 px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-muted backdrop-blur">{year}</div>}
                <button role="option" aria-selected={on && wide} onClick={() => { setSelId(v.id); setPhoneDetail(true); if (!wide) listRef.current?.closest(".card")?.scrollIntoView({ block: "start" }); }}
                  className={clsx('group flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition', on ? 'bg-brand-500 text-white shadow-[0_6px_16px_-8px_var(--brand-500)]' : 'hover:bg-slate-50')}>
                  <div className={clsx('w-11 shrink-0 text-center leading-tight', on ? 'text-white' : 'text-ink')}>
                    <div className="text-[17px] font-semibold tabular">{fmtDate(v.visit_date, { day: '2-digit' })}</div>
                    <div className={clsx('text-[11px] font-medium', on ? 'text-white/80' : 'text-muted')}>{fmtDate(v.visit_date, { month: 'short' })}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold">{v.diagnosis || v.complaints || 'Visit'}</div>
                    <div className={clsx('flex items-center gap-2 truncate text-[11px]', on ? 'text-white/80' : 'text-muted')}>
                      {v.bp_systolic && <span className="tabular">BP {v.bp_systolic}/{v.bp_diastolic}</span>}
                      {!!v.prescriptions?.length && <span className="inline-flex items-center gap-0.5"><Pill size={11} />{v.prescriptions.length}</span>}
                      {!!v.lab_tests?.length && <span className="inline-flex items-center gap-0.5"><FlaskConical size={11} />{v.lab_tests.length}</span>}
                      {v.doctor_comment && <Lock size={11} />}
                      {v.status !== 'completed' && <span className="font-semibold">{v.status === 'waiting' ? 'Waiting' : 'In progress'}</span>}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
          {!filtered.length && <li className="px-3 py-8 text-center text-sm text-muted">Nothing matches “{q}”.</li>}
        </ul>
      </div>
      {wide && <div className="card min-w-0 p-5 sm:p-6">{detail}</div>}
    </div>
  );
}
