import { Router } from 'express';
import { ah, HttpError } from '../lib/util.js';
import { requirePatient } from '../middleware/auth.js';
import { patientRecord } from '../lib/records.js';
import { audit } from '../lib/audit.js';

const r = Router();
r.use(requirePatient);

// The full case file — private doctor comments are always stripped.
r.get('/me', ah(async (req, res) => {
  const rec = await patientRecord(req.patient.id, { includePrivate: false, completedOnly: true });
  if (!rec) throw new HttpError(404, 'Record not found');
  await audit(req, 'portal_record_viewed', { entity: 'patient', entityId: rec.patient.id });
  res.json(rec);
}));

export default r;
