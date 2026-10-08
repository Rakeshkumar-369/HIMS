import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { config, isProd } from './config.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import clinicRoutes from './routes/clinics.js';
import patientRoutes from './routes/patients.js';
import visitRoutes from './routes/visits.js';
import dashboardRoutes from './routes/dashboard.js';
import transactionRoutes from './routes/transactions.js';
import portalRoutes from './routes/portal.js';
import vendorRoutes from './routes/vendors.js';
import practiceRoutes from './routes/practice.js';
import { requireStaff, idParam } from './middleware/auth.js';
import { subscribe } from './lib/live.js';
import { apiLimiter } from './lib/security.js';
import { assertClinicAccess, ah, HttpError } from './lib/util.js';
import { pool } from './db.js';

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY); // when behind nginx / a load balancer

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
      'img-src': ["'self'", 'data:', 'blob:'],
      'connect-src': ["'self'"],
      'frame-ancestors': ["'none'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'upgrade-insecure-requests': null, // clinics may run on a local network without HTTPS
    },
  },
  hsts: isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
  referrerPolicy: { policy: 'no-referrer' },
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({ origin: config.clientOrigins, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '200kb' }));

// CSRF defence in depth (cookies are already SameSite=Strict): state-changing API calls must
// carry a custom header, which a foreign site cannot add without passing CORS.
app.use('/api', (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'CareNest') return next(new HttpError(403, 'Request blocked'));
  return next();
});
app.use('/api', apiLimiter);
app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }); // never cache medical data

app.get('/api/health', ah(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true, time: new Date().toISOString() });
}));

// Live channel (Server-Sent Events): nurse ⇄ doctor screens stay in sync instantly.
// Registered before compression so events are flushed immediately.
app.param('clinicId', idParam);
app.get('/api/live/:clinicId', requireStaff('doctor', 'nurse'), ah(async (req, res) => {
  await assertClinicAccess(req.user, Number(req.params.clinicId));
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write('event: hello\ndata: {}\n\n');
  const unsubscribe = subscribe(req.params.clinicId, res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(ping); unsubscribe(); });
}));

app.use(compression());
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/clinics', clinicRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// In production, serve the built React app from the same port.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, {
    index: false,
    maxAge: '7d',
    // the service worker and manifest must always be re-checked so app updates reach installed phones
    setHeaders: (res, file) => { if (/(sw\.js|manifest\.webmanifest|mode\.js)$/.test(file)) res.setHeader('Cache-Control', 'no-cache'); },
  }));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const DB_INPUT_ERRORS = { ER_DATA_TOO_LONG: 'One of the fields is too long', ER_TRUNCATED_WRONG_VALUE: 'One of the values is not valid',
  ER_WARN_DATA_OUT_OF_RANGE: 'One of the numbers is out of range', ER_TRUNCATED_WRONG_VALUE_FOR_FIELD: 'One of the values is not valid' };

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') return res.status(400).json({ error: 'Invalid request' });
  if (DB_INPUT_ERRORS[err.code]) return res.status(400).json({ error: DB_INPUT_ERRORS[err.code] });
  const status = err.status || 500;
  if (status >= 500) {
    console.error(err);
    const db = String(err.code || '').startsWith('ECONN');
    return res.status(status).json({ error: db ? 'Database is not reachable — is MySQL running?' : 'Something went wrong on the server' });
  }
  return res.status(status).json({ error: err.message });
});

app.listen(config.port, () => console.log(`✔ CareNest API running on http://localhost:${config.port}`));
