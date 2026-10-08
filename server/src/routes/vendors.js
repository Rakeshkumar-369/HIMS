// Vendors & purchases: vendor directory, orders, deliveries, payments and balances.
// A vendor book belongs to a clinic (doctors of that clinic) or to a doctor's own practice.
import { Router } from 'express';
import { query, one, tx } from '../db.js';
import { ah, HttpError, assertClinicAccess, nullIfEmpty, todayISO } from '../lib/util.js';
import { requireStaff, idParam } from '../middleware/auth.js';
import { audit } from '../lib/audit.js';
import { likeEscape } from '../lib/security.js';
import { settle, statement, lineTotal, round, addDays } from '../lib/ledger.js';

const r = Router();
r.use(requireStaff('doctor'));
r.param('id', idParam);
r.param('orderId', idParam);
r.param('paymentId', idParam);

export const VENDOR_CATEGORIES = ['Medicines purchase', 'Medical supplies', 'Lab charges', 'Equipment & maintenance', 'Housekeeping', 'Stationery & printing', 'Instruments', 'Other'];
const MODES = ['Cash', 'UPI', 'Bank', 'Cheque', 'Card'];
const FIELDS = ['name', 'category', 'contact_person', 'phone', 'email', 'address', 'city', 'gstin', 'payment_terms_days', 'notes', 'is_active'];

/** Which book does the request refer to? Throws if the user may not use it. */
async function resolveBook(req, src) {
  if (src.book === 'personal') {
    const u = await one('SELECT practice_type FROM users WHERE id = ?', [req.user.id]);
    if (u.practice_type === 'clinic') throw new HttpError(403, 'Personal vendor book is for freelance practice');
    return { clinicId: null, doctorId: req.user.id };
  }
  const clinicId = Number(src.clinicId || src.clinic_id);
  await assertClinicAccess(req.user, clinicId);
  return { clinicId, doctorId: null };
}

async function loadVendor(req, id) {
  const v = await one('SELECT * FROM vendors WHERE id = ?', [id]);
  if (!v) throw new HttpError(404, 'Vendor not found');
  if (v.clinic_id) await assertClinicAccess(req.user, v.clinic_id);
  else if (v.doctor_id !== req.user.id) throw new HttpError(404, 'Vendor not found');
  return v;
}

async function loadOrder(req, orderId) {
  const o = await one('SELECT * FROM vendor_orders WHERE id = ?', [orderId]);
  if (!o) throw new HttpError(404, 'Order not found');
  const v = await loadVendor(req, o.vendor_id);
  return { order: o, vendor: v };
}

/** Balances for a set of vendors in one pass. */
async function balancesFor(vendors) {
  if (!vendors.length) return new Map();
  const ids = vendors.map((v) => v.id);
  const [deliveries, payments, items] = await Promise.all([
    query(`SELECT d.id, o.vendor_id, DATE(d.delivered_at) AS date, d.amount FROM vendor_deliveries d
             JOIN vendor_orders o ON o.id = d.order_id WHERE o.vendor_id IN (?)`, [ids]),
    query('SELECT vendor_id, SUM(amount) AS paid, MAX(paid_on) AS last_paid FROM vendor_payments WHERE vendor_id IN (?) GROUP BY vendor_id', [ids]),
    query(`SELECT o.vendor_id, i.qty, i.rate, i.gst_pct, i.received_qty FROM vendor_order_items i
             JOIN vendor_orders o ON o.id = i.order_id WHERE o.vendor_id IN (?) AND o.status IN ('ordered','partial')`, [ids]),
  ]);
  const lastOrders = await query('SELECT vendor_id, MAX(ordered_at) AS last_order, COUNT(*) AS orders FROM vendor_orders WHERE vendor_id IN (?) GROUP BY vendor_id', [ids]);
  const out = new Map();
  for (const v of vendors) {
    const bills = deliveries.filter((d) => d.vendor_id === v.id).map((d) => ({ ...d, due_on: addDays(d.date, v.payment_terms_days || 0) }));
    const pay = payments.find((p) => p.vendor_id === v.id);
    const paid = round(pay?.paid);
    const billed = round(bills.reduce((s, b) => s + Number(b.amount), 0));
    const s = settle(bills, paid);
    const pendingDelivery = round(items.filter((i) => i.vendor_id === v.id)
      .reduce((sum, i) => sum + lineTotal({ ...i, qty: Math.max(0, Number(i.qty) - Number(i.received_qty)) }), 0));
    const lo = lastOrders.find((x) => x.vendor_id === v.id);
    out.set(v.id, {
      billed, paid, outstanding: round(billed - paid), overdue: s.overdue, due_soon: s.due_soon, aging: s.aging,
      pending_delivery: pendingDelivery, last_paid: pay?.last_paid || null, last_order: lo?.last_order || null, orders: Number(lo?.orders || 0),
    });
  }
  return out;
}

