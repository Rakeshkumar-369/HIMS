import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { Modal, Field, Chips } from './ui';
import { inr, todayISO } from '../lib/format';
import { PAY_MODES } from '../lib/constants';

const TERMS = [{ value: '0', label: 'On delivery' }, '7', '15', '30', '45', '60'].map((t) => (typeof t === 'string' ? { value: t, label: `${t} days` } : t));
const GST = ['0', '5', '12', '18'];
const nowLocal = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const lineTotal = (l) => (Number(l.qty) || 0) * (Number(l.rate) || 0) * (1 + (Number(l.gst_pct) || 0) / 100);

/** Add or edit a vendor. book = { book: 'personal' } or { clinicId } */
export function VendorForm({ vendor, book, categories, onClose, onSaved }) {
  const [v, setV] = useState(() => ({
    name: '', category: categories[0], contact_person: '', phone: '', email: '', address: '', city: '', gstin: '', payment_terms_days: '30', notes: '',
    ...(vendor ? Object.fromEntries(Object.entries(vendor).map(([k, x]) => [k, x ?? ''])) : {}),
    ...(vendor ? { payment_terms_days: String(vendor.payment_terms_days) } : {}),
  }));
  const [busy, setBusy] = useState(false);
  const s = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const save = async () => {
    setBusy(true);
    try {
      const body = { name: v.name, category: v.category, contact_person: v.contact_person, phone: v.phone, email: v.email, address: v.address, city: v.city, gstin: v.gstin, payment_terms_days: v.payment_terms_days, notes: v.notes };
      const res = vendor ? await api.patch(`/vendors/${vendor.id}`, body) : await api.post('/vendors', { ...body, ...book });
      toast.success(vendor ? 'Vendor updated' : `${v.name} added`);
      onSaved(res);
      onClose();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open wide onClose={onClose} title={vendor ? `Edit ${vendor.name}` : 'Add a vendor'}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!v.name.trim() || busy} onClick={save}>{vendor ? 'Save' : 'Add vendor'}</button></>}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Vendor / company name" required className="md:col-span-2"><input className="input" autoFocus value={v.name} onChange={s('name')} placeholder="e.g. Sri Balaji Pharma Distributors" /></Field>
        <Field label="What do they supply?" className="md:col-span-2"><Chips size="sm" options={categories} value={v.category} onChange={(c) => setV({ ...v, category: c })} allowDeselect={false} /></Field>
        <Field label="Contact person"><input className="input" value={v.contact_person} onChange={s('contact_person')} /></Field>
        <Field label="Mobile / WhatsApp"><input className="input" inputMode="tel" value={v.phone} onChange={s('phone')} /></Field>
        <Field label="Email"><input className="input" type="email" value={v.email} onChange={s('email')} /></Field>
        <Field label="GSTIN"><input className="input uppercase" maxLength={15} value={v.gstin} onChange={s('gstin')} /></Field>
        <Field label="Address"><input className="input" value={v.address} onChange={s('address')} /></Field>
        <Field label="City"><input className="input" value={v.city} onChange={s('city')} /></Field>
        <Field label="Payment terms" hint="Bills become due this long after delivery" className="md:col-span-2">
          <Chips size="sm" options={TERMS} value={v.payment_terms_days} onChange={(t) => setV({ ...v, payment_terms_days: t })} allowDeselect={false} />
        </Field>
        <Field label="Notes" className="md:col-span-2"><input className="input" value={v.notes} onChange={s('notes')} placeholder="Bank / UPI details, delivery days…" /></Field>
      </div>
    </Modal>
  );
}

