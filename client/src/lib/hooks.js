import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { api } from './api';
import { getModePref, resolvedMode } from './themes';

/** Keep a ref pointing at the latest callback without re-subscribing effects. */
function useLatest(fn) {
  const ref = useRef(fn);
  useLayoutEffect(() => { ref.current = fn; });
  return ref;
}

/**
 * GET a URL and re-fetch whenever the URL changes (null = don't fetch).
 * `keep: true` keeps showing the previous result while the next one loads (filters, date ranges).
 */
export function useFetch(url, { keep = false } = {}) {
  const [state, setState] = useState({ key: null, data: null, error: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!url) return undefined;
    let live = true;
    api.get(url)
      .then((data) => { if (live) setState({ key: url, data, error: null }); })
      .catch((error) => { if (live) setState((s) => ({ ...s, key: url, error })); });
    return () => { live = false; };
  }, [url, nonce]);

  const fresh = state.key === url;
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })), []);
  return {
    data: fresh || keep ? state.data : null,
    error: fresh ? state.error : null,
    loading: !!url && !fresh,
    reload,
    setData,
  };
}

/** Subscribe to the clinic's live channel (Server-Sent Events, authenticated by the session cookie). */
export function useLive(clinicId, onEvent) {
  const handler = useLatest(onEvent);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!clinicId) return undefined;
    const es = new EventSource(`/api/live/${clinicId}`, { withCredentials: true });
    const on = (type) => (e) => handler.current?.(type, JSON.parse(e.data || '{}'));
    es.addEventListener('hello', () => setConnected(true));
    es.addEventListener('queue', on('queue'));
    es.addEventListener('display', on('display'));
    es.onerror = () => setConnected(false);
    return () => { es.close(); setConnected(false); };
  }, [clinicId, handler]);
  return connected;
}

export function useHotkey(combo, fn) {
  const ref = useLatest(fn);
  useEffect(() => {
    const h = (e) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable;
      const k = e.key.toLowerCase();
      if (combo === 'mod+k' && (e.metaKey || e.ctrlKey) && k === 'k') { e.preventDefault(); ref.current(e); }
      else if (combo.length === 1 && !typing && !e.metaKey && !e.ctrlKey && !e.altKey && k === combo) { e.preventDefault(); ref.current(e); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [combo, ref]);
}

/** Listen to live events dispatched by the app shell. */
export function useLiveEvents(fn) {
  const ref = useLatest(fn);
  useEffect(() => {
    const h = (e) => ref.current(e.detail);
    window.addEventListener('cn:live', h);
    return () => window.removeEventListener('cn:live', h);
  }, [ref]);
}

export function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Current light/dark preference and resolved mode; re-renders when either changes. */
export function useMode() {
  const [state, setState] = useState(() => ({ pref: getModePref(), mode: resolvedMode() }));
  useEffect(() => {
    const h = (e) => setState({ pref: e.detail.pref, mode: e.detail.mode });
    window.addEventListener('cn:mode', h);
    return () => window.removeEventListener('cn:mode', h);
  }, []);
  return state;
}

/** True while the CSS media query matches (e.g. '(min-width: 1024px)'). */
export function useMedia(query) {
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia(query); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
