import { useCallback, useEffect, useRef, useState } from 'react';
import { getModePref, resolvedMode } from './themes';
import { api, tokens } from './api';

/** Fetch JSON on mount / when deps change. Returns { data, error, loading, reload, setData }. */
export function useFetch(url, deps = [], opts) {
  const [state, setState] = useState({ data: null, error: null, loading: !!url });
  const seq = useRef(0);
  const load = useCallback(async (silent = false) => {
    if (!url) return;
    const id = ++seq.current;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api.get(url, opts);
      if (id === seq.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (id === seq.current) setState((s) => ({ ...s, error, loading: false }));
    }
  }, [url]); // eslint-disable-line
  useEffect(() => { load(); }, [load, ...deps]); // eslint-disable-line
  return { ...state, reload: load, setData: (fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })) };
}

/** Subscribe to the clinic's live channel (Server-Sent Events). */
export function useLive(clinicId, onEvent) {
  const handler = useRef(onEvent);
  handler.current = onEvent;
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!clinicId) return undefined;
    const es = new EventSource(`/api/live/${clinicId}?token=${encodeURIComponent(tokens.staff() || '')}`);
    const on = (type) => (e) => handler.current?.(type, JSON.parse(e.data || '{}'));
    es.addEventListener('hello', () => setConnected(true));
    es.addEventListener('queue', on('queue'));
    es.addEventListener('display', on('display'));
    es.onerror = () => setConnected(false);
    return () => { es.close(); setConnected(false); };
  }, [clinicId]);
  return connected;
}

export function useHotkey(combo, fn) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const h = (e) => {
      const tag = e.target.tagName;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.target.isContentEditable;
      const k = e.key.toLowerCase();
      if (combo === 'mod+k' && (e.metaKey || e.ctrlKey) && k === 'k') { e.preventDefault(); ref.current(e); }
      else if (combo.length === 1 && !typing && !e.metaKey && !e.ctrlKey && !e.altKey && k === combo) { e.preventDefault(); ref.current(e); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [combo]);
}

export function useMedia(q) {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const h = () => setM(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [q]);
  return m;
}

/** Listen to live events dispatched by the app shell. */
export function useLiveEvents(fn) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const h = (e) => ref.current(e.detail);
    window.addEventListener('cn:live', h);
    return () => window.removeEventListener('cn:live', h);
  }, []);
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
