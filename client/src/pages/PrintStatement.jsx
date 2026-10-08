import { useParams } from 'react-router-dom';
import { useAuth } from '../context/authCtx';
import { useFetch } from '../lib/hooks';
import { PageLoader } from '../components/ui';
import PrintFrame from '../components/PrintFrame';
import { palette } from '../lib/themes';
import { fmtDate, inr, balanceText, todayISO } from '../lib/format';

/** A4 statement of account — for a vendor (what we owe them) or a workplace (what they owe the doctor). */
export default function PrintStatement() {
  const { kind, id } = useParams();
  const { user, clinics } = useAuth();
  const isVendor = kind === 'vendor';
  const { data, error } = useFetch(isVendor ? `/vendors/${id}` : `/practice/workplaces/${id}`);
  if (error) return <p className="p-10 text-center text-rose-600">{error.message}</p>;
  if (!data) return <PageLoader />;

  const party = isVendor ? data.vendor : data.workplace;
  const clinic = isVendor && party.clinic_id ? clinics.find((c) => c.id === party.clinic_id) : null;
  const p = palette(clinic?.theme || party.theme || 'mint');
  const rows = data.statement;
  const billed = rows.reduce((s, r) => s + r.debit, 0);
  const paid = rows.reduce((s, r) => s + r.credit, 0);
  const closing = rows.at(-1)?.balance || 0;
  const fromName = clinic ? clinic.name : user.full_name;
  const fromLines = clinic
    ? [[clinic.address, clinic.city].filter(Boolean).join(', '), [clinic.phone, clinic.email].filter(Boolean).join(' · ')]
    : [[user.qualification, user.registration_no && `Reg. No ${user.registration_no}`].filter(Boolean).join(' · '), [user.phone, user.email].filter(Boolean).join(' · ')];

  return (
    <PrintFrame title={`Statement · ${party.name}`} filename={`Statement-${party.name.replace(/\W+/g, '-')}-${todayISO()}`}>
      <article className="print-sheet mx-auto w-[210mm] max-w-full bg-white p-[12mm] text-slate-900 shadow-lift sm:rounded-2xl">
        <header className="flex items-start justify-between gap-6 border-b-2 pb-4" style={{ borderColor: p[400] }}>
          <div>
            <h1 className="text-[22px] leading-tight font-extrabold" style={{ color: p[800] }}>{fromName}</h1>
            {fromLines.filter(Boolean).map((l) => <div key={l} className="text-[11.5px] text-slate-600">{l}</div>)}
          </div>
          <div className="text-right">
            <div className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: p[600] }}>Statement of account</div>
            <div className="mt-1 text-[11.5px] text-slate-600">As on {fmtDate(todayISO())}</div>
          </div>
        </header>

        <div className="mt-4 grid grid-cols-2 gap-6 rounded-xl px-4 py-3 text-[12.5px]" style={{ background: p[50] }}>
          <div>
            <div className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">{isVendor ? 'Vendor' : 'Billed to'}</div>
            <div className="font-bold">{party.name}</div>
            <div className="text-slate-600">{[party.address, party.city].filter(Boolean).join(', ')}</div>
            <div className="text-slate-600">{[party.contact_person, party.phone].filter(Boolean).join(' · ')}</div>
            {party.gstin && <div className="text-slate-600">GSTIN {party.gstin}</div>}
          </div>
          <div className="grid grid-cols-2 gap-y-1">
            <span className="text-slate-500">{isVendor ? 'Total billed' : 'Total billed'}</span><b className="text-right tabular">{inr(billed)}</b>
            <span className="text-slate-500">{isVendor ? 'Total paid' : 'Received (incl. TDS)'}</span><b className="text-right tabular">{inr(paid)}</b>
            <span className="text-slate-500">{isVendor ? 'Balance payable' : 'Balance due'}</span><b className="text-right text-[14px] tabular" style={{ color: p[800] }}>{inr(Math.max(closing, 0))}</b>
          </div>
        </div>

        <table className="mt-5 w-full border-collapse text-[11.5px]">
          <thead>
            <tr style={{ background: p[50] }}>
              {['Date', 'Description', 'Ref', isVendor ? 'Bill' : 'Billed', isVendor ? 'Paid' : 'Received', 'Balance'].map((h, i) => (
                <th key={h} className={`border border-slate-200 px-2 py-1.5 font-semibold ${i >= 3 ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="avoid-break">
                <td className="border border-slate-200 px-2 py-1 whitespace-nowrap">{fmtDate(r.date)}</td>
                <td className="border border-slate-200 px-2 py-1">{r.description}</td>
                <td className="border border-slate-200 px-2 py-1">{r.ref || ''}</td>
                <td className="border border-slate-200 px-2 py-1 text-right tabular">{r.debit ? inr(r.debit) : ''}</td>
                <td className="border border-slate-200 px-2 py-1 text-right tabular">{r.credit ? inr(r.credit) : ''}</td>
                <td className="border border-slate-200 px-2 py-1 text-right font-semibold tabular">{balanceText(r.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <footer className="mt-8 border-t border-slate-200 pt-2 text-center text-[10px] text-slate-400">Generated by CareNest on {fmtDate(todayISO())}</footer>
      </article>
    </PrintFrame>
  );
}
