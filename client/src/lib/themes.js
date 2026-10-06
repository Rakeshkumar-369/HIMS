// Pastel theme engine. Each theme is a hue + chroma; the 10-step scale is generated in OKLCH
// so every theme has the same perceived lightness (= equally readable).
// Dark mode uses the same hue with its own (inverted) lightness steps.
export const THEMES = [
  { id: 'mint', name: 'Mint', hue: 165, chroma: 1 },
  { id: 'lavender', name: 'Lavender', hue: 295, chroma: 0.95 },
  { id: 'peach', name: 'Peach', hue: 45, chroma: 0.95 },
  { id: 'sky', name: 'Sky', hue: 235, chroma: 0.95 },
  { id: 'rose', name: 'Rose', hue: 355, chroma: 0.9 },
  { id: 'sage', name: 'Sage', hue: 135, chroma: 0.6 },
  { id: 'butter', name: 'Butter', hue: 85, chroma: 0.95 },
  { id: 'ocean', name: 'Ocean', hue: 205, chroma: 1 },
];

const LIGHT = { 50: [0.98, 0.016], 100: [0.955, 0.033], 200: [0.91, 0.06], 300: [0.85, 0.09], 400: [0.77, 0.115],
  500: [0.68, 0.125], 600: [0.57, 0.12], 700: [0.48, 0.1], 800: [0.39, 0.08], 900: [0.31, 0.06] };
const DARK = { 50: [0.25, 0.025], 100: [0.29, 0.04], 200: [0.35, 0.055], 300: [0.44, 0.075], 400: [0.56, 0.1],
  500: [0.66, 0.115], 600: [0.72, 0.115], 700: [0.79, 0.1], 800: [0.87, 0.07], 900: [0.93, 0.04] };

export function themeSpec(id) {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

/** Light palette by default — used for print sheets, swatches and anything that must look the same in both modes. */
export function palette(id, mode = 'light') {
  const t = themeSpec(id);
  const steps = mode === 'dark' ? DARK : LIGHT;
  // yellow hues need to be darker to stay readable on white
  const shift = mode === 'light' && t.hue > 70 && t.hue < 110 ? -0.04 : 0;
  return Object.fromEntries(Object.entries(steps).map(([k, [l, c]]) => [k, `oklch(${(Number(k) >= 500 ? l + shift : l).toFixed(3)} ${(c * t.chroma).toFixed(3)} ${t.hue})`]));
}

// ---- Light / dark mode -------------------------------------------------
const MODE_KEY = 'cn.mode';
const mq = () => window.matchMedia('(prefers-color-scheme: dark)');
let currentTheme = 'mint';

export function getModePref() {
  try { return localStorage.getItem(MODE_KEY) || 'system'; } catch { return 'system'; }
}
export function resolvedMode(pref = getModePref()) {
  return pref === 'system' ? (mq().matches ? 'dark' : 'light') : pref;
}
export function setModePref(pref) {
  try { localStorage.setItem(MODE_KEY, pref); } catch { /* private mode */ }
  applyTheme(currentTheme);
  window.dispatchEvent(new CustomEvent('cn:mode', { detail: { pref, mode: resolvedMode(pref) } }));
}

export function applyTheme(id = currentTheme) {
  currentTheme = id;
  const mode = resolvedMode();
  const p = palette(id, mode);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(p)) root.style.setProperty(`--brand-${k}`, v);
  root.dataset.theme = themeSpec(id).id;
  root.dataset.mode = mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'dark' ? '#16181d' : p[100]);
}

// follow the OS when the preference is "system"
if (typeof window !== 'undefined') {
  mq().addEventListener('change', () => {
    if (getModePref() === 'system') {
      applyTheme(currentTheme);
      window.dispatchEvent(new CustomEvent('cn:mode', { detail: { pref: 'system', mode: resolvedMode() } }));
    }
  });
}
