// Pastel theme engine. Each theme is a hue + chroma; the 10-step scale is generated in OKLCH
// so every theme has the same perceived lightness (= equally readable).
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

const STEPS = { 50: [0.98, 0.016], 100: [0.955, 0.033], 200: [0.91, 0.06], 300: [0.85, 0.09], 400: [0.77, 0.115],
  500: [0.68, 0.125], 600: [0.57, 0.12], 700: [0.48, 0.1], 800: [0.39, 0.08], 900: [0.31, 0.06] };

export function themeSpec(id) {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

export function palette(id) {
  const t = themeSpec(id);
  // yellow hues need to be darker to stay readable on white
  const shift = t.hue > 70 && t.hue < 110 ? -0.04 : 0;
  return Object.fromEntries(Object.entries(STEPS).map(([k, [l, c]]) => [k, `oklch(${(Number(k) >= 500 ? l + shift : l).toFixed(3)} ${(c * t.chroma).toFixed(3)} ${t.hue})`]));
}

export function applyTheme(id) {
  const p = palette(id);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(p)) root.style.setProperty(`--brand-${k}`, v);
  root.dataset.theme = themeSpec(id).id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p[100]);
}
