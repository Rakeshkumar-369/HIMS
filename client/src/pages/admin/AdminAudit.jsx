import { useState } from 'react';
import clsx from 'clsx';
import { ScrollText } from 'lucide-react';
import { useFetch } from '../../lib/hooks';
import { PageHeader, PageLoader, Empty } from '../../components/ui';
import { fmtDate, fmtTime } from '../../lib/format';
import { ACTION_LABEL } from '../../lib/auditLabels';

const RISKY = new Set(['login_failed', 'login_locked', 'portal_login_failed']);
const FILTERS = [
  { value: '', label: 'Everything' }, { value: 'login_failed', label: 'Failed sign-ins' }, { value: 'login', label: 'Sign-ins' },
  { value: 'patient_record_viewed', label: 'Case files opened' }, { value: 'admin_reset_password', label: 'Password resets' },
];

export default function AdminAudit() {
  const [action, setAction] = useState('');
  const { data, loading } = useFetch(`/admin/audit?limit=500${action ? `&action=${action}` : ''}`, { keep: true });
  return (
    <div className="animate-in">
      <PageHeader eyebrow="Security" title="Security log" subtitle="Sign-ins, account changes and access to patient records. Keep at least 180 days." />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => <button key={f.value} className={clsx('chip', action === f.value && 'chip-on')} onClick={() => setAction(f.value)}>{f.label}</button>)}
      </div>
      {loading && !data ? <PageLoader /> : (
        <div className="card overflow-hidden">
          {!data?.length && <Empty icon={ScrollText} title="No entries" />}
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50/70 text-left text-[11px] font-bold tracking-wider text-muted uppercase">
                <tr><th className="px-5 py-3">When</th><th className="px-3 py-3">What</th><th className="px-3 py-3">Who</th><th className="px-3 py-3">Details</th><th className="px-5 py-3">IP address</th></tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {data?.map((a) => (
                  <tr key={a.id} className={clsx(RISKY.has(a.action) && 'bg-rose-50/50')}>
                    <td className="px-5 py-2.5 whitespace-nowrap text-muted tabular">{fmtDate(a.at.slice(0, 10), { day: '2-digit', month: 'short' })} · {fmtTime(a.at)}</td>
                    <td className={clsx('px-3 py-2.5 font-semibold', RISKY.has(a.action) && 'text-rose-700')}>{ACTION_LABEL[a.action] || a.action}</td>
                    <td className="px-3 py-2.5">{a.actor_name || '—'} <span className="text-xs text-muted capitalize">({a.actor_type})</span></td>
                    <td className="max-w-xs truncate px-3 py-2.5 text-muted">{[a.entity && `${a.entity} #${a.entity_id}`, a.detail].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="px-5 py-2.5 font-mono text-xs text-muted">{a.ip || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
