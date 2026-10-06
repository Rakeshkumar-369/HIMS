// Turns an on-screen A4 case sheet into a real, downloadable PDF file (works on phones too).
// Libraries are loaded only when the button is pressed, so they never slow the app down.

const A4_W_MM = 210;
const A4_H_MM = 297;
const MARGIN_MM = 12; // top/bottom margin on continuation pages
const SHEET_PX = 794; // 210 mm at 96 dpi

export async function downloadPdf(sheetEl, filename) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')]);

  // Lay the sheet out at true A4 width off-screen, whatever the device width is.
  const host = document.createElement('div');
  host.className = 'light-scope';
  Object.assign(host.style, { position: 'fixed', left: '-10000px', top: '0', width: `${SHEET_PX}px`, background: '#fff' });
  const clone = sheetEl.cloneNode(true);
  Object.assign(clone.style, { width: `${SHEET_PX}px`, maxWidth: 'none', boxShadow: 'none', borderRadius: '0', margin: '0' });
  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    await document.fonts?.ready;
    // Places where a page may break without cutting a block in half
    const top = clone.getBoundingClientRect().top;
    const breaks = [...clone.querySelectorAll('section, .avoid-break, tr, header, footer, p, li')]
      .map((el) => el.getBoundingClientRect().bottom - top)
      .sort((a, b) => a - b);

    const scale = 2;
    const canvas = await html2canvas(clone, { scale, backgroundColor: '#ffffff', useCORS: true, logging: false });
    const pxPerMm = canvas.width / A4_W_MM;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

    let y = 0; // in CSS px of the clone
    let page = 0;
    const totalPx = canvas.height / scale;
    while (y < totalPx - 2) {
      const offsetMm = page === 0 ? 0 : MARGIN_MM;
      const availPx = ((A4_H_MM - offsetMm - MARGIN_MM) * pxPerMm) / scale;
      let end = Math.min(y + availPx, totalPx);
      if (end < totalPx) {
        const safe = breaks.filter((b) => b > y + availPx * 0.5 && b <= end).pop();
        if (safe) end = safe;
      }
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = Math.ceil((end - y) * scale);
      slice.getContext('2d').drawImage(canvas, 0, y * scale, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
      if (page > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, offsetMm, A4_W_MM, slice.height / pxPerMm);
      y = end;
      page += 1;
    }
    pdf.save(filename);
  } finally {
    host.remove();
  }
}
