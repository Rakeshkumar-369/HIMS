import { Router } from 'express';
import { query, one, tx } from '../db.js';
import { ah, HttpError, assertClinicAccess, todayISO, addDays, NEXT_VISIT_DAYS, nullIfEmpty } from '../lib/util.js';
import { requireStaff } from '../middleware/auth.js';
import { getVisit, hydrateVisits, shapePatient } from '../lib/records.js';
import { publish } from '../lib/live.js';

const r = Router();

const NURSE_FIELDS = ['bp_systolic', 'bp_diastolic', 'pulse', 'temperature', 'spo2', 'weight_kg', 'height_cm', 'blood_sugar',
  'resp_rate', 'complaints', 'complaint_duration', 'current_medicines', 'nurse_notes', 'priority'];

const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const NUMERIC = new Set(['bp_systolic', 'bp_diastolic', 'pulse', 'temperature', 'spo2', 'weight_kg', 'height_cm', 'blood_sugar', 'resp_rate']);
const nurseVal = (k, v) => (NUMERIC.has(k) ? num(v) : k === 'priority' ? (v ? 1 : 0) : nullIfEmpty(v));

/** Creates a queue entry with the next token number for that clinic/day. */
export async function insertVisit(conn, b, user) {
  const date = b.visit_date || todayISO();
  const [[{ next }]] = await conn.query(
    'SELECT COALESCE(MAX(token_no), 0) + 1 AS next FROM visits WHERE clinic_id = ? AND visit_date = ? FOR UPDATE', [b.clinic_id, date]);
  const [[clinic]] = await conn.query('SELECT consultation_fee FROM clinics WHERE id = ?', [b.clinic_id]);
  const [ins] = await conn.query(
    `INSERT INTO visits (patient_id, clinic_id, visit_date, token_no, visit_type, fee, created_by, ${NURSE_FIELDS.join(', ')})
     VALUES (?,?,?,?,?,?,?,${NURSE_FIELDS.map(() => '?').join(',')})`,
    [b.patient_id, b.clinic_id, date, next, b.visit_type || 'follow_up', clinic?.consultation_fee || 0, user.id,
     ...NURSE_FIELDS.map((k) => nurseVal(k, b[k]))]);
  return { id: ins.insertId, token_no: next };
}

async function loadForStaff(req, id) {
  const v = await one('SELECT id, clinic_id, status, patient_id FROM visits WHERE id = ?', [id]);
  if (!v) throw new HttpError(404, 'Visit not found');
  await assertClinicAccess(req.user, v.clinic_id);
  return v;
}

r.use(requireStaff());

// ---- Day view ----------------------------------------------------------
r.get('/queue', ah(async (req, res) => {
  const clinicId = Number(req.query.clinicId);
  await assertClinicAccess(req.user, clinicId);
  const date = req.query.date || todayISO();
  const rows = await query(
    `SELECT v.*, p.case_no, p.full_name, p.gender, p.dob, p.age_years, p.phone, p.known_conditions, p.allergies,
            d.full_name AS doctor_name
       FROM visits v JOIN patients p ON p.id = v.patient_id LEFT JOIN users d ON d.id = v.doctor_id
      WHERE v.clinic_id = ? AND v.visit_date = ?
      ORDER BY FIELD(v.status,'with_doctor','waiting','completed','cancelled'), v.priority DESC, v.token_no`, [clinicId, date]);
  const visits = (await hydrateVisits(rows)).map((v) => {
    const s = shapePatient({ dob: v.dob, age_years: v.age_years, known_conditions: v.known_conditions });
    return { ...v, age: s.age, known_conditions: s.known_conditions };
  });
  res.json({ date, visits });
}));

// Patients currently "displayed" to doctors in this clinic
r.get('/live', ah(async (req, res) => {
  const clinicId = Number(req.query.clinicId);
  await assertClinicAccess(req.user, clinicId);
  const rows = await query(
    `SELECT id FROM visits WHERE clinic_id = ? AND visit_date = ? AND status = 'with_doctor'
        AND (doctor_id IS NULL OR doctor_id = ?) ORDER BY called_at`, [clinicId, todayISO(), req.user.id]);
  const waiting = await one(
    "SELECT COUNT(*) AS n FROM visits WHERE clinic_id = ? AND visit_date = ? AND status = 'waiting'", [clinicId, todayISO()]);
  const visits = await Promise.all(rows.map((x) => getVisit(x.id, { includePrivate: req.user.role === 'doctor' })));
  res.json({ visits, waiting: waiting.n });
}));

