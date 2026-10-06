// Apply light/dark before the first paint to avoid a white flash.
try {
  var m = localStorage.getItem('cn.mode') || 'system';
  if (m === 'system') m = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.mode = m;
} catch { /* storage unavailable */ }
