// POST /api/plan/draft {"outline": …, "startDate": "YYYY-MM-DD"} → a draft trip with real places
// (not saved). Streams newline-delimited JSON: {"progress": "…"} lines, then {"draft": …} or
// {"error": "…"} — progress keeps slow lookups from timing out behind the proxy.
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { handler, parseBody } from '@/lib/http'
import { dateSchema, outlineSchema } from '@/lib/schemas'
import { buildDraft } from '@/lib/server/planner'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export const POST = handler(async (req: NextRequest) => {
  const { outline, startDate } = await parseBody(req, z.object({ outline: outlineSchema, startDate: dateSchema }))
  const enc = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + '\n'))
      try {
        const draft = await buildDraft(outline, startDate, (progress) => send({ progress }))
        send({ draft })
      } catch (err) {
        send({ error: err instanceof Error ? err.message : 'Could not build the trip' })
      } finally {
        controller.close()
      }
    },
  })
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' } })
})
