// Freelance / visiting-doctor practice: workplaces, service log, payments received,
// personal expenses and the balance sheet. Every row belongs to the signed-in doctor.
import { Router } from 'express';
import { query, one } from '../db.js';
import { ah, HttpError, nullIfEmpty, todayISO } from '../lib/util.js';
import { requireStaff, idParam } from '../middleware/auth.js';
import { audit } from '../lib/audit.js';
import { settle, statement, round, addDays } from '../lib/ledger.js';
import { THEMES } from './clinics.js';

const r = Router();
r.use(requireStaff('doctor'));
r.use(ah(async (req, _res, next) => {
  const u = await one('SELECT practice_type FROM users WHERE id = ?', [req.user.id]);
  if (u.practice_type === 'clinic') throw new HttpError(403, 'Visiting-practice tools are not switched on for your account. Ask the CareNest team.');
  next();
}));
r.param('id', idParam);

export const WORKPLACE_KINDS = ['Hospital', 'Clinic', 'Nursing home', 'Diagnostic centre', 'Camp', 'Home visit', 'Teleconsult'];
export const PAY_MODELS = { per_case: 'Per case', per_procedure: 'Per procedure', per_visit: 'Fixed per visit', retainer: 'Monthly retainer', share: 'Revenue share %' };
export const SERVICE_TYPES = ['Consultation', 'Procedure', 'Surgery', 'On-call', 'Ward round', 'Teleconsult', 'Camp'];
export const EXPENSE_CATEGORIES = ['Travel & fuel', 'Instruments & consumables', 'Indemnity insurance', 'Memberships & CME', 'Phone & internet', 'Clothing & laundry', 'Other'];
const MODES = ['Cash', 'UPI', 'Bank', 'Cheque', 'Card'];
const RANGES = { '1m': 30, '3m': 91, '6m': 182, '1y': 365, all: 3650 };

const me = (req) => req.user.id;
const dt = (v) => (v ? String(v).replace('T', ' ').slice(0, 19) : null);

async function loadWorkplace(req, id) {
  const w = await one('SELECT * FROM workplaces WHERE id = ? AND doctor_id = ?', [id, me(req)]);
  if (!w) throw new HttpError(404, 'Workplace not found');
  return w;
}

/** Billed / received / TDS / outstanding for every workplace, plus per-service payment status. */
async function books(doctorId, { workplaceId } = {}) {
  const wf = workplaceId ? ' AND workplace_id = ?' : '';
  const p = workplaceId ? [doctorId, workplaceId] : [doctorId];
  const [workplaces, services, payments] = await Promise.all([
    query(`SELECT * FROM workplaces WHERE doctor_id = ?${workplaceId ? ' AND id = ?' : ''} ORDER BY is_active DESC, name`, p),
    query(`SELECT * FROM freelance_services WHERE doctor_id = ?${wf} ORDER BY service_at`, p),
    query(`SELECT * FROM freelance_payments WHERE doctor_id = ?${wf} ORDER BY received_on`, p),
  ]);
  const status = new Map();
  const perWp = workplaces.map((w) => {
    const sv = services.filter((s) => s.workplace_id === w.id);
    const py = payments.filter((x) => x.workplace_id === w.id);
    const received = round(py.reduce((s, x) => s + Number(x.amount), 0));
    const tds = round(py.reduce((s, x) => s + Number(x.tds_amount), 0));
    const billed = round(sv.reduce((s, x) => s + Number(x.amount_billed), 0));
    const writtenOff = round(sv.reduce((s, x) => s + Number(x.written_off), 0));
    const bills = sv.map((s) => ({ id: s.id, date: s.service_at.slice(0, 10), amount: round(s.amount_billed - s.written_off), due_on: s.expected_on || addDays(s.service_at.slice(0, 10), w.credit_days) }));
    const st = settle(bills, received + tds);
    for (const row of st.rows) {
      const s = sv.find((x) => x.id === row.id);
      const label = Number(s.amount_billed) === 0 ? 'free'
        : row.open <= 0 ? (Number(s.written_off) > 0 && row.paid === 0 ? 'written_off' : 'received')
          : row.paid > 0 ? 'partial' : row.late_days > 0 ? 'overdue' : 'pending';
      status.set(row.id, { status: label, settled: row.paid, open: row.open, due_on: row.due_on, late_days: row.late_days });
    }
    return {
      ...w, billed, received, tds, written_off: writtenOff, outstanding: round(billed - writtenOff - received - tds),
      overdue: st.overdue, aging: st.aging, services: sv.length, last_service: sv.at(-1)?.service_at || null, last_payment: py.at(-1)?.received_on || null,
    };
  });
  return { workplaces: perWp, services, payments, status };
}

