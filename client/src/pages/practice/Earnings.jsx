import { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Wallet, AlertTriangle, ReceiptIndianRupee, Landmark, TrendingDown, PiggyBank, FileDown } from 'lucide-react';
import { useFetch } from '../../lib/hooks';
import { PageHeader, PageLoader, Segmented } from '../../components/ui';
import { MoneyTile } from '../../components/money';
import { ChartCard, ChartTooltip, Legend, RankBars } from '../../components/charts';
import { WorkplaceDot } from '../../components/practice';
import { SERIES, GRID, AXIS, HOVER } from '../../lib/chartTokens';
import { downloadCSV } from '../../lib/csv';
import { compactInr, fmtDate, fmtShort, inr } from '../../lib/format';

const RANGES = [{ value: '1m', label: '1 mo' }, { value: '3m', label: '3 mo' }, { value: '6m', label: '6 mo' }, { value: '1y', label: '1 yr' }, { value: 'all', label: 'All' }];
const AGING = [['current', 'Not yet due'], ['d0_30', '1–30 days late'], ['d31_60', '31–60 days late'], ['d61_plus', '60+ days late']];

export default function Earnings() {
  const [range, setRange] = useState('6m');
  const { data, loading } = useFetch(`/practice/summary?range=${range}`, { keep: true });
  if (!data) return <PageLoader />;
  const k = data.kpis;
  const label = (d) => (data.granularity === 'month' ? fmtDate(d, { month: 'short', year: '2-digit' }) : fmtShort(d));
  const exportCSV = () => downloadCSV(`Balance-sheet-${data.from}-to-${data.to}`, [
    { label: 'Workplace', value: 'name' }, { label: 'City', value: 'city' }, { label: 'Services', value: 'services' }, { label: 'Billed (₹)', value: 'billed' },
    { label: 'Received (₹)', value: 'received' }, { label: 'TDS (₹)', value: 'tds' }, { label: 'Pending now (₹)', value: 'outstanding' }, { label: 'Overdue now (₹)', value: 'overdue' },
  ], data.workplaces);

  return (
    <div className="animate-in">
      <PageHeader eyebrow="My practice" title="Earnings & balance sheet" subtitle={`${fmtDate(data.from)} – ${fmtDate(data.to)}`}
        actions={<button className="btn-outline" onClick={exportCSV}><FileDown size={16} /> Excel / CSV</button>} />
      <div className="no-scrollbar -mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0"><Segmented options={RANGES} value={range} onChange={setRange} /></div>

      <div className={clsx('space-y-5 transition-opacity', loading && 'opacity-60')}>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
          <MoneyTile icon={ReceiptIndianRupee} label="Billed" value={k.billed} sub={`${k.services} services`} />
          <MoneyTile icon={Landmark} label="Received" value={k.received} tone="good" />
          <MoneyTile label="TDS deducted" value={k.tds} sub="tax credit" />
          <MoneyTile icon={TrendingDown} label="Expenses" value={k.expenses} tone={k.expenses ? 'warn' : 'default'} />
          <MoneyTile icon={PiggyBank} label="Net in hand" value={k.net} tone={k.net >= 0 ? 'good' : 'bad'} sub="received − expenses" />
          <MoneyTile icon={Wallet} label="Pending now" value={k.outstanding} tone="brand" sub={k.overdue ? `${inr(k.overdue)} overdue` : 'nothing overdue'} />
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <ChartCard className="xl:col-span-2" title="Billed vs received" subtitle={`Per ${data.granularity}`}
            legend={<Legend items={[{ label: 'Billed', color: SERIES[0] }, { label: 'Received', color: SERIES[2] }]} />}
            table={{ columns: ['Period', 'Billed', 'Received', 'Expenses'], rows: data.series.map((s) => [label(s.date), inr(s.billed), inr(s.received), inr(s.expenses)]) }}>
            <ResponsiveContainer>
              <BarChart data={data.series} margin={{ top: 4, right: 4, left: -4, bottom: 0 }} barGap={2} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="date" tickFormatter={label} tick={AXIS} axisLine={false} tickLine={false} minTickGap={12} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={compactInr} />
                <Tooltip content={<ChartTooltip labelFmt={label} fmt={inr} />} cursor={{ fill: HOVER }} />
                <Bar dataKey="billed" name="Billed" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={26} />
                <Bar dataKey="received" name="Received" fill={SERIES[2]} radius={[4, 4, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <section className="card p-5">
            <h3 className="font-bold">How late is the money?</h3>
            <p className="text-xs text-muted">Pending amounts by how far past the usual payment time</p>
            <ul className="mt-4 space-y-3">
              {AGING.map(([key, name]) => {
                const v = data.aging[key] || 0;
                const max = Math.max(...AGING.map(([kk]) => data.aging[kk] || 0), 1);
                return (
                  <li key={key}>
                    <div className="mb-1 flex justify-between text-sm"><span className={clsx(key !== 'current' && v > 0 && 'font-semibold text-rose-700')}>{name}</span><b className="tabular">{inr(v)}</b></div>
                    <div className="h-2 rounded-full bg-slate-100"><div className={clsx('h-2 rounded-full', key === 'current' ? 'bg-brand-400' : 'bg-rose-400')} style={{ width: `${(v / max) * 100}%` }} /></div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <section className="card overflow-hidden">
          <div className="border-b border-line/70 px-5 py-4"><h3 className="font-bold">By workplace</h3><p className="text-xs text-muted">Billed / received in this period · pending as of today</p></div>
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50/70 text-left text-xs font-medium text-muted">
                <tr><th className="px-5 py-3">Workplace</th><th className="px-3 py-3 text-right">Services</th><th className="px-3 py-3 text-right">Billed</th><th className="px-3 py-3 text-right">Received</th><th className="px-3 py-3 text-right">TDS</th><th className="px-5 py-3 text-right">Pending</th></tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {data.workplaces.map((w) => (
                  <tr key={w.id}>
                    <td className="px-5 py-3"><Link to={`/app/workplaces/${w.id}`} className="flex items-center gap-2 font-semibold hover:text-brand-700"><WorkplaceDot theme={w.theme} />{w.name}<span className="font-normal text-muted">· {w.city}</span></Link></td>
                    <td className="px-3 py-3 text-right tabular">{w.services}</td>
                    <td className="px-3 py-3 text-right tabular">{inr(w.billed)}</td>
                    <td className="px-3 py-3 text-right text-emerald-700 tabular">{inr(w.received)}</td>
                    <td className="px-3 py-3 text-right tabular">{inr(w.tds)}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular">{inr(w.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <ChartCard title="Top procedures" subtitle="Billed amount" height={280} table={{ columns: ['Procedure', 'Count', 'Billed'], rows: data.procedures.map((d) => [d.name, d.n, inr(d.amount)]) }}>
            <RankBars data={data.procedures.map((d) => ({ name: `${d.name} (${d.n})`, n: d.amount }))} fmt={compactInr} />
          </ChartCard>
          <ChartCard title="By city" subtitle="Billed amount" height={280} table={{ columns: ['City', 'Services', 'Billed'], rows: data.cities.map((d) => [d.name, d.n, inr(d.amount)]) }}>
            <RankBars data={data.cities.map((d) => ({ name: `${d.name} (${d.n})`, n: d.amount }))} fmt={compactInr} />
          </ChartCard>
          <ChartCard title="Where the money goes" subtitle="Your expenses" height={280} table={{ columns: ['Category', 'Amount'], rows: data.expenseCategories.map((d) => [d.name, inr(d.amount)]) }}>
            <RankBars data={data.expenseCategories.map((d) => ({ name: d.name, n: d.amount }))} color={SERIES[1]} fmt={compactInr} empty="No expenses recorded" />
          </ChartCard>
        </div>

        {!!data.pending.length && (
          <section className="card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line/70 px-5 py-4"><AlertTriangle size={17} className="text-rose-500" /><h3 className="font-bold">Follow up for payment</h3></div>
            <ul className="divide-y divide-line/70">
              {data.pending.map((s) => (
                <li key={s.id}>
                  <Link to={`/app/workplaces/${s.workplace_id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-brand-50/40">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{s.procedure_name || s.service_type} <span className="font-normal text-muted">· {s.workplace}</span></div>
                      <div className="text-xs text-muted">{fmtDate(s.service_at.slice(0, 10))}{s.patient_name ? ` · ${s.patient_name}` : ''}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold tabular">{inr(s.open)}</div>
                      <div className={clsx('text-xs', s.late_days > 0 ? 'font-semibold text-rose-600' : 'text-muted')}>{s.late_days > 0 ? `${s.late_days} days late` : `due ${fmtShort(s.due_on)}`}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
