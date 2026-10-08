import { useState } from 'react';
import clsx from 'clsx';
import { Plus } from 'lucide-react';
import { Chips } from './ui';
import { CONDITIONS, COMPLAINTS, DURATIONS } from '../lib/constants';
import { bmi, vitalFlag } from '../lib/format';

const FLAG_CLS = { high: 'border-rose-300 bg-rose-50/60 focus:border-rose-400 focus:ring-rose-100', low: 'border-amber-300 bg-amber-50/60 focus:border-amber-400 focus:ring-amber-100' };

function VitalBox({ label, unit, flag, children }) {
  return (
    <div className={clsx('rounded-2xl border bg-white px-3 pt-2 pb-2.5 transition focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100', flag ? FLAG_CLS[flag] : 'border-line')}>
      <div className="flex items-center justify-between text-xs font-medium text-muted">
        <span>{label}</span>
        {flag && <span className={clsx('rounded-full px-1.5 text-[10px]', flag === 'high' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700')}>{flag}</span>}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1">{children}<span className="text-xs text-muted">{unit}</span></div>
    </div>
  );
}

const vin = 'w-full min-w-0 bg-transparent text-xl font-bold tabular outline-none placeholder:text-slate-300';
const bpIn = 'w-[3.3ch] min-w-0 flex-none bg-transparent text-xl font-bold tabular outline-none placeholder:text-slate-300 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none';

export function VitalsInputs({ value, onChange }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  const b = bmi(value.weight_kg, value.height_cm);
  const field = (k, ph, step) => <input inputMode="decimal" type="number" step={step || 'any'} className={vin} placeholder={ph} value={value[k] ?? ''} onChange={set(k)} />;
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
      <VitalBox label="Blood pressure" unit="mmHg" flag={vitalFlag('bp', value.bp_systolic, value.bp_diastolic)}>
        <input inputMode="numeric" type="number" className={bpIn} placeholder="120" value={value.bp_systolic ?? ''} onChange={set('bp_systolic')} />
        <span className="text-xl font-bold text-slate-300">/</span>
        <input inputMode="numeric" type="number" className={bpIn} placeholder="80" value={value.bp_diastolic ?? ''} onChange={set('bp_diastolic')} />
      </VitalBox>
      <VitalBox label="Pulse" unit="bpm" flag={vitalFlag('pulse', value.pulse)}>{field('pulse', '72')}</VitalBox>
      <VitalBox label="Temp" unit="°F" flag={vitalFlag('temperature', value.temperature)}>{field('temperature', '98.4', '0.1')}</VitalBox>
      <VitalBox label="SpO₂" unit="%" flag={vitalFlag('spo2', value.spo2)}>{field('spo2', '98')}</VitalBox>
      <VitalBox label="Weight" unit="kg">{field('weight_kg', '65', '0.1')}</VitalBox>
      <VitalBox label="Height" unit="cm">{field('height_cm', '165')}</VitalBox>
      <VitalBox label="Sugar (RBS)" unit="mg/dL" flag={vitalFlag('blood_sugar', value.blood_sugar)}>{field('blood_sugar', '110')}</VitalBox>
      <div className={clsx('flex flex-col justify-center rounded-2xl px-3 py-2', b ? 'bg-brand-50' : 'bg-slate-50')}>
        <div className="text-xs font-medium text-muted">BMI (auto)</div>
        <div className="text-xl font-bold tabular">{b ?? '—'}<span className="ml-1 text-xs font-medium text-muted">{b ? (b < 18.5 ? 'Under' : b < 25 ? 'Normal' : b < 30 ? 'Over' : 'Obese') : ''}</span></div>
      </div>
    </div>
  );
}

export function ConditionsInput({ value = [], onChange }) {
  const [other, setOther] = useState('');
  const extra = value.filter((v) => !CONDITIONS.includes(v));
  const add = () => { const v = other.trim(); if (v && !value.includes(v)) onChange([...value, v]); setOther(''); };
  return (
    <div className="space-y-3">
      <Chips multi options={[...CONDITIONS, ...extra]} value={value} onChange={onChange} />
      <div className="flex gap-2">
        <input className="input py-2 text-sm" placeholder="Other (e.g. Migraine) — press Enter" value={other}
          onChange={(e) => setOther(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button type="button" onClick={add} className="btn-soft px-3"><Plus size={16} /></button>
      </div>
    </div>
  );
}

/** Complaint chips append to the free-text box — one tap, still fully editable. */
export function ComplaintsInput({ value, onChange }) {
  const text = value.complaints || '';
  const has = (c) => text.toLowerCase().split(/,\s*/).includes(c.toLowerCase());
  const toggle = (c) => {
    const parts = text.split(/,\s*/).filter(Boolean);
    const next = has(c) ? parts.filter((p) => p.toLowerCase() !== c.toLowerCase()) : [...parts, c];
    onChange({ ...value, complaints: next.join(', ') });
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {COMPLAINTS.map((c) => (
          <button type="button" key={c} onClick={() => toggle(c)} className={clsx('chip', has(c) && 'chip-on')}>{c}</button>
        ))}
      </div>
      <textarea rows={2} className="input" placeholder="Describe in the patient's words…" value={text} onChange={(e) => onChange({ ...value, complaints: e.target.value })} />
      <div>
        <div className="label">Since</div>
        <Chips size="sm" options={DURATIONS} value={value.complaint_duration || ''} onChange={(v) => onChange({ ...value, complaint_duration: v })} />
      </div>
    </div>
  );
}

export function Section({ icon: Icon, title, aside, children, className }) {
  return (
    <section className={clsx('card p-5 sm:p-6', className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="section-title">{Icon && <span className="grid size-7 place-items-center rounded-xl bg-brand-100 text-brand-700"><Icon size={15} /></span>}{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