// ---- Options for forms -------------------------------------------------------
r.get('/options', ah(async (req, res) => {
  const [procs, workplaces] = await Promise.all([
    query(`SELECT procedure_name AS name, COUNT(*) AS n, ROUND(AVG(amount_billed)) AS avg_fee FROM freelance_services
            WHERE doctor_id = ? AND procedure_name IS NOT NULL AND procedure_name <> '' GROUP BY procedure_name ORDER BY n DESC LIMIT 40`, [me(req)]),
    query('SELECT id, name, kind, city, default_fee, pay_model, tds_pct, credit_days, theme FROM workplaces WHERE doctor_id = ? AND is_active = 1 ORDER BY name', [me(req)]),
  ]);
  res.json({ procedures: procs, workplaces, kinds: WORKPLACE_KINDS, payModels: PAY_MODELS, serviceTypes: SERVICE_TYPES, expenseCategories: EXPENSE_CATEGORIES });
}));

// ---- Workplaces ----------------------------------------------------------------
const WP_FIELDS = ['name', 'kind', 'city', 'address', 'contact_person', 'phone', 'pay_model', 'default_fee', 'share_pct', 'tds_pct', 'credit_days', 'theme', 'notes', 'is_active'];
function wpValue(k, v) {
  if (['default_fee'].includes(k)) return Math.max(0, Number(v) || 0);
  if (['share_pct', 'tds_pct'].includes(k)) return v === '' || v == null ? (k === 'tds_pct' ? 0 : null) : Math.max(0, Math.min(100, Number(v) || 0));
  if (k === 'credit_days') return Math.max(0, Math.min(365, Number.parseInt(v, 10) || 0));
  if (k === 'is_active') return v ? 1 : 0;
  if (k === 'kind') return WORKPLACE_KINDS.includes(v) ? v : 'Hospital';
  if (k === 'pay_model') return PAY_MODELS[v] ? v : 'per_case';
  if (k === 'theme') return THEMES.includes(v) ? v : 'sky';
  return k === 'name' ? String(v || '').trim() : nullIfEmpty(v);
}

r.get('/workplaces', ah(async (req, res) => {
  const { workplaces } = await books(me(req));
  res.json(workplaces);
}));

r.post('/workplaces', ah(async (req, res) => {
  if (!String(req.body.name || '').trim()) throw new HttpError(400, 'Workplace name is required');
  const keys = WP_FIELDS.filter((k) => k in req.body && k !== 'is_active');
  const ins = await query(`INSERT INTO workplaces (doctor_id, ${keys.join(', ')}) VALUES (?, ${keys.map(() => '?').join(', ')})`,
    [me(req), ...keys.map((k) => wpValue(k, req.body[k]))]);
  res.status(201).json({ id: ins.insertId });
}));

