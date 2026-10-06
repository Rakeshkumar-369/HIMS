import { Router } from 'express';
import { query } from '../db.js';
import { ah, HttpError, todayISO, addDays, parseJSON } from '../lib/util.js';
import { requireStaff } from '../middleware/auth.js';

const r = Router();
r.use(requireStaff('doctor'));

const RANGES = { '7d': 7, '10d': 10, '1m': 30, '6m': 182, '1y': 365 };

function bucketExpr(col, gran) {
  if (gran === 'day') return col;
  if (gran === 'week') return `DATE_SUB(${col}, INTERVAL WEEKDAY(${col}) DAY)`;
  return `DATE_FORMAT(${col}, '%Y-%m-01')`;
}

function bucketsBetween(from, to, gran) {
  const out = [];
  let d = new Date(from + 'T00:00:00');
  if (gran === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  if (gran === 'month') d.setDate(1);
  const end = new Date(to + 'T00:00:00');
  while (d <= end) {
    out.push(todayISO(d));
    if (gran === 'day') d.setDate(d.getDate() + 1);
    else if (gran === 'week') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
  }
  return out;
}

const AGE_GROUPS = [['0–12', 0, 12], ['13–19', 13, 19], ['20–35', 20, 35], ['36–50', 36, 50], ['51–65', 51, 65], ['65+', 66, 200]];

r.get('/', ah(async (req, res) => {
  const range = RANGES[req.query.range] ? req.query.range : '1m';
  const days = RANGES[range];
  const to = todayISO();
  const from = addDays(to, -(days - 1));
  const prevFrom = addDays(from, -days);
  const prevTo = addDays(from, -1);
  const gran = days <= 31 ? 'day' : days <= 182 ? 'week' : 'month';
  // money is lumpy (rent on the 1st) — show it one step coarser so the trend is readable
  const finGran = days <= 10 ? 'day' : days <= 182 ? 'week' : 'month';

  const mine = await query('SELECT c.id, c.name, c.theme FROM clinics c JOIN clinic_members m ON m.clinic_id = c.id WHERE m.user_id = ?', [req.user.id]);
  let clinicIds = mine.map((c) => c.id);
  if (req.query.clinicId && req.query.clinicId !== 'all') {
    const id = Number(req.query.clinicId);
    if (!clinicIds.includes(id)) throw new HttpError(403, 'You do not have access to this clinic');
    clinicIds = [id];
  }
  if (!clinicIds.length) return res.json({ empty: true });

  const V = "v.clinic_id IN (?) AND v.status = 'completed' AND v.visit_date BETWEEN ? AND ?";
  const vp = [clinicIds, from, to];
  const ageExpr = 'COALESCE(TIMESTAMPDIFF(YEAR, p.dob, v.visit_date), p.age_years)';

  const [
    kpi, kpiPrev, newPatients, trendRows, ageRows, genderRows, diagRows, condRows, medRows, labRows,
    feeRows, txnRows, expenseCats, incomeCats, payRows, clinicRows, txnTotals, txnPrevTotals,
  ] = await Promise.all([
    query(`SELECT COUNT(*) AS cases, COUNT(DISTINCT v.patient_id) AS patients, COALESCE(SUM(v.fee),0) AS fees FROM visits v WHERE ${V}`, vp),
    query(`SELECT COUNT(*) AS cases, COALESCE(SUM(v.fee),0) AS fees FROM visits v WHERE ${V}`, [clinicIds, prevFrom, prevTo]),
    query('SELECT COUNT(*) AS n FROM patients WHERE clinic_id IN (?) AND DATE(created_at) BETWEEN ? AND ?', vp),
    query(`SELECT ${bucketExpr('v.visit_date', gran)} AS b, COUNT(*) AS cases,
                  SUM(v.visit_type = 'new') AS new_cases, SUM(v.visit_type <> 'new') AS follow_ups
             FROM visits v WHERE ${V} GROUP BY b`, vp),
    query(`SELECT ${ageExpr} AS age, p.gender FROM visits v JOIN patients p ON p.id = v.patient_id WHERE ${V}`, vp),
    query(`SELECT p.gender, COUNT(*) AS n FROM visits v JOIN patients p ON p.id = v.patient_id WHERE ${V} GROUP BY p.gender`, vp),
    query(`SELECT v.diagnosis AS name, COUNT(*) AS n FROM visits v WHERE ${V} AND v.diagnosis IS NOT NULL AND v.diagnosis <> ''
           GROUP BY v.diagnosis ORDER BY n DESC LIMIT 10`, vp),
    query(`SELECT DISTINCT p.id, p.known_conditions FROM visits v JOIN patients p ON p.id = v.patient_id WHERE ${V}`, vp),
    query(`SELECT rx.medicine AS name, COUNT(*) AS n FROM prescriptions rx JOIN visits v ON v.id = rx.visit_id WHERE ${V}
           GROUP BY rx.medicine ORDER BY n DESC LIMIT 12`, vp),
    query(`SELECT l.test_name AS name, COUNT(*) AS n FROM visit_lab_tests l JOIN visits v ON v.id = l.visit_id WHERE ${V}
           GROUP BY l.test_name ORDER BY n DESC LIMIT 12`, vp),
    query(`SELECT ${bucketExpr('v.visit_date', finGran)} AS b, SUM(v.fee) AS amt FROM visits v WHERE ${V} GROUP BY b`, vp),
    query(`SELECT ${bucketExpr('t.txn_date', finGran)} AS b, t.kind, SUM(t.amount) AS amt FROM transactions t
            WHERE t.clinic_id IN (?) AND t.txn_date BETWEEN ? AND ? GROUP BY b, t.kind`, vp),
    query(`SELECT category AS name, SUM(amount) AS n FROM transactions WHERE kind = 'expense' AND clinic_id IN (?) AND txn_date BETWEEN ? AND ?
           GROUP BY category ORDER BY n DESC`, vp),
    query(`SELECT category AS name, SUM(amount) AS n FROM transactions WHERE kind = 'income' AND clinic_id IN (?) AND txn_date BETWEEN ? AND ?
           GROUP BY category ORDER BY n DESC`, vp),
    query(`SELECT v.payment_mode AS name, COUNT(*) AS n, SUM(v.fee) AS amt FROM visits v WHERE ${V} GROUP BY v.payment_mode`, vp),
    query(`SELECT v.clinic_id, COUNT(*) AS cases, SUM(v.fee) AS fees FROM visits v WHERE ${V} GROUP BY v.clinic_id`, vp),
    query(`SELECT kind, SUM(amount) AS amt FROM transactions WHERE clinic_id IN (?) AND txn_date BETWEEN ? AND ? GROUP BY kind`, vp),
    query(`SELECT kind, SUM(amount) AS amt FROM transactions WHERE clinic_id IN (?) AND txn_date BETWEEN ? AND ? GROUP BY kind`, [clinicIds, prevFrom, prevTo]),
  ]);

  const sumKind = (rows, k) => Number(rows.find((x) => x.kind === k)?.amt || 0);
  const income = Number(kpi[0].fees) + sumKind(txnTotals, 'income');
  const expense = sumKind(txnTotals, 'expense');
  const prevIncome = Number(kpiPrev[0].fees) + sumKind(txnPrevTotals, 'income');
  const prevExpense = sumKind(txnPrevTotals, 'expense');

  const buckets = bucketsBetween(from, to, gran);
  const byB = (rows) => Object.fromEntries(rows.map((x) => [x.b, x]));
  const t = byB(trendRows);
  const f = byB(feeRows);
  const trend = buckets.map((b) => ({
    date: b, cases: Number(t[b]?.cases || 0), new_cases: Number(t[b]?.new_cases || 0), follow_ups: Number(t[b]?.follow_ups || 0),
  }));
  const finance = bucketsBetween(from, to, finGran).map((b) => {
    const inc = txnRows.filter((x) => x.b === b && x.kind === 'income').reduce((s, x) => s + Number(x.amt), 0);
    const exp = txnRows.filter((x) => x.b === b && x.kind === 'expense').reduce((s, x) => s + Number(x.amt), 0);
    const fees = Number(f[b]?.amt || 0);
    return { date: b, consultation: fees, other_income: inc, income: fees + inc, expense: exp, net: fees + inc - exp };
  });

  const ageGroups = AGE_GROUPS.map(([label, lo, hi]) => {
    const inGroup = ageRows.filter((a) => a.age != null && a.age >= lo && a.age <= hi);
    return { group: label, Male: inGroup.filter((a) => a.gender === 'Male').length, Female: inGroup.filter((a) => a.gender === 'Female').length, Other: inGroup.filter((a) => a.gender === 'Other').length };
  });

  const condCount = {};
  for (const row of condRows) for (const c of parseJSON(row.known_conditions)) condCount[c] = (condCount[c] || 0) + 1;
  const conditions = Object.entries(condCount).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n).slice(0, 10);

  res.json({
    range, from, to, granularity: gran, financeGranularity: finGran,
    kpis: {
      cases: Number(kpi[0].cases), prev_cases: Number(kpiPrev[0].cases), patients: Number(kpi[0].patients),
      new_patients: Number(newPatients[0].n), avg_per_day: +(Number(kpi[0].cases) / days).toFixed(1),
      income, expense, net: income - expense, prev_income: prevIncome, prev_expense: prevExpense,
    },
    trend, finance, ageGroups,
    gender: genderRows.map((g) => ({ name: g.gender, n: Number(g.n) })),
    diagnoses: diagRows.map((d) => ({ name: d.name, n: Number(d.n) })),
    conditions,
    medicines: medRows.map((d) => ({ name: d.name, n: Number(d.n) })),
    labTests: labRows.map((d) => ({ name: d.name, n: Number(d.n) })),
    expenseCategories: expenseCats.map((d) => ({ name: d.name, n: Number(d.n) })),
    incomeCategories: [{ name: 'Consultation', n: Number(kpi[0].fees) }, ...incomeCats.map((d) => ({ name: d.name, n: Number(d.n) }))].filter((x) => x.n > 0),
    paymentModes: payRows.map((d) => ({ name: d.name, n: Number(d.n), amt: Number(d.amt) })),
    clinics: mine.filter((c) => clinicIds.includes(c.id)).map((c) => {
      const row = clinicRows.find((x) => x.clinic_id === c.id);
      return { ...c, cases: Number(row?.cases || 0), fees: Number(row?.fees || 0) };
    }),
  });
}));

export default r;
