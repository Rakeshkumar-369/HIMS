import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, KeyRound, Power, Unlock, Plus, Minus, Building2, Users, Save, Mail, Phone, MapPin, Crown } from 'lucide-react';
import { api } from '../../lib/api';
import { useFetch, useMode } from '../../lib/hooks';
import { generatePassword, isStrong } from '../../lib/password';
import { palette } from '../../lib/themes';
import { PageLoader, Avatar, Field, Modal, Toggle } from '../../components/ui';
import { Section } from '../../components/intake';
import ThemePicker from '../../components/ThemePicker';
import PasswordField from '../../components/PasswordField';
import DoctorStatus from '../../components/DoctorStatus';
import { fmtDate, fmtTime, inr, num } from '../../lib/format';

const PROFILE = ['full_name', 'email', 'phone', 'qualification', 'registration_no', 'specialization', 'address', 'city'];

function ResetPassword({ doctor, onClose, onDone }) {
  const [password, setPassword] = useState(generatePassword);
  const [mustChange, setMustChange] = useState(true);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api.post(`/admin/doctors/${doctor.id}/password`, { password, must_change_password: mustChange });
      toast.success('Password reset — the doctor was signed out everywhere', { description: `New password: ${password}`, duration: 15000 });
      onDone();
      onClose();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Reset password · ${doctor.full_name}`}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!isStrong(password) || busy} onClick={save}>Set password</button></>}>
      <div className="space-y-4">
        <PasswordField value={password} onChange={setPassword} autoFocus />
        <Toggle checked={mustChange} onChange={setMustChange} label="Ask to set a new password at next sign-in" />
        <p className="text-sm text-muted">All of this doctor’s open sessions end immediately.</p>
      </div>
    </Modal>
  );
}

function AddClinic({ doctor, onClose, onDone }) {
  const [c, setC] = useState({ name: '', city: '', address: '', phone: '', consultation_fee: 300, theme: 'sky' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await api.post(`/admin/doctors/${doctor.id}/clinics`, c); toast.success(`${c.name} created`); onDone(); onClose(); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const s = (k) => (e) => setC({ ...c, [k]: e.target.value });
  return (
    <Modal open wide onClose={onClose} title={`New clinic for ${doctor.full_name}`}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!c.name.trim() || busy} onClick={save}>Create clinic</button></>}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Clinic name (unique)" className="md:col-span-2"><input className="input" autoFocus value={c.name} onChange={s('name')} /></Field>
        <Field label="Address"><input className="input" value={c.address} onChange={s('address')} /></Field>
        <Field label="City / PIN"><input className="input" value={c.city} onChange={s('city')} /></Field>
        <Field label="Phone"><input className="input" value={c.phone} onChange={s('phone')} /></Field>
        <Field label="Consultation fee (₹)"><input className="input" type="number" min="0" value={c.consultation_fee} onChange={s('consultation_fee')} /></Field>
        <Field label="Colour" className="md:col-span-2"><ThemePicker value={c.theme} onChange={(t) => setC({ ...c, theme: t })} /></Field>
      </div>
    </Modal>
  );
}

export default function AdminDoctor() {
  const { id } = useParams();
  const { data, reload } = useFetch(`/admin/doctors/${id}`);
  if (!data) return <PageLoader />;
  // re-mount the editor whenever fresh data arrives so the form starts from the saved values
  return <DoctorEditor key={JSON.stringify(data.doctor)} data={data} reload={reload} />;
}

function DoctorEditor({ data, reload }) {
  const { mode } = useMode();
  const [form, setForm] = useState(() => Object.fromEntries(PROFILE.map((k) => [k, data.doctor[k] || ''])));
  const [max, setMax] = useState(data.doctor.max_clinics);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);

  const { doctor: d, clinics, staff } = data;
  const s = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const dirty = PROFILE.some((k) => (d[k] || '') !== form[k]) || max !== d.max_clinics;

  const call = async (fn, msg) => {
    setBusy(true);
    try { await fn(); if (msg) toast.success(msg); reload(); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const save = () => call(() => api.patch(`/admin/doctors/${d.id}`, { ...form, max_clinics: max }), 'Profile saved');
  const toggleActive = () => {
    if (d.is_active && !window.confirm(`Deactivate ${d.full_name}? They will be signed out and cannot sign in until re-activated.`)) return;
    call(() => api.patch(`/admin/doctors/${d.id}`, { is_active: !d.is_active }), d.is_active ? 'Account deactivated' : 'Account re-activated');
  };

  return (
    <div className="animate-in space-y-5">
      <Link to="/admin/doctors" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft size={16} /> All doctors</Link>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-5 bg-gradient-to-r from-brand-100 via-brand-50 to-white p-6">
          <Avatar name={d.full_name} className="size-16 bg-white text-xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-2xl font-extrabold">{d.full_name}</h1><DoctorStatus d={d} /></div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1"><Mail size={13} />{d.email}</span>
              {d.phone && <span className="inline-flex items-center gap-1"><Phone size={13} />{d.phone}</span>}
              {(d.address || d.city) && <span className="inline-flex items-center gap-1"><MapPin size={13} />{[d.address, d.city].filter(Boolean).join(', ')}</span>}
            </div>
            <div className="mt-1 text-xs text-muted">Created {fmtDate(d.created_at?.slice(0, 10))} · Last sign-in {d.last_login_at ? `${fmtDate(d.last_login_at.slice(0, 10))} ${fmtTime(d.last_login_at)}` : 'never'}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-outline" onClick={() => setModal('password')}><KeyRound size={16} /> Reset password</button>
            {d.locked && <button className="btn-soft" disabled={busy} onClick={() => call(() => api.post(`/admin/doctors/${d.id}/unlock`), 'Account unlocked')}><Unlock size={16} /> Unlock</button>}
            <button className={d.is_active ? 'btn-danger' : 'btn-primary'} disabled={busy} onClick={toggleActive}><Power size={16} /> {d.is_active ? 'Deactivate' : 'Re-activate'}</button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <Section icon={Save} title="Profile & address">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Full name" className="md:col-span-2"><input className="input" value={form.full_name} onChange={s('full_name')} /></Field>
            <Field label="Email (sign-in ID)"><input className="input" type="email" value={form.email} onChange={s('email')} /></Field>
            <Field label="Mobile"><input className="input" value={form.phone} onChange={s('phone')} /></Field>
            <Field label="Qualification"><input className="input" value={form.qualification} onChange={s('qualification')} /></Field>
            <Field label="Medical registration no."><input className="input" value={form.registration_no} onChange={s('registration_no')} /></Field>
            <Field label="Specialisation" className="md:col-span-2"><input className="input" value={form.specialization} onChange={s('specialization')} /></Field>
            <Field label="Address"><input className="input" value={form.address} onChange={s('address')} /></Field>
            <Field label="City / PIN"><input className="input" value={form.city} onChange={s('city')} /></Field>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-line/70 pt-5">
            <span className="text-sm font-semibold">Clinics this doctor may own</span>
            <div className="inline-flex items-center rounded-2xl border border-line bg-white">
              <button type="button" className="p-2 text-muted hover:text-ink disabled:opacity-30" disabled={max <= clinics.length} onClick={() => setMax(max - 1)} aria-label="Fewer"><Minus size={15} /></button>
              <span className="w-8 text-center font-extrabold tabular">{max}</span>
              <button type="button" className="p-2 text-muted hover:text-ink" onClick={() => setMax(Math.min(50, max + 1))} aria-label="More"><Plus size={15} /></button>
            </div>
            <span className="text-xs text-muted">{clinics.length} in use</span>
            <div className="flex-1" />
            <button className="btn-primary" disabled={!dirty || busy} onClick={save}><Save size={16} /> Save changes</button>
          </div>
        </Section>

        <div className="space-y-5">
          <Section icon={Building2} title={`Clinics · ${clinics.length} of ${d.max_clinics}`}
            aside={clinics.length < d.max_clinics && <button className="btn-soft px-3 py-1.5 text-xs" onClick={() => setModal('clinic')}><Plus size={14} /> Add clinic</button>}>
            {!clinics.length && <p className="text-sm text-muted">No clinics yet{d.max_clinics ? ' — add one, or the doctor can add it after signing in.' : '. Raise the clinic limit to add one.'}</p>}
            <ul className="space-y-2">
              {clinics.map((c) => {
                const p = palette(c.theme, mode);
                return (
                  <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-line p-3">
                    <span className="grid h-10 min-w-10 place-items-center rounded-xl px-1.5 text-[11px] font-extrabold text-white" style={{ background: p[600] }}>{c.code}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{c.name}</div>
                      <div className="truncate text-xs text-muted">{[c.city, `${num(c.patient_count)} patients`, `${c.staff_count} team`, inr(c.consultation_fee)].filter(Boolean).join(' · ')}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Section>
          <Section icon={Users} title="Team">
            {!staff.length && <p className="text-sm text-muted">No nurses or associate doctors yet. The doctor adds them from Clinics → Team.</p>}
            <ul className="space-y-2">
              {staff.map((u) => (
                <li key={u.id} className="flex items-center gap-2.5">
                  <Avatar name={u.full_name} className="size-8 text-[11px]" />
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{u.full_name}</div><div className="truncate text-xs text-muted capitalize">{u.role} · {u.email}</div></div>
                  {!u.is_active && <span className="text-xs text-muted">inactive</span>}
                </li>
              ))}
            </ul>
            <p className="mt-4 flex items-center gap-1.5 text-xs text-muted"><Crown size={12} className="text-amber-500" /> {d.full_name} owns these clinics.</p>
          </Section>
        </div>
      </div>

      {modal === 'password' && <ResetPassword doctor={d} onClose={() => setModal(null)} onDone={() => reload()} />}
      {modal === 'clinic' && <AddClinic doctor={d} onClose={() => setModal(null)} onDone={() => reload()} />}
    </div>
  );
}
