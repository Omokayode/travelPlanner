// lib/http.ts — small helpers shared by the API route handlers
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z, ZodTypeAny } from 'zod'

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

const MAX_BODY_BYTES = 6 * 1024 * 1024 // receipts are still stored inline (up to ~5 MB)

/** Parse and validate a JSON body; throws HttpError(400) with a short reason. */
export async function parseBody<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  if (Number(req.headers.get('content-length') || 0) > MAX_BODY_BYTES) throw new HttpError(413, 'Request too large')
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    throw new HttpError(400, 'Body must be JSON')
  }
  const r = schema.safeParse(raw)
  if (!r.success) {
    const i = r.error.issues[0]
    throw new HttpError(400, `Invalid ${i.path.join('.') || 'body'}: ${i.message}`)
  }
  return r.data
}

/** Wrap a route handler: HttpError → its status, Prisma "not found" → 404, anything else → 500. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args)
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status })
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      console.error(err)
      return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }
  }
}

export const notFound = () => new HttpError(404, 'Not found')
