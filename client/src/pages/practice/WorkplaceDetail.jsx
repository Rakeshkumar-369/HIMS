import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Hospital, Phone, MapPin, Pencil, IndianRupee, Plus, Trash2, FileDown, Printer, Receipt, Power } from 'lucide-react';
import { api } from '../../lib/api';
import { useFetch, useMode } from '../../lib/hooks';
import { PageLoader, Segmented, Empty } from '../../components/ui';
import { MoneyTile, Pill } from '../../components/money';
import { WorkplaceForm, PracticePaymentForm, ServiceForm } from '../../components/practice';
import { downloadCSV } from '../../lib/csv';
import { palette } from '../../lib/themes';
import { fmtDate, fmtTime, inr, balanceText } from '../../lib/format';

export default function WorkplaceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { mode } = useMode();
  const { data, reload } = useFetch(`/practice/workplaces/${id}`);
  const options = useFetch('/practice/options');
  const [tab, setTab] = useState('services');
  const [modal, setModal] = useState(null);
  if (!data || !options.data) return <PageLoader />;
  const { workplace: w, services, payments, statement } = data;
  const p = palette(w.theme, mode);
  const refresh = () => { reload(); options.reload(); };
  const act = async (fn, msg) => { try { await fn(); toast.success(msg); refresh(); } catch (e) { toast.error(e.message); } };
  const exportCSV = () => downloadCSV(`Statement-${w.name.replace(/\W+/g, '-')}`, [
    { label: 'Date', value: 'date' }, { label: 'Description', value: 'description' }, { label: 'Reference', value: 'ref' },
    { label: 'Billed (₹)', value: (r) => r.debit || '' }, { label: 'Received incl. TDS (₹)', value: (r) => r.credit || '' }, { label: 'Balance (₹)', value: 'balance' },
  ], statement);

  return (
    <div className="animate-in space-y-5">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft size={16} /> Back</button>
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-4 p-5 sm:p-6" style={{ background: `linear-gradient(120deg, ${p[100]}, ${p[50]} 60%, transparent)` }}>
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl text-white shadow-soft max-sm:hidden" style={{ background: p[600] }}><Hospital size={26} /></span>
          <div className="min-w-0 flex-1 basis-60">
            <div className="text-xs font-medium" style={{ color: p[800] }}>{w.kind} · {options.data.payModels[w.pay_model]}{w.share_pct ? ` ${Number(w.share_pct)}%` : ''}{!w.is_active && ' · inactive'}</div>
            <h1 className="text-2xl font-semibold break-words">{w.name}</h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              {(w.address || w.city) && <span className="inline-flex items-center gap-1"><MapPin size={13} />{[w.address, w.city].filter(Boolean).join(', ')}</span>}
              {w.contact_person && <span>{w.contact_person}</span>}
              <span>Usual fee {inr(w.default_fee)} · TDS {Number(w.tds_pct)}% · pays in ~{w.credit_days} days</span>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto">
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button className="btn-primary" onClick={() => setModal('pay')}><IndianRupee size={16} /> <span className="sm:hidden">Got paid</span><span className="max-sm:hidden">Payment received</span></button>
              <button className="btn-outline" onClick={() => setModal('service')}><Plus size={16} /> Log service</button>
            </div>
            <div className="flex flex-wrap justify-around gap-1 sm:justify-end">
              {w.phone && <a href={`tel:${w.phone}`} className="btn-ghost"><Phone size={16} /> Call</a>}
              <button className="btn-ghost" onClick={() => setModal('edit')}><Pencil size={16} /> Edit</button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
        <MoneyTile label="Billed (all time)" value={w.billed} sub={`${w.services} services`} />
        <MoneyTile label="Received" value={w.received} tone="good" />
        <MoneyTile label="TDS deducted" value={w.tds} sub="claim in your tax return" />
        <MoneyTile label="Pending" value={w.outstanding} tone={w.outstanding > 0 ? 'brand' : 'good'} sub={w.written_off ? `${inr(w.written_off)} written off` : null} />
        <MoneyTile label="Overdue" value={w.overdue} tone={w.overdue > 0 ? 'bad' : 'default'} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented options={[{ value: 'services', label: `Services (${services.length})` }, { value: 'payments', label: `Payments (${payments.length})` }, { value: 'statement', label: 'Statement' }]} value={tab} onChange={setTab} />
        {tab === 'statement' && (
          <div className="flex gap-2">
            <button className="btn-outline" onClick={exportCSV}><FileDown size={16} /> Excel / CSV</button>
            <Link to={`/print/statement/workplace/${w.id}`} target="_blank" className="btn-outline"><Printer size={16} /> PDF</Link>
          </div>
        )}
      </div>

      {tab === 'services' && (
        <ul className="card divide-y divide-line/70 overflow-hidden">
          {!services.length && <Empty icon={Receipt} title="No services logged here yet" />}
          {services.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-20 shrink-0 text-xs text-muted tabular">{fmtDate(s.service_at.slice(0, 10), { day: '2-digit', month: 'short', year: '2-digit' })}<br />{fmtTime(s.service_at)}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{s.procedure_name || s.service_type}</div>
                <div className="truncate text-xs text-muted">{[s.service_type, s.patient_name, s.hospital_ref].filter(Boolean).join(' · ')}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-bold tabular">{inr(s.amount_billed)}</div>
                <Pill status={s.status} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {tab === 'payments' && (
        <ul className="card divide-y divide-line/70 overflow-hidden">
          {!payments.length && <Empty icon={Receipt} title="No payments yet" action={<button className="btn-primary" onClick={() => setModal('pay')}><IndianRupee size={16} /> Record a payment</button>} />}
          {payments.map((x) => (
            <li key={x.id} className="group flex items-center gap-3 px-4 py-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><IndianRupee size={18} /></div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{fmtDate(x.received_on)} · {x.mode}</div>
                <div className="truncate text-xs text-muted">{[x.reference, Number(x.tds_amount) ? `TDS ${inr(x.tds_amount)}` : null, x.notes].filter(Boolean).join(' · ') || '—'}</div>
              </div>
              <span className="font-bold text-emerald-700 tabular">{inr(x.amount)}</span>
              <button className="btn-ghost p-1.5 text-rose-500 opacity-0 group-hover:opacity-100 max-md:opacity-100" aria-label="Delete payment"
                onClick={() => window.confirm(`Delete the payment of ${inr(x.amount)}?`) && act(() => api.del(`/practice/payments/${x.id}`), 'Payment deleted')}><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
      )}

      {tab === 'statement' && (
        <div className="card overflow-hidden">
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50/70 text-left text-xs font-medium text-muted">
                <tr><th className="px-4 py-3">Date</th><th className="px-3 py-3">Description</th><th className="px-3 py-3">Ref</th><th className="px-3 py-3 text-right">Billed</th><th className="px-3 py-3 text-right">Received</th><th className="px-4 py-3 text-right">Balance</th></tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {statement.map((r, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted tabular">{fmtDate(r.date)}</td>
                    <td className="px-3 py-2.5">{r.description}</td>
                    <td className="px-3 py-2.5 text-muted">{r.ref || '—'}</td>
                    <td className="px-3 py-2.5 text-right tabular">{r.debit ? inr(r.debit) : ''}</td>
                    <td className="px-3 py-2.5 text-right text-emerald-700 tabular">{r.credit ? inr(r.credit) : ''}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular">{balanceText(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button className="btn-ghost text-sm" onClick={() => act(() => api.patch(`/practice/workplaces/${w.id}`, { is_active: !w.is_active }), w.is_active ? 'Marked inactive' : 'Re-activated')}>
          <Power size={15} /> {w.is_active ? 'I no longer work here' : 'Re-activate'}
        </button>
      </div>

      {modal === 'edit' && <WorkplaceForm workplace={w} options={options.data} onClose={() => setModal(null)} onSaved={refresh} />}
      {modal === 'pay' && <PracticePaymentForm workplace={w} outstanding={w.outstanding} onClose={() => setModal(null)} onSaved={refresh} />}
      {modal === 'service' && <ServiceForm options={options.data} defaultWorkplaceId={w.id} onClose={() => setModal(null)} onSaved={refresh} />}
    </div>
  );
}
