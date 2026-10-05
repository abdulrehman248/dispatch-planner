import type { Location, PlanInput, TripPlan } from './types';

const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

function errorMessage(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(errorMessage).join(' ');
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(
        ([key, detail]) =>
          `${key === 'detail' ? '' : `${key.replaceAll('_', ' ')}: `}${errorMessage(detail)}`,
      )
      .join(' ');
  }
  return 'Something went wrong. Please try again.';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const timeout = AbortSignal.timeout(100_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  try {
    const response = await fetch(`${base}${path}`, {
      ...options,
      signal,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    const json: unknown = await response.json().catch(() => ({
      detail: 'The server is starting or temporarily unavailable. Please try again in a moment.',
    }));
    if (!response.ok) throw new Error(errorMessage(json));
    return json as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError')
      throw new Error(
        'The server took too long to respond. Please try again; free hosting may need a minute to wake up.',
      );
    if (error instanceof TypeError)
      throw new Error('Cannot reach the trip service. Check your connection and try again.');
    throw error;
  }
}

export const searchLocations = (q: string, signal: AbortSignal) =>
  request<{ results: Location[] }>(`/locations/?q=${encodeURIComponent(q)}`, { signal });
export const createPlan = (input: PlanInput) =>
  request<TripPlan>('/plan/', { method: 'POST', body: JSON.stringify(input) });
