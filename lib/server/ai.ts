// lib/server/ai.ts — optional AI through Ollama (self-hosted). Only used to read a trip request
// written in plain words into an outline; places always come from OpenStreetMap, never the model.
//
//   OLLAMA_URL    e.g. http://100.81.70.42:11434 (server-side only; Ollama has no login, keep it private)
//   OLLAMA_MODEL  default model (Settings → AI can choose another installed one)
import 'server-only'
import { z } from 'zod'
import prisma from '@/lib/db'
import { INTERESTS, hintsFromText, type TripOutline } from '@/lib/domain/plan'

export const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b'

export function ollamaUrl(): string | null {
  const u = process.env.OLLAMA_URL?.trim()
  return u ? u.replace(/\/+$/, '') : null
}

export async function aiModel(): Promise<string> {
  const s = await prisma.appSettings.findUnique({ where: { id: 'singleton' }, select: { aiModel: true } })
  return s?.aiModel || DEFAULT_MODEL
}

export class AiError extends Error {}

/** Installed models, or null if Ollama is not set up / not reachable. */
export async function listModels(): Promise<{ name: string; sizeGb: number }[] | null> {
  const base = ollamaUrl()
  if (!base) return null
  try {
    const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(5000), cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { models?: { name: string; size: number }[] }
    return (data.models || []).map((m) => ({ name: m.name, sizeGb: Math.round(m.size / 1e8) / 10 }))
  } catch {
    return null
  }
}

/** One chat turn that must answer with JSON matching `schema` (Ollama structured outputs). */
async function chatJson(schema: object, system: string, user: string, timeoutMs = 180_000): Promise<unknown> {
  const base = ollamaUrl()
  if (!base) throw new AiError('AI is not set up (OLLAMA_URL)')
  let res: Response
  try {
    res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model: await aiModel(),
        stream: false,
        format: schema,
        options: { temperature: 0.2 },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    })
  } catch (err) {
    throw new AiError(err instanceof Error && err.name === 'TimeoutError' ? 'The AI took too long' : 'Could not reach the AI')
  }
  if (!res.ok) throw new AiError(`The AI answered ${res.status}`)
  const data = (await res.json()) as { message?: { content?: string } }
  try {
    return JSON.parse(data.message?.content || '')
  } catch {
    throw new AiError('The AI did not answer in the expected format')
  }
}

// What the model must return for a trip request.
const OUTLINE_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    startCity: { type: 'string' },
    startState: { type: 'string' },
    startDate: { type: 'string', description: 'YYYY-MM-DD, or empty if not given' },
    stays: {
      type: 'array',
      items: {
        type: 'object',
        properties: { city: { type: 'string' }, state: { type: 'string' }, nights: { type: 'integer' } },
        required: ['city', 'nights'],
      },
    },
    returnHome: { type: 'boolean' },
    interests: { type: 'array', items: { type: 'string', enum: [...INTERESTS] } },
    pace: { type: 'string', enum: ['relaxed', 'normal', 'packed'] },
    mode: { type: 'string', enum: ['drive', 'flight', 'train'] },
  },
  required: ['name', 'startCity', 'stays', 'returnHome', 'interests', 'pace', 'mode'],
}

const outlineAnswer = z.object({
  name: z.string().max(120).catch('My trip'),
  startCity: z.string().max(120).catch(''),
  startState: z.string().max(80).optional().catch(undefined),
  startDate: z.string().optional().catch(undefined),
  stays: z
    .array(z.object({ city: z.string().max(120), state: z.string().max(80).optional().catch(undefined), nights: z.coerce.number().int().min(1).max(30).catch(1) }))
    .max(20)
    .catch([]),
  returnHome: z.boolean().catch(true),
  interests: z.array(z.string()).catch([]),
  pace: z.enum(['relaxed', 'normal', 'packed']).catch('normal'),
  mode: z.enum(['drive', 'flight', 'train']).catch('drive'),
})

/** Plain words → an outline (cities not yet looked up). */
export async function readTripRequest(text: string, today: string, homeCity?: string | null): Promise<TripOutline> {
  const system = [
    'You turn a travel request into a JSON trip outline. Answer with JSON only.',
    `Today is ${today}.`,
    homeCity ? `If the request does not say where the trip starts, it starts in ${homeCity}.` : '',
    'stays: the cities where the traveller sleeps, in order, with the number of nights in each (whole numbers, at least 1).',
    'Use real city names with their US state (or country). Do not invent cities.',
    'If a total length is given (e.g. "5 days"), nights across all stays = days - 1.',
    'returnHome: true unless the request is one-way.',
    `interests: pick only from ${INTERESTS.join(', ')}.`,
    'startDate: YYYY-MM-DD if a date is given or clear (e.g. "next Friday", "Dec 18"); otherwise empty.',
    'name: a short trip name, e.g. "Arizona in December".',
  ]
    .filter(Boolean)
    .join('\n')
  const raw = outlineAnswer.parse(await chatJson(OUTLINE_SCHEMA, system, text.slice(0, 2000)))
  // small models get plain facts wrong; what the words say outright wins
  const hints = hintsFromText(text)
  const modelInterests = raw.interests.filter((i): i is (typeof INTERESTS)[number] => (INTERESTS as readonly string[]).includes(i))
  const interests = Array.from(new Set([...hints.interests, ...modelInterests]))
  const [homeName, homeState] = (homeCity || '').split(',').map((s) => s.trim())
  const start = hints.start ?? (homeName ? { name: homeName, state: homeState || undefined } : { name: raw.startCity.trim(), state: raw.startState?.trim() || undefined })
  return {
    name: raw.name.trim() || 'My trip',
    start,
    stays: raw.stays
      .filter((s) => s.city.trim() && s.city.trim().toLowerCase() !== start.name.toLowerCase())
      .map((s) => ({ city: { name: s.city.trim(), state: s.state?.trim() || undefined }, nights: s.nights })),
    returnHome: !hints.oneWay,
    startDate: raw.startDate && /^\d{4}-\d{2}-\d{2}$/.test(raw.startDate) && raw.startDate >= today ? raw.startDate : undefined,
    interests: interests.length ? interests : ['sights', 'food'],
    pace: raw.pace,
    mode: raw.mode,
  }
}
