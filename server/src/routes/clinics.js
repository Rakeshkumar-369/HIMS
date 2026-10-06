import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool, query, one, tx } from '../db.js';
import { ah, HttpError, assertClinicAccess } from '../lib/util.js';
import { requireStaff } from '../middleware/auth.js';

const r = Router();
export const THEMES = ['mint', 'lavender', 'peach', 'sky', 'rose', 'sage', 'butter', 'ocean'];
const EDITABLE = ['name', 'tagline', 'address', 'city', 'phone', 'email', 'registration_no', 'timings', 'consultation_fee', 'theme'];

/** Short unique code derived from the clinic name, e.g. "Sunrise Family Clinic" -> "SFC". */
export async function clinicCode(name, conn) {
  const base = (name.match(/\b[A-Za-z]/g) || ['C']).join('').toUpperCase().slice(0, 4) || 'C';
  for (let i = 0; i < 50; i++) {
    const code = i ? `${base}${i + 1}` : base;
    const [rows] = await conn.query('SELECT 1 FROM clinics WHERE code = ?', [code]);
    if (!rows.length) return code;
  }
  return `${base}${Date.now() % 10000}`;
}

async function assertOwner(user, clinicId) {
  const c = await one('SELECT owner_id FROM clinics WHERE id = ?', [clinicId]);
  if (!c) throw new HttpError(404, 'Clinic not found');
  if (c.owner_id !== user.id) throw new HttpError(403, 'Only the clinic owner can do this');
}

r.use(requireStaff());

r.get('/', ah(async (req, res) => {
  res.json(await query(
    `SELECT c.*, (c.owner_id = ?) AS is_owner,
            (SELECT COUNT(*) FROM patients p WHERE p.clinic_id = c.id) AS patient_count,
            (SELECT COUNT(*) FROM clinic_members m2 WHERE m2.clinic_id = c.id) AS staff_count
       FROM clinics c JOIN clinic_members m ON m.clinic_id = c.id
      WHERE m.user_id = ? ORDER BY c.id`, [req.user.id, req.user.id]));
}));

r.post('/', requireStaff('doctor'), ah(async (req, res) => {
  const b = req.body;
  if (!b.name?.trim()) throw new HttpError(400, 'Clinic name is required');
  if (await one('SELECT id FROM clinics WHERE name = ?', [b.name.trim()])) throw new HttpError(409, 'This clinic name is already taken — names must be unique');
  if (b.theme && !THEMES.includes(b.theme)) throw new HttpError(400, 'Unknown theme');
  const id = await tx(async (c) => {
    const [cl] = await c.query(
      `INSERT INTO clinics (owner_id, name, code, tagline, address, city, phone, email, registration_no, timings, consultation_fee, theme)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.user.id, b.name.trim(), await clinicCode(b.name, c), b.tagline || null, b.address || null, b.city || null, b.phone || null,
       b.email || null, b.registration_no || null, b.timings || null, Number(b.consultation_fee || 0), b.theme || 'mint']);
    await c.query('INSERT INTO clinic_members (clinic_id, user_id) VALUES (?,?)', [cl.insertId, req.user.id]);
    return cl.insertId;
  });
  res.status(201).json(await one('SELECT *, 1 AS is_owner FROM clinics WHERE id = ?', [id]));
}));

r.patch('/:id', requireStaff('doctor'), ah(async (req, res) => {
  const id = Number(req.params.id);
  await assertClinicAccess(req.user, id);
  const keys = EDITABLE.filter((k) => k in req.body);
  // Any doctor of the clinic may change its colour theme; other fields are owner-only.
  if (keys.some((k) => k !== 'theme')) await assertOwner(req.user, id);
  if (req.body.theme && !THEMES.includes(req.body.theme)) throw new HttpError(400, 'Unknown theme');
  if (req.body.name) {
    const dup = await one('SELECT id FROM clinics WHERE name = ? AND id <> ?', [req.body.name, id]);
    if (dup) throw new HttpError(409, 'This clinic name is already taken');
  }
  if (keys.length) {
    await query(`UPDATE clinics SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`,
      [...keys.map((k) => (k === 'consultation_fee' ? Number(req.body[k] || 0) : req.body[k] || null)), id]);
  }
  res.json(await one('SELECT *, (owner_id = ?) AS is_owner FROM clinics WHERE id = ?', [req.user.id, id]));
}));

// ---- Staff (nurses / associate doctors) --------------------------------
r.get('/:id/staff', ah(async (req, res) => {
  const id = Number(req.params.id);
  await assertClinicAccess(req.user, id);
  res.json(await query(
    `SELECT u.id, u.role, u.full_name, u.email, u.phone, u.is_active, (c.owner_id = u.id) AS is_owner
       FROM clinic_members m JOIN users u ON u.id = m.user_id JOIN clinics c ON c.id = m.clinic_id
      WHERE m.clinic_id = ? ORDER BY is_owner DESC, u.role, u.full_name`, [id]));
}));

// Adds an existing account (by email) or creates a new nurse/doctor account.
r.post('/:id/staff', requireStaff('doctor'), ah(async (req, res) => {
  const id = Number(req.params.id);
  await assertOwner(req.user, id);
  const { full_name, email, phone, password, role = 'nurse' } = req.body;
  if (!email) throw new HttpError(400, 'Email is required');
  let user = await one('SELECT id FROM users WHERE email = ?', [email]);
  if (!user) {
    if (!full_name || !password) throw new HttpError(400, 'Name and a temporary password are required for a new account');
    if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
    const [ins] = await pool.query(
      'INSERT INTO users (role, full_name, email, phone, password_hash, created_by) VALUES (?,?,?,?,?,?)',
      [role === 'doctor' ? 'doctor' : 'nurse', full_name, email, phone || null, await bcrypt.hash(password, 10), req.user.id]);
    user = { id: ins.insertId };
  }
  await query('INSERT IGNORE INTO clinic_members (clinic_id, user_id) VALUES (?,?)', [id, user.id]);
  res.status(201).json({ ok: true });
}));

r.delete('/:id/staff/:userId', requireStaff('doctor'), ah(async (req, res) => {
  const id = Number(req.params.id);
  await assertOwner(req.user, id);
  if (Number(req.params.userId) === req.user.id) throw new HttpError(400, 'You cannot remove yourself from your own clinic');
  await query('DELETE FROM clinic_members WHERE clinic_id = ? AND user_id = ?', [id, Number(req.params.userId)]);
  res.json({ ok: true });
}));

export default r;
