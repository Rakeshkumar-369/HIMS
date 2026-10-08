import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Plus, Search, ClipboardList, Building2, AlertTriangle, Wallet, Pencil, Ban, Undo2, Trash2, FileDown, Hospital } from 'lucide-react';
import { api } from '../../lib/api';
import { useFetch, useDebounced } from '../../lib/hooks';
import { PageHeader, PageLoader, Empty, Modal } from '../../components/ui';
import { MoneyTile, Pill } from '../../components/money';
import { ServiceForm, WorkplaceDot } from '../../components/practice';
import { downloadCSV } from '../../lib/csv';
import { fmtDate, fmtTime, inr, todayISO } from '../../lib/format';

const STATUS = [{ value: '', label: 'All' }, { value: 'unpaid', label: 'Not paid yet' }, { value: 'overdue', label: 'Overdue' }, { value: 'received', label: 'Received' }, { value: 'written_off', label: 'Written off' }];

const MONTHS = Array.from({ length: 24 }, (_, i) => {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
});

export default function WorkLog() {
  const [params, setParams] = useSearchParams();
  const [wp, setWp] = useState('');
  const [status, setStatus] = useState('');
  const [month, setMonth] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);
  const [editing, setEditing] = useState(null);
  const adding = params.get('new') === '1';
  const setAdding = (v) => setParams(v ? { new: '1' } : {}, { replace: true });

  const options = useFetch('/practice/options');
  const summary = useFetch('/practice/summary?range=1m');
  const qs = new URLSearchParams({ ...(wp && { workplaceId: wp }), ...(status && { status }), ...(month && { month }), ...(dq && { q: dq }) }).toString();
  const { data, reload } = useFetch(`/practice/services?${qs}`, { keep: true });
  const refresh = () => { reload(); summary.reload(); options.reload(); };

  const groups = useMemo(() => {
    const m = new Map();
    for (const s of data?.services || []) { const d = s.service_at.slice(0, 10); if (!m.has(d)) m.set(d, []); m.get(d).push(s); }
    return [...m.entries()];
  }, [data]);

  if (!options.data) return <PageLoader />;
  const o = options.data;
  if (!o.workplaces.length) {
    return (
      <div className="animate-in">
        <PageHeader eyebrow="My practice" title="Work log" />
        <div className="card"><Empty icon={Hospital} title="First, add the places you work at" text="Hospitals, clinics, nursing homes, camps or teleconsult platforms — with how and when they pay you."
          action={<Link to="/app/workplaces?new=1" className="btn-primary"><Plus size={16} /> Add a workplace</Link>} /></div>
      </div>
    );
  }
  const k = summary.data?.kpis;
  const act = async (fn, msg) => { try { await fn(); toast.success(msg); refresh(); setEditing(null); } catch (e) { toast.error(e.message); } };
  const exportCSV = () => downloadCSV(`Work-log-${todayISO()}`, [
    { label: 'Date', value: (s) => s.service_at.slice(0, 10) }, { label: 'Time', value: (s) => s.service_at.slice(11, 16) }, { label: 'Workplace', value: (s) => s.workplace?.name },
    { label: 'Type', value: 'service_type' }, { label: 'Procedure / service', value: 'procedure_name' }, { label: 'Patient', value: 'patient_name' },
    { label: 'Age', value: 'patient_age' }, { label: 'Gender', value: 'patient_gender' }, { label: 'Hospital ref', value: 'hospital_ref' },
    { label: 'Billed (₹)', value: 'amount_billed' }, { label: 'Settled (₹)', value: 'settled' }, { label: 'Pending (₹)', value: 'open' }, { label: 'Status', value: 'status' },
  ], data?.services || []);

  return (
    <div className="animate-in">
      <PageHeader eyebrow="My practice" title="Work log" subtitle="Every case, procedure and duty — with what was agreed and what has been paid."
        actions={<>
          <button className="btn-outline max-sm:hidden" onClick={exportCSV}><FileDown size={16} /> Excel / CSV</button>
          <button className="btn-primary max-lg:hidden" onClick={() => setAdding(true)}><Plus size={17} /> Log a service</button>
        </>} />

      {k && (
        <div className="mb-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <MoneyTile icon={Wallet} label="Pending from all" value={k.outstanding} tone="brand" sub="billed, not yet paid" />
          <MoneyTile icon={AlertTriangle} label="Overdue" value={k.overdue} tone={k.overdue > 0 ? 'bad' : 'default'} sub="later than usual" onClick={() => setStatus('overdue')} active={status === 'overdue'} />
          <MoneyTile label="Billed · last 30 days" value={k.billed} sub={`${k.services} services`} />
          <MoneyTile label="Received · last 30 days" value={k.received} tone="good" sub={k.tds ? `+ ${inr(k.tds)} TDS` : null} />
        </div>
      )}

      <div className="no-scrollbar -mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        <button className={clsx('chip shrink-0', !wp && 'chip-on')} onClick={() => setWp('')}><Building2 size={14} /> All places</button>
        {o.workplaces.map((w) => (
          <button key={w.id} className={clsx('chip shrink-0', String(w.id) === wp && 'chip-on')} onClick={() => setWp(String(w.id) === wp ? '' : String(w.id))}>
            <WorkplaceDot theme={w.theme} className="size-2" /> {w.name}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {STATUS.map((st) => <button key={st.value} className={clsx('chip shrink-0 px-2.5 py-1 text-xs', status === st.value && 'chip-on')} onClick={() => setStatus(st.value)}>{st.label}</button>)}
        </div>
        <select className="input w-auto py-2 text-sm" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
          <option value="">All months</option>
          {MONTHS.map((m) => <option key={m} value={m}>{fmtDate(`${m}-01`, { month: 'long', year: 'numeric' })}</option>)}
        </select>
        <div className="relative min-w-0 flex-1 basis-48">
          <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input className="input py-2 pl-9 text-sm" placeholder="Procedure, patient, IP no…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {!data ? <PageLoader /> : !groups.length ? (
        <div className="card"><Empty icon={ClipboardList} title="Nothing here yet" text="Log your first case — it takes about 10 seconds." action={<button className="btn-primary" onClick={() => setAdding(true)}><Plus size={16} /> Log a service</button>} /></div>
      ) : (
        <div className="space-y-4">
          {groups.map(([day, rows]) => (
            <section key={day}>
              <div className="mb-1.5 flex items-baseline justify-between px-1">
                <h3 className="text-sm font-bold">{day === todayISO() ? 'Today' : fmtDate(day, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</h3>
                <span className="text-xs text-muted tabular">{inr(rows.reduce((s, r) => s + Number(r.amount_billed), 0))}</span>
              </div>
              <ul className="card divide-y divide-line/70 overflow-hidden">
                {rows.map((s) => (
                  <li key={s.id}>
                    <button onClick={() => setEditing(s)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-brand-50/40">
                      <div className="w-14 shrink-0 text-xs font-semibold whitespace-nowrap text-muted tabular">{fmtTime(s.service_at)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{s.procedure_name || s.service_type}</div>
                        <div className="flex items-center gap-1.5 truncate text-xs text-muted">
                          <WorkplaceDot theme={s.workplace?.theme} className="size-2" /><span className="truncate">{s.workplace?.name}</span>
                          {s.patient_name && <span className="truncate">· {s.patient_name}{s.patient_age ? `, ${s.patient_age}${s.patient_gender ? s.patient_gender[0] : ''}` : ''}</span>}
                          {s.hospital_ref && <span className="max-sm:hidden">· {s.hospital_ref}</span>}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-bold tabular">{inr(s.amount_billed)}</div>
                        <Pill status={s.status} />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {data.total > data.services.length && <p className="text-center text-sm text-muted">Showing the latest {data.services.length} of {data.total}. Use the filters to narrow down.</p>}
        </div>
      )}

      {adding && <ServiceForm options={o} defaultWorkplaceId={Number(wp) || undefined} onClose={() => setAdding(false)} onSaved={refresh} />}
      {editing && !editing.edit && (
        <Modal open onClose={() => setEditing(null)} title={editing.procedure_name || editing.service_type}
          footer={<>
            <button className="btn-ghost text-rose-600" onClick={() => window.confirm('Delete this entry?') && act(() => api.del(`/practice/services/${editing.id}`), 'Entry deleted')}><Trash2 size={15} /> Delete</button>
            <div className="flex-1" />
            <button className="btn-primary" onClick={() => setEditing({ ...editing, edit: true })}><Pencil size={15} /> Edit</button>
          </>}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div><dt className="text-xs text-muted">When</dt><dd className="font-semibold">{fmtDate(editing.service_at.slice(0, 10))} · {fmtTime(editing.service_at)}</dd></div>
            <div><dt className="text-xs text-muted">Where</dt><dd className="font-semibold">{editing.workplace?.name}</dd></div>
            <div><dt className="text-xs text-muted">Type</dt><dd className="font-semibold">{editing.service_type}</dd></div>
            <div><dt className="text-xs text-muted">Patient</dt><dd className="font-semibold">{[editing.patient_name, editing.patient_age && `${editing.patient_age} y`, editing.patient_gender].filter(Boolean).join(', ') || '—'}</dd></div>
            <div><dt className="text-xs text-muted">Hospital ref</dt><dd className="font-semibold">{editing.hospital_ref || '—'}</dd></div>
            <div><dt className="text-xs text-muted">Mobile</dt><dd className="font-semibold">{editing.patient_phone || '—'}</dd></div>
            <div><dt className="text-xs text-muted">Billed</dt><dd className="text-lg font-extrabold tabular">{inr(editing.amount_billed)}</dd></div>
            <div><dt className="text-xs text-muted">Status</dt><dd className="flex flex-wrap items-center gap-2"><Pill status={editing.status} />{editing.open > 0 && <span className="text-xs text-muted">{inr(editing.open)} pending · due {fmtDate(editing.due_on)}</span>}</dd></div>
            {editing.notes && <div className="col-span-2"><dt className="text-xs text-muted">Note</dt><dd>{editing.notes}</dd></div>}
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            {editing.open > 0 && <button className="btn-outline" onClick={() => window.confirm(`Write off ${inr(editing.open)}? Use this when you know it will not be paid.`) && act(() => api.post(`/practice/services/${editing.id}/write-off`, {}), 'Written off')}><Ban size={15} /> Write off {inr(editing.open)}</button>}
            {Number(editing.written_off) > 0 && <button className="btn-outline" onClick={() => act(() => api.post(`/practice/services/${editing.id}/write-off`, { undo: true }), 'Write-off undone')}><Undo2 size={15} /> Undo write-off</button>}
            <Link to={`/app/workplaces/${editing.workplace_id}`} className="btn-ghost">Open {editing.workplace?.name}</Link>
          </div>
        </Modal>
      )}
      {editing?.edit && <ServiceForm service={editing} options={o} onClose={() => setEditing(null)} onSaved={refresh} />}
    </div>
  );
}
