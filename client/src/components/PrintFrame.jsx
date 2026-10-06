import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Printer, ArrowLeft, Download, Loader2 } from 'lucide-react';
import { downloadPdf } from '../lib/pdf';

export default function PrintFrame({ title, filename, children, back, autoPrint, autoDownload }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    document.title = title;
    if (autoPrint) { const t = setTimeout(() => window.print(), 600); return () => clearTimeout(t); }
    return undefined;
  }, [title, autoPrint]);
  useEffect(() => {
    if (!autoDownload) return undefined;
    const t = setTimeout(() => download(), 500);
    return () => clearTimeout(t);
  }, [autoDownload]); // eslint-disable-line

  async function download() {
    const sheet = ref.current?.querySelector('.print-sheet');
    if (!sheet) return;
    setBusy(true);
    try { await downloadPdf(sheet, `${filename || title}.pdf`); toast.success('PDF downloaded'); } catch (e) { toast.error(`Could not create PDF: ${e.message}`); } finally { setBusy(false); }
  }

  return (
    <div className="light-scope min-h-dvh bg-slate-100/70 pb-10 text-ink print:bg-white print:pb-0">
      <div className="no-print sticky top-0 z-10 mb-6 border-b border-line bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-[210mm] items-center gap-2 px-4 py-3">
          {back ? <button onClick={back} className="btn-ghost"><ArrowLeft size={16} /> Back</button> : <button onClick={() => window.close()} className="btn-ghost"><ArrowLeft size={16} /> Close</button>}
          <div className="flex-1 truncate text-sm font-semibold text-muted max-sm:hidden">{title}</div>
          <div className="flex-1 sm:hidden" />
          <button onClick={download} disabled={busy} className="btn-soft">{busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} PDF</button>
          <button onClick={() => window.print()} className="btn-primary"><Printer size={16} /> Print</button>
        </div>
      </div>
      <div ref={ref}>{children}</div>
    </div>
  );
}
