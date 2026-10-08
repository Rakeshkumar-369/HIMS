import { useState } from 'react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Calculator } from 'lucide-react';
import { api } from '../lib/api';
import { Modal, Field, Chips, Toggle } from './ui';
import ThemePicker from './ThemePicker';
import { inr, todayISO } from '../lib/format';
import { PAY_MODES } from '../lib/constants';
import { palette } from '../lib/themes';

const nowLocal = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const CREDIT = ['0', '7', '15', '30', '45', '60', '90'].map((d) => ({ value: d, label: d === '0' ? 'Same day' : `${d} days` }));

export function WorkplaceDot({ theme, className = 'size-2.5' }) {
  return <span className={clsx('inline-block shrink-0 rounded-full', className)} style={{ background: palette(theme || 'sky')[500] }} />;
}

/** Add / edit a hospital, clinic or other place the doctor works at. */
export function WorkplaceForm({ workplace, options, onClose, onSaved }) {
  const [w, setW] = useState(() => ({
    name: '', kind: 'Hospital', city: '', address: '', contact_person: '', phone: '', pay_model: 'per_case', default_fee: '', share_pct: '', tds_pct: '10', credit_days: '30', theme: 'sky', notes: '',
    ...(workplace ? Object.fromEntries(Object.entries(workplace).map(([k, v]) => [k, v == null ? '' : String(v)])) : {}),
  }));
  const [busy, setBusy] = useState(false);
  const s = (k) => (e) => setW({ ...w, [k]: e.target.value });
  const save = async () => {
    setBusy(true);
    try {
      const keys = ['name', 'kind', 'city', 'address', 'contact_person', 'phone', 'pay_model', 'default_fee', 'share_pct', 'tds_pct', 'credit_days', 'theme', 'notes'];
      const body = Object.fromEntries(keys.map((k) => [k, w[k]]));
      const res = workplace ? await api.patch(`/practice/workplaces/${workplace.id}`, body) : await api.post('/practice/workplaces', body);
      toast.success(workplace ? 'Workplace updated' : `${w.name} added`);
      onSaved(res);
      onClose();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open wide onClose={onClose} title={workplace ? `Edit ${workplace.name}` : 'Add a place you work at'}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!w.name.trim() || busy} onClick={save}>{workplace ? 'Save' : 'Add workplace'}</button></>}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" required className="md:col-span-2"><input className="input" autoFocus value={w.name} onChange={s('name')} placeholder="e.g. City Care Hospital" /></Field>
        <Field label="Type" className="md:col-span-2"><Chips size="sm" options={options.kinds} value={w.kind} onChange={(k) => setW({ ...w, kind: k })} allowDeselect={false} /></Field>
        <Field label="City / location"><input className="input" value={w.city} onChange={s('city')} /></Field>
        <Field label="Address"><input className="input" value={w.address} onChange={s('address')} /></Field>
        <Field label="Contact (accounts / admin)"><input className="input" value={w.contact_person} onChange={s('contact_person')} /></Field>
        <Field label="Phone"><input className="input" inputMode="tel" value={w.phone} onChange={s('phone')} /></Field>
        <Field label="How they pay you" className="md:col-span-2">
          <Chips size="sm" options={Object.entries(options.payModels).map(([value, label]) => ({ value, label }))} value={w.pay_model} onChange={(m) => setW({ ...w, pay_model: m })} allowDeselect={false} />
        </Field>
        <Field label={w.pay_model === 'retainer' ? 'Monthly retainer (₹)' : w.pay_model === 'per_visit' ? 'Fee per visit (₹)' : 'Usual fee (₹)'} hint="Pre-fills new entries">
          <input className="input tabular" type="number" min="0" inputMode="decimal" value={w.default_fee} onChange={s('default_fee')} />
        </Field>
        {w.pay_model === 'share'
          ? <Field label="Your share (%)"><input className="input tabular" type="number" min="0" max="100" inputMode="decimal" value={w.share_pct} onChange={s('share_pct')} /></Field>
          : <Field label="TDS they deduct (%)" hint="Usually 10% for professional fees"><input className="input tabular" type="number" min="0" max="30" inputMode="decimal" value={w.tds_pct} onChange={s('tds_pct')} /></Field>}
        {w.pay_model === 'share' && <Field label="TDS they deduct (%)"><input className="input tabular" type="number" min="0" max="30" inputMode="decimal" value={w.tds_pct} onChange={s('tds_pct')} /></Field>}
        <Field label="They usually pay within" className="md:col-span-2"><Chips size="sm" options={CREDIT} value={w.credit_days} onChange={(d) => setW({ ...w, credit_days: d })} allowDeselect={false} /></Field>
        <Field label="Colour" className="md:col-span-2"><ThemePicker size="sm" value={w.theme} onChange={(t) => setW({ ...w, theme: t })} /></Field>
        <Field label="Notes" className="md:col-span-2"><input className="input" value={w.notes} onChange={s('notes')} placeholder="OT days, billing contact, rules…" /></Field>
      </div>
    </Modal>
  );
}

