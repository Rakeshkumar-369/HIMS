// Loads realistic demo data: 1 doctor, 2 clinics, 2 nurses, a few thousand patients,
// a year of consultations, prescriptions, lab orders, expenses and a live queue for today.
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';
import { todayISO, addDays } from '../src/lib/util.js';

// Deterministic PRNG so every install shows the same demo data
let seed = 20261006;
const rand = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (a) => a[Math.floor(rand() * a.length)];
const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const chance = (p) => rand() < p;
const weighted = (items) => {
  const total = items.reduce((s, i) => s + i.w, 0);
  let x = rand() * total;
  for (const i of items) { if ((x -= i.w) <= 0) return i; }
  return items[items.length - 1];
};

const MALE = ['Rajesh', 'Suresh', 'Arun', 'Vikram', 'Karthik', 'Mohan', 'Ravi', 'Sanjay', 'Imran', 'Joseph', 'Prakash', 'Ganesh', 'Harish', 'Dinesh', 'Manoj', 'Naveen', 'Ramesh', 'Abdul', 'Venkat', 'Ashok', 'Rahul', 'Aditya', 'Faizal', 'Senthil', 'Gopal', 'Kiran', 'Deepak', 'Murali'];
const FEMALE = ['Lakshmi', 'Priya', 'Anitha', 'Kavya', 'Meena', 'Divya', 'Fathima', 'Sunita', 'Geetha', 'Revathi', 'Shalini', 'Pooja', 'Nandini', 'Mary', 'Sangeetha', 'Radha', 'Bhavana', 'Jyothi', 'Asha', 'Uma', 'Saranya', 'Keerthi', 'Ayesha', 'Malini', 'Vidya', 'Hema'];
const LAST = ['Kumar', 'Reddy', 'Sharma', 'Nair', 'Iyer', 'Rao', 'Patel', 'Singh', 'Khan', 'Menon', 'Pillai', 'Gupta', 'Das', 'Joshi', 'Krishnan', 'Varma', 'Shetty', 'Naidu', 'Thomas', 'Mishra', 'Babu', 'Hegde'];
const AREAS = ['MG Road', 'Gandhi Nagar', 'Anna Nagar', 'Jayanagar', 'Indira Colony', 'Lake View', 'Station Road', 'Market Street', 'Teachers Colony', 'Ashok Vihar', 'Temple Street', 'Nehru Nagar'];

