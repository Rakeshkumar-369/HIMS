export const inr = (n, opts = {}) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0, ...opts }).format(Number(n || 0));

export const compactInr = (n) => {
  const v = Number(n || 0);
  const a = Math.abs(v);
  if (a >= 1e7) return `₹${(v / 1e7).toFixed(1)}Cr`;
  if (a >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
  if (a >= 1e3) return `₹${(v / 1e3).toFixed(1)}k`;
  return `₹${v}`;
};

export const num = (n) => new Intl.NumberFormat('en-IN').format(Number(n || 0));

const d = (iso) => (iso ? new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso.replace(' ', 'T')) : null);

export const fmtDate = (iso, o = { day: '2-digit', month: 'short', year: 'numeric' }) => (iso ? d(iso).toLocaleDateString('en-IN', o) : '—');
export const fmtShort = (iso) => fmtDate(iso, { day: 'numeric', month: 'short' });
export const fmtTime = (iso) => (iso ? d(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '');
export const fmtDay = (iso) => fmtDate(iso, { weekday: 'long', day: 'numeric', month: 'long' });

export const todayISO = () => {
  const n = new Date();
  return new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const caseFmt = (c) => (c ? `${c.slice(0, 3)} ${c.slice(3, 6)} ${c.slice(6)}` : '');

export const initials = (name = '') =>
  name.replace(/^(Dr\.|Sr\.|Mr\.|Mrs\.|Ms\.)\s*/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();

export const ageSex = (p) => [p.age != null ? `${p.age} y` : null, p.gender?.[0]].filter(Boolean).join(' · ');

export function bmi(w, h) {
  if (!w || !h) return null;
  return +(w / (h / 100) ** 2).toFixed(1);
}

/** Returns 'high' | 'low' | null for simple vital range hints */
export function vitalFlag(key, v, v2) {
  if (v == null || v === '') return null;
  const n = Number(v);
  switch (key) {
    case 'bp': return n >= 140 || Number(v2) >= 90 ? 'high' : n < 90 ? 'low' : null;
    case 'pulse': return n > 100 ? 'high' : n < 60 ? 'low' : null;
    case 'temperature': return n >= 99.5 ? 'high' : n < 96 ? 'low' : null;
    case 'spo2': return n < 95 ? 'low' : null;
    case 'blood_sugar': return n >= 200 ? 'high' : n < 70 ? 'low' : null;
    case 'bmi': return n >= 25 ? 'high' : n < 18.5 ? 'low' : null;
    default: return null;
  }
}

/** Running balance for statements: "₹12,400 due" / "₹500 advance" */
export const balanceText = (n) => `${inr(Math.abs(n))}${n > 0 ? ' due' : n < 0 ? ' advance' : ''}`;