/** Place an order with item lines. */
export function OrderForm({ vendor, knownItems = [], onClose, onSaved }) {
  const blank = () => ({ item: '', qty: '', unit: '', rate: '', gst_pct: '12' });
  const [o, setO] = useState({ ordered_at: nowLocal(), expected_on: '', notes: '' });
  const [lines, setLines] = useState([blank()]);
  const [busy, setBusy] = useState(false);
  const setLine = (i, patch) => setLines((ls) => ls.map((l, j) => {
    if (j !== i) return l;
    const next = { ...l, ...patch };
    // picking an item bought before fills its last unit, rate and GST
    const known = patch.item && knownItems.find((k) => k.item.toLowerCase() === patch.item.toLowerCase());
    return known ? { ...next, unit: next.unit || known.unit || '', rate: next.rate || String(known.rate), gst_pct: String(known.gst_pct) } : next;
  }));
  const total = lines.reduce((s, l) => s + lineTotal(l), 0);
  const valid = lines.some((l) => l.item.trim() && Number(l.qty) > 0);
  const save = async () => {
    setBusy(true);
    try {
      await api.post(`/vendors/${vendor.id}/orders`, { ...o, items: lines });
      toast.success(`Order placed with ${vendor.name}`);
      onSaved();
      onClose();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open xl onClose={onClose} title={`New order · ${vendor.name}`}
      footer={<><div className="mr-auto self-center text-sm">Order value <b className="tabular">{inr(total)}</b> <span className="text-muted">incl. GST</span></div><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!valid || busy} onClick={save}>Place order</button></>}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Ordered on"><input type="datetime-local" className="input" value={o.ordered_at} onChange={(e) => setO({ ...o, ordered_at: e.target.value })} /></Field>
        <Field label="Expected delivery"><input type="date" className="input" value={o.expected_on} onChange={(e) => setO({ ...o, expected_on: e.target.value })} /></Field>
        <Field label="Note"><input className="input" value={o.notes} onChange={(e) => setO({ ...o, notes: e.target.value })} placeholder="Optional" /></Field>
      </div>
      <datalist id="known-items">{knownItems.map((k) => <option key={k.item} value={k.item} />)}</datalist>
      <div className="mt-5 space-y-2.5">
        {lines.map((l, i) => (
          <div key={i} className="rounded-2xl border border-line p-3">
            <div className="flex items-center gap-2">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-100 text-xs font-bold text-brand-700">{i + 1}</span>
              <input className="input py-2" list="known-items" placeholder="Item (e.g. Examination gloves, box of 100)" value={l.item} onChange={(e) => setLine(i, { item: e.target.value })} />
              {lines.length > 1 && <button className="btn-ghost p-2 text-rose-500" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label="Remove line"><Trash2 size={16} /></button>}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 pl-9 sm:grid-cols-[1fr_1fr_1fr_auto_auto]">
              <input className="input py-2 tabular" type="number" min="0" step="any" inputMode="decimal" placeholder="Qty" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} />
              <input className="input py-2" placeholder="Unit (box)" value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} />
              <input className="input py-2 tabular" type="number" min="0" step="any" inputMode="decimal" placeholder="Rate ₹" value={l.rate} onChange={(e) => setLine(i, { rate: e.target.value })} />
              <div className="col-span-2 sm:col-span-1"><Chips size="sm" options={GST.map((g) => ({ value: g, label: `${g}%` }))} value={l.gst_pct} onChange={(g) => setLine(i, { gst_pct: g })} allowDeselect={false} /></div>
              <div className="self-center text-right text-sm font-bold tabular">{inr(lineTotal(l))}</div>
            </div>
          </div>
        ))}
        <button className="btn-outline w-full border-dashed" onClick={() => setLines((ls) => [...ls, blank()])}><Plus size={16} /> Add item</button>
      </div>
    </Modal>
  );
}

