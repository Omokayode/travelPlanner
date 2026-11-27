// lib/session.ts — signed session cookie. Web Crypto only, so it runs in middleware (edge) and in Node.
export const SESSION_COOKIE = 'tp_session'
export const SESSION_DAYS = 30

const enc = new TextEncoder()

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('')
}

function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function sessionSecret(): string | null {
  const s = process.env.SESSION_SECRET || ''
  return s.length >= 32 ? s : null
}

/** Cookie value: "<expiry seconds>.<hmac>" */
export async function createSession(secret: string, now = Date.now()): Promise<{ value: string; maxAge: number }> {
  const maxAge = SESSION_DAYS * 24 * 3600
  const exp = Math.floor(now / 1000) + maxAge
  return { value: `${exp}.${await hmac(secret, `v1.${exp}`)}`, maxAge }
}

export async function verifySession(secret: string, value: string | undefined, now = Date.now()): Promise<boolean> {
  if (!value) return false
  const [expStr, sig] = value.split('.')
  const exp = Number(expStr)
  if (!Number.isInteger(exp) || !sig || exp < now / 1000) return false
  return sameString(sig, await hmac(secret, `v1.${exp}`))
}

export function authDisabled(): boolean {
  return process.env.AUTH_DISABLED === 'true'
}