// ---- Vendor directory ---------------------------------------------------
r.get('/', ah(async (req, res) => {
  const book = await resolveBook(req, req.query);
  const where = book.clinicId ? 'clinic_id = ?' : 'doctor_id = ?';
  const params = [book.clinicId || book.doctorId];
  let extra = '';
  if (req.query.q) { extra = ' AND (name LIKE ? OR contact_person LIKE ? OR phone LIKE ? OR city LIKE ?)'; const l = `%${likeEscape(req.query.q)}%`; params.push(l, l, l, l); }
  const vendors = await query(`SELECT * FROM vendors WHERE ${where}${extra} ORDER BY is_active DESC, name`, params);
  const bal = await balancesFor(vendors);
  const rows = vendors.map((v) => ({ ...v, ...bal.get(v.id) }));
  const monthStart = `${todayISO().slice(0, 8)}01`;
  const paidMonth = await one(
    `SELECT COALESCE(SUM(p.amount),0) AS n FROM vendor_payments p JOIN vendors v ON v.id = p.vendor_id WHERE v.${where} AND p.paid_on >= ?`, [params[0], monthStart]);
  const sum = (k) => round(rows.reduce((s, x) => s + (x[k] || 0), 0));
  res.json({
    vendors: rows,
    totals: { outstanding: sum('outstanding'), overdue: sum('overdue'), due_soon: sum('due_soon'), pending_delivery: sum('pending_delivery'), paid_this_month: round(paidMonth.n) },
    categories: VENDOR_CATEGORIES,
  });
}));

