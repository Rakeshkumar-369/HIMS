// Balance-sheet maths shared by the vendor and freelance modules.
// Payments always settle the oldest open bills first (FIFO), the way small practices think about it.
import { todayISO } from './util.js';

const round = (n) => Math.round(Number(n || 0) * 100) / 100;
const dayDiff = (a, b) => Math.round((new Date(`${a}T00:00:00`) - new Date(`${b}T00:00:00`)) / 86400000);
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export const lineTotal = (i) => round(Number(i.qty) * Number(i.rate) * (1 + Number(i.gst_pct || 0) / 100));

/**
 * bills: [{ id, date (YYYY-MM-DD), amount, due_on }], credit: total paid.
 * Returns each bill with paid/open amounts and the overall ageing of what is still open.
 */
export function settle(bills, credit) {
  let pool = round(credit);
  const today = todayISO();
  const aging = { current: 0, d0_30: 0, d31_60: 0, d61_plus: 0 };
  let overdue = 0;
  let dueSoon = 0;
  const rows = [...bills].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id)).map((b) => {
    const amount = round(b.amount);
    const paid = Math.min(amount, Math.max(pool, 0));
    pool = round(pool - paid);
    const open = round(amount - paid);
    if (open > 0) {
      const late = b.due_on ? dayDiff(today, b.due_on) : 0;
      if (late > 0) {
        overdue += open;
        if (late <= 30) aging.d0_30 += open;
        else if (late <= 60) aging.d31_60 += open;
        else aging.d61_plus += open;
      } else {
        aging.current += open;
        if (b.due_on && late >= -7) dueSoon += open;
      }
    }
    return { ...b, paid, open, late_days: open > 0 && b.due_on ? Math.max(0, dayDiff(today, b.due_on)) : 0 };
  });
  return {
    rows,
    overdue: round(overdue),
    due_soon: round(dueSoon),
    advance: round(Math.max(pool, 0)), // paid more than billed so far
    aging: Object.fromEntries(Object.entries(aging).map(([k, v]) => [k, round(v)])),
  };
}

/** Chronological statement with a running balance (bills add, payments subtract). */
export function statement(bills, payments) {
  const rows = [
    ...bills.map((b) => ({ date: b.date, at: b.at || b.date, type: 'bill', ref: b.ref, description: b.description, debit: round(b.amount), credit: 0 })),
    ...payments.map((p) => ({ date: p.date, at: p.at || p.date, type: 'payment', ref: p.ref, description: p.description, debit: 0, credit: round(p.amount) })),
  ].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.type === 'bill' ? -1 : 1));
  let bal = 0;
  return rows.map((r) => { bal = round(bal + r.debit - r.credit); return { ...r, balance: bal }; });
}

export { round, addDays, dayDiff };
