// GET /api/ai/status — is AI planning available, which model, which models are installed.
import { NextResponse } from 'next/server'
import { handler } from '@/lib/http'
import { aiModel, listModels, ollamaUrl } from '@/lib/server/ai'

export const dynamic = 'force-dynamic'

export const GET = handler(async () => {
  const configured = !!ollamaUrl()
  const models = configured ? await listModels() : null
  return NextResponse.json({ configured, reachable: !!models, model: await aiModel(), models: models ?? [] })
})
