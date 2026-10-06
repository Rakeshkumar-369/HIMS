import { useState } from 'react';
import clsx from 'clsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Line,
} from 'recharts';
import { Users, UserPlus, IndianRupee, TrendingDown, Wallet, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFetch, useMode } from '../lib/hooks';
import { PageHeader, PageLoader, Segmented } from '../components/ui';
import { ChartCard, ChartTooltip, Legend, RankBars, SERIES, GRID, AXIS, HOVER, SURFACE } from '../components/charts';
import { compactInr, inr, num, fmtShort, fmtDate } from '../lib/format';
import { palette } from '../lib/themes';

const RANGES = [{ value: '7d', label: '1 week' }, { value: '10d', label: '10 days' }, { value: '1m', label: '1 month' }, { value: '6m', label: '6 months' }, { value: '1y', label: '1 year' }];
const INK = 'var(--color-ink)';

function Kpi({ icon: Icon, label, value, prev, cur, invert, sub }) {
  const delta = prev ? ((cur - prev) / prev) * 100 : null;
  const good = delta != null && (invert ? delta <= 0 : delta >= 0);
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div className="grid size-10 place-items-center rounded-2xl bg-brand-100 text-brand-700"><Icon size={19} /></div>
        {delta != null && Number.isFinite(delta) && (
          <span className={clsx('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold', good ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
            {delta >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(delta).toFixed(0)}%
          </span>
        )}
      </div>
      <div className="mt-4 text-[26px] leading-none font-extrabold tracking-tight tabular">{value}</div>
      <div className="mt-1.5 text-xs font-semibold text-muted">{label}{sub && <span className="font-normal"> · {sub}</span>}</div>
    </div>
  );
}

export default function Dashboard() {
  const { clinics, clinicId } = useAuth();
  const { mode } = useMode();
  const [range, setRange] = useState('1m');
  const [scope, setScope] = useState(String(clinicId));
  const { data, loading } = useFetch(`/dashboard?range=${range}&clinicId=${scope}`, [range, scope]);
  if (!data) return <PageLoader />;

  const k = data.kpis;
  const tickFmt = (d) => (data.granularity === 'month' ? fmtDate(d, { month: 'short' }) : fmtShort(d));
  const labelFmt = (d) => (data.granularity === 'month' ? fmtDate(d, { month: 'long', year: 'numeric' }) : data.granularity === 'week' ? `Week of ${fmtShort(d)}` : fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' }));
  const finTick = (d) => (data.financeGranularity === 'month' ? fmtDate(d, { month: 'short' }) : fmtShort(d));
  const finLabel = (d) => (data.financeGranularity === 'month' ? fmtDate(d, { month: 'long', year: 'numeric' }) : data.financeGranularity === 'week' ? `Week of ${fmtShort(d)}` : fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' }));
  const rangeLabel = RANGES.find((r) => r.value === range).label;
  const genderColor = { Male: SERIES[0], Female: SERIES[1], Other: SERIES[2] };
  const totalGender = data.gender.reduce((s, g) => s + g.n, 0) || 1;

  return (
    <div className="animate-in">
      <PageHeader eyebrow="Insights" title="Practice dashboard" subtitle={`${fmtDate(data.from)} – ${fmtDate(data.to)}`} />

      {/* Filters — one row, scope everything below */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Segmented options={RANGES} value={range} onChange={setRange} className="max-md:hidden" />
        <select className="input w-auto md:hidden" value={range} onChange={(e) => setRange(e.target.value)}>{RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
        <select className="input w-auto font-semibold" value={scope} onChange={(e) => setScope(e.target.value)}>
          {clinics.length > 1 && <option value="all">All clinics</option>}
          {clinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className={clsx('space-y-5 transition-opacity', loading && 'opacity-60')}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi icon={Activity} label="Cases seen" value={num(k.cases)} cur={k.cases} prev={k.prev_cases} sub={`${k.avg_per_day}/day`} />
          <Kpi icon={Users} label="Unique patients" value={num(k.patients)} />
          <Kpi icon={UserPlus} label="New registrations" value={num(k.new_patients)} />
          <Kpi icon={IndianRupee} label="Income" value={compactInr(k.income)} cur={k.income} prev={k.prev_income} />
          <Kpi icon={TrendingDown} label="Outflow" value={compactInr(k.expense)} cur={k.expense} prev={k.prev_expense} invert />
          <Kpi icon={Wallet} label="Net" value={compactInr(k.net)} />
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <ChartCard className="xl:col-span-2" title="Cases over time" subtitle={`New vs follow-up · ${rangeLabel}`}
            legend={<Legend items={[{ label: 'New', color: SERIES[0] }, { label: 'Follow-up', color: SERIES[2] }]} />}
            table={{ columns: ['Period', 'New', 'Follow-up', 'Total'], rows: data.trend.map((t) => [labelFmt(t.date), t.new_cases, t.follow_ups, t.cases]) }}>
            <ResponsiveContainer>
              <BarChart data={data.trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="date" tickFormatter={tickFmt} tick={AXIS} axisLine={false} tickLine={false} minTickGap={16} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip labelFmt={labelFmt} />} cursor={{ fill: HOVER }} />
                <Bar dataKey="new_cases" name="New" stackId="a" fill={SERIES[0]} stroke={SURFACE} strokeWidth={1} />
                <Bar dataKey="follow_ups" name="Follow-up" stackId="a" fill={SERIES[2]} radius={[4, 4, 0, 0]} stroke={SURFACE} strokeWidth={1} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Gender" subtitle="Share of cases" table={{ columns: ['Gender', 'Cases', '%'], rows: data.gender.map((g) => [g.name, num(g.n), `${((g.n / totalGender) * 100).toFixed(0)}%`]) }}>
            <div className="flex h-full flex-col">
              <div className="relative flex-1">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={data.gender} dataKey="n" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={2} stroke={SURFACE} strokeWidth={2} cornerRadius={6} isAnimationActive={false}>
                      {data.gender.map((g) => <Cell key={g.name} fill={genderColor[g.name]} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip fmt={num} />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div><div className="text-2xl font-extrabold tabular">{num(k.cases)}</div><div className="text-xs text-muted">cases</div></div>
                </div>
              </div>
              <div className="mt-2 flex justify-center gap-4">
                {data.gender.map((g) => (
                  <div key={g.name} className="text-center">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600"><span className="size-2.5 rounded-[3px]" style={{ background: genderColor[g.name] }} />{g.name}</div>
                    <div className="text-sm font-bold tabular">{((g.n / totalGender) * 100).toFixed(0)}%</div>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <ChartCard className="xl:col-span-2" title="Age groups" subtitle="Cases by age band and gender"
            legend={<Legend items={['Male', 'Female', 'Other'].map((g) => ({ label: g, color: genderColor[g] }))} />}
            table={{ columns: ['Age', 'Male', 'Female', 'Other'], rows: data.ageGroups.map((a) => [a.group, a.Male, a.Female, a.Other]) }}>
            <ResponsiveContainer>
              <BarChart data={data.ageGroups} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={2} barCategoryGap="20%">
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="group" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip labelFmt={(l) => `Age ${l}`} />} cursor={{ fill: HOVER }} />
                {['Male', 'Female', 'Other'].map((g) => <Bar key={g} dataKey={g} fill={genderColor[g]} radius={[4, 4, 0, 0]} maxBarSize={28} />)}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Top diagnoses" subtitle="Disease-wise cases" table={{ columns: ['Diagnosis', 'Cases'], rows: data.diagnoses.map((d) => [d.name, d.n]) }}>
            <RankBars data={data.diagnoses} color="var(--brand-500)" />
          </ChartCard>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <ChartCard className="xl:col-span-2" title="Income vs outflow" subtitle="Consultation fees + other income, against clinic expenses"
            legend={<Legend items={[{ label: 'Income', color: SERIES[2] }, { label: 'Outflow', color: SERIES[1] }, { label: 'Net', color: INK, line: true }]} />}
            table={{ columns: ['Period', 'Income', 'Outflow', 'Net'], rows: data.finance.map((f) => [finLabel(f.date), inr(f.income), inr(f.expense), inr(f.net)]) }}>
            <ResponsiveContainer>
              <ComposedChart data={data.finance} margin={{ top: 4, right: 4, left: -4, bottom: 0 }} barGap={2} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="date" tickFormatter={finTick} tick={AXIS} axisLine={false} tickLine={false} minTickGap={16} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={compactInr} />
                <Tooltip content={<ChartTooltip labelFmt={finLabel} fmt={inr} />} cursor={{ fill: HOVER }} />
                <Bar dataKey="income" name="Income" fill={SERIES[2]} radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="expense" name="Outflow" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Line dataKey="net" name="Net" stroke={INK} strokeWidth={2} dot={false} type="monotone" />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Where the money goes" subtitle="Outflow by category" table={{ columns: ['Category', 'Amount'], rows: data.expenseCategories.map((d) => [d.name, inr(d.n)]) }}>
            <RankBars data={data.expenseCategories} color={SERIES[1]} fmt={compactInr} empty="No expenses recorded" />
          </ChartCard>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <ChartCard title="Medicines prescribed" subtitle="Times prescribed" height={300} table={{ columns: ['Medicine', 'Times'], rows: data.medicines.map((d) => [d.name, d.n]) }}>
            <RankBars data={data.medicines} />
          </ChartCard>
          <ChartCard title="Lab investigations" subtitle="Tests advised" height={300} table={{ columns: ['Test', 'Times'], rows: data.labTests.map((d) => [d.name, d.n]) }}>
            <RankBars data={data.labTests} />
          </ChartCard>
          <ChartCard title="Known conditions" subtitle="Chronic illness among patients seen" height={300} table={{ columns: ['Condition', 'Patients'], rows: data.conditions.map((d) => [d.name, d.n]) }}>
            <RankBars data={data.conditions} />
          </ChartCard>
          <ChartCard title="Income sources" subtitle={`Payment modes: ${data.paymentModes.map((m) => `${m.name} ${m.n}`).join(' · ') || '—'}`} height={300} table={{ columns: ['Source', 'Amount'], rows: data.incomeCategories.map((d) => [d.name, inr(d.n)]) }}>
            <RankBars data={data.incomeCategories} color={SERIES[2]} fmt={compactInr} />
          </ChartCard>
        </div>

        {data.clinics.length > 1 && (
          <section className="card p-5">
            <h3 className="mb-4 font-bold">Clinic comparison</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.clinics.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-line p-4">
                  <span className="size-10 shrink-0 rounded-2xl" style={{ background: `linear-gradient(135deg, ${palette(c.theme, mode)[200]}, ${palette(c.theme, mode)[500]})` }} />
                  <div className="min-w-0 flex-1"><div className="truncate font-semibold">{c.name}</div><div className="text-sm text-muted tabular">{num(c.cases)} cases · {compactInr(c.fees)} fees</div></div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
