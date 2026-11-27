// lib/server/receipts.ts — expense receipts as files instead of base64 text in the database.
//
// Files live in RECEIPTS_DIR (default ./data/receipts; /app/data/receipts in the Docker image,
// which should be a mounted volume). Names are random; the database keeps only the name.
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { HttpError } from '@/lib/http'
import { RECEIPT_DATA_URL } from '@/lib/schemas'

const MAX_BYTES = 4 * 1024 * 1024 // decoded; the data: URL is ~1.37× that

export const receiptsDir = () => path.resolve(process.env.RECEIPTS_DIR || path.join(process.cwd(), 'data', 'receipts'))

const TYPES: Record<string, { ext: string; magic: (b: Buffer) => boolean }> = {
  'image/png': { ext: 'png', magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/jpeg': { ext: 'jpg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/gif': { ext: 'gif', magic: (b) => b.subarray(0, 4).toString('latin1') === 'GIF8' },
  'image/webp': { ext: 'webp', magic: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
  'image/heic': { ext: 'heic', magic: (b) => b.subarray(4, 8).toString('latin1') === 'ftyp' },
  'image/heif': { ext: 'heif', magic: (b) => b.subarray(4, 8).toString('latin1') === 'ftyp' },
  'application/pdf': { ext: 'pdf', magic: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
}
const BY_EXT = Object.fromEntries(Object.entries(TYPES).map(([type, t]) => [t.ext, type]))

/** True for a new upload (as opposed to the URL of a stored receipt). */
export const isReceiptUpload = (v: string | null | undefined): v is string => !!v && RECEIPT_DATA_URL.test(v)

/** Decode a data: URL, check it really is that kind of file. */
export function decodeReceipt(dataUrl: string): { type: string; bytes: Buffer } {
  const m = /^data:([a-z/]+);base64,([A-Za-z0-9+/=\r\n]*)$/.exec(dataUrl)
  const type = m?.[1] ?? ''
  if (!m || !TYPES[type]) throw new HttpError(400, 'Receipt must be a PNG, JPEG, GIF, WebP, HEIC image or a PDF')
  const bytes = Buffer.from(m[2], 'base64')
  if (bytes.length > MAX_BYTES) throw new HttpError(413, 'Receipt is too large (max 4 MB)')
  if (!TYPES[type].magic(bytes)) throw new HttpError(400, 'Receipt file does not match its type')
  return { type, bytes }
}

/** Store an uploaded receipt; returns the file name to keep on the expense. */
export async function saveReceipt(dataUrl: string): Promise<string> {
  const { type, bytes } = decodeReceipt(dataUrl)
  const dir = receiptsDir()
  await mkdir(dir, { recursive: true, mode: 0o700 })
  const name = `${randomUUID()}.${TYPES[type].ext}`
  await writeFile(path.join(dir, name), bytes, { mode: 0o600, flag: 'wx' })
  return name
}

const SAFE_NAME = /^[0-9a-f-]{36}\.[a-z]{3,4}$/

export async function readReceipt(name: string): Promise<{ type: string; bytes: Buffer } | null> {
  const type = BY_EXT[name.split('.').pop() || '']
  if (!SAFE_NAME.test(name) || !type) return null
  try {
    return { type, bytes: await readFile(path.join(receiptsDir(), name)) }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

/** Remove a stored receipt; a missing file is fine. */
export async function deleteReceipt(name: string | null | undefined) {
  if (!name || !SAFE_NAME.test(name)) return
  try {
    await unlink(path.join(receiptsDir(), name))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') console.error('Could not delete receipt', name, err)
  }
}
