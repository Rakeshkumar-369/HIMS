import { Router } from 'express';
import { query, one, tx } from '../db.js';
import { ah, HttpError, assertClinicAccess, assertPatientAccess, generateCaseNo, nullIfEmpty } from '../lib/util.js';
import { requireStaff } from '../middleware/auth.js';
import { shapePatient, patientRecord } from '../lib/records.js';
import { insertVisit } from './visits.js';
import { publish } from '../lib/live.js';

const r = Router();
r.use(requireStaff());

const PATIENT_FIELDS = ['full_name', 'gender', 'dob', 'age_years', 'phone', 'address', 'blood_group', 'guardian_name',
  'emergency_phone', 'occupation', 'allergies', 'habits'];

function patientValues(b) {
  return PATIENT_FIELDS.map((k) => (k === 'age_years' ? (b.age_years === '' || b.age_years == null ? null : Number(b.age_years)) : nullIfEmpty(b[k])));
}

// Search / list
r.get('/', ah(async (req, res) => {
  const clinicId = Number(req.query.clinicId);
  await assertClinicAccess(req.user, clinicId);
  const q = String(req.query.q || '').trim();
  // This clinic's own patients, plus anyone from a sister clinic who has already visited here
  const params = [clinicId, clinicId];
  let where = '(p.clinic_id = ? OR EXISTS (SELECT 1 FROM visits vv WHERE vv.patient_id = p.id AND vv.clinic_id = ?))';
  if (q) {
    where += ' AND (p.case_no LIKE ? OR p.full_name LIKE ? OR p.phone LIKE ?)';
    params.push(`${q}%`, `%${q}%`, `%${q}%`);
  }
  // An exact 9-digit case ID also finds the file in any clinic of the same doctor
  const caseNo = q.replace(/\s/g, '');
  if (/^\d{9}$/.test(caseNo)) {
    where = `(${where}) OR (p.case_no = ? AND p.clinic_id IN
              (SELECT c2.id FROM clinics c1 JOIN clinics c2 ON c2.owner_id = c1.owner_id WHERE c1.id = ?))`;
    params.push(caseNo, clinicId);
  }
  const rows = await query(
    `SELECT p.*, hc.name AS home_clinic, MAX(v.visit_date) AS last_visit, COUNT(v.id) AS visit_count
       FROM patients p JOIN clinics hc ON hc.id = p.clinic_id
       LEFT JOIN visits v ON v.patient_id = p.id AND v.status = 'completed'
      WHERE ${where} GROUP BY p.id
      ORDER BY ${q ? 'p.full_name' : 'COALESCE(MAX(v.visit_date), DATE(p.created_at)) DESC'}
      LIMIT ?`, [...params, Math.min(Number(req.query.limit) || 30, 200)]);
  res.json(rows.map(shapePatient));
}));

// Register a new case file (and, by default, put the patient in today's queue).
r.post('/', ah(async (req, res) => {
  const b = req.body;
  const clinicId = Number(b.clinic_id);
  await assertClinicAccess(req.user, clinicId);
  if (!b.full_name?.trim() || !b.gender) throw new HttpError(400, 'Name and gender are required');
  if (!b.dob && (b.age_years === '' || b.age_years == null)) throw new HttpError(400, 'Age or date of birth is required');

  const result = await tx(async (c) => {
    const caseNo = await generateCaseNo(c);
    const [ins] = await c.query(
      `INSERT INTO patients (case_no, clinic_id, ${PATIENT_FIELDS.join(', ')}, known_conditions, created_by)
       VALUES (?,?,${PATIENT_FIELDS.map(() => '?').join(',')},?,?)`,
      [caseNo, clinicId, ...patientValues({ ...b, full_name: b.full_name.trim() }), JSON.stringify(b.known_conditions || []), req.user.id]);
    let visit = null;
    if (b.enqueue !== false) visit = await insertVisit(c, { ...(b.visit || {}), clinic_id: clinicId, patient_id: ins.insertId, visit_type: 'new' }, req.user);
    return { id: ins.insertId, case_no: caseNo, visit };
  });
  if (result.visit) publish(clinicId, 'queue', { type: 'added', visitId: result.visit.id });
  res.status(201).json(result);
}));

r.get('/:id', ah(async (req, res) => {
  const rec = await patientRecord(Number(req.params.id), { includePrivate: req.user.role === 'doctor' });
  if (!rec) throw new HttpError(404, 'Patient not found');
  await assertPatientAccess(req.user, rec.patient.clinic_id);
  res.json(rec);
}));

r.patch('/:id', ah(async (req, res) => {
  const p = await one('SELECT clinic_id FROM patients WHERE id = ?', [Number(req.params.id)]);
  if (!p) throw new HttpError(404, 'Patient not found');
  await assertPatientAccess(req.user, p.clinic_id);
  const keys = PATIENT_FIELDS.filter((k) => k in req.body);
  const vals = patientValues(req.body).filter((_, i) => keys.includes(PATIENT_FIELDS[i]));
  if ('known_conditions' in req.body) { keys.push('known_conditions'); vals.push(JSON.stringify(req.body.known_conditions || [])); }
  if (keys.length) await query(`UPDATE patients SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...vals, Number(req.params.id)]);
  res.json(shapePatient(await one('SELECT * FROM patients WHERE id = ?', [Number(req.params.id)])));
}));

export default r;
