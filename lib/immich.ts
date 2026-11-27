// lib/immich.ts — server-only Immich access. The API key never leaves the server.
import 'server-only'
import prisma from '@/lib/db'

export interface ImmichConfig {
  baseUrl: string
  apiKey: string
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Env vars win (set in docker-compose / secrets); otherwise the values saved on the Settings page. */
export async function getImmichConfig(): Promise<ImmichConfig | null> {
  const s = await prisma.appSettings.findUnique({ where: { id: 'singleton' } })
  const baseUrl = (process.env.IMMICH_URL || s?.immichUrl || '').trim().replace(/\/+$/, '').replace(/\/api$/, '')
  const apiKey = (process.env.IMMICH_API_KEY || s?.immichApiKey || '').trim()
  if (!baseUrl || !apiKey) return null
  return { baseUrl, apiKey }
}

export class ImmichError extends Error {
  constructor(public status: number) {
    super(`Immich returned ${status}`)
  }
}

export async function immichFetch(cfg: ImmichConfig, path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${cfg.baseUrl}/api${path}`, {
    ...init,
    headers: { 'x-api-key': cfg.apiKey, Accept: 'application/json', ...(init?.headers || {}) },
    cache: 'no-store',
  })
  if (!res.ok) throw new ImmichError(res.status)
  return res
}

export async function immichJson<T>(cfg: ImmichConfig, path: string): Promise<T> {
  return (await immichFetch(cfg, path)).json() as Promise<T>
}
