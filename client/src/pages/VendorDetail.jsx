import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import clsx from 'clsx';
import {
  ArrowLeft, Truck, Phone, MessageCircle, MapPin, Pencil, ShoppingCart, IndianRupee, PackageCheck, XCircle, Trash2, FileDown, Printer, Receipt,
} from 'lucide-react';
import { api } from '../lib/api';
import { useFetch } from '../lib/hooks';
import { PageLoader, Segmented, Empty } from '../components/ui';
import { MoneyTile, Pill } from '../components/money';
import { VendorForm, OrderForm, DeliveryForm, VendorPaymentForm } from '../components/vendors';
import { downloadCSV } from '../lib/csv';
import { fmtDate, fmtTime, inr, balanceText } from '../lib/format';

export default function VendorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, reload } = useFetch(`/vendors/${id}`);
  const [tab, setTab] = useState('orders');
  const [modal, setModal] = useState(null); // 'edit' | 'order' | 'pay' | { delivery: order }
  const knownItems = useMemo(() => {
    const m = new Map();
    for (const o of [...(data?.orders || [])].reverse()) for (const i of o.items) m.set(i.item.toLowerCase(), i);
    return [...m.values()];
  }, [data]);

  if (!data) return <PageLoader />;
  const { vendor: v, balance: b, orders, payments, statement } = data;
  const act = async (fn, msg) => { try { await fn(); toast.success(msg); reload(); } catch (e) { toast.error(e.message); } };
  const exportCSV = () => downloadCSV(`Statement-${v.name.replace(/\W+/g, '-')}`, [
    { label: 'Date', value: 'date' }, { label: 'Description', value: 'description' }, { label: 'Reference', value: 'ref' },
    { label: 'Bill (₹)', value: (r) => r.debit || '' }, { label: 'Paid (₹)', value: (r) => r.credit || '' }, { label: 'Balance (₹)', value: 'balance' },
  ], statement);
  const wa = v.phone ? `https://wa.me/${v.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}` : null;

  return (
    <div className="animate-in space-y-5">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft size={16} /> Vendors</button>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-4 bg-gradient-to-r from-brand-100 via-brand-50 to-white p-5 sm:p-6">
          <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white text-brand-600 shadow-soft max-sm:hidden"><Truck size={26} /></div>
          <div className="min-w-0 flex-1 basis-60">
            <div className="text-xs font-medium text-brand-700">{v.category}{!v.is_active && ' · inactive'}</div>
            <h1 className="text-2xl font-semibold break-words">{v.name}</h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              {v.contact_person && <span>{v.contact_person}</span>}
              {(v.address || v.city) && <span className="inline-flex items-center gap-1"><MapPin size={13} />{[v.address, v.city].filter(Boolean).join(', ')}</span>}
              <span>{v.payment_terms_days ? `${v.payment_terms_days}-day credit` : 'Pay on delivery'}</span>
              {v.gstin && <span className="font-mono text-xs">GSTIN {v.gstin}</span>}
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto">
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button className="btn-primary" onClick={() => setModal('order')}><ShoppingCart size={16} /> New order</button>
              <button className="btn-outline" onClick={() => setModal('pay')}><IndianRupee size={16} /> <span className="sm:hidden">Payment</span><span className="max-sm:hidden">Record payment</span></button>
            </div>
            <div className="flex flex-wrap justify-around gap-1 sm:justify-end">
              {v.phone && <a href={`tel:${v.phone}`} className="btn-ghost"><Phone size={16} /> Call</a>}
              {wa && <a href={wa} target="_blank" rel="noreferrer" className="btn-ghost"><MessageCircle size={16} /> WhatsApp</a>}
              <button className="btn-ghost" onClick={() => setModal('edit')}><Pencil size={16} /> Edit</button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
        <MoneyTile label="Billed (delivered)" value={b.billed} />
        <MoneyTile label="Paid" value={b.paid} tone="good" sub={b.last_paid ? `Last on ${fmtDate(b.last_paid)}` : 'No payments yet'} />
        <MoneyTile label="Outstanding" value={b.outstanding} tone={b.outstanding > 0 ? 'brand' : 'good'} />
        <MoneyTile label="Overdue" value={b.overdue} tone={b.overdue > 0 ? 'bad' : 'default'} sub={b.due_soon > 0 ? `${inr(b.due_soon)} due in 7 days` : null} />
        <MoneyTile label="Awaiting delivery" value={b.pending_delivery} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented options={[{ value: 'orders', label: `Orders (${orders.length})` }, { value: 'payments', label: `Payments (${payments.length})` }, { value: 'statement', label: 'Statement' }]} value={tab} onChange={setTab} />
        {tab === 'statement' && (
          <div className="flex gap-2">
            <button className="btn-outline" onClick={exportCSV}><FileDown size={16} /> Excel / CSV</button>
            <Link to={`/print/statement/vendor/${v.id}`} target="_blank" className="btn-outline"><Printer size={16} /> PDF</Link>
          </div>
        )}
      </div>

      {tab === 'orders' && (
        <div className="space-y-3">
          {!orders.length && <div className="card"><Empty icon={ShoppingCart} title="No orders yet" action={<button className="btn-primary" onClick={() => setModal('order')}><ShoppingCart size={16} /> Place first order</button>} /></div>}
          {orders.map((o) => (
            <article key={o.id} className={clsx('card p-4 sm:p-5', o.status === 'cancelled' && 'opacity-60')}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-bold">{o.order_no}</span>
                <Pill status={o.status} kind="order" />
                {o.billed > 0 && <Pill status={o.pay_status} />}
                <span className="ml-auto text-sm text-muted">{fmtDate(o.ordered_at.slice(0, 10))} · {fmtTime(o.ordered_at)}</span>
              </div>
              <ul className="mt-3 divide-y divide-line/60 rounded-2xl border border-line/70 text-sm">
                {o.items.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate font-medium">{i.item}</span>
                    <span className="shrink-0 text-xs text-muted tabular">{Number(i.received_qty)}/{Number(i.qty)} {i.unit} × {inr(i.rate)}{Number(i.gst_pct) ? ` +${Number(i.gst_pct)}%` : ''}</span>
                    <span className="w-24 shrink-0 text-right font-semibold tabular">{inr(i.total)}</span>
                  </li>
                ))}
              </ul>
              {o.deliveries.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {o.deliveries.map((d) => (
                    <div key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-slate-50 px-3 py-2 text-xs">
                      <PackageCheck size={14} className="text-emerald-600" />
                      <span className="font-semibold">Delivered {fmtDate(d.delivered_at.slice(0, 10))}</span>
                      {d.invoice_no && <span className="text-muted">Inv {d.invoice_no}</span>}
                      <span className="font-bold tabular">{inr(d.amount)}</span>
                      {d.open > 0
                        ? <span className={clsx('font-semibold', d.late_days > 0 ? 'text-rose-600' : 'text-muted')}>{inr(d.open)} {d.late_days > 0 ? `overdue by ${d.late_days} days` : `due ${fmtDate(d.due_on)}`}</span>
                        : <span className="font-semibold text-emerald-700">Paid</span>}
                      {d.items.some((x) => x.batch_no || x.expiry_date) && (
                        <span className="w-full text-muted">{d.items.filter((x) => x.batch_no || x.expiry_date).map((x) => `${x.item}: ${x.batch_no ? `batch ${x.batch_no}` : ''}${x.expiry_date ? ` exp ${fmtDate(x.expiry_date, { month: 'short', year: 'numeric' })}` : ''}`).join(' · ')}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm">Order value <b className="tabular">{inr(o.value)}</b></span>
                <div className="flex-1" />
                {['ordered', 'partial'].includes(o.status) && <button className="btn-soft px-3 py-2" onClick={() => setModal({ delivery: o })}><PackageCheck size={15} /> Record delivery</button>}
                {o.status === 'ordered' && <button className="btn-ghost px-3 py-2 text-rose-600" onClick={() => window.confirm(`Cancel ${o.order_no}?`) && act(() => api.post(`/vendors/orders/${o.id}/cancel`), 'Order cancelled')}><XCircle size={15} /> Cancel</button>}
              </div>
            </article>
          ))}
        </div>
      )}

      {tab === 'payments' && (
        <div className="card overflow-hidden">
          {!payments.length && <Empty icon={Receipt} title="No payments recorded" />}
          <ul className="divide-y divide-line/70">
            {payments.map((p) => (
              <li key={p.id} className="group flex items-center gap-3 px-4 py-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><IndianRupee size={18} /></div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{fmtDate(p.paid_on)} · {p.mode}</div>
                  <div className="truncate text-xs text-muted">{[p.reference, p.notes].filter(Boolean).join(' · ') || '—'}</div>
                </div>
                <span className="font-bold text-emerald-700 tabular">{inr(p.amount)}</span>
                <button className="btn-ghost p-1.5 text-rose-500 opacity-0 group-hover:opacity-100 max-md:opacity-100" aria-label="Delete payment"
                  onClick={() => window.confirm(`Delete the payment of ${inr(p.amount)} on ${fmtDate(p.paid_on)}?`) && act(() => api.del(`/vendors/payments/${p.id}`), 'Payment deleted')}><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'statement' && (
        <div className="card overflow-hidden">
          {!statement.length && <Empty icon={Receipt} title="Nothing yet" text="Deliveries and payments appear here with a running balance." />}
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50/70 text-left text-xs font-medium text-muted">
                <tr><th className="px-4 py-3">Date</th><th className="px-3 py-3">Description</th><th className="px-3 py-3">Ref</th><th className="px-3 py-3 text-right">Bill</th><th className="px-3 py-3 text-right">Paid</th><th className="px-4 py-3 text-right">Balance</th></tr>
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

      {modal === 'edit' && <VendorForm vendor={v} categories={data.categories} onClose={() => setModal(null)} onSaved={reload} />}
      {modal === 'order' && <OrderForm vendor={v} knownItems={knownItems} onClose={() => setModal(null)} onSaved={reload} />}
      {modal === 'pay' && <VendorPaymentForm vendor={v} outstanding={b.outstanding} onClose={() => setModal(null)} onSaved={reload} />}
      {modal?.delivery && <DeliveryForm order={modal.delivery} onClose={() => setModal(null)} onSaved={reload} />}
    </div>
  );
}
