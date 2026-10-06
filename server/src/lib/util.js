import crypto from 'node:crypto';
import { one } from '../db.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Wrap async route handlers so thrown errors reach the error middleware. */
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Unique 9-digit case number (never starts with 0). */
export async function generateCaseNo(conn) {
  for (let i = 0; i < 20; i++) {
    const n = String(crypto.randomInt(100000000, 1000000000));
    const [rows] = await conn.query('SELECT 1 FROM patients WHERE case_no = ?', [n]);
    if (!rows.length) return n;
  }
  throw new HttpError(500, 'Could not generate a unique case number');
}

export function todayISO(d = new Date()) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function addDays(iso, days) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return todayISO(d);
}

export function ageFrom(dob, ageYears) {
  if (dob) {
    const b = new Date(dob + 'T00:00:00');
    const n = new Date();
    let a = n.getFullYear() - b.getFullYear();
    if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
    return a;
  }
  return ageYears ?? null;
}

export function parseJSON(text, fallback = []) {
  if (!text) return fallback;
  try { return JSON.parse(text); } catch { return fallback; }
}

export const NEXT_VISIT_DAYS = { '1 week': 7, '15 days': 15, '1 month': 30, '3 months': 90 };

/** Throws 403 unless the staff user belongs to the clinic. */
export async function assertClinicAccess(user, clinicId) {
  const row = await one('SELECT 1 AS ok FROM clinic_members WHERE clinic_id = ? AND user_id = ?', [clinicId, user.id]);
  if (!row) throw new HttpError(403, 'You do not have access to this clinic');
}

export const nullIfEmpty = (v) => (v === '' || v === undefined ? null : v);
