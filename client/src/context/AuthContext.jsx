import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokens } from '../lib/api';
import { applyTheme } from '../lib/themes';

const Ctx = createContext(null);
const CLINIC_KEY = 'cn.clinic';

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: !!tokens.staff(), user: null, clinics: [] });
  const [clinicId, setClinicIdRaw] = useState(() => Number(localStorage.getItem(CLINIC_KEY)) || null);

  const setClinicId = useCallback((id) => {
    setClinicIdRaw(id);
    localStorage.setItem(CLINIC_KEY, String(id));
  }, []);

  const accept = useCallback((data) => {
    setState({ loading: false, user: data.user, clinics: data.clinics || [] });
    const ids = (data.clinics || []).map((c) => c.id);
    setClinicIdRaw((cur) => (ids.includes(cur) ? cur : ids[0] || null));
  }, []);

  const refresh = useCallback(async () => {
    if (!tokens.staff()) return setState({ loading: false, user: null, clinics: [] });
    try { accept(await api.get('/auth/me')); } catch { tokens.setStaff(null); setState({ loading: false, user: null, clinics: [] }); }
  }, [accept]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const h = (e) => { if (!e.detail?.patient) { tokens.setStaff(null); setState({ loading: false, user: null, clinics: [] }); } };
    window.addEventListener('cn:unauthorized', h);
    return () => window.removeEventListener('cn:unauthorized', h);
  }, []);

  const clinic = state.clinics.find((c) => c.id === clinicId) || state.clinics[0] || null;
  useEffect(() => { if (clinic) applyTheme(clinic.theme); }, [clinic?.id, clinic?.theme]); // eslint-disable-line

  const value = useMemo(() => ({
    ...state,
    clinic,
    clinicId: clinic?.id || null,
    isDoctor: state.user?.role === 'doctor',
    setClinicId,
    refresh,
    login: async (email, password) => { const d = await api.post('/auth/login', { email, password }); tokens.setStaff(d.token); accept(d); return d; },
    register: async (body) => { const d = await api.post('/auth/register', body); tokens.setStaff(d.token); accept(d); return d; },
    logout: () => { tokens.setStaff(null); setState({ loading: false, user: null, clinics: [] }); },
    upsertClinic: (c) => setState((s) => ({ ...s, clinics: s.clinics.some((x) => x.id === c.id) ? s.clinics.map((x) => (x.id === c.id ? { ...x, ...c } : x)) : [...s.clinics, c] })),
    setUser: (user) => setState((s) => ({ ...s, user })),
  }), [state, clinic, setClinicId, refresh, accept]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
