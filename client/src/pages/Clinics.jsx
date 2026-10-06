import { useState } from 'react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Plus, Building2, MapPin, Phone, Users, Pencil, Crown, Trash2, UserPlus, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { useFetch } from '../lib/hooks';
import { PageHeader, Modal, Field, Avatar, Segmented, Empty } from '../components/ui';
import ThemePicker from '../components/ThemePicker';
import { palette } from '../lib/themes';
import { inr, num } from '../lib/format';

const BLANK = { name: '', tagline: '', address: '', city: '', phone: '', email: '', registration_no: '', timings: '', consultation_fee: 300, theme: 'sky' };

function ClinicForm({ initial, onClose, onSaved }) {
  const [c, setC] = useState(initial || BLANK);
  const [busy, setBusy] = useState(false);
  const s = (k) => (e) => setC({ ...c, [k]: e.target.value });
  const save = async () => {
    setBusy(true);
    try {
      const body = Object.fromEntries(Object.keys(BLANK).map((k) => [k, c[k]]));
      const res = initial ? await api.patch(`/clinics/${initial.id}`, body) : await api.post('/clinics', body);
      toast.success(initial ? 'Clinic updated' : `${res.name} created`);
      onSaved(res);
      onClose();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open wide onClose={onClose} title={initial ? `Edit ${initial.name}` : 'Add a clinic'}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || !c.name} onClick={save}>{initial ? 'Save' : 'Create clinic'}</button></>}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Clinic name (unique)" required className="md:col-span-2"><input className="input" value={c.name} onChange={s('name')} autoFocus /></Field>
        <Field label="Tagline" className="md:col-span-2"><input className="input" value={c.tagline || ''} onChange={s('tagline')} /></Field>
        <Field label="Address" className="md:col-span-2"><input className="input" value={c.address || ''} onChange={s('address')} /></Field>
        <Field label="City / PIN"><input className="input" value={c.city || ''} onChange={s('city')} /></Field>
        <Field label="Phone"><input className="input" value={c.phone || ''} onChange={s('phone')} /></Field>
        <Field label="Email"><input className="input" value={c.email || ''} onChange={s('email')} /></Field>
        <Field label="Clinic registration no."><input className="input" value={c.registration_no || ''} onChange={s('registration_no')} /></Field>
        <Field label="Timings"><input className="input" value={c.timings || ''} onChange={s('timings')} /></Field>
        <Field label="Consultation fee (₹)"><input className="input" type="number" value={c.consultation_fee} onChange={s('consultation_fee')} /></Field>
        <Field label="Colour theme" className="md:col-span-2"><ThemePicker value={c.theme} onChange={(t) => setC({ ...c, theme: t })} /></Field>
      </div>
    </Modal>
  );
}

