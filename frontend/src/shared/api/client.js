const base = import.meta.env?.VITE_API_URL || '/api/v1/';
const key = 'forestguard.refresh';
let access = null;
let refreshing = null;
let generation = 0;
const listeners = new Set();
export const onSessionExpired = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
export function clearSession() {
  generation += 1;
  access = null;
  sessionStorage.removeItem(key);
  listeners.forEach((listener) => listener());
}
function save(tokens) {
  access = tokens.access;
  if (tokens.refresh) sessionStorage.setItem(key, tokens.refresh);
}
export function apiUrl(path) {
  const root = new URL(base, window.location.origin);
  const url = new URL(path, root);
  // API-generated absolute links may contain the Django proxy host. Keep requests
  // on the configured API origin and never send credentials to arbitrary hosts.
  if (!url.pathname.startsWith(root.pathname)) throw new Error('Ruta de API no permitida.');
  return new URL(url.pathname + url.search, root.origin).href;
}
export class ApiError extends Error {
  constructor(status, data) {
    const describe = (value) => typeof value === 'object' && value !== null
      ? Object.entries(value).map(([name, detail]) => `${/^\d+$/.test(name) || name === 'detail' ? '' : name + ': '}${describe(detail)}`).join(' · ')
      : String(value);
    super(describe(data)); this.status = status; this.data = data;
  }
}
async function parse(response, binary) {
  if (!response.ok) {
    const data = await response.json().catch(() => ({ detail: `Error HTTP ${response.status}` }));
    throw new ApiError(response.status, data);
  }
  if (binary) return response.blob();
  return response.status === 204 ? null : response.json();
}
export async function refreshSession() {
  if (refreshing) return refreshing;
  const refresh = sessionStorage.getItem(key);
  if (!refresh) return false;
  const version = generation;
  refreshing = (async () => {
    try {
      const response = await fetch(apiUrl('auth/token/refresh/'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh }),
      });
      const tokens = await parse(response);
      if (version !== generation) return false;
      save(tokens); return true;
    } catch (error) {
      if (version === generation) clearSession();
      throw error;
    } finally { refreshing = null; }
  })();
  return refreshing;
}
export async function request(path, { body, auth = true, binary = false, ...options } = {}) {
  const token = access;
  const headers = new Headers(options.headers);
  if (auth && token) headers.set('Authorization', `Bearer ${token}`);
  if (body && !(body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const send = () => fetch(apiUrl(path), { ...options, headers, body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body) });
  let response = await send();
  if (response.status === 401 && auth) {
    if ((access && access !== token) || await refreshSession()) {
      headers.set('Authorization', `Bearer ${access}`); response = await send();
    }
    if (response.status === 401) clearSession();
  }
  return parse(response, binary);
}
export async function login(credentials) {
  const tokens = await request('auth/token/', { method: 'POST', body: credentials, auth: false });
  generation += 1; save(tokens);
}
export async function logout() {
  // Wait for a rotation already in flight before revoking the current refresh.
  try { if (refreshing) await refreshing; } catch { /* session already cleared */ }
  const refresh = sessionStorage.getItem(key);
  try { if (refresh) await request('auth/logout/', { method: 'POST', body: { refresh } }); }
  finally { clearSession(); }
}
export async function download(path, filename) {
  const blob = await request(path, { binary: true });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
