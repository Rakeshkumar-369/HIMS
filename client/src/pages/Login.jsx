import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, Stethoscope, HeartHandshake, UserRound } from 'lucide-react';
import AuthLayout from '../components/AuthLayout';
import { Field } from '../components/ui';
import { useAuth } from '../context/AuthContext';

const DEMO = [
  { label: 'Doctor', email: 'doctor@demo.com', icon: Stethoscope },
  { label: 'Nurse', email: 'nurse@demo.com', icon: HeartHandshake },
];

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/app/today" replace />;

  const submit = async (e, creds = form) => {
    e?.preventDefault();
    setBusy(true);
    try {
      const d = await login(creds.email, creds.password);
      toast.success(`Welcome, ${d.user.full_name.split(' ').slice(0, 2).join(' ')}`);
      navigate('/app/today');
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your clinic workspace.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email"><input className="input" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@clinic.com" /></Field>
        <Field label="Password"><input className="input" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••" /></Field>
        <button className="btn-primary w-full py-3" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={17} /></button>
      </form>

      <div className="mt-6 rounded-3xl border border-dashed border-brand-300 bg-brand-50/60 p-4">
        <div className="text-xs font-bold tracking-wider text-brand-700 uppercase">Try the demo</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {DEMO.map(({ label, email, icon: Icon }) => (
            <button key={email} type="button" disabled={busy} onClick={() => submit(null, { email, password: 'demo123' })} className="btn-outline justify-start">
              <Icon size={16} className="text-brand-600" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 space-y-3 text-center text-sm">
        <p className="text-muted">New clinic? <Link to="/register" className="font-semibold text-brand-700 hover:underline">Create your hospital account</Link></p>
        <Link to="/portal/login" className="inline-flex items-center gap-1.5 font-semibold text-slate-600 hover:text-brand-700"><UserRound size={15} /> I'm a patient — open my case sheet</Link>
      </div>
    </AuthLayout>
  );
}
