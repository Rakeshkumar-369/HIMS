import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import authRoutes from './routes/auth.js';
import clinicRoutes from './routes/clinics.js';
import patientRoutes from './routes/patients.js';
import visitRoutes from './routes/visits.js';
import dashboardRoutes from './routes/dashboard.js';
import transactionRoutes from './routes/transactions.js';
import portalRoutes from './routes/portal.js';
import { requireStaff } from './middleware/auth.js';
import { subscribe } from './lib/live.js';
import { assertClinicAccess, ah } from './lib/util.js';
import { pool } from './db.js';

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') || true }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', ah(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true, time: new Date().toISOString() });
}));

// Live channel (Server-Sent Events): nurse ⇄ doctor screens stay in sync instantly.
// Registered before compression so events are flushed immediately.
app.get('/api/live/:clinicId', requireStaff(), ah(async (req, res) => {
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
app.use('/api/clinics', clinicRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// In production, serve the built React app from the same port.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '7d', index: false }));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  const msg = status >= 500 && err.code === 'ECONNREFUSED' ? 'Database is not reachable — is MySQL running?' : err.message;
  res.status(status).json({ error: status >= 500 && !err.code?.startsWith?.('ECONN') ? 'Something went wrong on the server' : msg });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`✔ CareNest API running on http://localhost:${port}`));
