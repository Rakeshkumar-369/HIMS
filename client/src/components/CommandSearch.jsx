import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Search, CornerDownLeft, UserPlus } from 'lucide-react';
import { useAuth } from '../context/authCtx';
import { useDebounced, useFetch } from '../lib/hooks';
import { caseFmt, fmtShort, ageSex } from '../lib/format';
import { Avatar, Spinner } from './ui';

/** Ctrl+K patient finder. Mounted only while open, so every opening starts fresh. */
export default function CommandSearch({ onClose }) {
  const { clinicId } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [pick, setPick] = useState({ q: '', i: 0 });
  const dq = useDebounced(q, 200);
  const { data, loading } = useFetch(clinicId ? `/patients?clinicId=${clinicId}&limit=8&q=${encodeURIComponent(dq)}` : null, { keep: true });
  const rows = data || [];
  const idx = pick.q === dq ? Math.min(pick.i, Math.max(rows.length - 1, 0)) : 0; // highlight resets when the search changes
  const setIdx = (fn) => setPick({ q: dq, i: fn(idx) });
  const go = (p) => { onClose(); navigate(`/app/patients/${p.id}`); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, rows.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && rows[idx]) go(rows[idx]);
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className="animate-pop w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-lift" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-5">
          <Search size={20} className="text-brand-500" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Search by name, 9-digit case ID or mobile…" className="h-14 flex-1 bg-transparent text-[15px] outline-none" />
          {loading && <Spinner />}
        </div>
        <div className="scrollbar-thin max-h-[50vh] overflow-y-auto p-2">
          {!rows.length && !loading && <div className="px-4 py-8 text-center text-sm text-muted">No matching patients.</div>}
          {rows.map((p, i) => (
            <button key={p.id} onMouseEnter={() => setIdx(i)} onClick={() => go(p)}
              className={clsx('flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left', i === idx && 'bg-brand-50')}>
              <Avatar name={p.full_name} className="size-10 text-xs" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{p.full_name} <span className="font-normal text-muted">· {ageSex(p)}</span>{p.clinic_id !== clinicId && <span className="ml-1.5 rounded-full bg-sky-50 px-1.5 text-[11px] font-semibold text-sky-700">from {p.home_clinic}</span>}</div>
                <div className="text-xs text-muted tabular">#{caseFmt(p.case_no)} · {p.phone || 'no phone'}{p.last_visit && ` · last seen ${fmtShort(p.last_visit)}`}</div>
              </div>
              {i === idx && <CornerDownLeft size={16} className="text-brand-500" />}
            </button>
          ))}
        </div>
        <button onClick={() => { onClose(); navigate('/app/register'); }} className="flex w-full items-center gap-2 border-t border-line px-5 py-3.5 text-sm font-semibold text-brand-700 hover:bg-brand-50">
          <UserPlus size={17} /> Register a new patient <span className="kbd ml-auto">N</span>
        </button>
      </div>
    </div>
  );
}
