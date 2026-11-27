// lib/password.ts — scrypt password hashes ("scrypt:N:r:p:saltHex:hashHex" — no "$", so compose env files leave it alone). Node only.
import 'server-only'
import { scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, N, r, p, saltHex, hashHex] = parts
  const expected = Buffer.from(hashHex, 'hex')
  const got = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: 256 * 1024 * 1024,
  })
  return got.length === expected.length && timingSafeEqual(got, expected)
}