r.patch('/workplaces/:id', ah(async (req, res) => {
  const w = await loadWorkplace(req, Number(req.params.id));
  if ('name' in req.body && !String(req.body.name).trim()) throw new HttpError(400, 'Workplace name is required');
  const keys = WP_FIELDS.filter((k) => k in req.body);
  if (keys.length) await query(`UPDATE workplaces SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => wpValue(k, req.body[k])), w.id]);
  res.json({ ok: true });
}));

r.get('/workplaces/:id', ah(async (req, res) => {
  const w = await loadWorkplace(req, Number(req.params.id));
  const b = await books(me(req), { workplaceId: w.id });
  const services = [...b.services].reverse().map((s) => ({ ...s, ...b.status.get(s.id) }));
  const stmt = statement(
    b.services.map((s) => ({ date: s.service_at.slice(0, 10), at: s.service_at, amount: round(s.amount_billed - s.written_off), ref: s.hospital_ref,
      description: [s.service_type, s.procedure_name, s.patient_name].filter(Boolean).join(' · ') })).filter((x) => x.amount > 0),
    b.payments.map((p) => ({ date: p.received_on, at: `${p.received_on} 23:59:59`, amount: round(Number(p.amount) + Number(p.tds_amount)), ref: p.reference,
      description: `Payment · ${p.mode}${Number(p.tds_amount) ? ` (incl. TDS ₹${round(p.tds_amount)})` : ''}` })),
  );
  res.json({ workplace: b.workplaces[0], services, payments: [...b.payments].reverse(), statement: stmt });
}));

// ---- Service log -----------------------------------------------------------------
const SV_FIELDS = ['workplace_id', 'service_at', 'service_type', 'procedure_name', 'patient_name', 'patient_age', 'patient_gender', 'patient_phone', 'hospital_ref', 'amount_billed', 'expected_on', 'notes'];
function svValue(k, v) {
  if (k === 'service_at') return dt(v) || null;
  if (k === 'amount_billed') return Math.max(0, Number(v) || 0);
  if (k === 'patient_age') return v === '' || v == null ? null : Math.max(0, Math.min(120, Number.parseInt(v, 10) || 0));
  if (k === 'patient_gender') return ['Male', 'Female', 'Other'].includes(v) ? v : null;
  if (k === 'service_type') return SERVICE_TYPES.includes(v) ? v : 'Consultation';
  if (k === 'workplace_id') return Number(v);
  return nullIfEmpty(v);
}

r.get('/services', ah(async (req, res) => {
  const b = await books(me(req));
  let rows = [...b.services].reverse().map((s) => ({ ...s, ...b.status.get(s.id) }));
  const { workplaceId, status, month, q } = req.query;
  if (workplaceId) rows = rows.filter((s) => s.workplace_id === Number(workplaceId));
  if (status === 'unpaid') rows = rows.filter((s) => ['pending', 'partial', 'overdue'].includes(s.status));
  else if (status) rows = rows.filter((s) => s.status === status);
  if (month) rows = rows.filter((s) => s.service_at.startsWith(month));
  if (q) {
    const t = String(q).toLowerCase();
    rows = rows.filter((s) => [s.procedure_name, s.patient_name, s.hospital_ref, s.patient_phone, s.service_type].filter(Boolean).join(' ').toLowerCase().includes(t));
  }
  const names = Object.fromEntries(b.workplaces.map((w) => [w.id, { name: w.name, theme: w.theme, city: w.city }]));
  res.json({ services: rows.slice(0, Number(req.query.limit) || 300).map((s) => ({ ...s, workplace: names[s.workplace_id] })), total: rows.length });
}));

r.post('/services', ah(async (req, res) => {
  const b = req.body;
  const w = await loadWorkplace(req, Number(b.workplace_id));
  const keys = SV_FIELDS.filter((k) => k in b);
  const vals = keys.map((k) => svValue(k, b[k]));
  const ins = await query(`INSERT INTO freelance_services (doctor_id, ${keys.join(', ')}) VALUES (?, ${keys.map(() => '?').join(', ')})`, [me(req), ...vals]);
  if (!keys.includes('service_at')) await query('UPDATE freelance_services SET service_at = NOW() WHERE id = ?', [ins.insertId]);
  // "Paid on the spot": record the money at the same time
  const paidNow = round(b.paid_now);
  if (paidNow > 0) {
    await query('INSERT INTO freelance_payments (doctor_id, workplace_id, received_on, amount, tds_amount, mode, reference, notes) VALUES (?,?,?,?,?,?,?,?)',
      [me(req), w.id, (dt(b.service_at) || todayISO()).slice(0, 10), paidNow, round(b.tds_now), MODES.includes(b.paid_mode) ? b.paid_mode : 'Cash', null, 'Paid with the service']);
  }
  res.status(201).json({ id: ins.insertId });
}));

r.patch('/services/:id', ah(async (req, res) => {
  const s = await one('SELECT * FROM freelance_services WHERE id = ? AND doctor_id = ?', [Number(req.params.id), me(req)]);
  if (!s) throw new HttpError(404, 'Entry not found');
  if (req.body.workplace_id) await loadWorkplace(req, Number(req.body.workplace_id));
  const keys = SV_FIELDS.filter((k) => k in req.body);
  if (keys.length) await query(`UPDATE freelance_services SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => svValue(k, req.body[k])), s.id]);
  res.json({ ok: true });
}));

r.post('/services/:id/write-off', ah(async (req, res) => {
  const s = await one('SELECT * FROM freelance_services WHERE id = ? AND doctor_id = ?', [Number(req.params.id), me(req)]);
  if (!s) throw new HttpError(404, 'Entry not found');
  const b = await books(me(req), { workplaceId: s.workplace_id });
  const open = b.status.get(s.id)?.open || 0;
  const undo = req.body.undo === true;
  await query('UPDATE freelance_services SET written_off = ? WHERE id = ?', [undo ? 0 : round(Number(s.written_off) + open), s.id]);
  res.json({ ok: true });
}));

