import { useState } from 'react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { Plus, Trash2, ArrowDownCircle, ArrowUpCircle, Stethoscope, Wallet, Truck } from 'lucide-react';
import { useAuth } from '../context/authCtx';
import { api } from '../lib/api';
import { useFetch } from '../lib/hooks';
import { PageHeader, PageLoader, Segmented, Chips, Field, Empty } from '../components/ui';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../lib/constants';
import { inr, fmtDate, todayISO } from '../lib/format';

const PERIODS = [{ value: 7, label: '7 days' }, { value: 30, label: '30 days' }, { value: 90, label: '90 days' }, { value: 365, label: '1 year' }];
const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - (n - 1)); return d.toISOString().slice(0, 10); };

export default function Accounts() {
  const { clinicId, clinic } = useAuth();
  const [days, setDays] = useState(30);
  const [form, setForm] = useState({ kind: 'expense', category: 'Medical supplies', amount: '', note: '', txn_date: todayISO() });
  const [busy, setBusy] = useState(false);
  const { data, reload } = useFetch(`/transactions?clinicId=${clinicId}&from=${ago(days)}`, { keep: true });

  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/transactions', { ...form, clinic_id: clinicId });
      toast.success(`${form.kind === 'expense' ? 'Expense' : 'Income'} of ${inr(form.amount)} saved`);
      setForm({ ...form, amount: '', note: '' });
      reload();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  const remove = async (id) => { try { await api.del(`/transactions/${id}`); reload(); } catch (e) { toast.error(e.message); } };

  if (!data) return <PageLoader />;
  const inc = data.transactions.filter((t) => t.kind === 'income').reduce((s, t) => s + Number(t.amount), 0) + data.consultation.amount;
  const exp = data.transactions.filter((t) => t.kind === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const cats = form.kind === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <div className="animate-in">
      <PageHeader eyebrow={clinic.name} title="Accounts" subtitle="Consultation fees and vendor payments are added automatically. Record everything else here." actions={<Segmented options={PERIODS} value={days} onChange={setDays} />} />
      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
        <div className="card p-3 sm:p-5"><div className="flex items-center gap-1.5 text-xs text-muted"><span className="size-1.5 rounded-full bg-emerald-400" />Income</div><div className="mt-1 text-[15px] font-semibold sm:text-2xl tabular">{inr(inc)}</div><div className="mt-1 text-xs text-muted max-sm:hidden">incl. {inr(data.consultation.amount)} from {data.consultation.visits} consultations</div></div>
        <div className="card p-3 sm:p-5"><div className="flex items-center gap-1.5 text-xs text-muted"><span className="size-1.5 rounded-full bg-amber-400" />Outflow</div><div className="mt-1 text-[15px] font-semibold sm:text-2xl tabular">{inr(exp)}</div></div>
        <div className="card p-3 sm:p-5"><div className="text-xs text-muted">Net</div><div className={clsx('mt-1 text-[15px] font-semibold sm:text-2xl tabular', inc - exp >= 0 ? 'text-ink' : 'text-rose-600')}>{inr(inc - exp)}</div></div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <form onSubmit={add} className="card space-y-4 self-start p-5 xl:sticky xl:top-24">
          <h2 className="font-bold">Quick entry</h2>
          <Segmented options={[{ value: 'expense', label: 'Outflow' }, { value: 'income', label: 'Income' }]} value={form.kind}
            onChange={(k) => setForm({ ...form, kind: k, category: k === 'expense' ? EXPENSE_CATEGORIES[2] : INCOME_CATEGORIES[0] })} className="w-full [&>button]:flex-1" />
          <Field label="Category"><Chips size="sm" options={cats} value={form.category} onChange={(c) => setForm({ ...form, category: c })} allowDeselect={false} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (₹)"><input className="input text-lg font-bold tabular" type="number" min="1" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            <Field label="Date"><input className="input" type="date" max={todayISO()} value={form.txn_date} onChange={(e) => setForm({ ...form, txn_date: e.target.value })} /></Field>
          </div>
          <Field label="Note"><input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional" /></Field>
          <button className="btn-primary w-full" disabled={busy}><Plus size={16} /> Save entry</button>
        </form>

        <div className="card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line bg-emerald-50/50 px-5 py-3.5">
            <Stethoscope size={18} className="text-emerald-600" />
            <span className="flex-1 text-sm font-semibold">Consultation fees ({data.consultation.visits} visits)</span>
            <span className="font-bold text-emerald-700 tabular">+{inr(data.consultation.amount)}</span>
          </div>
          {!data.transactions.length && <Empty icon={Wallet} title="No entries in this period" />}
          <ul className="divide-y divide-line/70">
            {data.transactions.map((t) => (
              <li key={`${t.source}-${t.id}`} className="group flex items-center gap-3 px-5 py-3">
                {t.kind === 'income' ? <ArrowDownCircle size={20} className="shrink-0 text-emerald-500" /> : <ArrowUpCircle size={20} className="shrink-0 text-rose-400" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{t.category}{t.note && <span className="font-normal text-muted"> · {t.note}</span>}</div>
                  <div className="text-xs text-muted">{fmtDate(t.txn_date)}{t.source === 'vendor' && <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-sky-50 px-1.5 font-semibold text-sky-700"><Truck size={11} /> Vendor payment</span>}</div>
                </div>
                <span className={clsx('font-bold tabular', t.kind === 'income' ? 'text-emerald-700' : 'text-ink')}>{t.kind === 'income' ? '+' : '−'}{inr(t.amount)}</span>
                {t.source === 'vendor'
                  ? <Link to={`/app/vendors/${t.vendor_id}`} className="btn-ghost p-1.5 text-xs" title="Manage in Vendors">Open</Link>
                  : <button onClick={() => remove(t.id)} className="btn-ghost p-1.5 text-rose-500 opacity-0 group-hover:opacity-100 max-md:opacity-100" aria-label="Delete"><Trash2 size={15} /></button>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