/** Log one piece of work (consultation, surgery, on-call…), optionally paid on the spot. */
export function ServiceForm({ service, options, defaultWorkplaceId, onClose, onSaved }) {
  const wps = options.workplaces;
  const first = wps.find((w) => w.id === defaultWorkplaceId) || wps[0];
  const [f, setF] = useState(() => (service ? {
    ...Object.fromEntries(Object.entries(service).map(([k, v]) => [k, v == null ? '' : String(v)])),
    workplace_id: service.workplace_id, service_at: service.service_at.slice(0, 16).replace(' ', 'T'),
  } : {
    workplace_id: first?.id, service_at: nowLocal(), service_type: 'Consultation', procedure_name: '', patient_name: '', patient_age: '', patient_gender: '',
    patient_phone: '', hospital_ref: '', amount_billed: first ? String(Number(first.default_fee) || '') : '', expected_on: '', notes: '',
  }));
  const [paidNow, setPaidNow] = useState(false);
  const [paid, setPaid] = useState({ paid_now: '', paid_mode: 'Cash', tds_now: '' });
  const [busy, setBusy] = useState(false);
  const s = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const wp = wps.find((w) => w.id === Number(f.workplace_id));

  const pickWorkplace = (id) => {
    const w = wps.find((x) => x.id === id);
    setF((cur) => ({ ...cur, workplace_id: id, amount_billed: cur.amount_billed && service ? cur.amount_billed : String(Number(w?.default_fee) || '') }));
  };
  const pickProcedure = (p) => setF((cur) => ({ ...cur, procedure_name: p.name, amount_billed: cur.amount_billed && cur.amount_billed !== String(Number(wp?.default_fee) || '') ? cur.amount_billed : String(p.avg_fee || cur.amount_billed) }));

  const save = async (again) => {
    setBusy(true);
    try {
      const body = { ...f, ...(paidNow && !service ? paid : {}) };
      if (service) await api.patch(`/practice/services/${service.id}`, body); else await api.post('/practice/services', body);
      toast.success(service ? 'Entry updated' : `Logged at ${wp?.name}`, { description: !service && paidNow ? `${inr(paid.paid_now)} received` : undefined });
      onSaved();
      if (again) setF((cur) => ({ ...cur, patient_name: '', patient_age: '', patient_gender: '', patient_phone: '', hospital_ref: '', notes: '' }));
      else onClose();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open wide onClose={onClose} title={service ? 'Edit entry' : 'Log a service'}
      footer={<>
        <button className="btn-ghost max-sm:hidden" onClick={onClose}>Cancel</button>
        {!service && <button className="btn-outline" disabled={!f.workplace_id || busy} onClick={() => save(true)}>Save & add another</button>}
        <button className="btn-primary" disabled={!f.workplace_id || busy} onClick={() => save(false)}>Save</button>
      </>}>
      <div className="space-y-5">
        <Field label="Where?">
          <div className="flex flex-wrap gap-1.5">
            {wps.map((w) => (
              <button key={w.id} type="button" onClick={() => pickWorkplace(w.id)} className={clsx('chip', Number(f.workplace_id) === w.id && 'chip-on')}>
                <WorkplaceDot theme={w.theme} className={clsx('size-2', Number(f.workplace_id) === w.id && 'ring-2 ring-white')} /> {w.name}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date & time"><input type="datetime-local" className="input" value={f.service_at} onChange={s('service_at')} /></Field>
          <Field label="Amount billed (₹)" hint="What was agreed / mentioned">
            <input className="input text-lg font-bold tabular" type="number" min="0" inputMode="decimal" value={f.amount_billed} onChange={s('amount_billed')} />
          </Field>
        </div>
        <Field label="Type of work"><Chips size="sm" options={options.serviceTypes} value={f.service_type} onChange={(t) => setF({ ...f, service_type: t })} allowDeselect={false} /></Field>
        <Field label="Procedure / service name">
          <input className="input" list="procedures" aria-label="Procedure / service name" value={f.procedure_name} onChange={s('procedure_name')} placeholder="e.g. Laparoscopic cholecystectomy" />
          <datalist id="procedures">{options.procedures.map((p) => <option key={p.name} value={p.name} />)}</datalist>
          {!!options.procedures.length && (
            <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-1">
              {options.procedures.slice(0, 8).map((p) => (
                <button key={p.name} type="button" onClick={() => pickProcedure(p)} className={clsx('chip shrink-0 px-2.5 py-1 text-xs', f.procedure_name === p.name && 'chip-on')}>{p.name}</button>
              ))}
            </div>
          )}
        </Field>
        <div className="rounded-2xl border border-line p-4">
          <div className="mb-3 text-xs font-medium text-muted">Patient (optional)</div>
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <Field label="Name"><input className="input" value={f.patient_name} onChange={s('patient_name')} /></Field>
            <Field label="Age"><input className="input tabular" type="number" min="0" max="120" inputMode="numeric" value={f.patient_age} onChange={s('patient_age')} /></Field>
            <Field label="Gender" className="sm:col-span-2"><Chips size="sm" options={['Male', 'Female', 'Other']} value={f.patient_gender} onChange={(g) => setF({ ...f, patient_gender: g })} /></Field>
            <Field label="Mobile"><input className="input tabular" inputMode="tel" value={f.patient_phone} onChange={s('patient_phone')} /></Field>
            <Field label="Hospital IP/OP no."><input className="input" value={f.hospital_ref} onChange={s('hospital_ref')} /></Field>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Expected payment by" hint={wp ? `Default: ${wp.credit_days ?? 30} days after the service` : null}><input type="date" className="input" value={f.expected_on} onChange={s('expected_on')} /></Field>
          <Field label="Note"><input className="input" value={f.notes} onChange={s('notes')} placeholder="Optional" /></Field>
        </div>
        {!service && (
          <div className={clsx('rounded-2xl border p-4 transition', paidNow ? 'border-emerald-200 bg-emerald-50/60' : 'border-line')}>
            <Toggle checked={paidNow} onChange={(v) => { setPaidNow(v); if (v && !paid.paid_now) setPaid({ ...paid, paid_now: f.amount_billed }); }} label="Paid on the spot" />
            {paidNow && (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Field label="Received (₹)"><input className="input font-bold tabular" type="number" min="0" inputMode="decimal" value={paid.paid_now} onChange={(e) => setPaid({ ...paid, paid_now: e.target.value })} /></Field>
                <Field label="TDS deducted (₹)"><input className="input tabular" type="number" min="0" inputMode="decimal" value={paid.tds_now} onChange={(e) => setPaid({ ...paid, tds_now: e.target.value })} /></Field>
                <Field label="Mode"><Chips size="sm" options={PAY_MODES} value={paid.paid_mode} onChange={(m) => setPaid({ ...paid, paid_mode: m })} allowDeselect={false} /></Field>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Money received from a workplace (settles its oldest pending services first). */
export function PracticePaymentForm({ workplace, outstanding, onClose, onSaved }) {
  const [p, setP] = useState({ received_on: todayISO(), amount: '', tds_amount: '', mode: 'Bank', reference: '', notes: '' });
  const [gross, setGross] = useState('');
  const [busy, setBusy] = useState(false);
  const tdsPct = Number(workplace.tds_pct) || 0;
  const applyGross = (g) => {
    setGross(g);
    const t = Math.round((Number(g) || 0) * tdsPct) / 100;
    setP((cur) => ({ ...cur, tds_amount: t ? String(t) : '', amount: g ? String(Math.round(((Number(g) || 0) - t) * 100) / 100) : '' }));
  };
  const save = async () => {
    setBusy(true);
    try {
      await api.post('/practice/payments', { ...p, workplace_id: workplace.id });
      toast.success(`${inr(p.amount)} received from ${workplace.name}`);
      onSaved();
      onClose();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const settles = (Number(p.amount) || 0) + (Number(p.tds_amount) || 0);
  return (
    <Modal open onClose={onClose} title={`Payment from ${workplace.name}`}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!(settles > 0) || busy} onClick={save}>Save payment</button></>}>
      <div className="space-y-4">
        <div className="rounded-2xl bg-brand-50 px-4 py-3 text-sm">Pending from them: <b className="tabular">{inr(outstanding)}</b> · this payment settles the oldest services first</div>
        {tdsPct > 0 && (
          <div className="rounded-2xl border border-line p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted"><Calculator size={13} /> Work out TDS ({tdsPct}%)</div>
            <input className="input tabular" type="number" min="0" inputMode="decimal" placeholder="Gross amount on their statement" value={gross} onChange={(e) => applyGross(e.target.value)} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Received in bank / hand (₹)"><input className="input text-lg font-bold tabular" type="number" min="0" inputMode="decimal" value={p.amount} onChange={(e) => setP({ ...p, amount: e.target.value })} /></Field>
          <Field label="TDS deducted (₹)"><input className="input tabular" type="number" min="0" inputMode="decimal" value={p.tds_amount} onChange={(e) => setP({ ...p, tds_amount: e.target.value })} /></Field>
          <Field label="Received on"><input type="date" className="input" max={todayISO()} value={p.received_on} onChange={(e) => setP({ ...p, received_on: e.target.value })} /></Field>
          <Field label="Reference" hint="UTR / cheque no."><input className="input" value={p.reference} onChange={(e) => setP({ ...p, reference: e.target.value })} /></Field>
        </div>
        <Field label="Mode"><Chips size="sm" options={PAY_MODES} value={p.mode} onChange={(m) => setP({ ...p, mode: m })} allowDeselect={false} /></Field>
        {settles > 0 && <p className="text-sm text-muted">Settles <b className="text-ink tabular">{inr(settles)}</b> of pending work{settles > outstanding && outstanding > 0 ? ' (more than pending — the extra is kept as an advance)' : ''}.</p>}
      </div>
    </Modal>
  );
}