/** Record what arrived (fully or partly) against an order. */
export function DeliveryForm({ order, onClose, onSaved }) {
  const open = order.items.filter((i) => Number(i.qty) - Number(i.received_qty) > 0);
  const [d, setD] = useState({ delivered_at: nowLocal(), invoice_no: '', amount: '' });
  const [lines, setLines] = useState(() => open.map((i) => ({ order_item_id: i.id, qty: String(Number(i.qty) - Number(i.received_qty)), batch_no: '', expiry_date: '' })));
  const [busy, setBusy] = useState(false);
  const computed = lines.reduce((s, l) => { const it = open.find((i) => i.id === l.order_item_id); return s + lineTotal({ ...it, qty: l.qty }); }, 0);
  const save = async () => {
    setBusy(true);
    try {
      const r = await api.post(`/vendors/orders/${order.id}/deliveries`, { ...d, items: lines });
      toast.success(`Delivery recorded · bill ${inr(r.amount)}`);
      onSaved();
      onClose();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open xl onClose={onClose} title={`Record delivery · ${order.order_no}`}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || !lines.some((l) => Number(l.qty) > 0)} onClick={save}>Save delivery</button></>}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Received on"><input type="datetime-local" className="input" value={d.delivered_at} onChange={(e) => setD({ ...d, delivered_at: e.target.value })} /></Field>
        <Field label="Vendor invoice no."><input className="input" value={d.invoice_no} onChange={(e) => setD({ ...d, invoice_no: e.target.value })} /></Field>
        <Field label="Bill amount (₹)" hint={`Calculated: ${inr(computed)} — change only if the bill differs`}>
          <input className="input tabular" type="number" min="0" step="any" inputMode="decimal" placeholder={computed.toFixed(2)} value={d.amount} onChange={(e) => setD({ ...d, amount: e.target.value })} />
        </Field>
      </div>
      <div className="mt-5 space-y-2.5">
        {lines.map((l, i) => {
          const it = open.find((x) => x.id === l.order_item_id);
          const left = Number(it.qty) - Number(it.received_qty);
          const set = (patch) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, ...patch } : x)));
          return (
            <div key={l.order_item_id} className="rounded-2xl border border-line p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{it.item}</span>
                <span className="text-xs text-muted">{left} {it.unit || ''} still to come · {inr(it.rate)} each</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <Field label="Received"><input className="input py-2 tabular" type="number" min="0" max={left} step="any" inputMode="decimal" value={l.qty} onChange={(e) => set({ qty: e.target.value })} /></Field>
                <Field label="Batch no."><input className="input py-2" value={l.batch_no} onChange={(e) => set({ batch_no: e.target.value })} /></Field>
                <Field label="Expiry"><input type="date" className="input py-2" value={l.expiry_date} onChange={(e) => set({ expiry_date: e.target.value })} /></Field>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

/** Pay a vendor (counts as a clinic expense on the payment date). */
export function VendorPaymentForm({ vendor, outstanding, onClose, onSaved }) {
  const [p, setP] = useState({ paid_on: todayISO(), amount: outstanding > 0 ? String(outstanding) : '', mode: 'UPI', reference: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api.post(`/vendors/${vendor.id}/payments`, p);
      toast.success(`Payment of ${inr(p.amount)} to ${vendor.name} saved`, { description: 'It now shows in Accounts as an expense.' });
      onSaved();
      onClose();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Pay ${vendor.name}`}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!(Number(p.amount) > 0) || busy} onClick={save}>Save payment</button></>}>
      <div className="space-y-4">
        <div className="rounded-2xl bg-brand-50 px-4 py-3 text-sm">Outstanding now: <b className="tabular">{inr(outstanding)}</b> · payments clear the oldest bills first</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)"><input className="input text-lg font-bold tabular" type="number" min="1" step="any" inputMode="decimal" value={p.amount} onChange={(e) => setP({ ...p, amount: e.target.value })} autoFocus /></Field>
          <Field label="Paid on"><input type="date" className="input" max={todayISO()} value={p.paid_on} onChange={(e) => setP({ ...p, paid_on: e.target.value })} /></Field>
        </div>
        <Field label="Mode"><Chips size="sm" options={PAY_MODES} value={p.mode} onChange={(m) => setP({ ...p, mode: m })} allowDeselect={false} /></Field>
        <Field label="Reference" hint="UPI / cheque / UTR number"><input className="input" value={p.reference} onChange={(e) => setP({ ...p, reference: e.target.value })} /></Field>
        <Field label="Note"><input className="input" value={p.notes} onChange={(e) => setP({ ...p, notes: e.target.value })} placeholder="Optional" /></Field>
      </div>
    </Modal>
  );
}