r.post('/', ah(async (req, res) => {
  const b = req.body;
  const book = await resolveBook(req, b);
  if (!b.name?.trim()) throw new HttpError(400, 'Vendor name is required');
  const cat = VENDOR_CATEGORIES.includes(b.category) ? b.category : 'Other';
  const ins = await query(
    `INSERT INTO vendors (clinic_id, doctor_id, name, category, contact_person, phone, email, address, city, gstin, payment_terms_days, notes, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [book.clinicId, book.doctorId, b.name.trim(), cat, nullIfEmpty(b.contact_person), nullIfEmpty(b.phone), nullIfEmpty(b.email), nullIfEmpty(b.address),
     nullIfEmpty(b.city), nullIfEmpty(b.gstin?.toUpperCase()), Math.max(0, Number.parseInt(b.payment_terms_days, 10) || 0), nullIfEmpty(b.notes), req.user.id]);
  res.status(201).json({ id: ins.insertId });
}));

r.get('/dues', ah(async (req, res) => {
  const book = await resolveBook(req, req.query);
  const vendors = await query(`SELECT * FROM vendors WHERE ${book.clinicId ? 'clinic_id' : 'doctor_id'} = ? AND is_active = 1`, [book.clinicId || book.doctorId]);
  const bal = await balancesFor(vendors);
  const rows = vendors.map((v) => ({ id: v.id, name: v.name, ...bal.get(v.id) })).filter((v) => v.overdue > 0 || v.due_soon > 0)
    .sort((a, b) => b.overdue - a.overdue || b.due_soon - a.due_soon);
  res.json({ overdue: round(rows.reduce((s, v) => s + v.overdue, 0)), due_soon: round(rows.reduce((s, v) => s + v.due_soon, 0)), vendors: rows.slice(0, 5) });
}));

r.get('/:id', ah(async (req, res) => {
  const v = await loadVendor(req, Number(req.params.id));
  const [orders, items, deliveries, dItems, payments] = await Promise.all([
    query('SELECT * FROM vendor_orders WHERE vendor_id = ? ORDER BY ordered_at DESC, id DESC', [v.id]),
    query('SELECT i.* FROM vendor_order_items i JOIN vendor_orders o ON o.id = i.order_id WHERE o.vendor_id = ? ORDER BY i.id', [v.id]),
    query('SELECT d.* FROM vendor_deliveries d JOIN vendor_orders o ON o.id = d.order_id WHERE o.vendor_id = ? ORDER BY d.delivered_at', [v.id]),
    query(`SELECT di.*, i.item FROM vendor_delivery_items di JOIN vendor_order_items i ON i.id = di.order_item_id
             JOIN vendor_orders o ON o.id = i.order_id WHERE o.vendor_id = ?`, [v.id]),
    query('SELECT * FROM vendor_payments WHERE vendor_id = ? ORDER BY paid_on DESC, id DESC', [v.id]),
  ]);
  const balance = (await balancesFor([v])).get(v.id);
  const bills = deliveries.map((d) => ({ id: d.id, date: d.delivered_at.slice(0, 10), at: d.delivered_at, amount: d.amount, due_on: addDays(d.delivered_at.slice(0, 10), v.payment_terms_days || 0) }));
  const settled = settle(bills, balance.paid).rows;
  const orderOut = orders.map((o) => {
    const its = items.filter((i) => i.order_id === o.id).map((i) => ({ ...i, total: lineTotal(i) }));
    const dels = deliveries.filter((d) => d.order_id === o.id).map((d) => {
      const st = settled.find((x) => x.id === d.id);
      return { ...d, items: dItems.filter((x) => x.delivery_id === d.id), paid: st?.paid || 0, open: st?.open || 0, due_on: st?.due_on, late_days: st?.late_days || 0 };
    });
    const billed = round(dels.reduce((s, d) => s + Number(d.amount), 0));
    const open = round(dels.reduce((s, d) => s + d.open, 0));
    return { ...o, items: its, deliveries: dels, value: round(its.reduce((s, i) => s + i.total, 0)), billed, open,
      pay_status: !billed ? 'unbilled' : open <= 0 ? 'paid' : open < billed ? 'part-paid' : 'unpaid' };
  });
  const orderNo = Object.fromEntries(orders.map((o) => [o.id, o.order_no]));
  const stmt = statement(
    deliveries.map((d) => ({ date: d.delivered_at.slice(0, 10), at: d.delivered_at, amount: d.amount, ref: d.invoice_no || orderNo[d.order_id], description: `Delivery · ${orderNo[d.order_id]}` })),
    payments.map((p) => ({ date: p.paid_on, at: `${p.paid_on} 23:59:59`, amount: p.amount, ref: p.reference, description: `Payment · ${p.mode}` })),
  );
  res.json({ vendor: v, balance, orders: orderOut, payments, statement: stmt, categories: VENDOR_CATEGORIES });
}));

r.patch('/:id', ah(async (req, res) => {
  const v = await loadVendor(req, Number(req.params.id));
  const keys = FIELDS.filter((k) => k in req.body);
  if ('name' in req.body && !String(req.body.name).trim()) throw new HttpError(400, 'Vendor name is required');
  const val = (k) => {
    const x = req.body[k];
    if (k === 'payment_terms_days') return Math.max(0, Number.parseInt(x, 10) || 0);
    if (k === 'is_active') return x ? 1 : 0;
    if (k === 'category') return VENDOR_CATEGORIES.includes(x) ? x : 'Other';
    if (k === 'gstin') return nullIfEmpty(String(x || '').toUpperCase());
    return k === 'name' ? String(x).trim() : nullIfEmpty(x);
  };
  if (keys.length) await query(`UPDATE vendors SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map(val), v.id]);
  res.json({ ok: true });
}));

// ---- Orders ---------------------------------------------------------------
r.post('/:id/orders', ah(async (req, res) => {
  const v = await loadVendor(req, Number(req.params.id));
  const items = (req.body.items || []).filter((i) => i.item?.trim() && Number(i.qty) > 0);
  if (!items.length) throw new HttpError(400, 'Add at least one item with a quantity');
  const orderedAt = req.body.ordered_at ? String(req.body.ordered_at).replace('T', ' ').slice(0, 19) : null;
  const id = await tx(async (c) => {
    const [[{ n }]] = await c.query('SELECT COUNT(*) + 1 AS n FROM vendor_orders WHERE vendor_id = ?', [v.id]);
    const orderNo = `PO-${v.id}-${String(n).padStart(3, '0')}`;
    const [o] = await c.query('INSERT INTO vendor_orders (vendor_id, order_no, ordered_at, expected_on, notes, created_by) VALUES (?,?,COALESCE(?, NOW()),?,?,?)',
      [v.id, orderNo, orderedAt, nullIfEmpty(req.body.expected_on), nullIfEmpty(req.body.notes), req.user.id]);
    await c.query('INSERT INTO vendor_order_items (order_id, item, qty, unit, rate, gst_pct) VALUES ?',
      [items.map((i) => [o.insertId, i.item.trim(), Number(i.qty), nullIfEmpty(i.unit), Math.max(0, Number(i.rate) || 0), Math.max(0, Math.min(28, Number(i.gst_pct) || 0))])]);
    return o.insertId;
  });
  res.status(201).json({ id });
}));

