const STAFF_KEY = 'cn.token';
const PATIENT_KEY = 'cn.ptoken';

export const tokens = {
  staff: () => localStorage.getItem(STAFF_KEY),
  patient: () => sessionStorage.getItem(PATIENT_KEY),
  setStaff: (t) => (t ? localStorage.setItem(STAFF_KEY, t) : localStorage.removeItem(STAFF_KEY)),
  setPatient: (t) => (t ? sessionStorage.setItem(PATIENT_KEY, t) : sessionStorage.removeItem(PATIENT_KEY)),
};

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function request(method, url, body, { patient = false } = {}) {
  const token = patient ? tokens.patient() : tokens.staff();
  let res;
  try {
    res = await fetch(`/api${url}`, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Is the backend running?');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !url.includes('login')) window.dispatchEvent(new CustomEvent('cn:unauthorized', { detail: { patient } }));
    throw new ApiError(res.status, data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  get: (u, o) => request('GET', u, null, o),
  post: (u, b, o) => request('POST', u, b || {}, o),
  patch: (u, b, o) => request('PATCH', u, b, o),
  del: (u, o) => request('DELETE', u, null, o),
};
