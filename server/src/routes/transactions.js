import { Router } from 'express';
import { query, one } from '../db.js';
import { ah, HttpError, assertClinicAccess, todayISO, addDays } from '../lib/util.js';
import { requireStaff } from '../middleware/auth.js';

const r = Router();
r.use(requireStaff('doctor'));

r.get('/', ah(async (req, res) => {
  const clinicId = Number(req.query.clinicId);
  await assertClinicAccess(req.user, clinicId);
  const to = req.query.to || todayISO();
  const from = req.query.from || addDays(to, -29);
  const [rows, fees] = await Promise.all([
    query(`SELECT t.*, u.full_name AS created_by_name FROM transactions t LEFT JOIN users u ON u.id = t.created_by
            WHERE t.clinic_id = ? AND t.txn_date BETWEEN ? AND ? ORDER BY t.txn_date DESC, t.id DESC`, [clinicId, from, to]),
    one(`SELECT COALESCE(SUM(fee),0) AS amt, COUNT(*) AS n FROM visits WHERE clinic_id = ? AND status = 'completed' AND visit_date BETWEEN ? AND ?`, [clinicId, from, to]),
  ]);
  res.json({ from, to, transactions: rows, consultation: { amount: Number(fees.amt), visits: Number(fees.n) } });
}));

r.post('/', ah(async (req, res) => {
  const b = req.body;
  await assertClinicAccess(req.user, Number(b.clinic_id));
  if (!['income', 'expense'].includes(b.kind)) throw new HttpError(400, 'Kind must be income or expense');
  if (!b.category || !(Number(b.amount) > 0)) throw new HttpError(400, 'Category and a positive amount are required');
  const ins = await query('INSERT INTO transactions (clinic_id, txn_date, kind, category, amount, note, created_by) VALUES (?,?,?,?,?,?,?)',
    [Number(b.clinic_id), b.txn_date || todayISO(), b.kind, b.category, Number(b.amount), b.note || null, req.user.id]);
  res.status(201).json(await one('SELECT * FROM transactions WHERE id = ?', [ins.insertId]));
}));

r.delete('/:id', ah(async (req, res) => {
  const t = await one('SELECT clinic_id FROM transactions WHERE id = ?', [Number(req.params.id)]);
  if (!t) throw new HttpError(404, 'Entry not found');
  await assertClinicAccess(req.user, t.clinic_id);
  await query('DELETE FROM transactions WHERE id = ?', [Number(req.params.id)]);
  res.json({ ok: true });
}));

export default r;
