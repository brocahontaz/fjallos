import { verify } from '@node-rs/bcrypt'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'
import { db } from '@/db/client'
import { sessions } from '@/db/schema'

const auth = new Hono()

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return false
  }
  entry.count++
  return true
}

function generateId(): string {
  return crypto.randomUUID()
}

function generateCsrfToken(): string {
  return crypto.randomUUID()
}

auth.post('/login', async (c) => {
  const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown'

  if (!checkRateLimit(ip)) {
    return c.json({ error: 'Too many login attempts. Try again in 15 minutes.' }, 429)
  }

  let body: { username?: string; password?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid request body' }, 400)
  }

  const username = (body.username ?? '').trim()
  const password = body.password ?? ''

  const ownerUsername = process.env.OWNER_USERNAME ?? 'admin'
  const ownerPasswordHash = process.env.OWNER_PASSWORD_HASH ?? ''

  let role: 'owner' | 'guest'

  if (username === ownerUsername && ownerPasswordHash) {
    let isValid = false
    try {
      isValid = await verify(password, ownerPasswordHash)
    } catch {
      isValid = false
    }
    if (!isValid) {
      return c.json({ success: false, error: 'Login incorrect.' }, 401)
    }
    role = 'owner'
  } else {
    role = 'guest'
  }

  const now = new Date().toISOString()
  await db.delete(sessions).where(eq(sessions.expiresAt, now))

  const sessionId = generateId()
  const csrfToken = generateCsrfToken()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  await db.insert(sessions).values({
    id: sessionId,
    role,
    csrfToken,
    expiresAt,
  })

  setCookie(c, 'session_id', sessionId, {
    httpOnly: true,
    sameSite: 'Strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(expiresAt),
  })

  return c.json({ success: true, role, csrf_token: csrfToken })
})

auth.post('/logout', async (c) => {
  const cookieHeader = c.req.header('Cookie')
  const sessionId = cookieHeader?.match(/session_id=([^;]+)/)?.[1]
  if (sessionId) {
    await db.delete(sessions).where(eq(sessions.id, sessionId))
  }
  deleteCookie(c, 'session_id', { path: '/' })
  return c.json({ success: true })
})

export { auth }
