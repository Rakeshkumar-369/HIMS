import { useState } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, Copy, Wand2 } from 'lucide-react';
import { generatePassword } from '../lib/password';

/** Password input with show/hide, generate and copy — for admins handing out first-time passwords. */
export default function PasswordField({ value, onChange, autoFocus }) {
  const [show, setShow] = useState(true);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); toast.success('Password copied'); } catch { toast.error('Copy failed — select and copy manually'); }
  };
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <input className="input pr-10 font-mono tracking-wide" type={show ? 'text' : 'password'} autoComplete="new-password" autoFocus={autoFocus}
          value={value} onChange={(e) => onChange(e.target.value)} placeholder="At least 8 characters, letters & numbers" />
        <button type="button" onClick={() => setShow(!show)} className="absolute top-1/2 right-2 -translate-y-1/2 p-1.5 text-muted hover:text-ink" aria-label={show ? 'Hide' : 'Show'}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <button type="button" className="btn-soft px-3" onClick={() => onChange(generatePassword())} title="Generate"><Wand2 size={16} /></button>
      <button type="button" className="btn-outline px-3" onClick={copy} disabled={!value} title="Copy"><Copy size={16} /></button>
    </div>
  );
}
