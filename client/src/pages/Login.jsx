import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, Stethoscope, HeartHandshake, UserRound, ShieldCheck, Briefcase, ChevronRight } from 'lucide-react';
import AuthLayout from '../components/AuthLayout';
import { Field } from '../components/ui';
import { useAuth } from '../context/authCtx';
import { api } from '../lib/api';
import { homeFor } from '../lib/routes';

const DEMO = [
  { label: 'Doctor', sub: 'Owns 2 clinics', email: 'doctor@demo.com', password: 'Demo@123', icon: Stethoscope },
  { label: 'Nurse', sub: 'Sunrise Family Clinic', email: 'nurse@demo.com', password: 'Demo@123', icon: HeartHandshake },
  { label: 'Nurse', sub: 'Green Valley Health Centre', email: 'nurse2@demo.com', password: 'Demo@123', icon: HeartHandshake },
  { label: 'Visiting doctor', sub: 'Freelance at 4 hospitals', email: 'freelance@demo.com', password: 'Demo@123', icon: Briefcase },
  { label: 'Platform admin', sub: 'Creates doctor accounts', email: 'admin@carenest.app', password: 'Admin@123', icon: ShieldCheck },
];

const Row = ({ icon: Icon, label, sub, right }) => (
  <>
    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon size={17} /></span>
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-medium text-ink">{label}</span>
      <span className="block truncate text-xs text-muted">{sub}</span>
    </span>
    <span className="hidden truncate text-xs text-muted sm:block">{right}</span>
    <ChevronRight size={16} className="shrink-0 text-slate-300 transition group-hover:text-brand-600" />
  </>
);

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [signup, setSignup] = useState(false);
  useEffect(() => { api.get('/auth/config').then((c) => setSignup(c.allowSelfSignup)).catch(() => {}); }, []);
  if (user) return <Navigate to={homeFor(user)} replace />;

  const submit = async (e, creds = form, demo = false) => {
    e?.preventDefault();
    setBusy(true);
    try {
      const d = await login(creds.email, creds.password);
      toast.success(`Welcome, ${d.user.full_name.split(' ').slice(0, 2).join(' ')}`);
      navigate(homeFor(d.user));
    } catch (err) {
      if (demo && err.status === 401) {
        // The demo password was changed on this computer: let the user type the new one.
        setForm({ email: creds.email, password: '' });
        toast.message('This demo password has been changed', { description: 'Type the new password above. To bring back the demo passwords, run “npm run db:reset”.' });
      } else toast.error(err.message);
    } finally { setBusy(false); }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your clinic workspace.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email"><input className="input" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@clinic.com" /></Field>
        <Field label="Password"><input className="input" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••" /></Field>
        <button className="btn-primary w-full py-3" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={17} /></button>
      </form>

      <div className="mt-8">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <span className="text-sm font-medium text-slate-600">Demo accounts</span>
          <span className="text-xs text-muted">tap to sign in</span>
        </div>
        <div className="divide-y divide-line/70 overflow-hidden rounded-2xl border border-line bg-white">
          {DEMO.map(({ email, password, ...r }) => (
            <button key={email} type="button" disabled={busy} onClick={() => submit(null, { email, password }, true)}
              className="group flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-brand-50/50 disabled:opacity-60">
              <Row {...r} right={email} />
            </button>
          ))}
          <Link to="/portal/login?demo=1" className="group flex w-full items-center gap-3 px-3.5 py-2.5 transition hover:bg-brand-50/50">
            <Row icon={UserRound} label="Patient" sub="Case ID 100 200 300 · mobile 9000000001" right="patient portal" />
          </Link>
        </div>
        <p className="mt-2 px-1 text-xs text-muted">Password <span className="font-mono">Demo@123</span> for all, <span className="font-mono">Admin@123</span> for the admin.</p>
      </div>

      <div className="mt-8 space-y-3 text-center text-sm">
        {signup
          ? <p className="text-muted">New clinic? <Link to="/register" className="font-medium text-brand-700 hover:underline">Create your hospital account</Link></p>
          : <p className="text-muted">New clinic? Contact the CareNest team to get your account.</p>}
        <Link to="/portal/login" className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-brand-700"><UserRound size={15} /> I’m a patient — open my case sheet</Link>
      </div>
    </AuthLayout>
  );
}
