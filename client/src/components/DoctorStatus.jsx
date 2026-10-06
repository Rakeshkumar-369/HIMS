import clsx from 'clsx';

/** Account state pill for a doctor in the admin console. */
export default function DoctorStatus({ d }) {
  const [label, cls] = !d.is_active ? ['Deactivated', 'bg-slate-100 text-slate-500']
    : d.locked ? ['Locked', 'bg-rose-50 text-rose-700']
      : d.must_change_password ? ['Awaiting first sign-in', 'bg-amber-50 text-amber-800']
        : ['Active', 'bg-emerald-50 text-emerald-700'];
  return <span className={clsx('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', cls)}>{label}</span>;
}
