import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Plus, Search, Truck, Phone, AlertTriangle, Clock, Wallet, PackageOpen, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/authCtx';
import { useFetch } from '../lib/hooks';
import { PageHeader, PageLoader, Empty, Segmented } from '../components/ui';
import { MoneyTile } from '../components/money';
import { VendorForm } from '../components/vendors';
import { fmtShort, inr } from '../lib/format';

const FILTERS = [{ value: 'all', label: 'All' }, { value: 'balance', label: 'With balance' }, { value: 'overdue', label: 'Overdue' }];

/** Vendor directory with balances. personal = the freelance doctor's own book. */
export default function Vendors({ personal = false }) {
  const { clinicId, clinic } = useAuth();
  const navigate = useNavigate();
  const url = personal ? '/vendors?book=personal' : clinicId ? `/vendors?clinicId=${clinicId}` : null;
  const { data, reload } = useFetch(url, { keep: true });
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [adding, setAdding] = useState(false);
  const list = useMemo(() => (data?.vendors || []).filter((v) => {
    if (filter === 'balance' && v.outstanding <= 0) return false;
    if (filter === 'overdue' && v.overdue <= 0) return false;
    return !q || [v.name, v.contact_person, v.phone, v.city, v.category].filter(Boolean).join(' ').toLowerCase().includes(q.toLowerCase());
  }), [data, q, filter]);

  if (!data) return <PageLoader />;
  const t = data.totals;
  return (
    <div className="animate-in">
      <PageHeader eyebrow={personal ? 'My practice' : clinic?.name} title="Vendors & purchases"
        subtitle="Suppliers, orders, deliveries and what you owe. Payments flow into your expenses automatically."
        actions={<button className="btn-primary" onClick={() => setAdding(true)}><Plus size={17} /> Add vendor</button>} />

      <div className="mb-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <MoneyTile icon={Wallet} label="You owe" value={t.outstanding} tone={t.outstanding > 0 ? 'brand' : 'default'} sub="delivered, not yet paid" />
        <MoneyTile icon={AlertTriangle} label="Overdue" value={t.overdue} tone={t.overdue > 0 ? 'bad' : 'default'} sub="past payment terms" onClick={() => setFilter('overdue')} active={filter === 'overdue'} />
        <MoneyTile icon={Clock} label="Due in 7 days" value={t.due_soon} tone={t.due_soon > 0 ? 'warn' : 'default'} />
        <MoneyTile icon={PackageOpen} label="Awaiting delivery" value={t.pending_delivery} sub={`Paid this month ${inr(t.paid_this_month)}`} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-60">
          <Search size={17} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
          <input className="input pl-10" placeholder="Search vendor, contact, city…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Segmented options={FILTERS} value={filter} onChange={setFilter} />
      </div>

      {!data.vendors.length ? (
        <div className="card"><Empty icon={Truck} title="No vendors yet" text="Add your medicine distributor, lab, equipment supplier and others to track orders and payments."
          action={<button className="btn-primary" onClick={() => setAdding(true)}><Plus size={16} /> Add first vendor</button>} /></div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((v) => (
            <Link key={v.id} to={`/app/vendors/${v.id}`} className={clsx('card group flex min-w-0 flex-col gap-3 p-4 transition hover:shadow-lift', !v.is_active && 'opacity-60')}>
              <div className="flex items-start gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-700"><Truck size={20} /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{v.name}</div>
                  <div className="truncate text-xs text-muted">{v.category}{v.city && ` · ${v.city}`}{v.payment_terms_days ? ` · ${v.payment_terms_days}-day terms` : ' · pay on delivery'}</div>
                </div>
                <ChevronRight size={18} className="mt-1 shrink-0 text-slate-300 group-hover:text-brand-600" />
              </div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-xs text-muted">Outstanding</div>
                  <div className={clsx('text-xl font-semibold tabular', v.outstanding > 0 ? 'text-ink' : 'text-emerald-700')}>{v.outstanding > 0 ? inr(v.outstanding) : 'All paid'}</div>
                </div>
                <div className="text-right text-xs text-muted">
                  {v.overdue > 0 && <div className="inline-flex items-center gap-1.5 text-slate-600"><span className="size-1.5 rounded-full bg-rose-400" />{inr(v.overdue)} past due date</div>}
                  {v.pending_delivery > 0 && <div>{inr(v.pending_delivery)} awaiting delivery</div>}
                  <div>{v.last_order ? `Last order ${fmtShort(v.last_order.slice(0, 10))}` : 'No orders yet'}</div>
                </div>
              </div>
              {v.phone && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700" onClick={(e) => { e.preventDefault(); window.location.href = `tel:${v.phone}`; }}>
                  <Phone size={13} /> {v.contact_person ? `${v.contact_person} · ` : ''}{v.phone}
                </span>
              )}
            </Link>
          ))}
          {!list.length && <div className="card p-8 text-center text-sm text-muted md:col-span-2">No vendors match.</div>}
        </div>
      )}

      {adding && <VendorForm book={personal ? { book: 'personal' } : { clinicId }} categories={data.categories} onClose={() => setAdding(false)} onSaved={(r) => { reload(); if (r?.id) navigate(`/app/vendors/${r.id}`); }} />}
    </div>
  );
}