// Frequently used medicines / diagnoses for one-tap entry
r.get('/suggestions', ah(async (req, res) => {
  const [medicines, diagnoses] = await Promise.all([
    query(
      `SELECT rx.medicine, COUNT(*) AS n,
              SUBSTRING_INDEX(GROUP_CONCAT(rx.dosage ORDER BY rx.id DESC SEPARATOR '|'), '|', 1) AS dosage,
              SUBSTRING_INDEX(GROUP_CONCAT(rx.timing ORDER BY rx.id DESC SEPARATOR '|'), '|', 1) AS timing,
              SUBSTRING_INDEX(GROUP_CONCAT(rx.duration ORDER BY rx.id DESC SEPARATOR '|'), '|', 1) AS duration
         FROM prescriptions rx JOIN visits v ON v.id = rx.visit_id
        WHERE v.doctor_id = ? GROUP BY rx.medicine ORDER BY n DESC LIMIT 80`, [req.user.id]),
    query(
      `SELECT diagnosis, COUNT(*) AS n FROM visits
        WHERE doctor_id = ? AND diagnosis IS NOT NULL AND diagnosis <> ''
        GROUP BY diagnosis ORDER BY n DESC LIMIT 40`, [req.user.id]),
  ]);
  res.json({ medicines, diagnoses });
}));

// Add an existing patient to the queue (follow-up)
r.post('/', ah(async (req, res) => {
  const b = req.body;
  const p = await one('SELECT id, clinic_id FROM patients WHERE id = ?', [Number(b.patient_id)]);
  if (!p) throw new HttpError(404, 'Patient not found');
  const clinicId = Number(b.clinic_id || p.clinic_id);
  await assertClinicAccess(req.user, clinicId);
  const dup = await one(
    "SELECT token_no FROM visits WHERE patient_id = ? AND clinic_id = ? AND visit_date = ? AND status IN ('waiting','with_doctor')",
    [p.id, clinicId, todayISO()]);
  if (dup) throw new HttpError(409, `Already in today's queue (token #${dup.token_no})`);
  const visit = await tx((c) => insertVisit(c, { ...b, clinic_id: clinicId, patient_id: p.id }, req.user));
  if (b.known_conditions) await query('UPDATE patients SET known_conditions = ? WHERE id = ?', [JSON.stringify(b.known_conditions), p.id]);
  publish(clinicId, 'queue', { type: 'added', visitId: visit.id });
  res.status(201).json(visit);
}));

r.get('/:id', ah(async (req, res) => {
  await loadForStaff(req, Number(req.params.id));
  const v = await getVisit(Number(req.params.id), { includePrivate: req.user.role === 'doctor' });
  const p = shapePatient(await one('SELECT * FROM patients WHERE id = ?', [v.patient_id]));
  const clinic = await one('SELECT * FROM clinics WHERE id = ?', [v.clinic_id]);
  res.json({ visit: v, patient: p, clinic });
}));

