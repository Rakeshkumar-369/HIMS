import rateLimit from 'express-rate-limit';
import { HttpError } from './util.js';

/** Minimum 8 characters with at least one letter and one number. */
export function assertStrongPassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8 || pw.length > 128 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
    throw new HttpError(400, 'Password must be 8–128 characters and contain letters and numbers');
  }
}

const limiter = (windowMin, limit, message) => rateLimit({
  windowMs: windowMin * 60 * 1000,
  limit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: message },
});

// Brute-force protection (per IP). Per-account lockout is handled in the auth routes.
export const loginLimiter = limiter(15, 20, 'Too many sign-in attempts. Please wait 15 minutes and try again.');
export const apiLimiter = limiter(1, 600, 'Too many requests. Please slow down.');

export const MAX_FAILED = 5;
export const LOCK_MINUTES = 15;

/** Escape % and _ so user text is matched literally inside LIKE patterns. */
export const likeEscape = (s) => String(s).replace(/[\\%_]/g, (c) => `\\${c}`);
