import 'dotenv/config';
import crypto from 'node:crypto';

export const isProd = process.env.NODE_ENV === 'production';

let secret = process.env.JWT_SECRET || '';
const weak = !secret || secret.length < 32 || /change|secret|example/i.test(secret);
if (weak) {
  if (isProd) {
    console.error('✖ JWT_SECRET must be set to a random string of at least 32 characters in production.');
    process.exit(1);
  }
  // Development fallback: random per start (everyone is signed out when the server restarts).
  secret = crypto.randomBytes(48).toString('hex');
  console.warn('⚠ JWT_SECRET is missing or weak — using a temporary random secret. Run "npm run secret" to create one.');
}

export const config = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: secret,
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  allowSelfSignup: process.env.ALLOW_SELF_SIGNUP === 'true',
  staffSessionHours: Number(process.env.STAFF_SESSION_HOURS || 12),
  patientSessionHours: 2,
};
