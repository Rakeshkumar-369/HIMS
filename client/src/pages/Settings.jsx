import { useState } from 'react';
import { toast } from 'sonner';
import { UserRound, Palette, KeyRound, Keyboard, SunMoon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { PageHeader, Field } from '../components/ui';
import { Section } from '../components/intake';
import ThemePicker from '../components/ThemePicker';
import { ModeSegmented } from '../components/ModeToggle';

export default function Settings() {
  const { user, setUser, clinic, isDoctor, upsertClinic } = useAuth();
  const [p, setP] = useState({ full_name: user.full_name, phone: user.phone || '', qualification: user.qualification || '', registration_no: user.registration_no || '', specialization: user.specialization || '' });
  const [pw, setPw] = useState({ current_password: '', new_password: '' });
  const s = (k) => (e) => setP({ ...p, [k]: e.target.value });

  const saveProfile = async (e) => {
    e.preventDefault();
    try { const r = await api.patch('/auth/me', p); setUser(r.user); toast.success('Profile saved'); } catch (err) { toast.error(err.message); }
  };
  const savePw = async (e) => {
    e.preventDefault();
    try { await api.patch('/auth/me', pw); setPw({ current_password: '', new_password: '' }); toast.success('Password changed'); } catch (err) { toast.error(err.message); }
  };
  const setTheme = async (theme) => {
    upsertClinic({ ...clinic, theme });
    try { await api.patch(`/clinics/${clinic.id}`, { theme }); } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="animate-in max-w-3xl space-y-5">
      <PageHeader title="Settings" subtitle="Your profile, security and appearance." />
      <Section icon={SunMoon} title="Light / dark mode">
        <p className="mb-4 text-sm text-muted">Dark mode is easier on the eyes in the evening clinic. This setting is saved on this device.</p>
        <ModeSegmented />
      </Section>
      {isDoctor && clinic && (
        <Section icon={Palette} title={`Colour theme · ${clinic.name}`}>
          <p className="mb-4 text-sm text-muted">Every clinic can have its own colour — a quick visual cue of where you're working. Changes apply instantly for everyone in this clinic.</p>
          <ThemePicker value={clinic.theme} onChange={setTheme} />
        </Section>
      )}
      <Section icon={UserRound} title="Profile">
        <form onSubmit={saveProfile} className="grid gap-4 md:grid-cols-2">
          <Field label="Full name" className="md:col-span-2"><input className="input" value={p.full_name} onChange={s('full_name')} /></Field>
          <Field label="Mobile"><input className="input" value={p.phone} onChange={s('phone')} /></Field>
          <Field label="Email"><input className="input bg-slate-50" value={user.email} disabled /></Field>
          {isDoctor && <>
            <Field label="Qualification" hint="Printed on case sheets"><input className="input" value={p.qualification} onChange={s('qualification')} /></Field>
            <Field label="Medical registration no."><input className="input" value={p.registration_no} onChange={s('registration_no')} /></Field>
            <Field label="Specialisation" className="md:col-span-2"><input className="input" value={p.specialization} onChange={s('specialization')} /></Field>
          </>}
          <div className="md:col-span-2"><button className="btn-primary">Save profile</button></div>
        </form>
      </Section>
      <Section icon={KeyRound} title="Change password">
        <form onSubmit={savePw} className="grid gap-4 md:grid-cols-2">
          <Field label="Current password"><input className="input" type="password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} /></Field>
          <Field label="New password"><input className="input" type="password" minLength={6} value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} /></Field>
          <div className="md:col-span-2"><button className="btn-outline" disabled={!pw.new_password}>Update password</button></div>
        </form>
      </Section>
      <Section icon={Keyboard} title="Keyboard shortcuts">
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {[['N', 'New case file'], ['T', 'Today’s queue'], ['Ctrl K', 'Find a patient'], ['Ctrl Enter', 'Register patient (on New case)']].map(([k, l]) => (
            <li key={k} className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2"><span>{l}</span><span className="kbd">{k}</span></li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
