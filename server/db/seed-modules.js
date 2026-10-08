// Demo data for the Vendors & Purchases module and the freelance (visiting doctor) practice.

const CATALOGUE = {
  'Medicines purchase': [['Paracetamol 650 mg (strip of 15)', 'strip', 28, 12], ['Amoxicillin 500 mg (strip of 10)', 'strip', 85, 12], ['Pantoprazole 40 mg (strip of 15)', 'strip', 96, 12],
    ['Metformin 500 mg (strip of 20)', 'strip', 32, 12], ['Amlodipine 5 mg (strip of 15)', 'strip', 41, 12], ['ORS sachets (box of 25)', 'box', 410, 12], ['Cetirizine 10 mg (strip of 10)', 'strip', 18, 12]],
  'Medical supplies': [['Examination gloves (box of 100)', 'box', 320, 12], ['Disposable syringes 5 ml (100)', 'box', 450, 12], ['Cotton roll 500 g', 'roll', 180, 5],
    ['Surgical masks (box of 50)', 'box', 150, 5], ['Dressing gauze (pack of 100)', 'pack', 260, 12], ['Hand sanitiser 5 L', 'can', 890, 18]],
  'Lab charges': [['CBC (outsourced)', 'test', 180, 0], ['Lipid profile (outsourced)', 'test', 420, 0], ['HbA1c (outsourced)', 'test', 380, 0], ['Thyroid profile (outsourced)', 'test', 460, 0]],
  'Equipment & maintenance': [['Glucometer strips (pack of 50)', 'pack', 650, 12], ['BP apparatus servicing', 'service', 900, 18], ['Nebuliser kit', 'piece', 1450, 12], ['Pulse oximeter', 'piece', 1200, 12]],
  Housekeeping: [['Floor cleaner 5 L', 'can', 420, 18], ['Bio-medical waste disposal (monthly)', 'service', 1500, 18], ['Tissue rolls (pack of 12)', 'pack', 360, 12]],
};

