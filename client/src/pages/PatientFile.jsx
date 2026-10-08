import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CalendarPlus, Printer, Pencil, Phone, MapPin, Droplet, AlertTriangle, History } from 'lucide-react';
import VisitHistory from '../components/VisitHistory';
import { useAuth } from '../context/authCtx';
import { api } from '../lib/api';
import { useFetch } from '../lib/hooks';
import { PageLoader, Avatar, Modal, Field, Chips } from '../components/ui';
import { ConditionsInput } from '../components/intake';
import VisitIntakeModal from '../components/VisitIntakeModal';
import { ChartCard, ChartTooltip, Legend } from '../components/charts';
import { SERIES, GRID, AXIS, SURFACE } from '../lib/chartTokens';
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

export default function PatientFile() {
  const { id } = useParams();
  const { clinicId } = useAuth();
  const { data, loading, reload, setData } = useFetch(`/patients/${id}`);
  const [queueOpen, setQueueOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  if (loading && !data) return <PageLoader />;
  if (!data) return null;
  const { patient: p, visits, clinic: home } = data;
  const done = visits.filter((v) => v.status === 'completed');
  const trend = [...done].reverse().filter((v) => v.bp_systolic || v.weight_kg).map((v) => ({ date: v.visit_date, Systolic: v.bp_systolic, Diastolic: v.bp_diastolic, Weight: v.weight_kg }));

  return (
    <div className="animate-in space-y-5">
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-4 bg-gradient-to-r from-brand-100 via-brand-50 to-white p-5 sm:gap-5 sm:p-6">
          <Avatar name={p.full_name} className="size-14 bg-white text-lg sm:size-16 sm:text-xl" />
          <div className="min-w-0 flex-1">
            <div className="text-sm text-brand-700">Case ID <span className="font-mono font-medium tracking-wider">{caseFmt(p.case_no)}</span>{home.id !== clinicId && <span className="ml-2 rounded-full bg-sky-50 px-2 py-0.5 font-sans tracking-normal text-sky-700">Registered at {home.name}</span>}</div>
            <h1 className="truncate text-2xl font-semibold">{p.full_name}</h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              <span>{p.age} yrs · {p.gender}</span>
              {p.phone && <span className="inline-flex items-center gap-1"><Phone size={13} />{p.phone}</span>}
              {p.blood_group && <span className="inline-flex items-center gap-1"><Droplet size={13} />{p.blood_group}</span>}
              {p.address && <span className="inline-flex items-center gap-1"><MapPin size={13} />{p.address}</span>}
            </div>
          </div>
          <div className="grid w-full grid-cols-[1fr_auto_auto] gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <button className="btn-primary" onClick={() => setQueueOpen(true)}><CalendarPlus size={16} /> Add to today’s queue</button>
            <Link to={`/print/patient/${p.id}`} target="_blank" className="btn-outline"><Printer size={16} /> <span className="max-sm:hidden">Full case sheet</span></Link>
            <button className="btn-ghost" onClick={() => setEditOpen(true)}><Pencil size={16} /> <span className="max-sm:hidden">Edit</span></button>
          </div>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div><div className="label">Known case of</div><div className="flex flex-wrap gap-1">{p.known_conditions.length ? p.known_conditions.map((c) => <span key={c} className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-800">{c}</span>) : <span className="text-sm text-muted">None recorded</span>}</div></div>
          <div><div className="label">Allergies</div>{p.allergies ? <span className="inline-flex items-center gap-1 text-sm font-semibold text-rose-600"><AlertTriangle size={14} />{p.allergies}</span> : <span className="text-sm text-muted">None known</span>}</div>
          <div><div className="label">Visits</div><span className="text-sm font-semibold">{done.length} consultations{done[0] && ` · last ${fmtShort(done[0].visit_date)}`}</span></div>
          <div><div className="label">Registered</div><span className="text-sm font-semibold">{fmtDate(p.created_at?.slice(0, 10))}</span></div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><History size={18} className="text-brand-600" /> Visit history
          <span className="text-sm font-medium text-muted max-sm:hidden">— pick any date to see that whole visit</span></h2>
        <VisitHistory visits={visits} />
      </section>

      {trend.length > 1 && (
        <section className="grid gap-5 lg:grid-cols-2">
          <ChartCard title="Blood pressure trend" subtitle="mmHg, per visit" height={200}
            legend={<Legend items={[{ label: 'Systolic', color: SERIES[0], line: true }, { label: 'Diastolic', color: SERIES[1], line: true }]} />}
            table={{ columns: ['Date', 'Systolic', 'Diastolic'], rows: trend.map((t) => [fmtShort(t.date), t.Systolic ?? '—', t.Diastolic ?? '—']) }}>
            <ResponsiveContainer>
              <LineChart data={trend} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="date" tickFormatter={fmtShort} tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} domain={['dataMin - 10', 'dataMax + 10']} />
                <Tooltip content={<ChartTooltip labelFmt={fmtDate} />} cursor={{ stroke: GRID }} />
                <Line type="monotone" dataKey="Systolic" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: SURFACE, fill: SERIES[0] }} connectNulls />
                <Line type="monotone" dataKey="Diastolic" stroke={SERIES[1]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: SURFACE, fill: SERIES[1] }} connectNulls />
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
                <Line type="monotone" dataKey="Weight" stroke="var(--brand-600)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: SURFACE, fill: 'var(--brand-600)' }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>
      )}

      {queueOpen && <VisitIntakeModal open mode="new" patient={p} visit={done[0]} clinicId={clinicId} onClose={() => setQueueOpen(false)} onSaved={() => reload()} />}
      {editOpen && <EditPatient patient={p} onClose={() => setEditOpen(false)} onSaved={(np) => setData((d) => ({ ...d, patient: np }))} />}
    </div>
  );
}