// Nurse updates vitals / complaints
r.patch('/:id', ah(async (req, res) => {
  const v = await loadForStaff(req, Number(req.params.id));
  const keys = NURSE_FIELDS.filter((k) => k in req.body);
  if (keys.length) await query(`UPDATE visits SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => nurseVal(k, req.body[k])), v.id]);
  if (req.body.known_conditions) await query('UPDATE patients SET known_conditions = ? WHERE id = ?', [JSON.stringify(req.body.known_conditions), v.patient_id]);
  publish(v.clinic_id, 'queue', { type: 'updated', visitId: v.id });
  res.json(await getVisit(v.id, { includePrivate: req.user.role === 'doctor' }));
}));

// "Display case to doctor"
r.post('/:id/call', ah(async (req, res) => {
  const v = await loadForStaff(req, Number(req.params.id));
  if (!['waiting', 'with_doctor'].includes(v.status)) throw new HttpError(400, 'This visit is already closed');
  await query("UPDATE visits SET status = 'with_doctor', called_at = NOW(), doctor_id = ? WHERE id = ?",
    [req.body.doctor_id || (req.user.role === 'doctor' ? req.user.id : null), v.id]);
  publish(v.clinic_id, 'queue', { type: 'called', visitId: v.id });
  publish(v.clinic_id, 'display', { visitId: v.id });
  res.json({ ok: true });
}));

r.post('/:id/return', ah(async (req, res) => {
  const v = await loadForStaff(req, Number(req.params.id));
  await query("UPDATE visits SET status = 'waiting', called_at = NULL WHERE id = ? AND status = 'with_doctor'", [v.id]);
  publish(v.clinic_id, 'queue', { type: 'returned', visitId: v.id });
  res.json({ ok: true });
}));

r.post('/:id/cancel', ah(async (req, res) => {
  const v = await loadForStaff(req, Number(req.params.id));
  if (v.status === 'completed') throw new HttpError(400, 'Completed visits cannot be cancelled');
  await query("UPDATE visits SET status = 'cancelled' WHERE id = ?", [v.id]);
  publish(v.clinic_id, 'queue', { type: 'cancelled', visitId: v.id });
  res.json({ ok: true });
}));

// Doctor finalises the consultation (also used to edit a completed visit)
r.post('/:id/complete', requireStaff('doctor'), ah(async (req, res) => {
  const v = await loadForStaff(req, Number(req.params.id));
  if (v.status === 'cancelled') throw new HttpError(400, 'This visit was cancelled');
  const b = req.body;
  const visitDate = (await one('SELECT visit_date FROM visits WHERE id = ?', [v.id])).visit_date;
  let nextDate = nullIfEmpty(b.next_visit_date);
  if (!nextDate && NEXT_VISIT_DAYS[b.next_visit_label]) nextDate = addDays(visitDate, NEXT_VISIT_DAYS[b.next_visit_label]);

  await tx(async (c) => {
    const nurseKeys = NURSE_FIELDS.filter((k) => k in b);
    await c.query(
      `UPDATE visits SET status = 'completed', doctor_id = ?, observations = ?, diagnosis = ?, lab_other = ?, advice = ?,
              doctor_comment = ?, next_visit_label = ?, next_visit_date = ?, fee = ?, payment_mode = ?,
              completed_at = COALESCE(completed_at, NOW()), called_at = COALESCE(called_at, NOW())
              ${nurseKeys.map((k) => `, ${k} = ?`).join('')}
        WHERE id = ?`,
      [req.user.id, nullIfEmpty(b.observations), nullIfEmpty(b.diagnosis), nullIfEmpty(b.lab_other), nullIfEmpty(b.advice),
       nullIfEmpty(b.doctor_comment), nullIfEmpty(b.next_visit_label), nextDate, Number(b.fee || 0), b.payment_mode || 'Cash',
       ...nurseKeys.map((k) => nurseVal(k, b[k])), v.id]);

    await c.query('DELETE FROM visit_lab_tests WHERE visit_id = ?', [v.id]);
    const labs = [...new Set((b.lab_tests || []).filter(Boolean))];
    if (labs.length) await c.query('INSERT INTO visit_lab_tests (visit_id, test_name) VALUES ?', [labs.map((t) => [v.id, t])]);

    await c.query('DELETE FROM prescriptions WHERE visit_id = ?', [v.id]);
    const rx = (b.prescriptions || []).filter((m) => m.medicine?.trim());
    if (rx.length) {
      await c.query('INSERT INTO prescriptions (visit_id, medicine, dosage, timing, duration, instructions, sort_order) VALUES ?',
        [rx.map((m, i) => [v.id, m.medicine.trim(), nullIfEmpty(m.dosage), nullIfEmpty(m.timing), nullIfEmpty(m.duration), nullIfEmpty(m.instructions), i])]);
    }
    if (Array.isArray(b.known_conditions)) {
      await c.query('UPDATE patients SET known_conditions = ? WHERE id = ?', [JSON.stringify(b.known_conditions), v.patient_id]);
    }
  });
  publish(v.clinic_id, 'queue', { type: 'completed', visitId: v.id });
  res.json(await getVisit(v.id, { includePrivate: true }));
}));

export default r;
