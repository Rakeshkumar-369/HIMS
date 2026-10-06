// Platform console for the CareNest team: create and manage doctor accounts and their clinics.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, one, tx } from '../db.js';
import { ah, HttpError, nullIfEmpty } from '../lib/util.js';
import { audit } from '../lib/audit.js';
import { assertStrongPassword, likeEscape } from '../lib/security.js';
import { requireStaff, endAllSessions, idParam } from '../middleware/auth.js';
import { publicUser } from './auth.js';
import { clinicCode, THEMES } from './clinics.js';

const r = Router();
r.use(requireStaff('admin'));
r.param('id', idParam);

const PROFILE = ['full_name', 'phone', 'address', 'city', 'qualification', 'registration_no', 'specialization'];
const clampClinics = (n) => Math.max(0, Math.min(50, Number.parseInt(n, 10) || 0));

async function loadDoctor(id) {
  const d = await one("SELECT * FROM users WHERE id = ? AND role = 'doctor'", [id]);
  if (!d) throw new HttpError(404, 'Doctor not found');
  return d;
}

async function insertClinic(conn, ownerId, c) {
  if (!c.name?.trim()) throw new HttpError(400, 'Clinic name is required');
  const [dup] = await conn.query('SELECT id FROM clinics WHERE name = ?', [c.name.trim()]);
  if (dup.length) throw new HttpError(409, `Clinic name "${c.name}" is already taken`);
  if (c.theme && !THEMES.includes(c.theme)) throw new HttpError(400, 'Unknown theme');
  const [cl] = await conn.query(
    `INSERT INTO clinics (owner_id, name, code, tagline, address, city, phone, email, registration_no, timings, consultation_fee, theme)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [ownerId, c.name.trim(), await clinicCode(c.name, conn), nullIfEmpty(c.tagline), nullIfEmpty(c.address), nullIfEmpty(c.city),
     nullIfEmpty(c.phone), nullIfEmpty(c.email), nullIfEmpty(c.registration_no), nullIfEmpty(c.timings), Number(c.consultation_fee || 0), c.theme || 'mint']);
  await conn.query('INSERT INTO clinic_members (clinic_id, user_id) VALUES (?,?)', [cl.insertId, ownerId]);
  return cl.insertId;
}

r.get('/stats', ah(async (_req, res) => {
  const [[d], [c], [p], [v]] = await Promise.all([
    query("SELECT COUNT(*) AS n, SUM(is_active) AS active FROM users WHERE role = 'doctor'"),
    query('SELECT COUNT(*) AS n FROM clinics'),
    query('SELECT COUNT(*) AS n FROM patients'),
    query("SELECT COUNT(*) AS n FROM visits WHERE status = 'completed' AND visit_date >= CURDATE() - INTERVAL 30 DAY"),
  ]);
  res.json({ doctors: Number(d.n), activeDoctors: Number(d.active || 0), clinics: Number(c.n), patients: Number(p.n), visits30: Number(v.n) });
}));

r.get('/doctors', ah(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const params = [];
  let where = "u.role = 'doctor'";
  if (q) {
    where += ' AND (u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR u.city LIKE ?)';
    const like = `%${likeEscape(q)}%`;
    params.push(like, like, like, like);
  }
  const rows = await query(
    `SELECT u.*, (SELECT COUNT(*) FROM clinics c WHERE c.owner_id = u.id) AS clinics_owned,
            (SELECT COUNT(*) FROM patients p JOIN clinics c ON c.id = p.clinic_id WHERE c.owner_id = u.id) AS patients
       FROM users u WHERE ${where} ORDER BY u.created_at DESC LIMIT 500`, params);
  res.json(rows.map((u) => ({ ...publicUser(u), is_active: !!u.is_active, last_login_at: u.last_login_at, created_at: u.created_at,
    locked: !!(u.locked_until && new Date(u.locked_until.replace(' ', 'T')) > new Date()), clinics_owned: Number(u.clinics_owned), patients: Number(u.patients) })));
}));

r.get('/doctors/:id', ah(async (req, res) => {
  const d = await loadDoctor(Number(req.params.id));
  const clinics = await query(
    `SELECT c.*, (SELECT COUNT(*) FROM patients p WHERE p.clinic_id = c.id) AS patient_count,
            (SELECT COUNT(*) FROM clinic_members m WHERE m.clinic_id = c.id) AS staff_count
       FROM clinics c WHERE c.owner_id = ? ORDER BY c.id`, [d.id]);
  const staff = await query(
    `SELECT DISTINCT u.id, u.full_name, u.email, u.role, u.is_active FROM users u
       JOIN clinic_members m ON m.user_id = u.id JOIN clinics c ON c.id = m.clinic_id
      WHERE c.owner_id = ? AND u.id <> ? ORDER BY u.full_name`, [d.id, d.id]);
  res.json({ doctor: { ...publicUser(d), is_active: !!d.is_active, last_login_at: d.last_login_at, created_at: d.created_at }, clinics, staff });
}));

r.post('/doctors', ah(async (req, res) => {
  const b = req.body;
  const email = String(b.email || '').trim().toLowerCase();
  if (!b.full_name?.trim() || !/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Full name and a valid email are required');
  assertStrongPassword(b.password);
  const max = clampClinics(b.max_clinics ?? 1);
  const clinics = (b.clinics || []).filter((c) => c?.name?.trim());
  if (clinics.length > max) throw new HttpError(400, `This doctor may own ${max} clinic(s) but ${clinics.length} were entered`);
  if (await one('SELECT id FROM users WHERE LOWER(email) = ?', [email])) throw new HttpError(409, 'An account with this email already exists');

  const id = await tx(async (c) => {
    const [u] = await c.query(
      `INSERT INTO users (role, full_name, email, phone, address, city, qualification, registration_no, specialization, max_clinics,
                          password_hash, must_change_password, created_by)
       VALUES ('doctor',?,?,?,?,?,?,?,?,?,?,?,?)`,
      [b.full_name.trim(), email, nullIfEmpty(b.phone), nullIfEmpty(b.address), nullIfEmpty(b.city), nullIfEmpty(b.qualification),
       nullIfEmpty(b.registration_no), nullIfEmpty(b.specialization), max, await bcrypt.hash(b.password, 12), b.must_change_password === false ? 0 : 1, req.user.id]);
    for (const cl of clinics) await insertClinic(c, u.insertId, cl);
    return u.insertId;
  });
  await audit(req, 'admin_create_doctor', { entity: 'user', entityId: id, detail: `${email}, ${clinics.length} clinic(s), limit ${max}` });
  res.status(201).json({ id });
}));

r.patch('/doctors/:id', ah(async (req, res) => {
  const d = await loadDoctor(Number(req.params.id));
  const b = req.body;
  const sets = [];
  const vals = [];
  for (const k of PROFILE) if (k in b) { sets.push(`${k} = ?`); vals.push(nullIfEmpty(String(b[k] ?? '').trim())); }
  if ('email' in b) {
    const email = String(b.email).trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Enter a valid email');
    if (await one('SELECT id FROM users WHERE LOWER(email) = ? AND id <> ?', [email, d.id])) throw new HttpError(409, 'Another account uses this email');
    sets.push('email = ?'); vals.push(email);
  }
  if ('max_clinics' in b) {
    const max = clampClinics(b.max_clinics);
    const owned = (await one('SELECT COUNT(*) AS n FROM clinics WHERE owner_id = ?', [d.id])).n;
    if (max < owned) throw new HttpError(400, `This doctor already owns ${owned} clinic(s); the limit cannot be lower than that`);
    sets.push('max_clinics = ?'); vals.push(max);
  }
  if ('is_active' in b) {
    sets.push('is_active = ?', 'token_version = token_version + 1'); // deactivation signs them out everywhere
    vals.push(b.is_active ? 1 : 0);
  }
  if (sets.length) await query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...vals, d.id]);
  if ('is_active' in b && !b.is_active) await endAllSessions('staff', d.id);
  await audit(req, 'admin_update_doctor', { entity: 'user', entityId: d.id, detail: Object.keys(b).join(', ') });
  res.json({ ok: true });
}));

r.post('/doctors/:id/password', ah(async (req, res) => {
  const d = await loadDoctor(Number(req.params.id));
  assertStrongPassword(req.body.password);
  await query(
    'UPDATE users SET password_hash = ?, must_change_password = ?, token_version = token_version + 1, failed_logins = 0, locked_until = NULL WHERE id = ?',
    [await bcrypt.hash(req.body.password, 12), req.body.must_change_password === false ? 0 : 1, d.id]);
  await endAllSessions('staff', d.id);
  await audit(req, 'admin_reset_password', { entity: 'user', entityId: d.id });
  res.json({ ok: true });
}));

r.post('/doctors/:id/unlock', ah(async (req, res) => {
  const d = await loadDoctor(Number(req.params.id));
  await query('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?', [d.id]);
  await audit(req, 'admin_unlock', { entity: 'user', entityId: d.id });
  res.json({ ok: true });
}));

r.post('/doctors/:id/clinics', ah(async (req, res) => {
  const d = await loadDoctor(Number(req.params.id));
  const owned = (await one('SELECT COUNT(*) AS n FROM clinics WHERE owner_id = ?', [d.id])).n;
  if (owned >= d.max_clinics) throw new HttpError(400, `Clinic limit reached (${d.max_clinics}). Increase the limit first.`);
  const id = await tx((c) => insertClinic(c, d.id, req.body));
  await audit(req, 'admin_create_clinic', { entity: 'clinic', entityId: id, detail: `for doctor ${d.id}` });
  res.status(201).json({ id });
}));

r.get('/audit', ah(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  const params = [];
  let where = '1=1';
  if (req.query.action) { where += ' AND a.action = ?'; params.push(String(req.query.action)); }
  const rows = await query(
    `SELECT a.*, COALESCE(u.full_name, p.full_name) AS actor_name
       FROM audit_logs a
       LEFT JOIN users u ON a.actor_type IN ('admin','doctor','nurse') AND u.id = a.actor_id
       LEFT JOIN patients p ON a.actor_type = 'patient' AND p.id = a.actor_id
      WHERE ${where} ORDER BY a.id DESC LIMIT ?`, [...params, limit]);
  res.json(rows);
}));

export default r;
