import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Trash2, Truck, Receipt } from 'lucide-react';
import { api } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { PageHeader, PageLoader, Segmented, Chips, Field, Empty } from '../../components/ui';
import { MoneyTile } from '../../components/money';
import { fmtDate, inr, todayISO } from '../../lib/format';

const RANGES = [{ value: '1m', label: '1 month' }, { value: '3m', label: '3 months' }, { value: '6m', label: '6 months' }, { value: '1y', label: '1 year' }];

export default function PracticeExpenses() {
  const [range, setRange] = useState('3m');
  const { data, reload } = useFetch(`/practice/expenses?range=${range}`, { keep: true });
  const options = useFetch('/practice/options');
  const [f, setF] = useState({ spent_on: todayISO(), category: 'Travel & fuel', amount: '', workplace_id: '', note: '' });
  const [busy, setBusy] = useState(false);
  if (!data || !options.data) return <PageLoader />;

  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/practice/expenses', f);
      toast.success(`${inr(f.amount)} added to ${f.category}`);
      setF({ ...f, amount: '', note: '' });
      reload();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  const remove = async (id) => { try { await api.del(`/practice/expenses/${id}`); reload(); } catch (err) { toast.error(err.message); } };
  const byCat = Object.entries(data.expenses.reduce((m, x) => ({ ...m, [x.category]: (m[x.category] || 0) + Number(x.amount) }), {})).sort((a, b) => b[1] - a[1]);

  return (
    <div className="animate-in">
      <PageHeader eyebrow="My practice" title="My expenses" subtitle="Travel, insurance, instruments, CME… Vendor payments are added automatically."
        actions={<Link to="/app/my-vendors" className="btn-outline"><Truck size={16} /> My vendors</Link>} />
      <div className="no-scrollbar -mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0"><Segmented options={RANGES} value={range} onChange={setRange} /></div>
      <div className="mb-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <MoneyTile label="Total spent" value={data.total} tone="warn" sub={`since ${fmtDate(data.from)}`} />
        {byCat.slice(0, 3).map(([c, v]) => <MoneyTile key={c} label={c} value={v} />)}
      </div>
      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <form onSubmit={add} className="card space-y-4 self-start p-5 xl:sticky xl:top-24">
          <h2 className="font-bold">Add an expense</h2>
          <Field label="Category"><Chips size="sm" options={data.categories} value={f.category} onChange={(c) => setF({ ...f, category: c })} allowDeselect={false} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (₹)"><input className="input text-lg font-bold tabular" type="number" min="1" step="any" inputMode="decimal" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
            <Field label="Date"><input className="input" type="date" max={todayISO()} value={f.spent_on} onChange={(e) => setF({ ...f, spent_on: e.target.value })} /></Field>
          </div>
          <Field label="For which workplace? (optional)">
            <select className="input" value={f.workplace_id} onChange={(e) => setF({ ...f, workplace_id: e.target.value })}>
              <option value="">General</option>
              {options.data.workplaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Field>
          <Field label="Note"><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Fuel for Mysuru trip" /></Field>
          <button className="btn-primary w-full" disabled={busy}><Plus size={16} /> Save expense</button>
        </form>
        <ul className="card divide-y divide-line/70 overflow-hidden">
          {!data.expenses.length && <Empty icon={Receipt} title="No expenses in this period" />}
          {data.expenses.map((x) => (
            <li key={`${x.source}-${x.id}`} className="group flex items-center gap-3 px-4 py-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-600">{x.source === 'vendor' ? <Truck size={18} /> : <Receipt size={18} />}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{x.category}{x.note && <span className="font-normal text-muted"> · {x.note}</span>}</div>
                <div className="text-xs text-muted">{fmtDate(x.date)}{x.workplace && ` · ${x.workplace}`}{x.source === 'vendor' && ' · vendor payment'}</div>
              </div>
              <span className="font-bold tabular">{inr(x.amount)}</span>
              {x.source === 'manual'
                ? <button onClick={() => remove(x.id)} className="btn-ghost p-1.5 text-rose-500 opacity-0 group-hover:opacity-100 max-md:opacity-100" aria-label="Delete"><Trash2 size={15} /></button>
                : <Link to={`/app/vendors/${x.vendor_id}`} className="btn-ghost p-1.5 text-xs">Open</Link>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
