const API_BASE = '/api';
const TOKEN_KEY = 'shiftsync:token';

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null): void {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  issues: string[];
  warnings: string[];
  constructor(message: string, status: number, issues: string[] = [], warnings: string[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.issues = issues;
    this.warnings = warnings;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
  const data: unknown = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const parsed = data as { error?: string; issues?: string[]; warnings?: string[] };
    throw new ApiError(parsed?.error ?? `Request failed (${res.status})`, res.status, parsed?.issues, parsed?.warnings);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>('GET', path),
  post: <T>(path: string, body?: unknown): Promise<T> => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown): Promise<T> => request<T>('PATCH', path, body),
  put: <T>(path: string, body?: unknown): Promise<T> => request<T>('PUT', path, body),
  del: <T>(path: string): Promise<T> => request<T>('DELETE', path),
};

export function joinLocationIds(ids?: string[]): string {
  return ids && ids.length ? `?locationIds=${ids.join(',')}` : '';
}
