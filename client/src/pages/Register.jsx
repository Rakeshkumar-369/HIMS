import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import clsx from 'clsx';
import AuthLayout from '../components/AuthLayout';
import { Field } from '../components/ui';
import ThemePicker from '../components/ThemePicker';
import { useAuth } from '../context/AuthContext';
import { applyTheme } from '../lib/themes';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState({ full_name: '', email: '', phone: '', password: '', qualification: '', registration_no: '', specialization: '' });
  const [clinic, setClinic] = useState({ name: '', tagline: '', address: '', city: '', phone: '', registration_no: '', timings: '', consultation_fee: 300, theme: 'mint' });
  const d = (k) => (e) => setDoc({ ...doc, [k]: e.target.value });
  const c = (k) => (e) => setClinic({ ...clinic, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (step === 0) return setStep(1);
    setBusy(true);
    try {
      await register({ ...doc, full_name: doc.full_name.startsWith('Dr') ? doc.full_name : `Dr. ${doc.full_name}`, clinic });
      toast.success('Your clinic is ready 🎉');
      navigate('/app/today');
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <AuthLayout title={step === 0 ? 'Create hospital account' : 'Tell us about your clinic'}
      subtitle={step === 0 ? 'Step 1 of 2 · Doctor details' : 'Step 2 of 2 · Printed on every case sheet'}>
      <div className="mb-6 flex gap-2">{[0, 1].map((i) => <div key={i} className={clsx('h-1.5 flex-1 rounded-full transition', i <= step ? 'bg-brand-500' : 'bg-slate-200')} />)}</div>
      <form onSubmit={submit} className="space-y-4">
        {step === 0 ? (
          <>
            <Field label="Full name" required><input className="input" required value={doc.full_name} onChange={d('full_name')} placeholder="Dr. Ananya Rao" /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email" required><input className="input" type="email" required value={doc.email} onChange={d('email')} /></Field>
              <Field label="Mobile"><input className="input" inputMode="tel" value={doc.phone} onChange={d('phone')} /></Field>
            </div>
            <Field label="Password" required hint="At least 6 characters"><input className="input" type="password" minLength={6} required value={doc.password} onChange={d('password')} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Qualification"><input className="input" value={doc.qualification} onChange={d('qualification')} placeholder="MBBS, MD" /></Field>
              <Field label="Medical reg. no."><input className="input" value={doc.registration_no} onChange={d('registration_no')} /></Field>
            </div>
          </>
        ) : (
          <>
            <Field label="Clinic name (must be unique)" required><input className="input" required value={clinic.name} onChange={c('name')} placeholder="Sunrise Family Clinic" /></Field>
            <Field label="Tagline"><input className="input" value={clinic.tagline} onChange={c('tagline')} placeholder="Caring for every generation" /></Field>
            <Field label="Address"><input className="input" value={clinic.address} onChange={c('address')} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City / PIN"><input className="input" value={clinic.city} onChange={c('city')} /></Field>
              <Field label="Clinic phone"><input className="input" value={clinic.phone} onChange={c('phone')} /></Field>
              <Field label="Timings"><input className="input" value={clinic.timings} onChange={c('timings')} placeholder="Mon–Sat 9–1, 5–8" /></Field>
              <Field label="Consultation fee (₹)"><input className="input" type="number" min="0" value={clinic.consultation_fee} onChange={c('consultation_fee')} /></Field>
            </div>
            <Field label="Pick a colour for this clinic">
              <ThemePicker value={clinic.theme} onChange={(t) => { setClinic({ ...clinic, theme: t }); applyTheme(t); }} />
            </Field>
          </>
        )}
        <div className="flex gap-2 pt-2">
          {step === 1 && <button type="button" className="btn-outline" onClick={() => setStep(0)}><ArrowLeft size={16} /> Back</button>}
          <button className="btn-primary flex-1 py-3" disabled={busy}>
            {step === 0 ? <>Continue <ArrowRight size={17} /></> : busy ? 'Creating…' : <><Check size={17} /> Create my clinic</>}
          </button>
        </div>
      </form>
      <p className="mt-8 text-center text-sm text-muted">Already registered? <Link to="/login" className="font-semibold text-brand-700 hover:underline">Sign in</Link></p>
    </AuthLayout>
  );
}
