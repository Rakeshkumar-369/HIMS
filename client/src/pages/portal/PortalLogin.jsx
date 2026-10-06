import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Wordmark } from '../../components/Brand';
import ModeToggle from '../../components/ModeToggle';
import { Field } from '../../components/ui';
import { api } from '../../lib/api';

export default function PortalLogin() {
  const navigate = useNavigate();
  const [f, setF] = useState({ case_no: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/auth/patient-login', f);
      navigate('/portal');
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <div className="relative grid min-h-dvh place-items-center px-5 py-10">
      <ModeToggle className="absolute top-4 right-4" />
      <div className="animate-in w-full max-w-md">
        <div className="mb-8 flex justify-center"><Wordmark /></div>
        <div className="card p-7 sm:p-8">
          <div className="mb-1 text-xs font-bold tracking-wider text-brand-600 uppercase">Patient portal</div>
          <h1 className="text-2xl font-extrabold">Your health records</h1>
          <p className="mt-1 text-sm text-muted">Enter the 9-digit Case ID printed on your case sheet and your registered mobile number.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Case ID"><input className="input font-mono text-lg tracking-[0.2em]" inputMode="numeric" maxLength={11} required placeholder="123 456 789"
              value={f.case_no} onChange={(e) => setF({ ...f, case_no: e.target.value.replace(/[^\d ]/g, '') })} /></Field>
            <Field label="Registered mobile number"><input className="input text-lg tabular" inputMode="tel" required placeholder="98765 43210" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <button className="btn-primary w-full py-3" disabled={busy}>{busy ? 'Checking…' : 'View my records'} <ArrowRight size={17} /></button>
          </form>
          <button type="button" onClick={() => setF({ case_no: '100200300', phone: '9000000001' })} className="mt-4 w-full text-center text-xs font-semibold text-brand-700 hover:underline">Use demo patient</button>
        </div>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted"><ShieldCheck size={14} /> Private doctor notes are never shown here.</p>
        <p className="mt-2 text-center text-sm"><Link to="/login" className="font-semibold text-slate-500 hover:text-brand-700">Clinic staff sign in →</Link></p>
      </div>
    </div>
  );
}
