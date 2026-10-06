import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { one, query } from '../db.js';
import { HttpError } from '../lib/util.js';
import { clientIp } from '../lib/audit.js';

export const STAFF_COOKIE = 'cn_session';
export const PATIENT_COOKIE = 'cn_patient';

const cookieOpts = (req, hours) => ({
  httpOnly: true, // not readable by JavaScript → safe from XSS token theft
  sameSite: 'strict', // never sent on cross-site requests → CSRF protection
  secure: req.secure, // HTTPS-only whenever the site is served over HTTPS
  path: '/api',
  maxAge: hours * 3600 * 1000,
});

/** Create a server-side session and hand the browser a signed, httpOnly cookie pointing to it. */
export async function setSession(req, res, name, payload, hours) {
  const sid = crypto.randomBytes(32).toString('base64url');
  await query('INSERT INTO sessions (id, kind, subject_id, ip, user_agent, expires_at) VALUES (?,?,?,?,?, NOW() + INTERVAL ? HOUR)',
    [sid, payload.kind, payload.id, clientIp(req), String(req.get('user-agent') || '').slice(0, 255), hours]);
  // opportunistic clean-up of expired sessions
  query('DELETE FROM sessions WHERE expires_at < NOW()').catch(() => {});
  const token = jwt.sign({ ...payload, sid }, config.jwtSecret, { expiresIn: `${hours}h`, algorithm: 'HS256' });
  res.cookie(name, token, cookieOpts(req, hours));
  return sid;
}

/** End the current session (server-side) and clear the cookie. */
export async function clearSession(req, res, name) {
  const p = read(req, name);
  if (p?.sid) await query('DELETE FROM sessions WHERE id = ?', [p.sid]);
  res.clearCookie(name, { ...cookieOpts(req, 0), maxAge: undefined });
}

/** End every session of a user, optionally keeping one (e.g. the device that changed the password). */
export const endAllSessions = (kind, subjectId, exceptSid = null) =>
  query('DELETE FROM sessions WHERE kind = ? AND subject_id = ? AND id <> ?', [kind, subjectId, exceptSid || '']);

function read(req, name) {
  const t = req.cookies?.[name];
  if (!t) return null;
  try { return jwt.verify(t, config.jwtSecret, { algorithms: ['HS256'] }); } catch { return null; }
}

async function liveSession(p, kind) {
  if (!p || p.kind !== kind || !p.sid) return false;
  return !!(await one('SELECT 1 AS ok FROM sessions WHERE id = ? AND kind = ? AND subject_id = ? AND expires_at > NOW()', [p.sid, kind, p.id]));
}

/** Require a signed-in, active staff user (optionally restricted to roles). */
export const requireStaff = (...roles) => async (req, _res, next) => {
  try {
    const p = read(req, STAFF_COOKIE);
    if (!(await liveSession(p, 'staff'))) throw new HttpError(401, 'Please sign in');
    const u = await one('SELECT id, role, is_active, token_version, must_change_password FROM users WHERE id = ?', [p.id]);
    // token_version changes on password change / reset / deactivation → old sessions die immediately
    if (!u || !u.is_active || u.token_version !== p.tv) throw new HttpError(401, 'Session expired — please sign in again');
    if (roles.length && !roles.includes(u.role)) throw new HttpError(403, 'Not allowed for your role');
    req.user = { id: u.id, role: u.role, mustChangePassword: !!u.must_change_password, sid: p.sid };
    // Accounts created/reset by an admin must set their own password before doing anything else
    if (req.user.mustChangePassword && req.baseUrl !== '/api/auth') throw new HttpError(403, 'Please set a new password first');
    next();
  } catch (e) {
    next(e);
  }
};

export const requirePatient = async (req, _res, next) => {
  try {
    const p = read(req, PATIENT_COOKIE);
    if (!(await liveSession(p, 'patient'))) throw new HttpError(401, 'Please sign in');
    req.patient = { id: p.id };
    next();
  } catch (e) {
    next(e);
  }
};

/** Route parameters that are database ids must be positive integers. */
export const idParam = (_req, _res, next, value) => (/^[1-9]\d{0,9}$/.test(value) ? next() : next(new HttpError(404, 'Not found')));