const DX = [
  { dx: 'Acute upper respiratory tract infection', w: 16, ages: [3, 70], c: ['Cough and cold', 'Sore throat, runny nose', 'Fever with cough'], dur: ['2 days', '3 days', '5 days'],
    rx: [['Paracetamol 650 mg', '1-1-1', 'After food', '3 days'], ['Cetirizine 10 mg', '0-0-1', 'After food', '5 days'], ['Amoxicillin 500 mg', '1-1-1', 'After food', '5 days']], labs: [['CBC', 0.2]],
    obs: 'Throat congested, chest clear on auscultation.', adv: 'Warm saline gargles, steam inhalation, plenty of fluids.' },
  { dx: 'Viral fever', w: 12, ages: [3, 75], c: ['Fever with body ache', 'High grade fever, chills', 'Fever since 2 days, headache'], dur: ['1 day', '2 days', '3 days'],
    rx: [['Paracetamol 650 mg', '1-1-1', 'After food', '3 days'], ['ORS sachet', 'SOS', 'Any time', '3 days']], labs: [['CBC', 0.7], ['Dengue NS1', 0.3], ['Widal', 0.15]],
    obs: 'Febrile, no rash, no organomegaly.', adv: 'Rest, adequate hydration, tepid sponging if temperature > 101°F.' },
  { dx: 'Essential hypertension', w: 14, ages: [38, 85], c: ['Headache, giddiness', 'Routine BP check', 'Occasional giddiness'], dur: ['1 week', '2 weeks', '1 month'],
    rx: [['Amlodipine 5 mg', '1-0-0', 'After food', '30 days'], ['Telmisartan 40 mg', '1-0-0', 'After food', '30 days']], labs: [['RFT', 0.4], ['Lipid profile', 0.4], ['ECG', 0.3]],
    obs: 'BP elevated, no signs of end-organ damage.', adv: 'Low salt diet, 30 minutes brisk walk daily, avoid smoking.', cond: 'Hypertension' },
  { dx: 'Type 2 diabetes mellitus', w: 13, ages: [35, 85], c: ['Increased thirst and urination', 'Routine sugar check', 'Tiredness, frequent urination'], dur: ['2 weeks', '1 month', '3 months'],
    rx: [['Metformin 500 mg', '1-0-1', 'After food', '30 days'], ['Glimepiride 1 mg', '1-0-0', 'Before food', '30 days']], labs: [['FBS / PPBS', 0.8], ['HbA1c', 0.5], ['RFT', 0.25]],
    obs: 'Sugars uncontrolled, foot examination normal.', adv: 'Avoid sweets & refined carbs, regular meals, daily foot care.', cond: 'Diabetes' },
  { dx: 'Acute gastroenteritis', w: 7, ages: [2, 70], c: ['Loose stools and vomiting', 'Stomach pain with loose motions'], dur: ['1 day', '2 days'],
    rx: [['ORS sachet', 'SOS', 'Any time', '3 days'], ['Ondansetron 4 mg', '1-0-1', 'Before food', '2 days'], ['Ofloxacin + Ornidazole', '1-0-1', 'After food', '5 days'], ['Probiotic sachet', '1-0-1', 'After food', '5 days']], labs: [['Stool routine', 0.3]],
    obs: 'Mild dehydration, abdomen soft, bowel sounds increased.', adv: 'Oral rehydration, light home food, boiled water.' },
  { dx: 'Acid peptic disease', w: 8, ages: [20, 75], c: ['Burning in upper abdomen', 'Acidity and bloating', 'Heartburn after meals'], dur: ['1 week', '2 weeks'],
    rx: [['Pantoprazole 40 mg', '1-0-0', 'Before food', '14 days'], ['Domperidone 10 mg', '1-0-1', 'Before food', '7 days']], labs: [['USG abdomen', 0.15]],
    obs: 'Epigastric tenderness present.', adv: 'Avoid spicy, oily food & late dinners. Small frequent meals.' },
  { dx: 'Urinary tract infection', w: 5, ages: [18, 80], c: ['Burning micturition', 'Frequent urination with pain'], dur: ['2 days', '4 days'],
    rx: [['Nitrofurantoin 100 mg', '1-0-1', 'After food', '5 days'], ['Alkaliser syrup (10 ml)', '1-1-1', 'After food', '5 days']], labs: [['Urine routine', 0.9], ['Urine culture', 0.3]],
    obs: 'Suprapubic tenderness, no renal angle tenderness.', adv: 'Drink 3 litres of water daily, maintain hygiene.' },
  { dx: 'Hypothyroidism', w: 5, ages: [22, 75], c: ['Weight gain, tiredness', 'Thyroid follow-up', 'Hair fall, lethargy'], dur: ['1 month', '3 months'],
    rx: [['Levothyroxine 50 mcg', '1-0-0', 'Empty stomach', '90 days']], labs: [['TSH / Thyroid profile', 0.9]],
    obs: 'No goitre, reflexes normal.', adv: 'Take tablet on empty stomach, 30 min before breakfast.', cond: 'Thyroid disorder' },
  { dx: 'Musculoskeletal low back pain', w: 6, ages: [25, 80], c: ['Lower back pain', 'Back pain after lifting weight'], dur: ['3 days', '1 week', '2 weeks'],
    rx: [['Aceclofenac + Paracetamol', '1-0-1', 'After food', '5 days'], ['Thiocolchicoside 4 mg', '1-0-1', 'After food', '5 days'], ['Diclofenac gel', 'Local', 'Apply', '7 days']], labs: [['X-Ray', 0.2]],
    obs: 'Paraspinal muscle spasm, SLR negative.', adv: 'Hot fomentation, back strengthening exercises, avoid lifting heavy weights.' },
  { dx: 'Allergic rhinitis', w: 5, ages: [8, 60], c: ['Sneezing and blocked nose', 'Running nose in mornings'], dur: ['1 week', '1 month'],
    rx: [['Montelukast + Levocetirizine', '0-0-1', 'After food', '10 days'], ['Fluticasone nasal spray', '1-0-1', 'Two puffs', '15 days']], labs: [],
    obs: 'Pale, boggy nasal mucosa.', adv: 'Avoid dust exposure, use mask while travelling.' },
  { dx: 'Iron deficiency anaemia', w: 4, ages: [14, 60], c: ['Tiredness and breathlessness', 'Weakness, dizziness'], dur: ['2 weeks', '1 month'],
    rx: [['Ferrous ascorbate 100 mg', '0-1-0', 'After food', '30 days'], ['Folic acid 5 mg', '1-0-0', 'After food', '30 days']], labs: [['CBC', 0.9], ['Vitamin B12', 0.2]],
    obs: 'Pallor present.', adv: 'Iron rich diet — greens, dates, jaggery. Take tablets with lemon water.' },
  { dx: 'Bronchial asthma', w: 3, ages: [6, 70], c: ['Wheezing, breathlessness', 'Night time cough'], dur: ['2 days', '1 week'],
    rx: [['Salbutamol inhaler', 'SOS', 'Two puffs', '30 days'], ['Budesonide + Formoterol inhaler', '1-0-1', 'Two puffs', '30 days']], labs: [['Chest X-Ray', 0.3]],
    obs: 'Bilateral wheeze present, no crepitations.', adv: 'Rinse mouth after inhaler, avoid smoke and cold drinks.', cond: 'Asthma' },
  { dx: 'Vitamin D deficiency', w: 3, ages: [20, 75], c: ['Body ache, joint pain', 'Generalised weakness'], dur: ['1 month', '3 months'],
    rx: [['Cholecalciferol 60,000 IU', 'Weekly', 'After food', '8 weeks'], ['Calcium + Vitamin D3', '0-1-0', 'After food', '30 days']], labs: [['Vitamin D', 0.8]],
    obs: 'Generalised bony tenderness.', adv: 'Morning sunlight exposure 20 minutes daily.' },
  { dx: 'Typhoid fever', w: 2, ages: [5, 60], c: ['Continuous fever, loss of appetite'], dur: ['5 days', '1 week'],
    rx: [['Azithromycin 500 mg', '1-0-0', 'After food', '7 days'], ['Paracetamol 650 mg', '1-1-1', 'After food', '5 days']], labs: [['Widal', 0.8], ['CBC', 0.8], ['LFT', 0.3]],
    obs: 'Coated tongue, mild hepatomegaly.', adv: 'Boiled water, soft diet, complete the antibiotic course.' },
];

