import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthCtx } from './authCtx';
import { api, clearLocalClinicalData } from '../lib/api';
import { applyTheme } from '../lib/themes';

const CLINIC_KEY = 'cn.clinic';
const SIGNED_OUT = { loading: false, user: null, clinics: [] };

const storedClinic = () => {
  try { return Number(localStorage.getItem(CLINIC_KEY)) || null; } catch { return null; }
};

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, clinics: [] });
  const [clinicId, setClinicIdRaw] = useState(storedClinic);

  const setClinicId = useCallback((id) => {
    setClinicIdRaw(id);
    try { localStorage.setItem(CLINIC_KEY, String(id)); } catch { /* storage unavailable */ }
  }, []);

  const accept = useCallback((data) => {
    if (!data.user) return setState(SIGNED_OUT);
    setState({ loading: false, user: data.user, clinics: data.clinics || [] });
    const ids = (data.clinics || []).map((c) => c.id);
    setClinicIdRaw((cur) => (ids.includes(cur) ? cur : ids[0] || null));
  }, []);

  const refresh = useCallback(() => api.get('/auth/session').then(accept, () => setState(SIGNED_OUT)), [accept]);

  useEffect(() => {
    api.get('/auth/session').then(accept, () => setState(SIGNED_OUT));
  }, [accept]);
  useEffect(() => {
    const onUnauthorized = (e) => { if (!e.detail?.patient) setState(SIGNED_OUT); };
    const onPasswordRequired = () => setState((s) => (s.user ? { ...s, user: { ...s.user, must_change_password: true } } : s));
    window.addEventListener('cn:unauthorized', onUnauthorized);
    window.addEventListener('cn:password-required', onPasswordRequired);
    return () => {
      window.removeEventListener('cn:unauthorized', onUnauthorized);
      window.removeEventListener('cn:password-required', onPasswordRequired);
    };
  }, []);

  const clinic = state.clinics.find((c) => c.id === clinicId) || state.clinics[0] || null;
  const theme = clinic?.theme;
  useEffect(() => { if (theme) applyTheme(theme); }, [theme]);

  const value = useMemo(() => ({
    ...state,
    clinic,
    clinicId: clinic?.id || null,
    isDoctor: state.user?.role === 'doctor',
    isAdmin: state.user?.role === 'admin',
    setClinicId,
    refresh,
    login: async (email, password) => { const d = await api.post('/auth/login', { email, password }); accept(d); return d; },
    register: async (body) => { const d = await api.post('/auth/register', body); accept(d); return d; },
    logout: async () => {
      try { await api.post('/auth/logout'); } catch { /* already signed out */ }
      clearLocalClinicalData();
      setState(SIGNED_OUT);
    },
    upsertClinic: (c) => setState((s) => ({ ...s, clinics: s.clinics.some((x) => x.id === c.id) ? s.clinics.map((x) => (x.id === c.id ? { ...x, ...c } : x)) : [...s.clinics, c] })),
    setUser: (user) => setState((s) => ({ ...s, user })),
  }), [state, clinic, setClinicId, refresh, accept]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

