import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Siren } from 'lucide-react';
import { Modal, Toggle } from './ui';
import { VitalsInputs, ComplaintsInput, ConditionsInput } from './intake';
import { api } from '../lib/api';

const VITAL_KEYS = ['bp_systolic', 'bp_diastolic', 'pulse', 'temperature', 'spo2', 'weight_kg', 'height_cm', 'blood_sugar'];
const pickVitals = (v = {}) => Object.fromEntries(VITAL_KEYS.map((k) => [k, v[k] ?? '']));

/**
 * mode="new": add an existing patient to today's queue (POST /visits)
 * mode="edit": update vitals/complaints of a queued visit (PATCH /visits/:id)
 */
export default function VisitIntakeModal({ open, onClose, mode = 'new', patient, visit, clinicId, onSaved }) {
  const [vitals, setVitals] = useState({});
  const [info, setInfo] = useState({});
  const [conds, setConds] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    // carry height forward from the last visit — one less thing to type
    setVitals(mode === 'edit' ? pickVitals(visit) : { height_cm: visit?.height_cm ?? '' });
    setInfo(mode === 'edit'
      ? { complaints: visit.complaints || '', complaint_duration: visit.complaint_duration || '', current_medicines: visit.current_medicines || '', nurse_notes: visit.nurse_notes || '', priority: !!visit.priority }
      : { complaints: '', complaint_duration: '', current_medicines: visit?.current_medicines || '', nurse_notes: '', priority: false });
    setConds(patient?.known_conditions || []);
  }, [open]); // eslint-disable-line

  const save = async () => {
    setBusy(true);
    try {
      const body = { ...vitals, ...info, known_conditions: conds };
      const res = mode === 'edit' ? await api.patch(`/visits/${visit.id}`, body) : await api.post('/visits', { ...body, patient_id: patient.id, clinic_id: clinicId });
      toast.success(mode === 'edit' ? 'Updated' : `Added to today's queue · token #${res.token_no}`);
      onSaved?.(res);
      onClose();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} wide title={mode === 'edit' ? `Update vitals · ${patient?.full_name || ''}` : `Add ${patient?.full_name || ''} to today's queue`}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Add to queue'}</button></>}>
      <div className="space-y-6">
        <div><div className="section-title mb-3">Vitals</div><VitalsInputs value={vitals} onChange={setVitals} /></div>
        <div><div className="section-title mb-3">Complaints</div><ComplaintsInput value={info} onChange={setInfo} /></div>
        <div><div className="section-title mb-3">Known case of</div><ConditionsInput value={conds} onChange={setConds} /></div>
        <div className="grid gap-4 md:grid-cols-2">
          <div><div className="label">Current medicines</div><textarea rows={2} className="input" value={info.current_medicines || ''} onChange={(e) => setInfo({ ...info, current_medicines: e.target.value })} /></div>
          <div><div className="label">Note for doctor</div><textarea rows={2} className="input" value={info.nurse_notes || ''} onChange={(e) => setInfo({ ...info, nurse_notes: e.target.value })} /></div>
        </div>
        <Toggle checked={!!info.priority} onChange={(v) => setInfo({ ...info, priority: v })} label={<span className="flex items-center gap-1.5"><Siren size={15} /> Emergency — move to top</span>} />
      </div>
    </Modal>
  );
}
