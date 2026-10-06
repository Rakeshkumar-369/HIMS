import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { KeyRound, Check, X } from 'lucide-react';
import clsx from 'clsx';
import AuthLayout from '../components/AuthLayout';
import { Field } from '../components/ui';
import { useAuth } from '../context/authCtx';
import { api } from '../lib/api';
import { homeFor } from '../lib/routes';

const RULES = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'Contains a letter', test: (p) => /[A-Za-z]/.test(p) },
  { label: 'Contains a number', test: (p) => /\d/.test(p) },
];

/** Shown after an admin creates/resets an account: the user must pick their own password. */
export default function ChangePassword() {
  const { user, loading, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ current_password: '', new_password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const ok = RULES.every((r) => r.test(f.new_password)) && f.new_password === f.confirm;
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.patch('/auth/me', { current_password: f.current_password, new_password: f.new_password });
      setUser(r.user);
      toast.success('Password updated — you are all set');
      navigate(homeFor(r.user), { replace: true });
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <AuthLayout title="Set your own password" subtitle={`Welcome, ${user.full_name}. For your security, replace the temporary password you were given.`}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Temporary / current password"><input className="input" type="password" autoComplete="current-password" required value={f.current_password} onChange={(e) => setF({ ...f, current_password: e.target.value })} /></Field>
        <Field label="New password"><input className="input" type="password" autoComplete="new-password" required value={f.new_password} onChange={(e) => setF({ ...f, new_password: e.target.value })} /></Field>
        <Field label="Confirm new password"><input className="input" type="password" autoComplete="new-password" required value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
        <ul className="space-y-1 text-sm">
          {[...RULES, { label: 'Both entries match', test: (p) => p && p === f.confirm }].map((r) => {
            const pass = r.test(f.new_password);
            return <li key={r.label} className={clsx('flex items-center gap-2', pass ? 'text-emerald-700' : 'text-muted')}>{pass ? <Check size={15} /> : <X size={15} />}{r.label}</li>;
          })}
        </ul>
        <button className="btn-primary w-full py-3" disabled={!ok || busy}><KeyRound size={17} /> {busy ? 'Saving…' : 'Save password'}</button>
        <button type="button" className="btn-ghost w-full" onClick={() => logout().then(() => navigate('/login'))}>Sign out</button>
      </form>
    </AuthLayout>
  );
}
