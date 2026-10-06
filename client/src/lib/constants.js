export const CONDITIONS = ['Hypertension', 'Diabetes', 'Thyroid disorder', 'Asthma', 'Heart disease', 'Kidney disease', 'Arthritis', 'Epilepsy', 'TB (past)', 'Pregnancy'];

export const COMPLAINTS = ['Fever', 'Cough', 'Cold', 'Headache', 'Body ache', 'Sore throat', 'Stomach pain', 'Vomiting', 'Loose stools', 'Giddiness',
  'Breathlessness', 'Chest pain', 'Back pain', 'Joint pain', 'Burning urination', 'Weakness', 'Skin rash', 'Routine check-up'];

export const DURATIONS = ['Today', '1 day', '2 days', '3 days', '1 week', '2 weeks', '1 month', '> 3 months'];

export const LAB_TESTS = ['CBC', 'RFT', 'LFT', 'Lipid profile', 'FBS / PPBS', 'HbA1c', 'TSH / Thyroid profile', 'Urine routine', 'Urine culture',
  'ECG', 'Chest X-Ray', 'X-Ray', 'USG abdomen', 'Dengue NS1', 'Widal', 'Vitamin D', 'Vitamin B12', 'CRP', 'ESR', 'Stool routine'];

export const DOSAGES = ['1-0-1', '1-0-0', '0-0-1', '1-1-1', '0-1-0', 'SOS', 'Weekly'];
export const TIMINGS = ['After food', 'Before food', 'Empty stomach', 'Bedtime'];
export const RX_DURATIONS = ['3 days', '5 days', '7 days', '10 days', '15 days', '30 days', '90 days'];

export const NEXT_VISITS = [
  { label: '1 week', days: 7 }, { label: '15 days', days: 15 }, { label: '1 month', days: 30 }, { label: '3 months', days: 90 }, { label: 'SOS', days: 0 },
];

export const COMMON_MEDICINES = ['Paracetamol 650 mg', 'Paracetamol 500 mg', 'Cetirizine 10 mg', 'Levocetirizine 5 mg', 'Amoxicillin 500 mg', 'Amoxicillin + Clavulanate 625 mg',
  'Azithromycin 500 mg', 'Pantoprazole 40 mg', 'Domperidone 10 mg', 'Ondansetron 4 mg', 'ORS sachet', 'Metformin 500 mg', 'Glimepiride 1 mg', 'Amlodipine 5 mg',
  'Telmisartan 40 mg', 'Atorvastatin 10 mg', 'Levothyroxine 50 mcg', 'Montelukast + Levocetirizine', 'Aceclofenac + Paracetamol', 'Ibuprofen 400 mg',
  'Calcium + Vitamin D3', 'Cholecalciferol 60,000 IU', 'Ferrous ascorbate 100 mg', 'Folic acid 5 mg', 'Vitamin B complex', 'Salbutamol inhaler',
  'Cough syrup (10 ml)', 'Ofloxacin + Ornidazole', 'Nitrofurantoin 100 mg', 'Probiotic sachet'];

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export const EXPENSE_CATEGORIES = ['Rent', 'Staff salary', 'Medical supplies', 'Medicines purchase', 'Electricity & water', 'Equipment & maintenance', 'Internet & phone', 'Housekeeping', 'Other'];
export const INCOME_CATEGORIES = ['Procedures', 'Lab collection', 'Pharmacy sales', 'Certificates', 'Other'];

export const STATUS = {
  waiting: { label: 'Waiting', cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
  with_doctor: { label: 'With doctor', cls: 'bg-brand-100 text-brand-800 ring-brand-300' },
  completed: { label: 'Done', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500 ring-slate-200' },
};
