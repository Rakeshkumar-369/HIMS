import { palette } from '../lib/themes';
import { caseFmt, fmtDate, bmi as calcBmi } from '../lib/format';

const Row = ({ label, children }) => (children ? (
  <div className="avoid-break grid grid-cols-[150px_1fr] gap-3 border-b border-dashed border-slate-200 py-2 text-[13px] last:border-0">
    <div className="font-semibold text-slate-500">{label}</div>
    <div className="text-slate-900">{children}</div>
  </div>
) : null);

function VisitBlock({ v, patient, showHeader }) {
  const b = v.bmi ?? calcBmi(v.weight_kg, v.height_cm);
  const vit = [
    ['BP', v.bp_systolic && `${v.bp_systolic}/${v.bp_diastolic} mmHg`], ['Pulse', v.pulse && `${v.pulse} bpm`], ['Temp', v.temperature && `${v.temperature} °F`],
    ['SpO₂', v.spo2 && `${v.spo2}%`], ['Weight', v.weight_kg && `${v.weight_kg} kg`], ['Height', v.height_cm && `${v.height_cm} cm`], ['BMI', b], ['RBS', v.blood_sugar && `${v.blood_sugar} mg/dL`],
  ].filter(([, x]) => x);
  const labs = [...(v.lab_tests || []), ...(v.lab_other ? [v.lab_other] : [])];
  return (
    <section className="avoid-break-soft mt-5">
      {showHeader && (
        <div className="mb-2 flex items-center justify-between rounded-lg px-3 py-1.5 text-[12px] font-bold" style={{ background: 'var(--sheet-50)', color: 'var(--sheet-800)' }}>
          <span>Visit · {fmtDate(v.visit_date)}</span><span>Token #{v.token_no}{v.doctor_name && ` · ${v.doctor_name}`}</span>
        </div>
      )}
      {!!vit.length && (
        <div className="avoid-break mb-3 grid grid-cols-4 gap-1.5">
          {vit.map(([k, val]) => (
            <div key={k} className="rounded-lg border border-slate-200 px-2.5 py-1.5">
              <div className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">{k}</div>
              <div className="text-[13px] font-bold">{val}</div>
            </div>
          ))}
        </div>
      )}
      <Row label="Known case of">{patient.known_conditions?.join(', ')}</Row>
      <Row label="Complaints">{v.complaints}{v.complaint_duration && ` — since ${v.complaint_duration}`}</Row>
      <Row label="Current medicines">{v.current_medicines}</Row>
      <Row label="Observations">{v.observations}</Row>
      <Row label="Diagnosis"><b>{v.diagnosis}</b></Row>
      {!!v.prescriptions?.length && (
        <div className="avoid-break mt-3">
          <div className="mb-1.5 flex items-center gap-2 text-[13px] font-bold"><span className="font-serif text-xl italic" style={{ color: 'var(--sheet-600)' }}>℞</span> Medicines</div>
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr style={{ background: 'var(--sheet-50)' }}>
                {['#', 'Medicine', 'Dosage', 'When', 'Duration', 'Notes'].map((h) => <th key={h} className="border border-slate-200 px-2 py-1.5 text-left font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {v.prescriptions.map((r, i) => (
                <tr key={r.id ?? i}>
                  <td className="border border-slate-200 px-2 py-1.5">{i + 1}</td>
                  <td className="border border-slate-200 px-2 py-1.5 font-semibold">{r.medicine}</td>
                  <td className="border border-slate-200 px-2 py-1.5 font-mono">{r.dosage}</td>
                  <td className="border border-slate-200 px-2 py-1.5">{r.timing}</td>
                  <td className="border border-slate-200 px-2 py-1.5">{r.duration}</td>
                  <td className="border border-slate-200 px-2 py-1.5">{r.instructions}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-1 text-[10px] text-slate-400">Dosage = Morning – Afternoon – Night</div>
        </div>
      )}
      <div className="mt-2">
        <Row label="Investigations advised">{labs.join(', ')}</Row>
        <Row label="Advice">{v.advice && <span className="whitespace-pre-line">{v.advice}</span>}</Row>
        <Row label="Next visit">{v.next_visit_date ? <b>{fmtDate(v.next_visit_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</b> : v.next_visit_label === 'SOS' ? 'If symptoms persist (SOS)' : null}</Row>
      </div>
    </section>
  );
}

/** A4 case sheet. Never renders the doctor's private comment. */
export default function CaseSheet({ clinic, patient, visits, full = false }) {
  const p = palette(clinic.theme);
  const doctor = visits.find((v) => v.doctor_name) || {};
  const style = { '--sheet-50': p[50], '--sheet-100': p[100], '--sheet-600': p[600], '--sheet-800': p[800] };
  return (
    <article style={style} className="print-sheet mx-auto w-[210mm] max-w-full bg-white p-[12mm] font-sans text-slate-900 shadow-lift sm:rounded-2xl">
      {/* Letterhead */}
      <header className="flex items-start justify-between gap-6 border-b-2 pb-4" style={{ borderColor: p[400] }}>
        <div className="flex gap-3">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl text-sm font-extrabold text-white" style={{ background: p[600] }}>{clinic.code}</div>
          <div>
            <h1 className="text-[22px] leading-tight font-extrabold" style={{ color: p[800] }}>{clinic.name}</h1>
            {clinic.tagline && <div className="text-[12px] text-slate-500 italic">{clinic.tagline}</div>}
            <div className="mt-1 text-[11.5px] text-slate-600">{[clinic.address, clinic.city].filter(Boolean).join(', ')}</div>
            <div className="text-[11.5px] text-slate-600">{[clinic.phone && `☎ ${clinic.phone}`, clinic.email].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
        <div className="text-right text-[11.5px] text-slate-600">
          {doctor.doctor_name && <div className="text-[14px] font-bold text-slate-900">{doctor.doctor_name}</div>}
          {doctor.doctor_qualification && <div>{doctor.doctor_qualification}</div>}
          {doctor.doctor_registration_no && <div>Reg. No: {doctor.doctor_registration_no}</div>}
          {clinic.timings && <div className="mt-1">{clinic.timings}</div>}
          {clinic.registration_no && <div>Clinic Reg: {clinic.registration_no}</div>}
        </div>
      </header>

      <div className="mt-3 text-center text-[11px] font-bold tracking-[0.25em] uppercase" style={{ color: p[600] }}>{full ? 'Complete case record' : 'Consultation summary'}</div>

      {/* Patient block */}
      <div className="mt-3 grid grid-cols-3 gap-x-6 gap-y-1.5 rounded-xl px-4 py-3 text-[12.5px]" style={{ background: p[50] }}>
        <div><span className="text-slate-500">Name: </span><b>{patient.full_name}</b></div>
        <div><span className="text-slate-500">Case ID: </span><b className="font-mono tracking-wider">{caseFmt(patient.case_no)}</b></div>
        <div><span className="text-slate-500">Age / Sex: </span><b>{patient.age ?? '—'} yrs / {patient.gender}</b></div>
        <div><span className="text-slate-500">Mobile: </span>{patient.phone || '—'}</div>
        <div><span className="text-slate-500">Blood group: </span>{patient.blood_group || '—'}</div>
        <div><span className="text-slate-500">{full ? 'Visits' : 'Date'}: </span><b>{full ? visits.length : fmtDate(visits[0]?.visit_date)}</b></div>
        {patient.address && <div className="col-span-2"><span className="text-slate-500">Address: </span>{patient.address}</div>}
        {patient.allergies && <div className="text-rose-700"><span>Allergies: </span><b>{patient.allergies}</b></div>}
      </div>

      {visits.map((v, i) => <div key={v.id} className={full && i > 0 ? 'mt-6 border-t border-slate-200 pt-1' : ''}><VisitBlock v={v} patient={patient} showHeader={full} /></div>)}

      {!full && (
        <div className="avoid-break mt-12 flex items-end justify-between text-[11px] text-slate-500">
          <div>Printed {fmtDate(new Date().toISOString().slice(0, 10))}</div>
          <div className="text-center"><div className="mb-1 h-10 w-48 border-b border-slate-400" />{doctor.doctor_name || 'Doctor'}’s signature</div>
        </div>
      )}
      <footer className="mt-8 border-t border-slate-200 pt-2 text-center text-[10px] text-slate-400">
        Keep this sheet for your next visit · Access your records online with Case ID {caseFmt(patient.case_no)} · Generated by CareNest
      </footer>
    </article>
  );
}