r.delete('/services/:id', ah(async (req, res) => {
  const s = await one('SELECT id FROM freelance_services WHERE id = ? AND doctor_id = ?', [Number(req.params.id), me(req)]);
  if (!s) throw new HttpError(404, 'Entry not found');
  await query('DELETE FROM freelance_services WHERE id = ?', [s.id]);
  res.json({ ok: true });
}));

// ---- Payments received -----------------------------------------------------------------
r.post('/payments', ah(async (req, res) => {
  const b = req.body;
  const w = await loadWorkplace(req, Number(b.workplace_id));
  const amount = round(b.amount);
  const tds = round(b.tds_amount);
  if (!(amount > 0) && !(tds > 0)) throw new HttpError(400, 'Enter the amount received');
  const ins = await query('INSERT INTO freelance_payments (doctor_id, workplace_id, received_on, amount, tds_amount, mode, reference, notes) VALUES (?,?,?,?,?,?,?,?)',
    [me(req), w.id, b.received_on || todayISO(), Math.max(0, amount), Math.max(0, tds), MODES.includes(b.mode) ? b.mode : 'Bank', nullIfEmpty(b.reference), nullIfEmpty(b.notes)]);
  await audit(req, 'practice_payment', { entity: 'workplace', entityId: w.id, detail: `₹${amount} + TDS ₹${tds}` });
  res.status(201).json({ id: ins.insertId });
}));

r.delete('/payments/:id', ah(async (req, res) => {
  const p = await one('SELECT id FROM freelance_payments WHERE id = ? AND doctor_id = ?', [Number(req.params.id), me(req)]);
  if (!p) throw new HttpError(404, 'Payment not found');
  await query('DELETE FROM freelance_payments WHERE id = ?', [p.id]);
  res.json({ ok: true });
}));

// ---- Own expenses ---------------------------------------------------------------------------
r.get('/expenses', ah(async (req, res) => {
  const days = RANGES[req.query.range] || 91;
  const from = addDays(todayISO(), -(days - 1));
  const [manual, vendor] = await Promise.all([
    query(`SELECT e.id, e.spent_on AS date, e.category, e.amount, e.note, w.name AS workplace, 'manual' AS source
             FROM practice_expenses e LEFT JOIN workplaces w ON w.id = e.workplace_id WHERE e.doctor_id = ? AND e.spent_on >= ?`, [me(req), from]),
    query(`SELECT p.id, p.paid_on AS date, v.category, p.amount, v.name AS note, NULL AS workplace, 'vendor' AS source, v.id AS vendor_id
             FROM vendor_payments p JOIN vendors v ON v.id = p.vendor_id WHERE v.doctor_id = ? AND p.paid_on >= ?`, [me(req), from]),
  ]);
  const rows = [...manual, ...vendor].sort((a, b) => (a.date < b.date ? 1 : -1));
  res.json({ from, expenses: rows, total: round(rows.reduce((s, x) => s + Number(x.amount), 0)), categories: EXPENSE_CATEGORIES });
}));

r.post('/expenses', ah(async (req, res) => {
  const b = req.body;
  const amount = round(b.amount);
  if (!(amount > 0)) throw new HttpError(400, 'Enter a positive amount');
  if (b.workplace_id) await loadWorkplace(req, Number(b.workplace_id));
  const ins = await query('INSERT INTO practice_expenses (doctor_id, spent_on, category, amount, workplace_id, note) VALUES (?,?,?,?,?,?)',
    [me(req), b.spent_on || todayISO(), EXPENSE_CATEGORIES.includes(b.category) ? b.category : 'Other', amount, b.workplace_id ? Number(b.workplace_id) : null, nullIfEmpty(b.note)]);
  res.status(201).json({ id: ins.insertId });
}));

r.delete('/expenses/:id', ah(async (req, res) => {
  const e = await one('SELECT id FROM practice_expenses WHERE id = ? AND doctor_id = ?', [Number(req.params.id), me(req)]);
  if (!e) throw new HttpError(404, 'Entry not found');
  await query('DELETE FROM practice_expenses WHERE id = ?', [e.id]);
  res.json({ ok: true });
}));