r.post('/orders/:orderId/deliveries', ah(async (req, res) => {
  const { order, vendor } = await loadOrder(req, Number(req.params.orderId));
  if (order.status === 'cancelled') throw new HttpError(400, 'This order was cancelled');
  const items = await query('SELECT * FROM vendor_order_items WHERE order_id = ?', [order.id]);
  const lines = (req.body.items || []).map((l) => ({ ...l, qty: Number(l.qty) || 0, item: items.find((i) => i.id === Number(l.order_item_id)) }))
    .filter((l) => l.item && l.qty > 0);
  if (!lines.length) throw new HttpError(400, 'Enter the quantity received for at least one item');
  for (const l of lines) {
    if (l.qty > Number(l.item.qty) - Number(l.item.received_qty) + 0.001) throw new HttpError(400, `More ${l.item.item} received than ordered`);
  }
  const computed = round(lines.reduce((s, l) => s + lineTotal({ ...l.item, qty: l.qty }), 0));
  const amount = req.body.amount !== undefined && req.body.amount !== '' ? round(req.body.amount) : computed;
  if (!(amount >= 0)) throw new HttpError(400, 'Bill amount is not valid');
  const at = req.body.delivered_at ? String(req.body.delivered_at).replace('T', ' ').slice(0, 19) : null;
  await tx(async (c) => {
    const [d] = await c.query('INSERT INTO vendor_deliveries (order_id, delivered_at, invoice_no, amount, notes, created_by) VALUES (?,COALESCE(?, NOW()),?,?,?,?)',
      [order.id, at, nullIfEmpty(req.body.invoice_no), amount, nullIfEmpty(req.body.notes), req.user.id]);
    for (const l of lines) {
      await c.query('INSERT INTO vendor_delivery_items (delivery_id, order_item_id, qty, batch_no, expiry_date) VALUES (?,?,?,?,?)',
        [d.insertId, l.item.id, l.qty, nullIfEmpty(l.batch_no), nullIfEmpty(l.expiry_date)]);
      await c.query('UPDATE vendor_order_items SET received_qty = received_qty + ? WHERE id = ?', [l.qty, l.item.id]);
    }
    const [[left]] = await c.query('SELECT SUM(qty - received_qty) AS left_qty FROM vendor_order_items WHERE order_id = ?', [order.id]);
    await c.query('UPDATE vendor_orders SET status = ? WHERE id = ?', [Number(left.left_qty) > 0.001 ? 'partial' : 'delivered', order.id]);
  });
  await audit(req, 'vendor_delivery', { entity: 'vendor', entityId: vendor.id, detail: `${order.order_no} · ₹${amount}` });
  res.status(201).json({ ok: true, amount });
}));

r.post('/orders/:orderId/cancel', ah(async (req, res) => {
  const { order } = await loadOrder(req, Number(req.params.orderId));
  if (order.status !== 'ordered') throw new HttpError(400, 'Only orders with nothing delivered yet can be cancelled');
  await query("UPDATE vendor_orders SET status = 'cancelled' WHERE id = ?", [order.id]);
  res.json({ ok: true });
}));

// ---- Payments ---------------------------------------------------------------
r.post('/:id/payments', ah(async (req, res) => {
  const v = await loadVendor(req, Number(req.params.id));
  const amount = round(req.body.amount);
  if (!(amount > 0)) throw new HttpError(400, 'Enter the amount paid');
  const ins = await query('INSERT INTO vendor_payments (vendor_id, paid_on, amount, mode, reference, notes, created_by) VALUES (?,?,?,?,?,?,?)',
    [v.id, req.body.paid_on || todayISO(), amount, MODES.includes(req.body.mode) ? req.body.mode : 'UPI', nullIfEmpty(req.body.reference), nullIfEmpty(req.body.notes), req.user.id]);
  await audit(req, 'vendor_payment', { entity: 'vendor', entityId: v.id, detail: `₹${amount}` });
  res.status(201).json({ id: ins.insertId });
}));

r.delete('/payments/:paymentId', ah(async (req, res) => {
  const p = await one('SELECT * FROM vendor_payments WHERE id = ?', [Number(req.params.paymentId)]);
  if (!p) throw new HttpError(404, 'Payment not found');
  await loadVendor(req, p.vendor_id);
  await query('DELETE FROM vendor_payments WHERE id = ?', [p.id]);
  await audit(req, 'vendor_payment_deleted', { entity: 'vendor', entityId: p.vendor_id, detail: `₹${p.amount} on ${p.paid_on}` });
  res.json({ ok: true });
}));

export default r;