const CONDITIONS = ['Hypertension', 'Diabetes', 'Thyroid disorder', 'Asthma', 'Heart disease', 'Kidney disease', 'Arthritis'];
const COMMENTS = ['Recheck HbA1c next time, consider adding DPP4 inhibitor.', 'Patient anxious — counsel on lifestyle.', 'Compliance poor, ask relative to accompany.',
  'Consider cardiology referral if BP stays high.', 'Review lab reports and taper antibiotics.', 'Check for drug interaction with herbal supplements.'];
const NEXT = [{ l: '1 week', d: 7, w: 4 }, { l: '15 days', d: 15, w: 3 }, { l: '1 month', d: 30, w: 4 }, { l: '3 months', d: 90, w: 1.5 }, { l: 'SOS', d: 0, w: 3 }];

function vitalsFor(age, gender, d) {
  const htn = d.cond === 'Hypertension' || age > 55 && chance(0.4);
  const height = age < 14 ? int(95, 155) : gender === 'Male' ? int(158, 182) : int(148, 168);
  const bmi = age < 14 ? 16 + rand() * 4 : 20 + rand() * 10;
  return {
    bp_systolic: htn ? int(136, 172) : int(108, 132), bp_diastolic: htn ? int(86, 102) : int(68, 84),
    pulse: int(68, 104), temperature: d.dx.includes('fever') || d.dx.includes('infection') ? +(99 + rand() * 3).toFixed(1) : +(97.6 + rand() * 1.2).toFixed(1),
    spo2: d.dx === 'Bronchial asthma' ? int(92, 96) : int(96, 100), height_cm: height,
    weight_kg: +(bmi * (height / 100) ** 2).toFixed(1),
    blood_sugar: d.cond === 'Diabetes' ? int(160, 290) : chance(0.3) ? int(85, 140) : null,
    resp_rate: int(14, 20),
  };
}

