let cachedCsrfToken: string | null = null;

export async function fetchCsrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;
  try {
    const res = await fetch('/api/v1/auth/csrf', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      cachedCsrfToken = data.csrfToken;
      return data.csrfToken;
    }
  } catch {
    // Fallback or retry
  }
  return '';
}

export function invalidateCsrfToken(): void {
  cachedCsrfToken = null;
}

export interface ApiError {
  error: string;
  message: string;
  status: number;
  details?: Array<{ field: string; message: string }>;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const method = options.method?.toUpperCase() || 'GET';
  const headers = new Headers(options.headers || {});

  headers.set('Accept', 'application/json');

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }
    const token = await fetchCsrfToken();
    if (token) {
      headers.set('X-CSRF-Token', token);
    }
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    if (response.status === 403 && data?.message?.includes('CSRF')) {
      invalidateCsrfToken();
    }
    const err: ApiError = {
      status: response.status,
      error: data?.error || 'Request Failed',
      message: data?.message || `HTTP error ${response.status}`,
      details: data?.details,
    };
    throw err;
  }

  return data as T;
}
