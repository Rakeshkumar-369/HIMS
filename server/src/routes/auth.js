import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, one, tx } from '../db.js';
import { config } from '../config.js';
import { ah, HttpError } from '../lib/util.js';
import { audit } from '../lib/audit.js';
import { assertStrongPassword, loginLimiter, MAX_FAILED, LOCK_MINUTES } from '../lib/security.js';
import { requireStaff, setSession, clearSession, endAllSessions, STAFF_COOKIE, PATIENT_COOKIE } from '../middleware/auth.js';
import { clinicCode } from './clinics.js';

const r = Router();

// Same cost for unknown e-mails so response time does not reveal which accounts exist
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-not-a-password', 12);

export const publicUser = (u) => ({
  id: u.id, role: u.role, full_name: u.full_name, email: u.email, phone: u.phone, address: u.address, city: u.city,
  qualification: u.qualification, registration_no: u.registration_no, specialization: u.specialization,
  max_clinics: u.max_clinics, must_change_password: !!u.must_change_password,
});

async function clinicsFor(userId) {
  return query(
    `SELECT c.*, (c.owner_id = ?) AS is_owner
       FROM clinics c JOIN clinic_members m ON m.clinic_id = c.id
      WHERE m.user_id = ? ORDER BY c.id`, [userId, userId]);
}

const startSession = (req, res, user) =>
  setSession(req, res, STAFF_COOKIE, { kind: 'staff', id: user.id, tv: user.token_version }, config.staffSessionHours);

// Public app settings the login screen needs
r.get('/config', (_req, res) => res.json({ allowSelfSignup: config.allowSelfSignup }));