const conn = await pool.getConnection();
try {
  console.log('Seeding demo data…');
  const hash = await bcrypt.hash('Demo@123', 12);
  await conn.query(
    "INSERT INTO users (role, full_name, email, phone, password_hash) VALUES ('admin','CareNest Support','admin@carenest.app','9876500000',?)",
    [await bcrypt.hash('Admin@123', 12)]);
  const [doc] = await conn.query(
    `INSERT INTO users (role, full_name, email, phone, address, city, password_hash, qualification, registration_no, specialization, max_clinics)
     VALUES ('doctor','Dr. Ananya Rao','doctor@demo.com','9876500001','12, 2nd Cross, MG Road','Bengaluru',?,'MBBS, MD (General Medicine)','KMC 104528','Family Physician',3)`, [hash]);
  const doctorId = doc.insertId;
  const [n1] = await conn.query("INSERT INTO users (role, full_name, email, phone, password_hash, created_by) VALUES ('nurse','Sr. Priya Thomas','nurse@demo.com','9876500002',?,?)", [hash, doctorId]);
  const [n2] = await conn.query("INSERT INTO users (role, full_name, email, phone, password_hash, created_by) VALUES ('nurse','Sr. Meena Pillai','nurse2@demo.com','9876500003',?,?)", [hash, doctorId]);

  const clinics = [
    { name: 'Sunrise Family Clinic', code: 'SFC', tagline: 'Caring for every generation', address: '12, 2nd Cross, MG Road', city: 'Bengaluru 560001', phone: '080 4123 5566', email: 'care@sunriseclinic.in', reg: 'KA/BLR/CE/2019/0421', timings: 'Mon–Sat · 9:00 AM – 1:00 PM, 5:00 – 8:30 PM', fee: 300, theme: 'mint', nurse: n1.insertId, perDay: [9, 18] },
    { name: 'Green Valley Health Centre', code: 'GVHC', tagline: 'Rural care, close to home', address: 'Opp. Panchayat Office, Main Road', city: 'Hoskote 562114', phone: '080 2793 1122', email: 'greenvalley@clinic.in', reg: 'KA/BRD/CE/2021/0177', timings: 'Tue, Thu, Sat · 10:00 AM – 2:00 PM', fee: 200, theme: 'lavender', nurse: n2.insertId, perDay: [6, 13], days: [2, 4, 6] },
  ];
  for (const c of clinics) {
    const [r] = await conn.query(
      `INSERT INTO clinics (owner_id, name, code, tagline, address, city, phone, email, registration_no, timings, consultation_fee, theme)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [doctorId, c.name, c.code, c.tagline, c.address, c.city, c.phone, c.email, c.reg, c.timings, c.fee, c.theme]);
    c.id = r.insertId;
    await conn.query('INSERT INTO clinic_members (clinic_id, user_id) VALUES (?,?),(?,?)', [c.id, doctorId, c.id, c.nurse]);
  }

  const today = todayISO();
  const usedCase = new Set(['100200300']);
  const caseNo = () => { let n; do { n = String(int(100000000, 999999999)); } while (usedCase.has(n)); usedCase.add(n); return n; };

  let totalVisits = 0;
  let totalPatients = 0;
  for (const c of clinics) {
    const pool_ = []; // patients registered so far (for follow-ups)
    const visitRows = [];
    const rxRows = [];
    const labRows = [];
    let visitId = (await conn.query('SELECT COALESCE(MAX(id),0) AS m FROM visits'))[0][0].m;

    for (let back = 364; back >= 0; back--) {
      const date = addDays(today, -back);
      const dow = new Date(date + 'T00:00:00').getDay();
      if (dow === 0) continue;
      if (c.days && !c.days.includes(dow)) continue;
      const isToday = back === 0;
      const seasonal = 1 + 0.35 * Math.sin(((365 - back) / 365) * Math.PI * 2);
      const count = isToday ? (c.code === 'SFC' ? 11 : 6) : Math.round(int(c.perDay[0], c.perDay[1]) * seasonal * (0.75 + (365 - back) / 900));
      for (let tok = 1; tok <= count; tok++) {
        let patient;
        const followUp = pool_.length > 30 && chance(0.42);
        if (followUp) {
          patient = pick(pool_);
        } else {
          const gender = chance(0.52) ? 'Female' : chance(0.97) ? 'Male' : 'Other';
          const d = weighted(DX);
          const age = int(d.ages[0], d.ages[1]);
          const first = gender === 'Male' ? pick(MALE) : pick(FEMALE);
          const conds = new Set();
          if (d.cond) conds.add(d.cond);
          if (age > 45 && chance(0.25)) conds.add(pick(CONDITIONS));
          const useDob = chance(0.6);
          const dob = useDob ? addDays(date, -(age * 365 + int(0, 300))) : null;
          const createdAt = `${date} ${String(int(9, 19)).padStart(2, '0')}:${String(int(0, 59)).padStart(2, '0')}:00`;
          const [pr] = await conn.query(
            `INSERT INTO patients (case_no, clinic_id, full_name, gender, dob, age_years, phone, address, blood_group, guardian_name, emergency_phone,
                                   occupation, known_conditions, allergies, habits, created_by, created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [caseNo(), c.id, `${first} ${pick(LAST)}`, gender, dob, useDob ? null : age, `9${int(100000000, 999999999)}`,
             `${int(1, 220)}, ${pick(AREAS)}, ${c.city.split(' ')[0]}`, pick(['A+', 'B+', 'O+', 'O+', 'AB+', 'A-', 'B-', 'O-', null]),
             chance(0.5) ? `${pick(MALE)} ${pick(LAST)}` : null, chance(0.5) ? `9${int(100000000, 999999999)}` : null,
             pick(['Farmer', 'Teacher', 'Homemaker', 'IT professional', 'Shop owner', 'Driver', 'Student', 'Retired', 'Labourer', null]),
             JSON.stringify([...conds]), chance(0.08) ? pick(['Penicillin', 'Sulfa drugs', 'NSAIDs', 'Dust']) : null,
             chance(0.15) ? pick(['Smoker', 'Occasional alcohol', 'Tobacco chewing']) : null, c.nurse, createdAt]);
          patient = { id: pr.insertId, age, gender, d, conds: [...conds] };
          pool_.push(patient);
          totalPatients++;
        }
        // Follow-ups mostly continue the chronic diagnosis, sometimes a new acute complaint
        const d = followUp && (patient.d.cond ? chance(0.75) : chance(0.2)) ? patient.d : weighted(DX);
        const vit = vitalsFor(patient.age, patient.gender, d);
        visitId++;
        totalVisits++;
        let status = 'completed';
        if (isToday) status = tok <= count - 5 ? 'completed' : tok === count - 4 ? 'with_doctor' : 'waiting';
        const done = status === 'completed';
        const nx = weighted(NEXT);
        const fee = chance(0.04) ? 0 : c.fee;
        const hour = 9 + Math.floor((tok / count) * 10);
        visitRows.push([
          visitId, patient.id, c.id, date, tok, status, followUp ? 'follow_up' : 'new', 0,
          vit.bp_systolic, vit.bp_diastolic, vit.pulse, vit.temperature, vit.spo2, vit.weight_kg, vit.height_cm, vit.blood_sugar, vit.resp_rate,
          pick(d.c), pick(d.dur), followUp && patient.d.cond ? patient.d.rx.map((r) => r[0]).join(', ') : chance(0.2) ? 'Paracetamol SOS' : null, null,
          done || status === 'with_doctor' ? doctorId : null,
          done ? d.obs : null, done ? d.dx : null, null, done ? d.adv : null, done && chance(0.18) ? pick(COMMENTS) : null,
          done ? nx.l : null, done && nx.d ? addDays(date, nx.d) : null,
          done ? fee : c.fee, fee === 0 ? 'Free' : pick(['Cash', 'Cash', 'UPI', 'UPI', 'UPI', 'Card']), c.nurse,
          `${date} ${String(hour).padStart(2, '0')}:${String(int(0, 59)).padStart(2, '0')}:00`,
          status !== 'waiting' ? `${date} ${String(hour).padStart(2, '0')}:${String(int(0, 59)).padStart(2, '0')}:00` : null,
          done ? `${date} ${String(hour).padStart(2, '0')}:59:00` : null,
        ]);
        if (done) {
          d.rx.forEach((r, i) => { if (i === 0 || chance(0.85)) rxRows.push([visitId, r[0], r[1], r[2], r[3], null, i]); });
          for (const [t, p] of d.labs) if (chance(p)) labRows.push([visitId, t]);
        }
      }
    }
    const COLS = `(id, patient_id, clinic_id, visit_date, token_no, status, visit_type, priority, bp_systolic, bp_diastolic, pulse, temperature, spo2,
      weight_kg, height_cm, blood_sugar, resp_rate, complaints, complaint_duration, current_medicines, nurse_notes, doctor_id, observations, diagnosis,
      lab_other, advice, doctor_comment, next_visit_label, next_visit_date, fee, payment_mode, created_by, created_at, called_at, completed_at)`;
    for (let i = 0; i < visitRows.length; i += 500) await conn.query(`INSERT INTO visits ${COLS} VALUES ?`, [visitRows.slice(i, i + 500)]);
    for (let i = 0; i < rxRows.length; i += 1000) await conn.query('INSERT INTO prescriptions (visit_id, medicine, dosage, timing, duration, instructions, sort_order) VALUES ?', [rxRows.slice(i, i + 1000)]);
    for (let i = 0; i < labRows.length; i += 1000) await conn.query('INSERT INTO visit_lab_tests (visit_id, test_name) VALUES ?', [labRows.slice(i, i + 1000)]);

    // Ledger: monthly fixed costs + weekly variable entries
    const txns = [];
    const scale = c.code === 'SFC' ? 1 : 0.3;
    for (let back = 364; back >= 0; back--) {
      const date = addDays(today, -back);
      const d = new Date(date + 'T00:00:00');
      if (d.getDate() === 1) {
        txns.push([c.id, date, 'expense', 'Rent', Math.round(18000 * scale), 'Monthly rent', doctorId]);
        txns.push([c.id, date, 'expense', 'Staff salary', Math.round(22000 * scale), 'Nurse & helper salary', doctorId]);
      }
      if (d.getDate() === 5) txns.push([c.id, date, 'expense', 'Electricity & water', int(2800, 5200) * scale | 0, null, doctorId]);
      if (d.getDay() === 1) {
        txns.push([c.id, date, 'expense', 'Medical supplies', int(1500, 6500) * scale | 0, 'Gloves, syringes, dressing material', doctorId]);
        if (chance(0.5)) txns.push([c.id, date, 'income', 'Procedures', int(800, 4500) * scale | 0, 'Dressing / injections / nebulisation', doctorId]);
        if (chance(0.6)) txns.push([c.id, date, 'income', 'Lab collection', int(1200, 5000) * scale | 0, 'Sample collection share', doctorId]);
      }
      if (d.getDate() === 15 && chance(0.5)) txns.push([c.id, date, 'expense', 'Equipment & maintenance', int(1500, 12000), pick(['BP apparatus service', 'Glucometer strips', 'AC service', 'Nebuliser repair']), doctorId]);
      if (d.getDate() === 20) txns.push([c.id, date, 'expense', 'Internet & phone', 1200, null, doctorId]);
    }
    await conn.query('INSERT INTO transactions (clinic_id, txn_date, kind, category, amount, note, created_by) VALUES ?', [txns]);
    c.demoPatient = pool_.find((p) => p.d.cond === 'Diabetes') || pool_[0];
  }

  // Give the demo patient a known mobile number for the patient portal
  const demo = clinics[0].demoPatient;
  await conn.query("UPDATE patients SET case_no = '100200300', phone = '9000000001', full_name = 'Ramesh Kumar', gender = 'Male' WHERE id = ?", [demo.id]);
  const [[{ case_no }]] = await conn.query('SELECT case_no FROM patients WHERE id = ?', [demo.id]);

  console.log(`✔ Seeded ${totalPatients} patients and ${totalVisits} visits across ${clinics.length} clinics.\n`);
  console.log('  Super admin   : admin@carenest.app / Admin@123');
  console.log('  Doctor login  : doctor@demo.com / Demo@123');
  console.log('  Nurse login   : nurse@demo.com  / Demo@123   (Sunrise Family Clinic)');
  console.log('  Nurse login   : nurse2@demo.com / Demo@123   (Green Valley Health Centre)');
  console.log(`  Patient portal: Case ID ${case_no} + mobile 9000000001`);
} finally {
  conn.release();
  await pool.end();
}
