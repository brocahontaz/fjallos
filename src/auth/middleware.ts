import { db } from '@/db/client'
import { sessions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'

export type SessionRole = 'owner' | 'guest'

export interface SessionData {
  id: string
  role: SessionRole
  csrfToken: string
}

declare module 'hono' {
  interface ContextVariableMap {
    session: SessionData
  }
}

export const sessionMiddleware = createMiddleware(async (c, next) => {
  const sessionId = getCookie(c, 'session_id')
  if (!sessionId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const now = new Date().toISOString()
  const session = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1)
    .then((rows) => rows[0])

  if (!session || session.expiresAt < now) {
    return c.json({ error: 'Session expired' }, 401)
  }

  c.set('session', {
    id: session.id,
    role: session.role as SessionRole,
    csrfToken: session.csrfToken,
  })

  await next()
})

export const requireOwner = createMiddleware(async (c, next) => {
  const session = c.get('session')
  if (!session || session.role !== 'owner') {
    return c.json({ error: 'Forbidden' }, 403)
  }
  await next()
})

export const csrfMiddleware = createMiddleware(async (c, next) => {
  const method = c.req.method
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const sessionId = getCookie(c, 'session_id')
    if (!sessionId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const csrfHeader = c.req.header('HX-CSRF-Token') ?? c.req.header('X-CSRF-Token')

    const session = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1)
      .then((rows) => rows[0])

    if (!session || csrfHeader !== session.csrfToken) {
      return c.json({ error: 'CSRF validation failed' }, 403)
    }
  }
  await next()
})
