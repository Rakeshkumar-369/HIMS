import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { UserRound, MapPin, Building2, KeyRound, Plus, Trash2, Minus, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import { generatePassword, isStrong } from '../../lib/password';
import { Field, PageHeader, Toggle } from '../../components/ui';
import { Section } from '../../components/intake';
import ThemePicker from '../../components/ThemePicker';
import PasswordField from '../../components/PasswordField';
import { THEMES } from '../../lib/themes';

const blankClinic = (i) => ({ name: '', city: '', address: '', phone: '', consultation_fee: 300, theme: THEMES[i % THEMES.length].id });

export default function AdminDoctorNew() {
  const navigate = useNavigate();
  const [d, setD] = useState({ full_name: 'Dr. ', email: '', phone: '', qualification: '', registration_no: '', specialization: '', address: '', city: '' });
  const [max, setMax] = useState(1);
  const [clinics, setClinics] = useState([blankClinic(0)]);
  const [password, setPassword] = useState(generatePassword);
  const [mustChange, setMustChange] = useState(true);
  const [busy, setBusy] = useState(false);
  const s = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const setC = (i, patch) => setClinics((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const setLimit = (n) => {
    const v = Math.max(0, Math.min(50, n));
    setMax(v);
    if (clinics.length > v) setClinics((cs) => cs.slice(0, v));
  };

  const valid = d.full_name.trim().length > 4 && /^\S+@\S+\.\S+$/.test(d.email) && isStrong(password);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { id } = await api.post('/admin/doctors', { ...d, max_clinics: max, clinics: clinics.filter((c) => c.name.trim()), password, must_change_password: mustChange });
      toast.success(`${d.full_name} can now sign in`, { description: `Email: ${d.email} · Password: ${password}`, duration: 15000 });
      navigate(`/admin/doctors/${id}`);
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="animate-in">
      <PageHeader eyebrow="Accounts" title="New doctor" subtitle="Create the doctor's profile, their clinics and a first-time password." />
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Section icon={UserRound} title="Profile">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Full name" required className="md:col-span-2"><input className="input text-base" required value={d.full_name} onChange={s('full_name')} /></Field>
              <Field label="Email (sign-in ID)" required><input className="input" type="email" required value={d.email} onChange={s('email')} /></Field>
              <Field label="Mobile"><input className="input tabular" inputMode="tel" value={d.phone} onChange={s('phone')} /></Field>
              <Field label="Qualification" hint="Printed on case sheets"><input className="input" value={d.qualification} onChange={s('qualification')} placeholder="MBBS, MD" /></Field>
              <Field label="Medical registration no."><input className="input" value={d.registration_no} onChange={s('registration_no')} /></Field>
              <Field label="Specialisation" className="md:col-span-2"><input className="input" value={d.specialization} onChange={s('specialization')} placeholder="Family physician" /></Field>
            </div>
          </Section>
          <Section icon={MapPin} title="Address">
            <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
              <Field label="Address"><input className="input" value={d.address} onChange={s('address')} /></Field>
              <Field label="City / PIN"><input className="input" value={d.city} onChange={s('city')} /></Field>
            </div>
          </Section>
          <Section icon={Building2} title="Clinics"
            aside={(
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-muted">May own</span>
                <div className="inline-flex items-center rounded-2xl border border-line bg-white">
                  <button type="button" className="p-2 text-muted hover:text-ink" onClick={() => setLimit(max - 1)} aria-label="Fewer"><Minus size={15} /></button>
                  <span className="w-8 text-center font-extrabold tabular">{max}</span>
                  <button type="button" className="p-2 text-muted hover:text-ink" onClick={() => setLimit(max + 1)} aria-label="More"><Plus size={15} /></button>
                </div>
                <span className="font-semibold text-muted">clinic{max === 1 ? '' : 's'}</span>
              </div>
            )}>
            <p className="mb-4 text-sm text-muted">Set up clinics now, or leave them blank — the doctor can add clinics later, up to this limit.</p>
            <div className="space-y-3">
              {clinics.map((c, i) => (
                <div key={i} className="rounded-2xl border border-line p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-bold tracking-wider text-muted uppercase">Clinic {i + 1}</span>
                    <button type="button" className="btn-ghost p-1.5 text-rose-500" onClick={() => setClinics((cs) => cs.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 size={15} /></button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Clinic name (unique)" className="md:col-span-2"><input className="input" value={c.name} onChange={(e) => setC(i, { name: e.target.value })} /></Field>
                    <Field label="Address"><input className="input" value={c.address} onChange={(e) => setC(i, { address: e.target.value })} /></Field>
                    <Field label="City / PIN"><input className="input" value={c.city} onChange={(e) => setC(i, { city: e.target.value })} /></Field>
                    <Field label="Clinic phone"><input className="input" value={c.phone} onChange={(e) => setC(i, { phone: e.target.value })} /></Field>
                    <Field label="Consultation fee (₹)"><input className="input" type="number" min="0" value={c.consultation_fee} onChange={(e) => setC(i, { consultation_fee: e.target.value })} /></Field>
                    <Field label="Colour" className="md:col-span-2"><ThemePicker size="sm" value={c.theme} onChange={(t) => setC(i, { theme: t })} /></Field>
                  </div>
                </div>
              ))}
              {clinics.length < max && (
                <button type="button" className="btn-outline w-full border-dashed" onClick={() => setClinics((cs) => [...cs, blankClinic(cs.length)])}><Plus size={16} /> Add a clinic</button>
              )}
            </div>
          </Section>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
          <Section icon={KeyRound} title="Sign-in">
            <div className="space-y-4">
              <Field label="First-time password"><PasswordField value={password} onChange={setPassword} /></Field>
              {!isStrong(password) && <p className="-mt-2 text-xs text-rose-600">Use at least 8 characters with letters and numbers.</p>}
              <Toggle checked={mustChange} onChange={setMustChange} label="Ask to set a new password at first sign-in" />
              <p className="text-xs text-muted">Share the email and this password with the doctor privately (in person or by phone).</p>
            </div>
          </Section>
          <button className="btn-primary w-full py-3.5 text-[15px]" disabled={!valid || busy}><CheckCircle2 size={18} /> {busy ? 'Creating…' : 'Create doctor account'}</button>
        </aside>
      </div>
    </form>
  );
}
