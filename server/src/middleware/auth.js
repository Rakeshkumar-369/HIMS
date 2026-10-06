import jwt from 'jsonwebtoken';
import { HttpError } from '../lib/util.js';

const SECRET = () => process.env.JWT_SECRET || 'dev-secret-change-me';

export function sign(payload, expiresIn = '12h') {
  return jwt.sign(payload, SECRET(), { expiresIn });
}

export function verify(token) {
  return jwt.verify(token, SECRET());
}

function readToken(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return req.query.token || null; // EventSource cannot send headers
}

/** Require a staff login. Optionally restrict to roles. */
export const requireStaff = (...roles) => (req, _res, next) => {
  try {
    const t = readToken(req);
    if (!t) throw new HttpError(401, 'Please sign in');
    const p = verify(t);
    if (p.kind !== 'staff') throw new HttpError(403, 'Staff only');
    if (roles.length && !roles.includes(p.role)) throw new HttpError(403, 'Not allowed for your role');
    req.user = p;
    next();
  } catch (e) {
    next(e.status ? e : new HttpError(401, 'Session expired — please sign in again'));
  }
};

export const requirePatient = (req, _res, next) => {
  try {
    const t = readToken(req);
    if (!t) throw new HttpError(401, 'Please sign in');
    const p = verify(t);
    if (p.kind !== 'patient') throw new HttpError(403, 'Patients only');
    req.patient = p;
    next();
  } catch (e) {
    next(e.status ? e : new HttpError(401, 'Session expired — please sign in again'));
  }
};