function StaffPanel({ clinic }) {
  const { data, reload } = useFetch(`/clinics/${clinic.id}/staff`, [clinic.id]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ role: 'nurse', full_name: '', email: '', phone: '', password: '' });
  const add = async () => {
    try { await api.post(`/clinics/${clinic.id}/staff`, f); toast.success(`${f.full_name || f.email} can now sign in to ${clinic.name}`); setOpen(false); setF({ ...f, full_name: '', email: '', phone: '', password: '' }); reload(true); } catch (e) { toast.error(e.message); }
  };
  const remove = async (u) => {
    if (!window.confirm(`Remove ${u.full_name} from ${clinic.name}?`)) return;
    try { await api.del(`/clinics/${clinic.id}/staff/${u.id}`); reload(true); } catch (e) { toast.error(e.message); }
  };
  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold tracking-wider text-muted uppercase">Team</span>
        {!!clinic.is_owner && <button className="text-xs font-bold text-brand-700 hover:underline" onClick={() => setOpen(true)}><UserPlus size={13} className="mr-1 inline" />Add nurse / doctor</button>}
      </div>
      <ul className="space-y-1.5">
        {data?.map((u) => (
          <li key={u.id} className="group flex items-center gap-2.5 rounded-xl px-1 py-1">
            <Avatar name={u.full_name} className="size-8 text-[11px]" />
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{u.full_name}{!!u.is_owner && <Crown size={12} className="ml-1 inline text-amber-500" />}</div><div className="truncate text-xs text-muted">{u.role} · {u.email}</div></div>
            {!!clinic.is_owner && !u.is_owner && <button className="btn-ghost p-1 text-rose-500 opacity-0 group-hover:opacity-100 max-md:opacity-100" onClick={() => remove(u)}><Trash2 size={14} /></button>}
          </li>
        ))}
      </ul>
      <Modal open={open} onClose={() => setOpen(false)} title={`Add team member · ${clinic.name}`}
        footer={<><button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" onClick={add} disabled={!f.email}>Add</button></>}>
        <div className="space-y-4">
          <Segmented options={[{ value: 'nurse', label: 'Nurse' }, { value: 'doctor', label: 'Doctor' }]} value={f.role} onChange={(r) => setF({ ...f, role: r })} />
          <Field label="Email" hint="If they already have an account (e.g. at another clinic), just the email is enough."><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Full name"><input className="input" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} placeholder={f.role === 'nurse' ? 'Sr. Priya Thomas' : 'Dr. …'} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mobile"><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="Temporary password"><input className="input" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function Clinics() {
  const { clinicId, setClinicId, upsertClinic, refresh } = useAuth();
  const { data, reload } = useFetch('/clinics', []);
  const [edit, setEdit] = useState(null);
  const saved = (c) => { upsertClinic(c); reload(true); refresh(); };

  return (
    <div className="animate-in">
      <PageHeader eyebrow="Clinic mapping" title="Your clinics" subtitle="Each clinic keeps its own patients, queue, accounts, team and colour theme."
        actions={<button className="btn-primary" onClick={() => setEdit('new')}><Plus size={17} /> Add clinic</button>} />
      {data && !data.length && <div className="card"><Empty icon={Building2} title="Create your first clinic" action={<button className="btn-primary" onClick={() => setEdit('new')}><Plus size={16} /> Add clinic</button>} /></div>}
      <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {data?.map((c) => {
          const p = palette(c.theme);
          const active = c.id === clinicId;
          return (
            <article key={c.id} className={clsx('card overflow-hidden transition', active && 'ring-2 ring-offset-2')} style={{ '--tw-ring-color': p[400] }}>
              <div className="relative h-24 p-5" style={{ background: `linear-gradient(120deg, ${p[100]}, ${p[200]} 55%, ${p[300]})` }}>
                <div className="flex items-start justify-between">
                  <span className="grid size-12 place-items-center rounded-2xl text-sm font-extrabold text-white shadow-soft" style={{ background: p[600] }}>{c.code}</span>
                  {active ? <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold" style={{ color: p[800] }}><CheckCircle2 size={13} /> Active</span>
                    : <button className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold hover:bg-white" style={{ color: p[800] }} onClick={() => setClinicId(c.id)}>Switch to</button>}
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold">{c.name}</h3>
                    {c.tagline && <p className="truncate text-sm text-muted">{c.tagline}</p>}
                  </div>
                  {!!c.is_owner && <button className="btn-ghost p-2" onClick={() => setEdit(c)} aria-label="Edit"><Pencil size={16} /></button>}
                </div>
                <div className="mt-3 space-y-1 text-sm text-slate-600">
                  {(c.address || c.city) && <div className="flex gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-muted" />{[c.address, c.city].filter(Boolean).join(', ')}</div>}
                  {c.phone && <div className="flex gap-2"><Phone size={15} className="mt-0.5 shrink-0 text-muted" />{c.phone}</div>}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-slate-50 py-2"><div className="font-bold tabular">{num(c.patient_count)}</div><div className="text-[11px] text-muted">patients</div></div>
                  <div className="rounded-2xl bg-slate-50 py-2"><div className="font-bold tabular"><Users size={13} className="mr-1 inline" />{c.staff_count}</div><div className="text-[11px] text-muted">team</div></div>
                  <div className="rounded-2xl bg-slate-50 py-2"><div className="font-bold tabular">{inr(c.consultation_fee)}</div><div className="text-[11px] text-muted">fee</div></div>
                </div>
                <div className="mt-4">
                  <div className="mb-2 text-xs font-bold tracking-wider text-muted uppercase">Theme</div>
                  <ThemePicker size="sm" value={c.theme} onChange={async (t) => { try { saved(await api.patch(`/clinics/${c.id}`, { theme: t })); } catch (e) { toast.error(e.message); } }} />
                </div>
                <StaffPanel clinic={c} />
              </div>
            </article>
          );
        })}
      </div>
      {edit && <ClinicForm initial={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={saved} />}
    </div>
  );
}