// ---- Balance sheet / earnings ------------------------------------------------------------
r.get('/summary', ah(async (req, res) => {
  const range = RANGES[req.query.range] ? req.query.range : '6m';
  const days = RANGES[range];
  const to = todayISO();
  const from = range === 'all' ? '2000-01-01' : addDays(to, -(days - 1));
  const b = await books(me(req));
  const inRange = (d) => d >= from && d <= to;
  const services = b.services.filter((s) => inRange(s.service_at.slice(0, 10)));
  const payments = b.payments.filter((p) => inRange(p.received_on));
  const [expManual, expVendor] = await Promise.all([
    query('SELECT spent_on AS date, category, amount FROM practice_expenses WHERE doctor_id = ? AND spent_on BETWEEN ? AND ?', [me(req), from, to]),
    query('SELECT p.paid_on AS date, v.category, p.amount FROM vendor_payments p JOIN vendors v ON v.id = p.vendor_id WHERE v.doctor_id = ? AND p.paid_on BETWEEN ? AND ?', [me(req), from, to]),
  ]);
  const expenses = [...expManual, ...expVendor];
  const sum = (arr, f) => round(arr.reduce((s, x) => s + Number(f(x) || 0), 0));

  // monthly series (or weekly for 1 month)
  const weekly = days <= 31;
  const bucket = (d) => {
    if (!weekly) return `${d.slice(0, 7)}-01`;
    const x = new Date(`${d}T00:00:00`); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.toISOString().slice(0, 10);
  };
  const firstDate = range === 'all' ? (b.services[0]?.service_at.slice(0, 10) || to) : from;
  const keys = [];
  for (let d = new Date(`${bucket(firstDate)}T00:00:00`); d <= new Date(`${to}T00:00:00`);) {
    keys.push(d.toISOString().slice(0, 10));
    if (weekly) d.setDate(d.getDate() + 7); else d.setMonth(d.getMonth() + 1);
  }
  const series = keys.map((k) => ({
    date: k,
    billed: sum(services.filter((s) => bucket(s.service_at.slice(0, 10)) === k), (s) => s.amount_billed),
    received: sum(payments.filter((p) => bucket(p.received_on) === k), (p) => p.amount),
    expenses: sum(expenses.filter((e) => bucket(e.date) === k), (e) => e.amount),
  }));

  const group = (arr, keyFn, valFn) => {
    const m = new Map();
    for (const x of arr) { const k = keyFn(x); if (!k) continue; const g = m.get(k) || { name: k, n: 0, amount: 0 }; g.n += 1; g.amount = round(g.amount + Number(valFn(x) || 0)); m.set(k, g); }
    return [...m.values()].sort((a, b2) => b2.amount - a.amount);
  };
  const wpName = Object.fromEntries(b.workplaces.map((w) => [w.id, w]));
  const pending = [...b.services].filter((s) => ['pending', 'partial', 'overdue'].includes(b.status.get(s.id)?.status))
    .map((s) => ({ ...s, ...b.status.get(s.id), workplace: wpName[s.workplace_id]?.name }))
    .sort((a, c) => c.late_days - a.late_days).slice(0, 8);
  const aging = b.workplaces.reduce((acc, w) => { for (const k of Object.keys(w.aging)) acc[k] = round((acc[k] || 0) + w.aging[k]); return acc; }, {});

  res.json({
    range, from, to, granularity: weekly ? 'week' : 'month',
    kpis: {
      services: services.length, billed: sum(services, (s) => s.amount_billed), received: sum(payments, (p) => p.amount), tds: sum(payments, (p) => p.tds_amount),
      expenses: sum(expenses, (e) => e.amount), net: round(sum(payments, (p) => p.amount) - sum(expenses, (e) => e.amount)),
      outstanding: round(b.workplaces.reduce((s, w) => s + w.outstanding, 0)), overdue: round(b.workplaces.reduce((s, w) => s + w.overdue, 0)),
    },
    aging,
    series,
    workplaces: b.workplaces.map((w) => ({
      id: w.id, name: w.name, city: w.city, theme: w.theme, kind: w.kind, outstanding: w.outstanding, overdue: w.overdue,
      billed: sum(services.filter((s) => s.workplace_id === w.id), (s) => s.amount_billed),
      received: sum(payments.filter((p) => p.workplace_id === w.id), (p) => p.amount),
      tds: sum(payments.filter((p) => p.workplace_id === w.id), (p) => p.tds_amount),
      services: services.filter((s) => s.workplace_id === w.id).length,
    })),
    procedures: group(services, (s) => s.procedure_name || s.service_type, (s) => s.amount_billed).slice(0, 10),
    serviceTypes: group(services, (s) => s.service_type, (s) => s.amount_billed),
    cities: group(services, (s) => wpName[s.workplace_id]?.city || 'Unknown', (s) => s.amount_billed),
    expenseCategories: group(expenses, (e) => e.category, (e) => e.amount),
    pending,
  });
}));

export default r;
