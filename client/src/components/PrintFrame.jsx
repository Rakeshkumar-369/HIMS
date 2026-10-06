import { useEffect } from 'react';
import { Printer, ArrowLeft } from 'lucide-react';

export default function PrintFrame({ title, children, back, autoPrint }) {
  useEffect(() => {
    document.title = title;
    if (autoPrint) { const t = setTimeout(() => window.print(), 600); return () => clearTimeout(t); }
    return undefined;
  }, [title, autoPrint]);
  return (
    <div className="min-h-dvh bg-slate-100/70 pb-10 print:bg-white print:pb-0">
      <div className="no-print sticky top-0 z-10 mb-6 border-b border-line bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-[210mm] items-center gap-3 px-4 py-3">
          {back ? <button onClick={back} className="btn-ghost"><ArrowLeft size={16} /> Back</button> : <button onClick={() => window.close()} className="btn-ghost"><ArrowLeft size={16} /> Close</button>}
          <div className="flex-1 truncate text-sm font-semibold text-muted">{title}</div>
          <button onClick={() => window.print()} className="btn-primary"><Printer size={16} /> Print / Save PDF</button>
        </div>
      </div>
      {children}
    </div>
  );
}