// Optional self-service sign-up (off by default — the platform team creates doctor accounts)
r.post('/register', loginLimiter, ah(async (req, res) => {
  if (!config.allowSelfSignup) throw new HttpError(403, 'Sign-up is closed. Please contact the CareNest team to get an account.');
  const { full_name, email, phone, password, qualification, registration_no, specialization, clinic = {} } = req.body;
  if (!full_name || !email || !clinic.name) throw new HttpError(400, 'Name, email, password and clinic name are required');
  assertStrongPassword(password);
  if (await one('SELECT id FROM users WHERE email = ?', [email])) throw new HttpError(409, 'Could not create the account with these details');
  if (await one('SELECT id FROM clinics WHERE name = ?', [clinic.name])) throw new HttpError(409, 'Clinic name is already taken — please choose a unique name');

  const hash = await bcrypt.hash(password, 12);
  const userId = await tx(async (c) => {
    const [u] = await c.query(
      `INSERT INTO users (role, full_name, email, phone, password_hash, qualification, registration_no, specialization, max_clinics)
       VALUES ('doctor',?,?,?,?,?,?,?,1)`,
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
  await startSession(req, res, user);
  await audit(req, 'signup', { actorType: 'doctor', actorId: user.id });
  res.status(201).json({ user: publicUser(user), clinics: await clinicsFor(user.id) });
}));

r.post('/login', loginLimiter, ah(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = await one('SELECT * FROM users WHERE LOWER(email) = ?', [email]);
  const fail = async (detail) => {
    await audit(req, 'login_failed', { actorType: user?.role || 'anonymous', actorId: user?.id, detail: detail || email });
    throw new HttpError(401, 'Incorrect email or password');
  };
  if (!user) { await bcrypt.compare(password, DUMMY_HASH); return fail(); }
  if (user.locked_until && new Date(user.locked_until.replace(' ', 'T')) > new Date()) {
    await audit(req, 'login_locked', { actorType: user.role, actorId: user.id });
    throw new HttpError(429, `Account temporarily locked after repeated failed attempts. Try again in ${LOCK_MINUTES} minutes.`);
  }
  if (!(await bcrypt.compare(password, user.password_hash))) {
    const failed = user.failed_logins + 1;
    await query('UPDATE users SET failed_logins = ?, locked_until = IF(? >= ?, NOW() + INTERVAL ? MINUTE, NULL) WHERE id = ?',
      [failed >= MAX_FAILED ? 0 : failed, failed, MAX_FAILED, LOCK_MINUTES, user.id]);
    return fail('wrong password');
  }
  if (!user.is_active) return fail('inactive account');
  await query('UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = NOW() WHERE id = ?', [user.id]);
  await startSession(req, res, user);
  await audit(req, 'login', { actorType: user.role, actorId: user.id });
  res.json({ user: publicUser(user), clinics: user.role === 'admin' ? [] : await clinicsFor(user.id) });
}));

r.post('/logout', ah(async (req, res) => {
  await clearSession(req, res, STAFF_COOKIE);
  res.json({ ok: true });
}));

// Who is signed in on this browser? Answers { user: null } instead of 401 so the login page loads quietly.
r.get('/session', ah(async (req, res) => {
  const ok = await new Promise((resolve) => { requireStaff()(req, res, (err) => resolve(!err)); });
  if (!ok) return res.json({ user: null, clinics: [] });
  const user = await one('SELECT * FROM users WHERE id = ?', [req.user.id]);
  return res.json({ user: publicUser(user), clinics: user.role === 'admin' ? [] : await clinicsFor(user.id) });
}));

r.get('/me', requireStaff(), ah(async (req, res) => {
  const user = await one('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json({ user: publicUser(user), clinics: user.role === 'admin' ? [] : await clinicsFor(user.id) });
}));

r.patch('/me', requireStaff(), ah(async (req, res) => {
  const f = ['full_name', 'phone', 'qualification', 'registration_no', 'specialization'];
  const sets = f.filter((k) => k in req.body && !req.user.mustChangePassword);
  if (sets.length) await query(`UPDATE users SET ${sets.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...sets.map((k) => String(req.body[k] || '').slice(0, 160) || null), req.user.id]);
  if (req.body.new_password) {
    assertStrongPassword(req.body.new_password);
    const u = await one('SELECT password_hash, token_version FROM users WHERE id = ?', [req.user.id]);
    if (!(await bcrypt.compare(String(req.body.current_password || ''), u.password_hash))) throw new HttpError(400, 'Current password is incorrect');
    if (await bcrypt.compare(req.body.new_password, u.password_hash)) throw new HttpError(400, 'Choose a password different from the current one');
    await query('UPDATE users SET password_hash = ?, must_change_password = 0, token_version = token_version + 1 WHERE id = ?',
      [await bcrypt.hash(req.body.new_password, 12), req.user.id]);
    const fresh = await one('SELECT * FROM users WHERE id = ?', [req.user.id]);
    await endAllSessions('staff', req.user.id); // every device is signed out…
    await startSession(req, res, fresh); // …and this one gets a fresh session
    await audit(req, 'password_changed', { entity: 'user', entityId: req.user.id });
  }
  const user = await one('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json({ user: publicUser(user) });
}));

// ---- Patient portal: Case ID + registered mobile number ------------------
r.post('/patient-login', loginLimiter, ah(async (req, res) => {
  const caseNo = String(req.body.case_no || '').replace(/\D/g, '');
  const phone = String(req.body.phone || '').replace(/\D/g, '').slice(-10);
  const p = await one('SELECT id, full_name, phone, portal_failed, portal_locked_until FROM patients WHERE case_no = ?', [caseNo]);
  if (p?.portal_locked_until && new Date(p.portal_locked_until.replace(' ', 'T')) > new Date()) {
    throw new HttpError(429, `Too many attempts for this Case ID. Try again in ${LOCK_MINUTES} minutes or contact your clinic.`);
  }
  if (!p || phone.length < 10 || String(p.phone || '').replace(/\D/g, '').slice(-10) !== phone) {
    if (p) {
      const failed = p.portal_failed + 1;
      await query('UPDATE patients SET portal_failed = ?, portal_locked_until = IF(? >= ?, NOW() + INTERVAL ? MINUTE, NULL) WHERE id = ?',
        [failed >= MAX_FAILED ? 0 : failed, failed, MAX_FAILED, LOCK_MINUTES, p.id]);
    }
    await audit(req, 'portal_login_failed', { actorType: 'anonymous', entity: 'patient', entityId: p?.id, detail: `case ${caseNo}` });
    throw new HttpError(401, 'Case ID and mobile number do not match our records');
  }
  await query('UPDATE patients SET portal_failed = 0, portal_locked_until = NULL WHERE id = ?', [p.id]);
  await setSession(req, res, PATIENT_COOKIE, { kind: 'patient', id: p.id }, config.patientSessionHours);
  await audit(req, 'portal_login', { actorType: 'patient', actorId: p.id });
  res.json({ patient: { id: p.id, full_name: p.full_name } });
}));

r.post('/patient-logout', ah(async (req, res) => {
  await clearSession(req, res, PATIENT_COOKIE);
  res.json({ ok: true });
}));

export default r;