/** Vendors with a year of orders, deliveries and payments for one clinic. */
export async function seedVendors(conn, clinic, doctorId, h) {
  const { int, pick, chance, addDays, today, scale } = h;
  const VENDORS = [
    { name: 'Sri Balaji Pharma Distributors', category: 'Medicines purchase', contact: 'Venkatesh R', terms: 30, every: 14 },
    { name: 'MediCare Surgicals', category: 'Medical supplies', contact: 'Anil Kumar', terms: 15, every: 21 },
    { name: 'Precision Diagnostics Lab', category: 'Lab charges', contact: 'Dr. Shruthi', terms: 30, every: 30 },
    { name: 'BioServe Equipment', category: 'Equipment & maintenance', contact: 'Rahul Jain', terms: 0, every: 60 },
    { name: 'CleanCare Services', category: 'Housekeeping', contact: 'Mary Joseph', terms: 7, every: 30 },
  ];
  const city = clinic.city.split(' ')[0];
  for (const [vi, v] of VENDORS.entries()) {
    const [ins] = await conn.query(
      `INSERT INTO vendors (clinic_id, name, category, contact_person, phone, email, address, city, gstin, payment_terms_days, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [clinic.id, v.name, v.category, v.contact, `98${int(10000000, 99999999)}`, `${v.name.split(' ')[0].toLowerCase()}@vendor.in`,
       `${int(1, 90)}, ${pick(['Industrial Area', 'Market Road', 'KR Road', 'Main Street'])}`, city, `29ABCDE${int(1000, 9999)}F1Z${vi}`, v.terms, doctorId]);
    const vendorId = ins.insertId;
    let billedTotal = 0;
    let n = 0;
    const bills = [];
    for (let back = 360 - vi * 3; back >= 2; back -= v.every + int(-3, 3)) {
      n += 1;
      const orderedOn = addDays(today, -back);
      const items = [...CATALOGUE[v.category]].sort(() => (chance(0.5) ? 1 : -1)).slice(0, int(2, 4))
        .map(([item, unit, rate, gst]) => ({ item, unit, rate, gst, qty: Math.max(1, Math.round(int(2, 12) * scale)) }));
      const recent = back < 6;
      const status = recent ? (chance(0.5) ? 'ordered' : 'partial') : 'delivered';
      const [o] = await conn.query('INSERT INTO vendor_orders (vendor_id, order_no, ordered_at, expected_on, status, created_by) VALUES (?,?,?,?,?,?)',
        [vendorId, `PO-${vendorId}-${String(n).padStart(3, '0')}`, `${orderedOn} ${String(int(10, 18)).padStart(2, '0')}:${String(int(0, 59)).padStart(2, '0')}:00`, addDays(orderedOn, 3), status, doctorId]);
      if (status === 'ordered') {
        await conn.query('INSERT INTO vendor_order_items (order_id, item, qty, unit, rate, gst_pct) VALUES ?', [items.map((i) => [o.insertId, i.item, i.qty, i.unit, i.rate, i.gst])]);
        continue;
      }
      const deliveredOn = addDays(orderedOn, int(1, 3));
      let amount = 0;
      const lines = [];
      for (const i of items) {
        const got = status === 'partial' && i === items[0] ? Math.max(1, Math.floor(i.qty / 2)) : i.qty;
        const [oi] = await conn.query('INSERT INTO vendor_order_items (order_id, item, qty, unit, rate, gst_pct, received_qty) VALUES (?,?,?,?,?,?,?)',
          [o.insertId, i.item, i.qty, i.unit, i.rate, i.gst, got]);
        amount += got * i.rate * (1 + i.gst / 100);
        lines.push([oi.insertId, got, v.category === 'Medicines purchase' ? `B${int(10000, 99999)}` : null, v.category === 'Medicines purchase' ? addDays(deliveredOn, int(240, 720)) : null]);
      }
      amount = Math.round(amount * 100) / 100;
      const [d] = await conn.query('INSERT INTO vendor_deliveries (order_id, delivered_at, invoice_no, amount, created_by) VALUES (?,?,?,?,?)',
        [o.insertId, `${deliveredOn} ${String(int(10, 18)).padStart(2, '0')}:15:00`, `INV/${int(1000, 9999)}`, amount, doctorId]);
      await conn.query('INSERT INTO vendor_delivery_items (delivery_id, order_item_id, qty, batch_no, expiry_date) VALUES ?', [lines.map((l) => [d.insertId, ...l])]);
      billedTotal += amount;
      bills.push({ date: deliveredOn, amount });
    }
    // Payments: bills are paid around their due date, the last couple are still open (one vendor runs overdue)
    const pays = [];
    const lagExtra = vi === 0 ? 25 : 0;
    for (const [bi, b] of bills.entries()) {
      const payOn = addDays(b.date, v.terms + int(-2, 6) + lagExtra);
      if (payOn >= today || bi >= bills.length - (vi === 0 ? 3 : 1)) continue;
      pays.push([vendorId, payOn, b.amount, pick(['UPI', 'UPI', 'Bank', 'Cash', 'Cheque']), `TXN${int(100000, 999999)}`, null, doctorId]);
    }
    if (pays.length) await conn.query('INSERT INTO vendor_payments (vendor_id, paid_on, amount, mode, reference, notes, created_by) VALUES ?', [pays]);
    h.log.vendors += 1;
    h.log.billed += billedTotal;
  }
}

/** A freelance doctor who visits several hospitals and clinics. */
export async function seedFreelance(conn, hash, h) {
  const { int, pick, chance, addDays, today } = h;
  const [u] = await conn.query(
    `INSERT INTO users (role, full_name, email, phone, address, city, password_hash, qualification, registration_no, specialization, max_clinics, practice_type)
     VALUES ('doctor','Dr. Arjun Mehta','freelance@demo.com','9876500010','44, Lake View Layout','Bengaluru',?,'MBBS, MS (General Surgery)','KMC 118204','General & Laparoscopic Surgeon',0,'freelance')`,
    [hash]);
  const doc = u.insertId;
  const WORKPLACES = [
    { name: 'City Care Hospital', kind: 'Hospital', city: 'Bengaluru', model: 'per_procedure', fee: 15000, tds: 10, credit: 30, theme: 'sky', contact: 'Accounts – Ms. Kavitha', weekly: 2.2,
      jobs: [['Surgery', 'Laparoscopic cholecystectomy', 18000], ['Surgery', 'Open inguinal hernia repair', 14000], ['Procedure', 'Incision & drainage of abscess', 4000], ['Surgery', 'Appendicectomy', 15000], ['Consultation', 'Surgical OPD', 800]] },
    { name: 'Lotus Nursing Home', kind: 'Nursing home', city: 'Mysuru', model: 'per_visit', fee: 6000, tds: 10, credit: 45, theme: 'lavender', contact: 'Mr. Prakash (Admin)', weekly: 1,
      jobs: [['Ward round', 'Weekly surgical round', 6000], ['Surgery', 'Excision of lipoma', 7000], ['Procedure', 'Circumcision', 6500]] },
    { name: 'Green Cross Multispeciality', kind: 'Hospital', city: 'Hosur', model: 'per_case', fee: 1200, tds: 10, credit: 30, theme: 'mint', contact: 'Billing desk', weekly: 2.5,
      jobs: [['Consultation', 'Surgical consultation', 1200], ['On-call', 'Emergency on-call (night)', 5000], ['Procedure', 'Wound debridement', 3500]] },
    { name: 'HealthLine Teleconsult', kind: 'Teleconsult', city: 'Online', model: 'per_case', fee: 500, tds: 0, credit: 7, theme: 'peach', contact: 'Partner support', weekly: 3,
      jobs: [['Teleconsult', 'Post-op follow-up (video)', 500], ['Teleconsult', 'Second opinion', 700]] },
  ];
  const FIRST = ['Rahul', 'Sneha', 'Mohammed', 'Lakshmi', 'Vikram', 'Deepa', 'Joseph', 'Kavya', 'Naveen', 'Fathima', 'Suresh', 'Anitha'];
  const LAST = ['Sharma', 'Reddy', 'Khan', 'Iyer', 'Nair', 'Patel', 'Gowda', 'Das', 'Pillai', 'Rao'];
  let services = 0;
  for (const [wi, w] of WORKPLACES.entries()) {
    const [ins] = await conn.query(
      `INSERT INTO workplaces (doctor_id, name, kind, city, address, contact_person, phone, pay_model, default_fee, tds_pct, credit_days, theme)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [doc, w.name, w.kind, w.city, w.kind === 'Teleconsult' ? null : `${int(1, 200)}, Main Road, ${w.city}`, w.contact, `80${int(10000000, 99999999)}`, w.model, w.fee, w.tds, w.credit, w.theme]);
    const wpId = ins.insertId;
    const rows = [];
    for (let back = 182; back >= 0; back--) {
      const date = addDays(today, -back);
      if (new Date(`${date}T00:00:00`).getDay() === 0 && w.kind !== 'Teleconsult') continue;
      if (!chance(w.weekly / 6)) continue;
      const [type, proc, fee] = pick(w.jobs);
      const g = chance(0.5) ? 'Male' : 'Female';
      rows.push([doc, wpId, `${date} ${String(int(8, 20)).padStart(2, '0')}:${pick(['00', '15', '30', '45'])}:00`, type, proc,
        `${pick(FIRST)} ${pick(LAST)}`, int(8, 78), g, chance(0.6) ? `9${int(100000000, 999999999)}` : null,
        w.kind === 'Teleconsult' ? null : `${pick(['IP', 'OP'])}-${int(10000, 99999)}`, fee + int(-1, 2) * (fee >= 5000 ? 1000 : 0)]);
    }
    if (rows.length) {
      await conn.query(`INSERT INTO freelance_services (doctor_id, workplace_id, service_at, service_type, procedure_name, patient_name, patient_age, patient_gender,
        patient_phone, hospital_ref, amount_billed) VALUES ?`, [rows]);
    }
    services += rows.length;
    // Monthly settlements (hospitals deduct TDS); the most recent month is still pending; Lotus pays late.
    const byMonth = new Map();
    for (const r of rows) { const m = r[2].slice(0, 7); byMonth.set(m, (byMonth.get(m) || 0) + r[10]); }
    const months = [...byMonth.keys()].sort();
    const pays = [];
    for (const [mi, m] of months.entries()) {
      const unpaid = wi === 1 ? 3 : wi === 3 ? 0 : 1;
      if (mi >= months.length - unpaid) continue;
      const gross = byMonth.get(m) * (wi === 2 && mi === months.length - 2 ? 0.6 : 1); // one part payment
      const tds = Math.round(gross * w.tds) / 100;
      const payDate = addDays(`${m}-01`, 31 + w.credit + int(-5, 10));
      if (payDate > today) continue;
      pays.push([doc, wpId, payDate, Math.round((gross - tds) * 100) / 100, tds, w.kind === 'Teleconsult' ? 'UPI' : pick(['Bank', 'Bank', 'Cheque']), `UTR${int(1000000, 9999999)}`]);
    }
    if (pays.length) await conn.query('INSERT INTO freelance_payments (doctor_id, workplace_id, received_on, amount, tds_amount, mode, reference) VALUES ?', [pays]);
  }
  // Own expenses
  const exp = [];
  for (let back = 182; back >= 0; back -= 7) exp.push([doc, addDays(today, -back), 'Travel & fuel', int(1800, 3200), null, 'Fuel & tolls (Mysuru / Hosur trips)']);
  exp.push([doc, addDays(today, -150), 'Indemnity insurance', 18500, null, 'Professional indemnity – annual premium']);
  exp.push([doc, addDays(today, -95), 'Memberships & CME', 7500, null, 'Surgical society conference registration']);
  exp.push([doc, addDays(today, -40), 'Memberships & CME', 2500, null, 'Annual membership renewal']);
  for (let back = 170; back >= 0; back -= 30) exp.push([doc, addDays(today, -back), 'Phone & internet', 999, null, 'Mobile + data plan']);
  await conn.query('INSERT INTO practice_expenses (doctor_id, spent_on, category, amount, workplace_id, note) VALUES ?', [exp]);
  // A personal vendor (instruments)
  const [v] = await conn.query(
    `INSERT INTO vendors (doctor_id, name, category, contact_person, phone, city, payment_terms_days) VALUES (?,?,?,?,?,?,?)`,
    [doc, 'SurgiTech Instruments', 'Instruments', 'Imran Shaikh', '9845011122', 'Bengaluru', 15]);
  const [o] = await conn.query("INSERT INTO vendor_orders (vendor_id, order_no, ordered_at, status) VALUES (?, ?, ?, 'delivered')", [v.insertId, `PO-${v.insertId}-001`, `${addDays(today, -60)} 11:00:00`]);
  const [oi] = await conn.query('INSERT INTO vendor_order_items (order_id, item, qty, unit, rate, gst_pct, received_qty) VALUES (?,?,?,?,?,?,?)',
    [o.insertId, 'Laparoscopic hand instrument set', 1, 'set', 24000, 12, 1]);
  const [d] = await conn.query('INSERT INTO vendor_deliveries (order_id, delivered_at, invoice_no, amount) VALUES (?,?,?,?)', [o.insertId, `${addDays(today, -57)} 16:00:00`, 'ST/2231', 26880]);
  await conn.query('INSERT INTO vendor_delivery_items (delivery_id, order_item_id, qty) VALUES (?,?,1)', [d.insertId, oi.insertId]);
  await conn.query("INSERT INTO vendor_payments (vendor_id, paid_on, amount, mode, reference) VALUES (?,?,15000,'UPI','Advance + part')", [v.insertId, addDays(today, -50)]);
  return { services, workplaces: WORKPLACES.length };
}
