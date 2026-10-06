import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, one, tx } from '../db.js';
import { ah, HttpError } from '../lib/util.js';
import { sign, requireStaff } from '../middleware/auth.js';
import { clinicCode } from './clinics.js';

const r = Router();

const publicUser = (u) => ({
  id: u.id, role: u.role, full_name: u.full_name, email: u.email, phone: u.phone,
  qualification: u.qualification, registration_no: u.registration_no, specialization: u.specialization,
});

async function clinicsFor(userId) {
  return query(
    `SELECT c.*, (c.owner_id = ?) AS is_owner
       FROM clinics c JOIN clinic_members m ON m.clinic_id = c.id
      WHERE m.user_id = ? ORDER BY c.id`, [userId, userId]);
}

// Doctor creates the hospital account + first clinic in one step.
r.post('/register', ah(async (req, res) => {
  const { full_name, email, phone, password, qualification, registration_no, specialization, clinic = {} } = req.body;
  if (!full_name || !email || !password || !clinic.name) throw new HttpError(400, 'Name, email, password and clinic name are required');
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
  if (await one('SELECT id FROM users WHERE email = ?', [email])) throw new HttpError(409, 'An account with this email already exists');
  if (await one('SELECT id FROM clinics WHERE name = ?', [clinic.name])) throw new HttpError(409, 'Clinic name is already taken — please choose a unique name');

  const hash = await bcrypt.hash(password, 10);
  const userId = await tx(async (c) => {
    const [u] = await c.query(
      `INSERT INTO users (role, full_name, email, phone, password_hash, qualification, registration_no, specialization)
       VALUES ('doctor',?,?,?,?,?,?,?)`,
      [full_name, email, phone || null, hash, qualification || null, registration_no || null, specialization || null]);
    const [cl] = await c.query(
      `INSERT INTO clinics (owner_id, name, code, tagline, address, city, phone, email, registration_no, timings, consultation_fee, theme)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [u.insertId, clinic.name, await clinicCode(clinic.name, c), clinic.tagline || null, clinic.address || null, clinic.city || null,
       clinic.phone || phone || null, clinic.email || email, clinic.registration_no || null, clinic.timings || null,
       Number(clinic.consultation_fee || 0), clinic.theme || 'mint']);
    await c.query('INSERT INTO clinic_members (clinic_id, user_id) VALUES (?,?)', [cl.insertId, u.insertId]);
    return u.insertId;
  });
  const user = await one('SELECT * FROM users WHERE id = ?', [userId]);
  res.status(201).json({ token: sign({ kind: 'staff', id: user.id, role: user.role }), user: publicUser(user), clinics: await clinicsFor(user.id) });
}));

r.post('/login', ah(async (req, res) => {
  const { email, password } = req.body;
  const user = await one('SELECT * FROM users WHERE email = ? AND is_active = 1', [email || '']);
  if (!user || !(await bcrypt.compare(password || '', user.password_hash))) throw new HttpError(401, 'Incorrect email or password');
  res.json({ token: sign({ kind: 'staff', id: user.id, role: user.role }), user: publicUser(user), clinics: await clinicsFor(user.id) });
}));

r.get('/me', requireStaff(), ah(async (req, res) => {
  const user = await one('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!user) throw new HttpError(401, 'Account not found');
  res.json({ user: publicUser(user), clinics: await clinicsFor(user.id) });
}));

r.patch('/me', requireStaff(), ah(async (req, res) => {
  const f = ['full_name', 'phone', 'qualification', 'registration_no', 'specialization'];
  const sets = f.filter((k) => k in req.body);
  if (sets.length) await query(`UPDATE users SET ${sets.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...sets.map((k) => req.body[k] || null), req.user.id]);
  if (req.body.new_password) {
    if (req.body.new_password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
    const u = await one('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!(await bcrypt.compare(req.body.current_password || '', u.password_hash))) throw new HttpError(400, 'Current password is incorrect');
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(req.body.new_password, 10), req.user.id]);
  }
  const user = await one('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json({ user: publicUser(user) });
}));

// Patient portal: Case ID + registered mobile number.
r.post('/patient-login', ah(async (req, res) => {
  const caseNo = String(req.body.case_no || '').replace(/\D/g, '');
  const phone = String(req.body.phone || '').replace(/\D/g, '').slice(-10);
  const p = await one('SELECT id, full_name, phone FROM patients WHERE case_no = ?', [caseNo]);
  if (!p || !phone || String(p.phone || '').replace(/\D/g, '').slice(-10) !== phone) {
    throw new HttpError(401, 'Case ID and mobile number do not match our records');
  }
  res.json({ token: sign({ kind: 'patient', id: p.id }, '2h'), patient: { id: p.id, full_name: p.full_name } });
}));

export default r;
