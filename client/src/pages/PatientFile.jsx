import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import clsx from 'clsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CalendarPlus, Printer, Pencil, Phone, MapPin, Droplet, AlertTriangle, Lock, ChevronDown, FlaskConical, Pill, Stethoscope } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { useFetch } from '../lib/hooks';
import { PageLoader, Avatar, Modal, Field, Chips, StatusBadge } from '../components/ui';
import { ConditionsInput } from '../components/intake';
import VisitIntakeModal from '../components/VisitIntakeModal';
import { ChartCard, ChartTooltip, Legend, SERIES, GRID, AXIS } from '../components/charts';
import { caseFmt, fmtDate, fmtShort } from '../lib/format';
import { BLOOD_GROUPS } from '../lib/constants';

function EditPatient({ patient, onClose, onSaved }) {
  const [p, setP] = useState({ ...patient, age_years: patient.age_years ?? '', dob: patient.dob ?? '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setP({ ...p, [k]: e.target.value });
  const save = async () => {
    setBusy(true);
    try {
      const keys = ['full_name', 'gender', 'dob', 'age_years', 'phone', 'address', 'blood_group', 'guardian_name', 'emergency_phone', 'occupation', 'allergies', 'habits', 'known_conditions'];
      onSaved(await api.patch(`/patients/${patient.id}`, Object.fromEntries(keys.map((k) => [k, p[k]]))));
      toast.success('Case file updated');
      onClose();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open wide onClose={onClose} title="Edit patient details" footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={save}>Save</button></>}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Full name" className="md:col-span-2"><input className="input" value={p.full_name} onChange={set('full_name')} /></Field>
        <Field label="Gender"><Chips options={['Male', 'Female', 'Other']} value={p.gender} onChange={(v) => setP({ ...p, gender: v })} allowDeselect={false} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Age"><input className="input" type="number" value={p.age_years} onChange={set('age_years')} disabled={!!p.dob} /></Field>
          <Field label="DOB"><input className="input" type="date" value={p.dob} onChange={set('dob')} /></Field>
        </div>
        <Field label="Mobile"><input className="input" value={p.phone || ''} onChange={set('phone')} /></Field>
        <Field label="Emergency contact"><input className="input" value={p.emergency_phone || ''} onChange={set('emergency_phone')} /></Field>
        <Field label="Address" className="md:col-span-2"><input className="input" value={p.address || ''} onChange={set('address')} /></Field>
        <Field label="Blood group" className="md:col-span-2"><Chips size="sm" options={BLOOD_GROUPS} value={p.blood_group || ''} onChange={(v) => setP({ ...p, blood_group: v })} /></Field>
        <Field label="Relative / guardian"><input className="input" value={p.guardian_name || ''} onChange={set('guardian_name')} /></Field>
        <Field label="Occupation"><input className="input" value={p.occupation || ''} onChange={set('occupation')} /></Field>
        <Field label="Allergies"><input className="input" value={p.allergies || ''} onChange={set('allergies')} /></Field>
        <Field label="Habits"><input className="input" value={p.habits || ''} onChange={set('habits')} /></Field>
        <Field label="Known case of" className="md:col-span-2"><ConditionsInput value={p.known_conditions} onChange={(v) => setP({ ...p, known_conditions: v })} /></Field>
      </div>
    </Modal>
  );
}

function VisitCard({ v, open, onToggle }) {
  return (
    <li className="card overflow-hidden">
      <button onClick={onToggle} className="flex w-full items-center gap-4 p-4 text-left hover:bg-slate-50/60">
        <div className="w-14 shrink-0 text-center">
          <div className="text-lg leading-none font-extrabold">{fmtDate(v.visit_date, { day: '2-digit' })}</div>
          <div className="text-[11px] font-bold text-muted uppercase">{fmtDate(v.visit_date, { month: 'short', year: '2-digit' })}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{v.diagnosis || v.complaints || 'Visit'}</div>
          <div className="truncate text-xs text-muted">{v.complaints}{v.doctor_name && ` · ${v.doctor_name}`}</div>
        </div>
        {v.status !== 'completed' && <StatusBadge status={v.status} />}
        <ChevronDown size={18} className={clsx('shrink-0 text-muted transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="animate-in grid gap-4 border-t border-line/70 p-5 text-sm md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5 text-xs">
              {v.bp_systolic && <span className="rounded-lg bg-slate-100 px-2 py-1 font-semibold">BP {v.bp_systolic}/{v.bp_diastolic}</span>}
              {v.pulse && <span className="rounded-lg bg-slate-100 px-2 py-1 font-semibold">Pulse {v.pulse}</span>}
              {v.temperature && <span className="rounded-lg bg-slate-100 px-2 py-1 font-semibold">{v.temperature}°F</span>}
              {v.spo2 && <span className="rounded-lg bg-slate-100 px-2 py-1 font-semibold">SpO₂ {v.spo2}%</span>}
              {v.weight_kg && <span className="rounded-lg bg-slate-100 px-2 py-1 font-semibold">{v.weight_kg} kg</span>}
              {v.blood_sugar && <span className="rounded-lg bg-slate-100 px-2 py-1 font-semibold">RBS {v.blood_sugar}</span>}
            </div>
            {v.observations && <p><b className="text-muted">Observations:</b> {v.observations}</p>}
            {(v.lab_tests.length > 0 || v.lab_other) && <p className="flex gap-2"><FlaskConical size={16} className="mt-0.5 shrink-0 text-brand-600" />{[...v.lab_tests, v.lab_other].filter(Boolean).join(', ')}</p>}
            {v.advice && <p><b className="text-muted">Advice:</b> {v.advice.replace(/\n/g, ' · ')}</p>}
            {v.next_visit_date && <p><b className="text-muted">Next visit:</b> {fmtDate(v.next_visit_date)}</p>}
            {v.doctor_comment && <p className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-amber-900"><Lock size={14} className="mt-0.5 shrink-0" />{v.doctor_comment}</p>}
          </div>
          <div>
            {!!v.prescriptions.length && (
              <ul className="space-y-1.5">
                {v.prescriptions.map((r) => (
                  <li key={r.id} className="flex items-start gap-2 rounded-xl bg-brand-50/60 px-3 py-2">
                    <Pill size={15} className="mt-0.5 shrink-0 text-brand-600" />
                    <div><div className="font-semibold">{r.medicine}</div><div className="text-xs text-muted">{[r.dosage, r.timing, r.duration, r.instructions].filter(Boolean).join(' · ')}</div></div>
                  </li>
                ))}
              </ul>
            )}
            {v.status === 'completed' && <Link to={`/print/visit/${v.id}`} target="_blank" className="btn-soft mt-3"><Printer size={15} /> Print this visit</Link>}
          </div>
        </div>
      )}
    </li>
  );
}

export default function PatientFile() {
  const { id } = useParams();
  const { clinicId } = useAuth();
  const { data, loading, reload, setData } = useFetch(`/patients/${id}`, [id]);
  const [queueOpen, setQueueOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [openId, setOpenId] = useState(null);
  if (loading && !data) return <PageLoader />;
  if (!data) return null;
  const { patient: p, visits } = data;
  const done = visits.filter((v) => v.status === 'completed');
  const trend = [...done].reverse().filter((v) => v.bp_systolic || v.weight_kg).map((v) => ({ date: v.visit_date, Systolic: v.bp_systolic, Diastolic: v.bp_diastolic, Weight: v.weight_kg }));
  const firstOpen = openId ?? visits[0]?.id;

  return (
    <div className="animate-in space-y-5">
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-5 bg-gradient-to-r from-brand-100 via-brand-50 to-white p-6">
          <Avatar name={p.full_name} className="size-16 bg-white text-xl" />
          <div className="min-w-0 flex-1">
            <div className="font-mono text-xs font-bold tracking-widest text-brand-700">CASE #{caseFmt(p.case_no)}</div>
            <h1 className="truncate text-2xl font-extrabold">{p.full_name}</h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              <span>{p.age} yrs · {p.gender}</span>
              {p.phone && <span className="inline-flex items-center gap-1"><Phone size={13} />{p.phone}</span>}
              {p.blood_group && <span className="inline-flex items-center gap-1"><Droplet size={13} />{p.blood_group}</span>}
              {p.address && <span className="inline-flex items-center gap-1"><MapPin size={13} />{p.address}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => setQueueOpen(true)}><CalendarPlus size={16} /> Add to today's queue</button>
            <Link to={`/print/patient/${p.id}`} target="_blank" className="btn-outline"><Printer size={16} /> Full case sheet</Link>
            <button className="btn-ghost" onClick={() => setEditOpen(true)}><Pencil size={16} /> Edit</button>
          </div>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div><div className="label">Known case of</div><div className="flex flex-wrap gap-1">{p.known_conditions.length ? p.known_conditions.map((c) => <span key={c} className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-800">{c}</span>) : <span className="text-sm text-muted">None recorded</span>}</div></div>
          <div><div className="label">Allergies</div>{p.allergies ? <span className="inline-flex items-center gap-1 text-sm font-semibold text-rose-600"><AlertTriangle size={14} />{p.allergies}</span> : <span className="text-sm text-muted">None known</span>}</div>
          <div><div className="label">Visits</div><span className="text-sm font-semibold">{done.length} consultations{done[0] && ` · last ${fmtShort(done[0].visit_date)}`}</span></div>
          <div><div className="label">Registered</div><span className="text-sm font-semibold">{fmtDate(p.created_at?.slice(0, 10))}</span></div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Stethoscope size={18} className="text-brand-600" /> Visit history</h2>
          {!visits.length && <div className="card p-8 text-center text-muted">No visits yet.</div>}
          <ul className="space-y-2.5">{visits.map((v) => <VisitCard key={v.id} v={v} open={firstOpen === v.id} onToggle={() => setOpenId(firstOpen === v.id ? 0 : v.id)} />)}</ul>
        </section>
        {trend.length > 1 && (
          <div className="space-y-5 xl:sticky xl:top-24 xl:self-start">
            <ChartCard title="Blood pressure trend" subtitle="mmHg, per visit" height={200}
              legend={<Legend items={[{ label: 'Systolic', color: SERIES[0], line: true }, { label: 'Diastolic', color: SERIES[1], line: true }]} />}
              table={{ columns: ['Date', 'Systolic', 'Diastolic'], rows: trend.map((t) => [fmtShort(t.date), t.Systolic ?? '—', t.Diastolic ?? '—']) }}>
              <ResponsiveContainer>
                <LineChart data={trend} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="date" tickFormatter={fmtShort} tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} domain={['dataMin - 10', 'dataMax + 10']} />
                  <Tooltip content={<ChartTooltip labelFmt={fmtDate} />} cursor={{ stroke: GRID }} />
                  <Line type="monotone" dataKey="Systolic" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: SERIES[0] }} connectNulls />
                  <Line type="monotone" dataKey="Diastolic" stroke={SERIES[1]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: SERIES[1] }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Weight trend" subtitle="kg, per visit" height={160} table={{ columns: ['Date', 'Weight (kg)'], rows: trend.map((t) => [fmtShort(t.date), t.Weight ?? '—']) }}>
              <ResponsiveContainer>
                <LineChart data={trend} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="date" tickFormatter={fmtShort} tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} domain={['dataMin - 3', 'dataMax + 3']} />
                  <Tooltip content={<ChartTooltip labelFmt={fmtDate} fmt={(v) => `${v} kg`} />} cursor={{ stroke: GRID }} />
                  <Line type="monotone" dataKey="Weight" stroke="var(--brand-600)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: 'var(--brand-600)' }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        )}
      </div>

      {queueOpen && <VisitIntakeModal open mode="new" patient={p} visit={done[0]} clinicId={clinicId} onClose={() => setQueueOpen(false)} onSaved={() => reload(true)} />}
      {editOpen && <EditPatient patient={p} onClose={() => setEditOpen(false)} onSaved={(np) => setData((d) => ({ ...d, patient: np }))} />}
    </div>
  );
}
