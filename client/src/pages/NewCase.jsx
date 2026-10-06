import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import clsx from 'clsx';
import { UserRound, Activity, HeartPulse, MessageSquareText, Pill, ChevronDown, Siren, CheckCircle2, Search, NotebookPen } from 'lucide-react';
import { useAuth } from '../context/authCtx';
import { api } from '../lib/api';
import { Field, Chips, PageHeader, Toggle } from '../components/ui';
import { VitalsInputs, ConditionsInput, ComplaintsInput, Section } from '../components/intake';
import { BLOOD_GROUPS } from '../lib/constants';

const EMPTY = {
  full_name: '', gender: '', age_years: '', dob: '', phone: '', address: '', blood_group: '', guardian_name: '', emergency_phone: '',
  occupation: '', allergies: '', habits: '', known_conditions: [],
};
const EMPTY_VISIT = { complaints: '', complaint_duration: '', current_medicines: '', nurse_notes: '', priority: false };

export default function NewCase() {
  const { clinicId, clinic } = useAuth();
  const navigate = useNavigate();
  const [p, setP] = useState(EMPTY);
  const [visit, setVisit] = useState(EMPTY_VISIT);
  const [vitals, setVitals] = useState({});
  const [more, setMore] = useState(false);
  const [useDob, setUseDob] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setP({ ...p, [k]: e.target.value });

  const valid = p.full_name.trim() && p.gender && (p.age_years || p.dob);

  const submit = async (enqueue = true) => {
    if (!valid) return toast.error('Name, gender and age are required');
    setBusy(true);
    try {
      const res = await api.post('/patients', {
        ...p, clinic_id: clinicId, enqueue, age_years: useDob ? '' : p.age_years, dob: useDob ? p.dob : '',
        visit: { ...vitals, ...visit },
      });
      toast.success(`Case file created · ID ${res.case_no}`, { description: enqueue ? `Added to today's queue as token #${res.visit.token_no}` : 'Saved without queueing' });
      navigate(enqueue ? `/app/today?highlight=${res.visit.id}` : `/app/patients/${res.id}`);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submit(true); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  return (
    <div className="animate-in">
      <PageHeader eyebrow={clinic?.name} title="New case file" subtitle="A unique 9-digit case ID is generated automatically on save."
        actions={<button className="btn-outline" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}><Search size={16} /> Returning patient?</button>} />

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Section icon={UserRound} title="Patient">
            <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
              <Field label="Full name" required><input autoFocus className="input text-base" value={p.full_name} onChange={set('full_name')} placeholder="e.g. Lakshmi Narayanan" /></Field>
              <Field label="Mobile number" hint="Used for patient portal login"><input className="input tabular" inputMode="tel" value={p.phone} onChange={set('phone')} placeholder="98765 43210" /></Field>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-[auto_1fr]">
              <Field label="Gender" required><Chips options={['Male', 'Female', 'Other']} value={p.gender} onChange={(v) => setP({ ...p, gender: v })} allowDeselect={false} /></Field>
              <div>
                <div className="label flex items-center justify-between">
                  <span>{useDob ? 'Date of birth' : 'Age (years)'} <span className="text-rose-400">*</span></span>
                  <button type="button" className="text-xs font-semibold text-brand-700" onClick={() => setUseDob(!useDob)}>{useDob ? 'Enter age instead' : 'Know the DOB?'}</button>
                </div>
                {useDob
                  ? <input type="date" className="input" value={p.dob} max={new Date().toISOString().slice(0, 10)} onChange={set('dob')} />
                  : <input type="number" min="0" max="120" inputMode="numeric" className="input tabular" value={p.age_years} onChange={set('age_years')} placeholder="35" />}
              </div>
            </div>

            <button type="button" onClick={() => setMore(!more)} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
              <ChevronDown size={16} className={clsx('transition', more && 'rotate-180')} /> {more ? 'Fewer details' : 'More details (address, blood group, allergies…)'}
            </button>
            {more && (
              <div className="animate-in mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Address" className="md:col-span-2"><input className="input" value={p.address} onChange={set('address')} /></Field>
                <Field label="Blood group" className="md:col-span-2"><Chips size="sm" options={BLOOD_GROUPS} value={p.blood_group} onChange={(v) => setP({ ...p, blood_group: v })} /></Field>
                <Field label="Relative / guardian"><input className="input" value={p.guardian_name} onChange={set('guardian_name')} /></Field>
                <Field label="Emergency contact"><input className="input" inputMode="tel" value={p.emergency_phone} onChange={set('emergency_phone')} /></Field>
                <Field label="Occupation"><input className="input" value={p.occupation} onChange={set('occupation')} /></Field>
                <Field label="Allergies"><input className="input" value={p.allergies} onChange={set('allergies')} placeholder="e.g. Penicillin" /></Field>
                <Field label="Habits" className="md:col-span-2"><Chips multi size="sm" options={['Smoking', 'Alcohol', 'Tobacco chewing', 'Vegetarian']} value={p.habits ? p.habits.split(', ') : []} onChange={(v) => setP({ ...p, habits: v.join(', ') })} /></Field>
              </div>
            )}
          </Section>

          <Section icon={Activity} title="Vitals" aside={<span className="text-xs text-muted">Out-of-range values turn red automatically</span>}>
            <VitalsInputs value={vitals} onChange={setVitals} />
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section icon={HeartPulse} title="Known case of">
              <ConditionsInput value={p.known_conditions} onChange={(v) => setP({ ...p, known_conditions: v })} />
            </Section>
            <Section icon={Pill} title="Current medicines">
              <textarea rows={5} className="input" placeholder="e.g. Metformin 500 mg twice daily, Amlodipine 5 mg…" value={visit.current_medicines} onChange={(e) => setVisit({ ...visit, current_medicines: e.target.value })} />
            </Section>
          </div>

          <Section icon={MessageSquareText} title="Current complaints">
            <ComplaintsInput value={visit} onChange={setVisit} />
          </Section>

          <Section icon={NotebookPen} title="Note for the doctor">
            <textarea rows={2} className="input" placeholder="Anything the doctor should know before the patient walks in" value={visit.nurse_notes} onChange={(e) => setVisit({ ...visit, nurse_notes: e.target.value })} />
          </Section>
        </div>

        {/* Sticky action panel */}
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <div className="card overflow-hidden">
            <div className="bg-gradient-to-br from-brand-100 to-brand-50 p-5">
              <div className="text-xs font-bold tracking-wider text-brand-700 uppercase">Preview</div>
              <div className="mt-2 truncate text-xl font-extrabold">{p.full_name || 'New patient'}</div>
              <div className="mt-1 text-sm text-slate-600">
                {[p.gender, useDob ? p.dob : p.age_years && `${p.age_years} yrs`, p.phone].filter(Boolean).join(' · ') || 'Fill in the basics to begin'}
              </div>
              {!!p.known_conditions.length && (
                <div className="mt-3 flex flex-wrap gap-1">{p.known_conditions.map((c) => <span key={c} className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-brand-800">{c}</span>)}</div>
              )}
            </div>
            <div className="space-y-4 p-5">
              <div className={clsx('rounded-2xl border p-3 transition', visit.priority ? 'border-rose-200 bg-rose-50' : 'border-line')}>
                <Toggle checked={visit.priority} onChange={(v) => setVisit({ ...visit, priority: v })}
                  label={<span className="flex items-center gap-1.5"><Siren size={15} className={visit.priority ? 'text-rose-600' : 'text-muted'} /> Emergency — move to top</span>} />
              </div>
              <button className="btn-primary w-full py-3.5 text-[15px]" disabled={!valid || busy} onClick={() => submit(true)}>
                <CheckCircle2 size={18} /> {busy ? 'Saving…' : 'Register & add to queue'}
              </button>
              <button className="btn-ghost w-full" disabled={!valid || busy} onClick={() => submit(false)}>Save case file only</button>
              <p className="text-center text-xs text-muted"><span className="kbd">Ctrl</span> + <span className="kbd">Enter</span> to register</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
