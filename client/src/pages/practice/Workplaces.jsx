import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Plus, Hospital, MapPin, ChevronRight } from 'lucide-react';
import { useFetch, useMode } from '../../lib/hooks';
import { PageHeader, PageLoader, Empty } from '../../components/ui';
import { WorkplaceForm } from '../../components/practice';
import { palette } from '../../lib/themes';
import { fmtShort, inr } from '../../lib/format';

export default function Workplaces() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { mode } = useMode();
  const { data, reload } = useFetch('/practice/workplaces');
  const options = useFetch('/practice/options');
  const adding = params.get('new') === '1';
  if (!data || !options.data) return <PageLoader />;

  return (
    <div className="animate-in">
      <PageHeader eyebrow="My practice" title="Workplaces" subtitle="Hospitals, clinics and platforms you work with — and what each one owes you."
        actions={<button className="btn-primary" onClick={() => setParams({ new: '1' })}><Plus size={17} /> Add workplace</button>} />
      {!data.length && <div className="card"><Empty icon={Hospital} title="No workplaces yet" action={<button className="btn-primary" onClick={() => setParams({ new: '1' })}><Plus size={16} /> Add the first one</button>} /></div>}
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {data.map((w) => {
          const p = palette(w.theme, mode);
          return (
            <Link key={w.id} to={`/app/workplaces/${w.id}`} className={clsx('card group overflow-hidden transition hover:shadow-lift', !w.is_active && 'opacity-60')}>
              <div className="flex items-center gap-3 p-4" style={{ background: `linear-gradient(120deg, ${p[100]}, ${p[50]})` }}>
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl text-white" style={{ background: p[600] }}><Hospital size={20} /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{w.name}</div>
                  <div className="flex items-center gap-1 truncate text-xs text-muted"><MapPin size={12} />{w.city || '—'} · {w.kind} · {options.data.payModels[w.pay_model]}</div>
                </div>
                <ChevronRight size={18} className="text-slate-400 group-hover:text-brand-600" />
              </div>
              <div className="grid grid-cols-3 gap-2 p-4 text-center">
                <div><div className="text-[11px] font-bold text-muted uppercase">Pending</div><div className={clsx('font-extrabold tabular', w.overdue > 0 ? 'text-rose-600' : 'text-ink')}>{inr(w.outstanding)}</div></div>
                <div><div className="text-[11px] font-bold text-muted uppercase">Received</div><div className="font-extrabold text-emerald-700 tabular">{inr(w.received)}</div></div>
                <div><div className="text-[11px] font-bold text-muted uppercase">Services</div><div className="font-extrabold tabular">{w.services}</div></div>
              </div>
              <div className="border-t border-line/70 px-4 py-2.5 text-xs text-muted">
                {w.overdue > 0 ? <span className="font-semibold text-rose-600">{inr(w.overdue)} overdue · </span> : null}
                Last worked {w.last_service ? fmtShort(w.last_service.slice(0, 10)) : '—'} · last paid {w.last_payment ? fmtShort(w.last_payment) : '—'}
              </div>
            </Link>
          );
        })}
      </div>
      {adding && <WorkplaceForm options={options.data} onClose={() => setParams({})} onSaved={(r) => { reload(); options.reload(); if (r?.id) navigate(`/app/workplaces/${r.id}`); }} />}
    </div>
  );
}
