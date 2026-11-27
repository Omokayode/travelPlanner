'use client'
// lib/client.ts — browser helpers: one way to call the API, and one way to show errors.

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

/**
 * Call our API and return the JSON. Throws ApiError with the server's message on any non-2xx
 * (so a failed save never gets treated as data). A 401 sends the browser to the login page.
 */
export async function api<T = unknown>(url: string, method: Method = 'GET', body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Could not reach the server — check your connection')
  }
  const data = await res.json().catch(() => null)
  if (res.status === 401 && typeof window !== 'undefined' && !url.startsWith('/api/auth/')) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`
  }
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string } | null)?.error || `Request failed (${res.status})`)
  return data as T
}

// ── toasts ────────────────────────────────────────────────────────────────────
export interface ToastMessage {
  id: number
  kind: 'error' | 'info'
  text: string
}
type Listener = (t: ToastMessage) => void
const listeners = new Set<Listener>()
let seq = 0

export function onToast(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export const toast = {
  error(text: string) {
    const t: ToastMessage = { id: ++seq, kind: 'error', text }
    listeners.forEach((l) => l(t))
  },
  info(text: string) {
    const t: ToastMessage = { id: ++seq, kind: 'info', text }
    listeners.forEach((l) => l(t))
  },
}

/** Show an error from a failed call (ApiError message or a generic one). */
export function reportError(err: unknown, fallback = 'Something went wrong') {
  toast.error(err instanceof Error && err.message ? err.message : fallback)
}
