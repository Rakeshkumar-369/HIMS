import { query, one } from '../db.js';
import { ageFrom, parseJSON } from './util.js';

export function shapePatient(p) {
  if (!p) return p;
  return { ...p, age: ageFrom(p.dob, p.age_years), known_conditions: parseJSON(p.known_conditions) };
}

/** Attach prescriptions + lab tests to a list of visits. Strips the private doctor comment unless allowed. */
export async function hydrateVisits(visits, { includePrivate = false } = {}) {
  if (!visits.length) return visits;
  const ids = visits.map((v) => v.id);
  const [rx, labs] = await Promise.all([
    query('SELECT * FROM prescriptions WHERE visit_id IN (?) ORDER BY sort_order, id', [ids]),
    query('SELECT visit_id, test_name FROM visit_lab_tests WHERE visit_id IN (?) ORDER BY id', [ids]),
  ]);
  return visits.map((v) => {
    const out = {
      ...v,
      prescriptions: rx.filter((r) => r.visit_id === v.id),
      lab_tests: labs.filter((l) => l.visit_id === v.id).map((l) => l.test_name),
      bmi: v.weight_kg && v.height_cm ? +(v.weight_kg / (v.height_cm / 100) ** 2).toFixed(1) : null,
    };
    if (!includePrivate) delete out.doctor_comment;
    return out;
  });
}

const VISIT_SELECT = `
  SELECT v.*, d.full_name AS doctor_name, d.qualification AS doctor_qualification,
         d.registration_no AS doctor_registration_no, c.name AS clinic_name
    FROM visits v LEFT JOIN users d ON d.id = v.doctor_id JOIN clinics c ON c.id = v.clinic_id`;

export async function getVisit(id, opts) {
  const v = await one(`${VISIT_SELECT} WHERE v.id = ?`, [id]);
  if (!v) return null;
  const [h] = await hydrateVisits([v], opts);
  return h;
}

/** Complete case file: patient, clinic (print header) and every visit, newest first. */
export async function patientRecord(patientId, opts = {}) {
  const p = await one('SELECT * FROM patients WHERE id = ?', [patientId]);
  if (!p) return null;
  const clinic = await one('SELECT * FROM clinics WHERE id = ?', [p.clinic_id]);
  const statusFilter = opts.completedOnly ? "AND v.status = 'completed'" : "AND v.status <> 'cancelled'";
  const visits = await query(`${VISIT_SELECT} WHERE v.patient_id = ? ${statusFilter} ORDER BY v.visit_date DESC, v.id DESC`, [patientId]);
  return { patient: shapePatient(p), clinic, visits: await hydrateVisits(visits, opts) };
}
