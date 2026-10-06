// Sessions live in httpOnly cookies set by the server, so no token is ever stored in JavaScript.
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(method, url, body, { patient = false } = {}) {
  let res;
  try {
    res = await fetch(`/api${url}`, {
      method,
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'CareNest', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Is the backend running?');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !url.includes('login')) window.dispatchEvent(new CustomEvent('cn:unauthorized', { detail: { patient } }));
    if (res.status === 403 && data.error === 'Please set a new password first') window.dispatchEvent(new CustomEvent('cn:password-required'));
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

/** Patient-specific data kept on this device (drafts) is wiped at sign-out. */
export function clearLocalClinicalData() {
  try {
    Object.keys(sessionStorage).filter((k) => k.startsWith('cn.draft.')).forEach((k) => sessionStorage.removeItem(k));
  } catch { /* storage unavailable */ }
}
